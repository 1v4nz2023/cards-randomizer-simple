import { dbRun, dbGet, dbAll } from '../db.js'

/**
 * Get all decks owned by a user, with summary card counts.
 */
export async function getDecksByUser(userId) {
  const sql = `
    SELECT 
      d.id,
      d.user_id,
      d.name,
      d.format,
      d.created_at,
      d.updated_at,
      COALESCE(SUM(CASE WHEN dc.section = 'main' THEN dc.quantity ELSE 0 END), 0) AS main_count,
      COALESCE(SUM(CASE WHEN dc.section = 'extra' THEN dc.quantity ELSE 0 END), 0) AS extra_count,
      COALESCE(SUM(CASE WHEN dc.section = 'side' THEN dc.quantity ELSE 0 END), 0) AS side_count,
      COALESCE(SUM(dc.quantity), 0) AS total_cards
    FROM decks d
    LEFT JOIN deck_cards dc ON d.id = dc.deck_id
    WHERE d.user_id = ?
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `
  return await dbAll(sql, [userId])
}

/**
 * Get a single deck by ID and user_id, including all assigned deck_cards.
 */
export async function getDeckById(deckId, userId) {
  const deckSql = `SELECT * FROM decks WHERE id = ? AND user_id = ?`
  const deck = await dbGet(deckSql, [deckId, userId])
  if (!deck) return null

  const cardsSql = `
    SELECT 
      dc.id AS deck_card_id,
      dc.deck_id,
      dc.inventory_card_id,
      dc.section,
      dc.quantity AS assigned_quantity,
      ic.card_id,
      ic.card_code,
      ic.quantity AS inventory_total_quantity,
      ic.condition,
      ic.set_name,
      ic.rarity,
      ic.binder_page,
      ic.binder_slot,
      ic.notes
    FROM deck_cards dc
    JOIN inventory_cards ic ON dc.inventory_card_id = ic.id
    WHERE dc.deck_id = ?
    ORDER BY dc.id ASC
  `
  const deckCards = await dbAll(cardsSql, [deckId])

  return {
    ...deck,
    cards: deckCards,
  }
}

/**
 * Create a new deck.
 */
export async function createDeck(userId, { name, format }) {
  const now = new Date().toISOString()
  const sql = `
    INSERT INTO decks (user_id, name, format, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `
  const res = await dbRun(sql, [userId, name, format || 'TCG', now, now])
  return await getDeckById(res.lastID, userId)
}

/**
 * Update deck metadata (name, format).
 */
export async function updateDeck(deckId, userId, { name, format }) {
  const existing = await dbGet('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  if (!existing) return null

  const now = new Date().toISOString()
  const sql = `
    UPDATE decks
    SET name = COALESCE(?, name),
        format = COALESCE(?, format),
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `
  await dbRun(sql, [name || null, format || null, now, deckId, userId])
  return await getDeckById(deckId, userId)
}

/**
 * Delete a deck (cascade deletes deck_cards and frees availability).
 */
export async function deleteDeck(deckId, userId) {
  const existing = await dbGet('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  if (!existing) return false

  await dbRun('DELETE FROM deck_cards WHERE deck_id = ?', [deckId])
  await dbRun('DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  return true
}

/**
 * Get availability and location tags for a specific inventory_cards entry.
 */
export async function getInventoryCardAvailability(inventoryCardId, userId) {
  const invSql = `SELECT * FROM inventory_cards WHERE id = ? AND user_id = ?`
  const invCard = await dbGet(invSql, [inventoryCardId, userId])
  if (!invCard) return null

  const assignedSql = `
    SELECT 
      dc.id AS deck_card_id,
      dc.deck_id,
      dc.section,
      dc.quantity,
      d.name AS deck_name
    FROM deck_cards dc
    JOIN decks d ON dc.deck_id = d.id
    WHERE dc.inventory_card_id = ? AND d.user_id = ?
  `
  const assignments = await dbAll(assignedSql, [inventoryCardId, userId])
  const assignedCopies = assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
  const availableCopies = Math.max(0, (invCard.quantity || 1) - assignedCopies)

  // Build human-readable location tags
  const locations = []
  if (invCard.binder_page) {
    locations.push(`Página ${invCard.binder_page} (Binder)`)
  }

  assignments.forEach((a) => {
    const secLabel = a.section.charAt(0).toUpperCase() + a.section.slice(1)
    locations.push(`Deck: ${a.deck_name} (${secLabel}) [x${a.quantity}]`)
  })

  if (locations.length === 0) {
    locations.push('Sin ubicar (Libre en Binder)')
  }

  return {
    inventory_card_id: invCard.id,
    card_id: invCard.card_id,
    total_owned: invCard.quantity || 1,
    assigned_copies: assignedCopies,
    available_quantity: availableCopies,
    assignments,
    location_summary: locations.join(' | '),
    locations,
  }
}

/**
 * Get total copies of a card_id assigned in a specific deck across all sections.
 */
export async function getDeckCardTotalCopies(deckId, cardId) {
  const sql = `
    SELECT COALESCE(SUM(dc.quantity), 0) AS total_copies
    FROM deck_cards dc
    JOIN inventory_cards ic ON dc.inventory_card_id = ic.id
    WHERE dc.deck_id = ? AND ic.card_id = ?
  `
  const row = await dbGet(sql, [deckId, String(cardId)])
  return row ? row.total_copies : 0
}

/**
 * Assign a card from binder to a deck section.
 */
export async function assignCardToDeck(deckId, userId, { inventory_card_id, section, quantity = 1 }) {
  const deck = await dbGet('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  if (!deck) throw new Error('Deck no encontrado.')

  const availability = await getInventoryCardAvailability(inventory_card_id, userId)
  if (!availability) throw new Error('Carta del binder no encontrada.')

  const qtyToAssign = parseInt(quantity, 10) || 1
  if (qtyToAssign <= 0) throw new Error('La cantidad debe ser mayor a 0.')

  if (qtyToAssign > availability.available_quantity) {
    throw new Error(`No hay suficientes copias disponibles. Posees ${availability.total_owned}, asignadas ${availability.assigned_copies}, libres: ${availability.available_quantity}.`)
  }

  // Check if card is already assigned to this exact section in this deck
  const existingAssignment = await dbGet(
    'SELECT * FROM deck_cards WHERE deck_id = ? AND inventory_card_id = ? AND section = ?',
    [deckId, inventory_card_id, section]
  )

  const currentDeckTotal = await getDeckCardTotalCopies(deckId, availability.card_id)
  if (currentDeckTotal + qtyToAssign > 3) {
    throw new Error(`Regla de Yu-Gi-Oh!: No puedes tener más de 3 copias de una misma carta en el mismo deck (actualmente tienes ${currentDeckTotal} en este deck).`)
  }

  const now = new Date().toISOString()
  await dbRun('UPDATE decks SET updated_at = ? WHERE id = ?', [now, deckId])

  if (existingAssignment) {
    const newQty = existingAssignment.quantity + qtyToAssign
    await dbRun('UPDATE deck_cards SET quantity = ? WHERE id = ?', [newQty, existingAssignment.id])
    return await getDeckById(deckId, userId)
  }

  await dbRun(
    'INSERT INTO deck_cards (deck_id, inventory_card_id, section, quantity) VALUES (?, ?, ?, ?)',
    [deckId, inventory_card_id, section, qtyToAssign]
  )

  return await getDeckById(deckId, userId)
}

/**
 * Update quantity or section of a card in a deck.
 */
export async function updateDeckCard(deckCardId, deckId, userId, { section, quantity }) {
  const deck = await dbGet('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  if (!deck) throw new Error('Deck no encontrado.')

  const existingDc = await dbGet('SELECT * FROM deck_cards WHERE id = ? AND deck_id = ?', [deckCardId, deckId])
  if (!existingDc) throw new Error('Carta no encontrada en el deck.')

  const newQty = quantity !== undefined ? parseInt(quantity, 10) : existingDc.quantity
  const newSection = section || existingDc.section

  if (newQty <= 0) {
    return await removeDeckCard(deckCardId, deckId, userId)
  }

  // Check availability difference
  const qtyDiff = newQty - existingDc.quantity
  if (qtyDiff > 0) {
    const availability = await getInventoryCardAvailability(existingDc.inventory_card_id, userId)
    if (qtyDiff > availability.available_quantity) {
      throw new Error(`No hay suficientes copias disponibles libres en tu binder (libres: ${availability.available_quantity}).`)
    }

    const currentDeckTotal = await getDeckCardTotalCopies(deckId, availability.card_id)
    if (currentDeckTotal + qtyDiff > 3) {
      throw new Error(`Regla de Yu-Gi-Oh!: Excede el límite de 3 copias por carta en el deck.`)
    }
  }

  const now = new Date().toISOString()
  await dbRun('UPDATE decks SET updated_at = ? WHERE id = ?', [now, deckId])

  await dbRun('UPDATE deck_cards SET section = ?, quantity = ? WHERE id = ?', [newSection, newQty, deckCardId])
  return await getDeckById(deckId, userId)
}

/**
 * Remove a card from a deck (frees copies back to binder).
 */
export async function removeDeckCard(deckCardId, deckId, userId) {
  const deck = await dbGet('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId])
  if (!deck) throw new Error('Deck no encontrado.')

  await dbRun('DELETE FROM deck_cards WHERE id = ? AND deck_id = ?', [deckCardId, deckId])

  const now = new Date().toISOString()
  await dbRun('UPDATE decks SET updated_at = ? WHERE id = ?', [now, deckId])

  return await getDeckById(deckId, userId)
}
