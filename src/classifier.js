import { readFileSync } from 'fs'
import { CARDS_FILE_PATH } from './config.js'

/**
 * Classify a spell or trap card as generic or archetype-dependent
 * based on its description text.
 */
export function classifyCardAsGeneric(card) {
  const desc = (card.desc || '').toLowerCase()

  // Check for archetype-dependent keywords
  const dependentPatterns = [
    /add 1 "/i,
    /add a "/i,
    /special summon "/i,
    /special summon [a-z]/i,
    /if you control a "/i,
    /if you control "/i,
    /target "...\s*/i,
    /" monster["\s]/i,
    /" monster\(/i,
    /equip only to "/i,
    /only equip to "/i,
    /target face-up monster/i,
    /target monster/i,
    /destroy 1 card/i,
    /discard 1 card/i,
    /draw cards/i,
    /add 1 card/i,
    /search your deck/i,
    /you can only use this effect of/i,
    /you can only activate 1/i,
    /once per turn/i,
  ]

  for (const pattern of dependentPatterns) {
    if (pattern.test(desc)) {
      return false // archetype-dependent
    }
  }

  // Check for known archetype markers in description
  const archetypeMarkers = [
    'Blue-Eyes',
    'Black-Luster',
    'Dark Magician',
    'HERO',
    'Elemental HERO',
    'Kashtira',
    'Branded',
    'Sky Striker',
    'Tearlaments',
    'Shaddoll',
    'Thunder Dragon',
    'Crystal Beast',
    'Cyber Dragon',
    'Dark World',
    'Harpie',
    'Gladiator Beast',
    'Jurrac',
    'Ojama',
    'Vylon',
    'Silkcity',
    'Sylvan',
    'Rikka',
    'Marincess',
    'Purrely',
    'Winda',
    'Ice Barrier',
    'Icejade',
    'Bystial',
    'Code Talker',
    'Lavalval',
    'Flamvell',
    'Fossil',
    'Gadget',
    'Majestic',
    'Millennium',
    'Morphtronic',
    'Myutant',
    'Nemere',
    'Phantom',
    'Proton',
    'Salvage',
    'Thunder Dragon',
    'Tribe-Illusion',
    'U.A.',
    'Underworld',
    'Wabula',
    'Yami',
    'Zombie World',
    'K9',
    'Alien',
  ]

  for (const marker of archetypeMarkers) {
    if (desc.includes(marker.toLowerCase())) {
      return false
    }
  }

  return true // generic
}

/**
 * Check if a monster type is a playable non-normal monster.
 * Includes Tuner, Spirit, Gemini, Flip, Ritual, Toon, Pendulum variants, etc.
 */
function isPlayableNonNormalMonster(type) {
  const nonNormalTypes = [
    'Tuner Monster',
    'Synchro Tuner Monster',
    'Pendulum Tuner Effect Monster',
    'Spirit Monster',
    'Gemini Monster',
    'Flip Monster',
    'Flip Effect Monster',
    'Pendulum Flip Effect Monster',
    'Flip Tuner Effect Monster',
    'Ritual Monster',
    'Toon Monster',
    'Pendulum Normal Monster',
    'Union Effect Monster',
    'Pendulum Effect Monster',
    'Pendulum Effect Ritual Monster',
  ]
  return nonNormalTypes.includes(type)
}

/**
 * All extra deck monster types, including variants with "Effect" in the name.
 */
const ALL_EXTRA_DECK_TYPES = [
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Pendulum Effect Monster',
  'XYZ Pendulum Effect Monster',
]

/**
 * Classify a card into its pool category.
 * Returns: 'effectMonster', 'normalMonster', 'spell', 'trap', 'extraDeck', or null
 */
export function classifyCard(card) {
  const type = (card.type || '').trim()

  // Extra deck monsters must be checked FIRST, even if they contain "Effect"
  if (ALL_EXTRA_DECK_TYPES.includes(type)) {
    return 'extraDeck'
  }

  // Effect monsters: any type containing "Effect" (excluding extra deck types already handled)
  if (type.includes('Effect')) {
    return 'effectMonster'
  }

  // Playable non-normal monsters (Tuner, Spirit, Gemini, Flip, Ritual, Toon, etc.)
  if (isPlayableNonNormalMonster(type)) {
    return 'effectMonster'
  }

  // Normal monsters: ONLY "Normal Monster" exactly
  if (type === 'Normal Monster') {
    return 'normalMonster'
  }

  // Spell cards
  if (type === 'Spell Card') {
    return 'spell'
  }

  // Trap cards
  if (type === 'Trap Card') {
    return 'trap'
  }

  return null
}

/**
 * Load and classify all cards from cards.json into memory pools.
 * Returns an object with all card pools.
 */
export function loadAndClassifyCards() {
  const rawData = readFileSync(CARDS_FILE_PATH, 'utf-8')
  const cards = JSON.parse(rawData)

  const pools = {
    effectMonsters: [],
    normalMonsters: [],
    genericSpells: [],
    dependentSpells: [],
    genericTraps: [],
    dependentTraps: [],
    extraDeck: [],
  }

  for (const card of cards) {
    const category = classifyCard(card)

    if (!category) continue

    switch (category) {
      case 'effectMonster':
        pools.effectMonsters.push(card)
        break

      case 'normalMonster':
        pools.normalMonsters.push(card)
        break

      case 'spell': {
        const isGeneric = classifyCardAsGeneric(card)
        if (isGeneric) {
          pools.genericSpells.push(card)
        } else {
          pools.dependentSpells.push(card)
        }
        break
      }

      case 'trap': {
        const isGeneric = classifyCardAsGeneric(card)
        if (isGeneric) {
          pools.genericTraps.push(card)
        } else {
          pools.dependentTraps.push(card)
        }
        break
      }

      case 'extraDeck':
        pools.extraDeck.push(card)
        break
    }
  }

  return pools
}
