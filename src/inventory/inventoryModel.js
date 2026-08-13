import { dbRun, dbGet, dbAll } from '../db.js'

export async function getInventoryByUser(userId) {
  return await dbAll(
    'SELECT * FROM inventory_cards WHERE user_id = ? ORDER BY binder_page ASC, binder_slot ASC, updated_at DESC',
    [userId]
  )
}

export async function getInventoryItemById(id, userId) {
  return await dbGet(
    'SELECT * FROM inventory_cards WHERE id = ? AND user_id = ?',
    [id, userId]
  )
}

export async function addInventoryCard(userId, data) {
  const updatedAt = new Date().toISOString()
  const cardCode = (data.card_code || '').trim()
  const setRarity = (data.rarity || '').trim()
  const conditionVal = data.condition || 'Near Mint'
  const setNameVal = (data.set_name || '').trim()
  const pageVal = data.binder_page ? parseInt(data.binder_page, 10) : null
  const slotVal = data.binder_slot ? parseInt(data.binder_slot, 10) : null
  const addQty = parseInt(data.quantity, 10) || 1

  // Check if an identical card entry already exists for this user
  const existingItem = await dbGet(
    `SELECT * FROM inventory_cards
     WHERE user_id = ?
       AND card_id = ?
       AND UPPER(COALESCE(card_code, '')) = UPPER(?)
       AND LOWER(COALESCE(rarity, '')) = LOWER(?)
       AND COALESCE(condition, '') = ?
       AND LOWER(COALESCE(set_name, '')) = LOWER(?)
       AND COALESCE(binder_page, -1) = COALESCE(?, -1)
       AND COALESCE(binder_slot, -1) = COALESCE(?, -1)`,
    [
      userId,
      data.card_id,
      cardCode,
      setRarity,
      conditionVal,
      setNameVal,
      pageVal,
      slotVal,
    ]
  )

  if (existingItem) {
    const updatedQty = (parseInt(existingItem.quantity, 10) || 1) + addQty
    await dbRun(
      `UPDATE inventory_cards SET quantity = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [updatedQty, updatedAt, existingItem.id, userId]
    )
    return await getInventoryItemById(existingItem.id, userId)
  }

  const result = await dbRun(
    `INSERT INTO inventory_cards (
      user_id, card_id, card_code, quantity, condition, set_name, rarity, binder_page, binder_slot, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.card_id,
      cardCode || null,
      addQty,
      conditionVal,
      setNameVal || null,
      setRarity || null,
      pageVal,
      slotVal,
      data.notes || null,
      updatedAt,
    ]
  )
  return await getInventoryItemById(result.lastID, userId)
}

export async function updateInventoryCard(id, userId, data) {
  const updatedAt = new Date().toISOString()
  await dbRun(
    `UPDATE inventory_cards SET
      card_code = COALESCE(?, card_code),
      quantity = COALESCE(?, quantity),
      condition = COALESCE(?, condition),
      set_name = COALESCE(?, set_name),
      rarity = COALESCE(?, rarity),
      binder_page = COALESCE(?, binder_page),
      binder_slot = COALESCE(?, binder_slot),
      notes = COALESCE(?, notes),
      updated_at = ?
    WHERE id = ? AND user_id = ?`,
    [
      data.card_code !== undefined ? data.card_code : null,
      data.quantity !== undefined ? data.quantity : null,
      data.condition !== undefined ? data.condition : null,
      data.set_name !== undefined ? data.set_name : null,
      data.rarity !== undefined ? data.rarity : null,
      data.binder_page !== undefined ? (data.binder_page ? parseInt(data.binder_page, 10) : null) : null,
      data.binder_slot !== undefined ? (data.binder_slot ? parseInt(data.binder_slot, 10) : null) : null,
      data.notes !== undefined ? data.notes : null,
      updatedAt,
      id,
      userId,
    ]
  )
  return await getInventoryItemById(id, userId)
}

export async function deleteInventoryCard(id, userId) {
  const result = await dbRun(
    'DELETE FROM inventory_cards WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return result.changes > 0
}
