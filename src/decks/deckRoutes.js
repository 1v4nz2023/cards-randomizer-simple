import { Router } from 'express'
import { authMiddleware } from '../auth/authMiddleware.js'
import {
  getDecksByUser,
  getDeckById,
  createDeck,
  updateDeck,
  deleteDeck,
  getInventoryCardAvailability,
  assignCardToDeck,
  updateDeckCard,
  removeDeckCard,
} from './deckModel.js'
import { findCardById, getCardsCatalog } from '../inventory/cardSearch.js'
import { getInventoryByUser } from '../inventory/inventoryModel.js'

const router = Router()
router.use(authMiddleware)

/**
 * Enrich deck cards with full catalog metadata (name, type, images, attributes).
 */
async function enrichDeckCards(deck) {
  if (!deck || !deck.cards) return deck

  const enrichedCards = await Promise.all(
    deck.cards.map(async (item) => {
      const cardDetails = (await findCardById(item.card_id)) || {}
      return {
        ...item,
        card_name: cardDetails.name || 'Carta desconocida',
        card_type: cardDetails.type || '',
        humanReadableCardType: cardDetails.humanReadableCardType || cardDetails.type || '',
        attribute: cardDetails.attribute || '',
        race: cardDetails.race || '',
        level: cardDetails.level || null,
        atk: cardDetails.atk !== undefined ? cardDetails.atk : null,
        def: cardDetails.def !== undefined ? cardDetails.def : null,
        desc: cardDetails.desc || cardDetails.description || '',
        imageSmall: cardDetails.imageSmall || '',
        imageFull: cardDetails.imageFull || '',
      }
    })
  )

  const main = enrichedCards.filter((c) => c.section === 'main')
  const extra = enrichedCards.filter((c) => c.section === 'extra')
  const side = enrichedCards.filter((c) => c.section === 'side')

  return {
    ...deck,
    cards: enrichedCards,
    sections: {
      main,
      extra,
      side,
    },
  }
}

// GET /api/decks - List all decks of user
router.get('/', async (req, res) => {
  try {
    const decks = await getDecksByUser(req.user.id)
    res.json({ success: true, data: decks })
  } catch (err) {
    console.error('Error fetching decks:', err)
    res.status(500).json({ success: false, error: 'Error al obtener los decks.' })
  }
})

// POST /api/decks/import-ydk - Import a YDK file directly to create a new deck
router.post('/import-ydk', async (req, res) => {
  try {
    const { name, format, ydkContent } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del deck es obligatorio.' })
    }
    if (!ydkContent) {
      return res.status(400).json({ success: false, error: 'El contenido del archivo .ydk es obligatorio.' })
    }

    const parseYdkSections = (text) => {
      const lines = text.split(/\r?\n/)
      let currentSection = 'main'
      const mainIds = []
      const extraIds = []
      const sideIds = []

      for (let line of lines) {
        line = line.trim()
        if (!line) continue
        if (line.startsWith('#main')) {
          currentSection = 'main'
          continue
        }
        if (line.startsWith('#extra')) {
          currentSection = 'extra'
          continue
        }
        if (line.startsWith('!side')) {
          currentSection = 'side'
          continue
        }
        if (line.startsWith('#') || line.startsWith('!')) continue

        const cardId = line.replace(/[^0-9]/g, '')
        if (cardId) {
          if (currentSection === 'main') mainIds.push(cardId)
          else if (currentSection === 'extra') extraIds.push(cardId)
          else if (currentSection === 'side') sideIds.push(cardId)
        }
      }
      return { mainIds, extraIds, sideIds }
    }

    const { mainIds, extraIds, sideIds } = parseYdkSections(ydkContent)

    // Create the new deck
    const newDeck = await createDeck(req.user.id, { name: name.trim(), format: format || 'TCG' })
    const userInventory = await getInventoryByUser(req.user.id)

    let addedCount = 0
    let missingCount = 0

    const processSection = async (cardIds, section) => {
      // Group IDs by count
      const counts = new Map()
      for (const id of cardIds) counts.set(id, (counts.get(id) || 0) + 1)

      for (const [cardId, targetQty] of counts.entries()) {
        // Find matching inventory items for cardId
        const matchingInvItems = userInventory.filter((item) => String(item.card_id) === String(cardId))

        let remainingToAssign = targetQty

        for (const invItem of matchingInvItems) {
          if (remainingToAssign <= 0) break
          const avail = await getInventoryCardAvailability(invItem.id, req.user.id)
          if (avail && avail.available_quantity > 0) {
            const assignQty = Math.min(remainingToAssign, avail.available_quantity)
            try {
              await assignCardToDeck(newDeck.id, req.user.id, {
                inventory_card_id: invItem.id,
                section,
                quantity: assignQty,
              })
              addedCount += assignQty
              remainingToAssign -= assignQty
            } catch (assignErr) {
              console.warn(`[YDK Import] Skip card ${cardId}:`, assignErr.message)
            }
          }
        }

        if (remainingToAssign > 0) {
          missingCount += remainingToAssign
        }
      }
    }

    await processSection(mainIds, 'main')
    await processSection(extraIds, 'extra')
    await processSection(sideIds, 'side')

    const enriched = await enrichDeckCards(await getDeckById(newDeck.id, req.user.id))

    res.status(201).json({
      success: true,
      message: `¡Deck "${newDeck.name}" creado! Se asignaron ${addedCount} cartas desde tu binder.${missingCount > 0 ? ` (${missingCount} cartas del YDK no estaban disponibles en tu colección).` : ''}`,
      addedCount,
      missingCount,
      data: enriched,
    })
  } catch (err) {
    console.error('Error importing YDK to deck:', err)
    res.status(500).json({ success: false, error: 'Error al importar el archivo YDK al deck.' })
  }
})

// GET /api/decks/:id - Get deck details
router.get('/:id', async (req, res) => {
  try {
    const rawDeck = await getDeckById(req.params.id, req.user.id)
    if (!rawDeck) {
      return res.status(404).json({ success: false, error: 'Deck no encontrado.' })
    }

    const enriched = await enrichDeckCards(rawDeck)
    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error('Error fetching deck:', err)
    res.status(500).json({ success: false, error: 'Error al obtener el deck.' })
  }
})

// GET /api/decks/:id/ydk - Export deck to downloadable YDK file
router.get('/:id/ydk', async (req, res) => {
  try {
    const rawDeck = await getDeckById(req.params.id, req.user.id)
    if (!rawDeck) {
      return res.status(404).json({ success: false, error: 'Deck no encontrado.' })
    }

    const lines = []
    lines.push(`#created with YGO Randomizer Deck Builder - ${rawDeck.name}`)
    lines.push('#main')

    const mainCards = rawDeck.cards.filter((c) => c.section === 'main')
    const extraCards = rawDeck.cards.filter((c) => c.section === 'extra')
    const sideCards = rawDeck.cards.filter((c) => c.section === 'side')

    mainCards.forEach((c) => {
      for (let i = 0; i < c.assigned_quantity; i++) lines.push(c.card_id)
    })

    lines.push('#extra')
    extraCards.forEach((c) => {
      for (let i = 0; i < c.assigned_quantity; i++) lines.push(c.card_id)
    })

    lines.push('!side')
    sideCards.forEach((c) => {
      for (let i = 0; i < c.assigned_quantity; i++) lines.push(c.card_id)
    })

    const ydkContent = lines.join('\n')
    const sanitizeName = rawDeck.name.toLowerCase().replace(/[^a-z0-9]/g, '_')

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeName}.ydk"`)
    res.send(ydkContent)
  } catch (err) {
    console.error('Error exporting deck YDK:', err)
    res.status(500).json({ success: false, error: 'Error al exportar el deck a YDK.' })
  }
})

// POST /api/decks - Create new empty deck
router.post('/', async (req, res) => {
  try {
    const { name, format } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del deck es obligatorio.' })
    }

    const newDeck = await createDeck(req.user.id, { name: name.trim(), format })
    const enriched = await enrichDeckCards(newDeck)
    res.status(201).json({ success: true, data: enriched })
  } catch (err) {
    console.error('Error creating deck:', err)
    res.status(500).json({ success: false, error: 'Error al crear el deck.' })
  }
})

// PUT /api/decks/:id - Update deck metadata
router.put('/:id', async (req, res) => {
  try {
    const updated = await updateDeck(req.params.id, req.user.id, req.body)
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Deck no encontrado.' })
    }

    const enriched = await enrichDeckCards(updated)
    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error('Error updating deck:', err)
    res.status(500).json({ success: false, error: 'Error al actualizar el deck.' })
  }
})

// DELETE /api/decks/:id - Delete deck (frees availability)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteDeck(req.params.id, req.user.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Deck no encontrado.' })
    }

    res.json({ success: true, message: 'Deck eliminado y copias liberadas al binder.' })
  } catch (err) {
    console.error('Error deleting deck:', err)
    res.status(500).json({ success: false, error: 'Error al eliminar el deck.' })
  }
})

// POST /api/decks/:id/cards - Assign card from binder to deck
router.post('/:id/cards', async (req, res) => {
  try {
    const { inventory_card_id, section, quantity } = req.body
    if (!inventory_card_id || !section) {
      return res.status(400).json({ success: false, error: 'inventory_card_id y section son obligatorios.' })
    }

    const validSections = ['main', 'extra', 'side']
    if (!validSections.includes(section)) {
      return res.status(400).json({ success: false, error: 'Sección inválida (debe ser main, extra o side).' })
    }

    // Extra deck validation
    if (section === 'extra') {
      const avail = await getInventoryCardAvailability(inventory_card_id, req.user.id)
      if (avail) {
        const cardDetails = (await findCardById(avail.card_id)) || {}
        const typeStr = (cardDetails.type || cardDetails.humanReadableCardType || '').toLowerCase()
        const extraKeywords = ['fusion', 'synchro', 'xyz', 'link']
        if (!extraKeywords.some((k) => typeStr.includes(k))) {
          return res.status(400).json({
            success: false,
            error: 'Solo se pueden agregar monstruos de Fusión, Sincronía, XYZ o Link al Extra Deck.',
          })
        }
      }
    }

    const updatedDeck = await assignCardToDeck(req.params.id, req.user.id, {
      inventory_card_id,
      section,
      quantity,
    })

    const enriched = await enrichDeckCards(updatedDeck)
    res.status(201).json({ success: true, data: enriched })
  } catch (err) {
    console.error('Error assigning card to deck:', err.message)
    res.status(400).json({ success: false, error: err.message })
  }
})

// PUT /api/decks/:id/cards/:deckCardId - Update card in deck
router.put('/:id/cards/:deckCardId', async (req, res) => {
  try {
    const { section, quantity } = req.body
    const updatedDeck = await updateDeckCard(req.params.deckCardId, req.params.id, req.user.id, {
      section,
      quantity,
    })

    const enriched = await enrichDeckCards(updatedDeck)
    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error('Error updating card in deck:', err.message)
    res.status(400).json({ success: false, error: err.message })
  }
})

// DELETE /api/decks/:id/cards/:deckCardId - Remove card from deck (frees availability)
router.delete('/:id/cards/:deckCardId', async (req, res) => {
  try {
    const updatedDeck = await removeDeckCard(req.params.deckCardId, req.params.id, req.user.id)
    const enriched = await enrichDeckCards(updatedDeck)
    res.json({ success: true, data: enriched, message: 'Carta removida del deck y liberada al binder.' })
  } catch (err) {
    console.error('Error removing card from deck:', err.message)
    res.status(400).json({ success: false, error: err.message })
  }
})

export default router
