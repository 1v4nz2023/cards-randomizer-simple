import { Router } from 'express'
import { authMiddleware } from '../auth/authMiddleware.js'
import {
  getInventoryByUser,
  getInventoryItemById,
  addInventoryCard,
  updateInventoryCard,
  deleteInventoryCard,
} from './inventoryModel.js'
import { searchCardsByName, searchCardsAdvanced, findCardById } from './cardSearch.js'

const router = Router()

// All inventory endpoints require authentication
router.use(authMiddleware)

function formatEnrichedItem(item, cardDetails = {}) {
  return {
    ...item,
    card_name: cardDetails.name || 'Carta desconocida',
    card_type: cardDetails.type || '',
    humanReadableCardType: cardDetails.humanReadableCardType || cardDetails.type || '',
    attribute: cardDetails.attribute || '',
    race: cardDetails.race || '',
    archetype: cardDetails.archetype || '',
    level: cardDetails.level || null,
    atk: cardDetails.atk !== undefined ? cardDetails.atk : null,
    def: cardDetails.def !== undefined ? cardDetails.def : null,
    imageSmall: cardDetails.imageSmall || '',
    imageFull: cardDetails.imageFull || '',
    card_sets: cardDetails.card_sets || [],
  }
}

// GET /api/inventory/search - Search catalog with all advanced filters & YGOPRODeck fallback
router.get('/search', async (req, res) => {
  try {
    const matches = await searchCardsAdvanced(req.query, 35)
    res.json({ success: true, data: matches })
  } catch (err) {
    console.error('Error searching catalog:', err)
    res.status(500).json({ success: false, error: 'Error al buscar en el catálogo.' })
  }
})

// GET /api/inventory/export-ydk - Export user's binder to YDK text format
router.get('/export-ydk', async (req, res) => {
  try {
    const rawItems = await getInventoryByUser(req.user.id)
    const lines = []
    lines.push('#created with YGO Randomizer Binder')
    lines.push('#main')

    const extraDeckKeywords = ['fusion', 'synchro', 'xyz', 'link']
    const mainLines = []
    const extraLines = []

    for (const item of rawItems) {
      const cardDetails = (await findCardById(item.card_id)) || {}
      const qty = parseInt(item.quantity, 10) || 1
      const typeStr = (cardDetails.type || cardDetails.humanReadableCardType || '').toLowerCase()
      const isExtra = extraDeckKeywords.some((k) => typeStr.includes(k))

      for (let i = 0; i < qty; i++) {
        if (isExtra) {
          extraLines.push(item.card_id)
        } else {
          mainLines.push(item.card_id)
        }
      }
    }

    mainLines.forEach((id) => lines.push(id))
    lines.push('#extra')
    extraLines.forEach((id) => lines.push(id))
    lines.push('!side')

    const ydkContent = lines.join('\n')
    const dateStr = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="mi_binder_ygo_${dateStr}.ydk"`)
    res.send(ydkContent)
  } catch (err) {
    console.error('Error exporting YDK:', err)
    res.status(500).json({ success: false, error: 'Error al exportar el archivo YDK.' })
  }
})

// GET /api/inventory - Get all inventory items for current user
router.get('/', async (req, res) => {
  try {
    const rawItems = await getInventoryByUser(req.user.id)

    // Enrich inventory items with card catalog details (name, image, type, attribute, race, level)
    const enrichedItems = await Promise.all(
      rawItems.map(async (item) => {
        const cardDetails = (await findCardById(item.card_id)) || {}
        return formatEnrichedItem(item, cardDetails)
      })
    )

    res.json({ success: true, data: enrichedItems })
  } catch (err) {
    console.error('Error fetching inventory:', err)
    res.status(500).json({ success: false, error: 'Error al obtener el inventario.' })
  }
})

// GET /api/inventory/:id - Get single inventory item
router.get('/:id', async (req, res) => {
  try {
    const item = await getInventoryItemById(req.params.id, req.user.id)
    if (!item) {
      return res.status(404).json({ success: false, error: 'Carta no encontrada en tu binder.' })
    }

    const cardDetails = (await findCardById(item.card_id)) || {}
    res.json({
      success: true,
      data: formatEnrichedItem(item, cardDetails),
    })
  } catch (err) {
    console.error('Error fetching inventory item:', err)
    res.status(500).json({ success: false, error: 'Error al obtener la carta.' })
  }
})

// POST /api/inventory - Add card to inventory
router.post('/', async (req, res) => {
  try {
    const { card_id, card_code, quantity, condition, set_name, rarity, binder_page, binder_slot, notes } = req.body

    if (!card_id) {
      return res.status(400).json({ success: false, error: 'card_id es obligatorio.' })
    }

    const newItem = await addInventoryCard(req.user.id, {
      card_id,
      card_code,
      quantity,
      condition,
      set_name,
      rarity,
      binder_page,
      binder_slot,
      notes,
    })

    const cardDetails = (await findCardById(newItem.card_id)) || {}

    res.status(201).json({
      success: true,
      data: formatEnrichedItem(newItem, cardDetails),
    })
  } catch (err) {
    console.error('Error adding to inventory:', err)
    res.status(500).json({ success: false, error: 'Error al añadir carta al inventario.' })
  }
})

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const existing = await getInventoryItemById(req.params.id, req.user.id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Carta no encontrada en tu binder.' })
    }

    const updatedItem = await updateInventoryCard(req.params.id, req.user.id, req.body)
    const cardDetails = (await findCardById(updatedItem.card_id)) || {}

    res.json({
      success: true,
      data: formatEnrichedItem(updatedItem, cardDetails),
    })
  } catch (err) {
    console.error('Error updating inventory item:', err)
    res.status(500).json({ success: false, error: 'Error al actualizar la carta.' })
  }
})

// POST /api/inventory/import-ydk - Import a YDK deck file into inventory
router.post('/import-ydk', async (req, res) => {
  try {
    const { ydkContent, condition, binder_page, notes } = req.body

    if (!ydkContent) {
      return res.status(400).json({ success: false, error: 'El contenido del archivo .ydk es obligatorio.' })
    }

    const parseYdkContent = (text) => {
      if (!text || typeof text !== 'string') return []
      const lines = text.split(/\r?\n/)
      const cardCounts = new Map()

      for (let line of lines) {
        line = line.trim()
        if (!line || line.startsWith('#') || line.startsWith('!')) continue
        const cardId = line.replace(/[^0-9]/g, '')
        if (cardId) {
          cardCounts.set(cardId, (cardCounts.get(cardId) || 0) + 1)
        }
      }

      const list = []
      for (const [cardId, quantity] of cardCounts.entries()) {
        list.push({ card_id: cardId, quantity })
      }
      return list
    }

    const parsedCards = parseYdkContent(ydkContent)
    if (parsedCards.length === 0) {
      return res.status(400).json({ success: false, error: 'No se encontraron IDs de cartas válidos en el archivo YDK.' })
    }

    const addedItems = []
    let totalCardsCount = 0

    for (const parsed of parsedCards) {
      const cardDetails = (await findCardById(parsed.card_id)) || {}
      const firstSet = cardDetails.card_sets?.[0] || {}

      const newItem = await addInventoryCard(req.user.id, {
        card_id: parsed.card_id,
        card_code: firstSet.set_code || null,
        quantity: parsed.quantity,
        condition: condition || 'Near Mint',
        set_name: firstSet.set_name || null,
        rarity: firstSet.set_rarity || null,
        binder_page: binder_page ? parseInt(binder_page, 10) : null,
        binder_slot: null,
        notes: notes || 'Importado desde archivo .ydk',
      })

      addedItems.push(formatEnrichedItem(newItem, cardDetails))
      totalCardsCount += parsed.quantity
    }

    res.status(201).json({
      success: true,
      message: `¡Importación exitosa! Se añadieron ${totalCardsCount} cartas (${parsedCards.length} modelos únicos) a tu binder.`,
      importedCardsCount: totalCardsCount,
      uniqueModelsCount: parsedCards.length,
      data: addedItems,
    })
  } catch (err) {
    console.error('Error importing YDK file:', err)
    res.status(500).json({ success: false, error: 'Error al importar el archivo YDK.' })
  }
})

// DELETE /api/inventory/:id - Delete item from inventory
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteInventoryCard(req.params.id, req.user.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Carta no encontrada en tu binder.' })
    }

    res.json({ success: true, message: 'Carta eliminada del binder.' })
  } catch (err) {
    console.error('Error deleting inventory item:', err)
    res.status(500).json({ success: false, error: 'Error al eliminar la carta.' })
  }
})

export default router
