import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { loadAndClassifyCards } from './src/classifier.js'
import { buildDeck, generateYdkContent } from './src/deckBuilder.js'
import { initDb } from './src/db.js'
import authRoutes from './src/auth/authRoutes.js'
import inventoryRoutes from './src/inventory/inventoryRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Parse JSON request bodies
app.use(express.json())

// Serve static files from public/
app.use(express.static(join(__dirname, 'public')))

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/inventory', inventoryRoutes)

// Load and classify cards once at startup
let cardPools
try {
  console.log('Loading cards.json...')
  cardPools = loadAndClassifyCards()
  console.log('Cards loaded and classified:')
  console.log(`  Effect Monsters: ${cardPools.effectMonsters.length}`)
  console.log(`  Normal Monsters: ${cardPools.normalMonsters.length}`)
  console.log(`  Generic Spells: ${cardPools.genericSpells.length}`)
  console.log(`  Dependent Spells: ${cardPools.dependentSpells.length}`)
  console.log(`  Generic Traps: ${cardPools.genericTraps.length}`)
  console.log(`  Dependent Traps: ${cardPools.dependentTraps.length}`)
  console.log(`  Extra Deck: ${cardPools.extraDeck.length}`)
} catch (err) {
  console.error('Failed to load cards.json:', err.message)
  process.exit(1)
}

// GET /api/deck - Generate and return a new deck
app.get('/api/deck', (req, res) => {
  try {
    const deck = buildDeck(cardPools)
    // Store the deck for reuse in YDK download
    lastGeneratedDeck = deck

    // Format cards for the frontend (include image URLs)
    const formatCard = (card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      humanReadableCardType: card.humanReadableCardType,
      imageSmall: card.card_images?.[0]?.image_url_small || '',
      imageFull: card.card_images?.[0]?.image_url || '',
    })

    res.json({
      success: true,
      data: {
        mainCount: deck.mainCount,
        extraCount: deck.extraCount,
        cards: deck.mainDeck.map(formatCard),
        extra: deck.extraDeck.map(formatCard),
      },
    })
  } catch (err) {
    console.error('Error generating deck:', err.message)
    res.status(500).json({ success: false, error: 'Failed to generate deck' })
  }
})

// GET /api/deck/ydk - Return YDK file content using the last generated deck
app.get('/api/deck/ydk', (req, res) => {
  try {
    const deck = lastGeneratedDeck || buildDeck(cardPools)
    const ydkContent = generateYdkContent(deck)
    res.set('Content-Type', 'text/plain')
    res.set('Content-Disposition', `attachment; filename="${generateRandomFilename()}"`)
    res.send(ydkContent)
  } catch (err) {
    console.error('Error generating YDK:', err.message)
    res.status(500).json({ success: false, error: 'Failed to generate YDK' })
  }
})

// Store the last generated deck to reuse for YDK download
let lastGeneratedDeck = null

function generateRandomFilename() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let name = ''
  for (let i = 0; i < 8; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${name}.ydk`
}

// Start server after DB initialization
async function startServer() {
  try {
    await initDb()
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  }
}

startServer()

