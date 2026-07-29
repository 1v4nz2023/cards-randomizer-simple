import { DECK_CONFIG } from './config.js'

/**
 * Select a random sample of unique cards from a pool,
 * respecting the maximum copies per card limit.
 */
export function selectRandomCards(pool, count, maxCopies = DECK_CONFIG.maxCopiesPerCard) {
  if (pool.length === 0) return []

  // Build a list of [card, copyCount] pairs
  const cardCounts = new Map()
  const available = []

  for (const card of pool) {
    if (!cardCounts.has(card.id)) {
      cardCounts.set(card.id, 0)
    }
    available.push(card)
  }

  // Shuffle the available cards using Fisher-Yates
  const shuffled = [...available]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const selected = []
  const copyCounts = new Map()

  for (const card of shuffled) {
    if (selected.length >= count) break

    const currentCount = copyCounts.get(card.id) || 0
    if (currentCount < maxCopies) {
      selected.push(card)
      copyCounts.set(card.id, currentCount + 1)
    }
  }

  return selected
}

/**
 * Build a complete deck from the card pools.
 * Returns { mainDeck, extraDeck }.
 */
export function buildDeck(pools) {
  const mainDeck = []
  const extraDeck = []

  // Main Deck: Effect Monsters
  const effectMonsters = selectRandomCards(
    pools.effectMonsters,
    DECK_CONFIG.mainDeck.effectMonsters
  )
  mainDeck.push(...effectMonsters)

  // Main Deck: Normal Monsters
  const normalMonsters = selectRandomCards(
    pools.normalMonsters,
    DECK_CONFIG.mainDeck.normalMonsters
  )
  mainDeck.push(...normalMonsters)

  // Main Deck: Generic Spells
  const genericSpells = selectRandomCards(
    pools.genericSpells,
    DECK_CONFIG.mainDeck.genericSpells
  )
  mainDeck.push(...genericSpells)

  // Main Deck: Generic Traps
  const genericTraps = selectRandomCards(
    pools.genericTraps,
    DECK_CONFIG.mainDeck.genericTraps
  )
  mainDeck.push(...genericTraps)

  // Extra Deck
  const extraCount = Math.min(
    DECK_CONFIG.extraDeck.maxCards,
    pools.extraDeck.length
  )
  const extraCards = selectRandomCards(pools.extraDeck, extraCount)
  extraDeck.push(...extraCards)

  return {
    mainDeck,
    extraDeck,
    mainCount: mainDeck.length,
    extraCount: extraDeck.length,
  }
}

/**
 * Generate a YDK file content string from a deck object.
 */
export function generateYdkContent(deck) {
  const lines = []
  lines.push('#created with YGO Random Deck Generator')

  lines.push('#main')
  for (const card of deck.mainDeck) {
    lines.push(card.id)
  }

  lines.push('#extra')
  for (const card of deck.extraDeck) {
    lines.push(card.id)
  }

  return lines.join('\n')
}
