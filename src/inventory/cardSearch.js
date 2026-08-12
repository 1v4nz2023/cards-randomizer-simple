import { readFileSync } from 'fs'
import { CARDS_FILE_PATH } from '../config.js'

let cardsCache = null
const externalCardsCache = new Map()

// In-memory cache for YGOPRODeck API requests to respect rate limits (TTL: 12 hours)
const apiCache = new Map()
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

export function getCardsCatalog() {
  if (!cardsCache) {
    try {
      const rawData = readFileSync(CARDS_FILE_PATH, 'utf-8')
      cardsCache = JSON.parse(rawData)
    } catch (err) {
      console.error('Failed to load cards catalog:', err.message)
      cardsCache = []
    }
  }
  return cardsCache
}

/**
 * Helper to match numeric attributes with comparison operators (gt, gte, lt, lte)
 */
function matchNumericOperator(cardValue, filterStr) {
  if (cardValue === null || cardValue === undefined) return false
  const str = String(filterStr).trim().toLowerCase()

  if (str.startsWith('gte')) {
    const num = parseFloat(str.replace('gte', ''))
    return !isNaN(num) && cardValue >= num
  }
  if (str.startsWith('gt')) {
    const num = parseFloat(str.replace('gt', ''))
    return !isNaN(num) && cardValue > num
  }
  if (str.startsWith('lte')) {
    const num = parseFloat(str.replace('lte', ''))
    return !isNaN(num) && cardValue <= num
  }
  if (str.startsWith('lt')) {
    const num = parseFloat(str.replace('lt', ''))
    return !isNaN(num) && cardValue < num
  }

  const num = parseFloat(str)
  return !isNaN(num) && cardValue === num
}

/**
 * Advanced search cards in catalog & YGOPRODeck API with filters.
 * Options: { query, name, fname, id, type, race, attribute, archetype, level, atk, def, scale, link, linkmarker, cardset, banlist, format, staple, sort }
 */
export async function searchCardsAdvanced(options = {}, maxResults = 35) {
  const opts = typeof options === 'string' ? { query: options } : options

  const {
    query = '',
    name = '',
    fname = '',
    id = '',
    type = '',
    race = '',
    attribute = '',
    archetype = '',
    level = '',
    atk = '',
    def = '',
    scale = '',
    link = '',
    linkmarker = '',
    cardset = '',
    banlist = '',
    format = '',
    staple = '',
    sort = '',
  } = opts

  const cleanQuery = (query || fname).trim().toLowerCase()
  const cleanName = name.trim().toLowerCase()
  const cleanId = id.trim().toLowerCase()
  const cleanType = type.trim().toLowerCase()
  const cleanRace = race.trim().toLowerCase()
  const cleanAttribute = attribute.trim().toLowerCase()
  const cleanArchetype = archetype.trim().toLowerCase()
  const cleanSet = cardset.trim().toLowerCase()

  const catalog = getCardsCatalog()
  const results = []

  // 1. Search local cards.json catalog first
  for (const card of catalog) {
    // ID match
    if (cleanId && String(card.id).toLowerCase() !== cleanId) continue

    // Name match
    if (cleanName && card.name && !cleanName.split('|').some((n) => card.name.toLowerCase().includes(n.trim()))) {
      continue
    }

    // Query text match (name, id, or set code)
    if (cleanQuery) {
      const nameMatch = card.name && card.name.toLowerCase().includes(cleanQuery)
      const idMatch = String(card.id).toLowerCase().includes(cleanQuery)

      let setMatch = false
      if (card.card_sets) {
        for (const s of card.card_sets) {
          if (
            (s.set_code && s.set_code.toLowerCase().includes(cleanQuery)) ||
            (s.set_name && s.set_name.toLowerCase().includes(cleanQuery))
          ) {
            setMatch = true
            break
          }
        }
      }
      if (!nameMatch && !idMatch && !setMatch) continue
    }

    // Type match
    if (cleanType) {
      const cType = (card.type || '').toLowerCase()
      const cHuman = (card.humanReadableCardType || '').toLowerCase()
      const types = cleanType.split(',').map((t) => t.trim())
      const typeMatches = types.some((t) => cType.includes(t) || cHuman.includes(t))
      if (!typeMatches) continue
    }

    // Race match
    if (cleanRace) {
      const cRace = (card.race || '').toLowerCase()
      const races = cleanRace.split(',').map((r) => r.trim())
      if (!races.some((r) => cRace.includes(r))) continue
    }

    // Attribute match
    if (cleanAttribute) {
      const cAttr = (card.attribute || '').toLowerCase()
      const attributes = cleanAttribute.split(',').map((a) => a.trim())
      if (!attributes.some((a) => cAttr.includes(a))) continue
    }

    // Archetype match
    if (cleanArchetype) {
      const cArch = (card.archetype || '').toLowerCase()
      if (!cArch.includes(cleanArchetype)) continue
    }

    // Level / Rank numeric operators match
    if (level && !matchNumericOperator(card.level || card.rank, level)) continue

    // ATK numeric operators match
    if (atk && !matchNumericOperator(card.atk, atk)) continue

    // DEF numeric operators match
    if (def && !matchNumericOperator(card.def, def)) continue

    // Cardset match
    if (cleanSet) {
      let setMatch = false
      if (card.card_sets) {
        for (const s of card.card_sets) {
          if (
            (s.set_code && s.set_code.toLowerCase().includes(cleanSet)) ||
            (s.set_name && s.set_name.toLowerCase().includes(cleanSet))
          ) {
            setMatch = true
            break
          }
        }
      }
      if (!setMatch) continue
    }

    // Determine matched set code
    let matchedSetCode = null
    if (card.card_sets && card.card_sets.length > 0) {
      if (cleanQuery) {
        const foundSet = card.card_sets.find(
          (s) => s.set_code && s.set_code.toLowerCase().includes(cleanQuery)
        )
        if (foundSet) matchedSetCode = foundSet.set_code
      }
      if (!matchedSetCode) matchedSetCode = card.card_sets[0].set_code
    }

    results.push({
      id: String(card.id),
      name: card.name,
      type: card.type,
      humanReadableCardType: card.humanReadableCardType || card.type,
      race: card.race,
      attribute: card.attribute,
      archetype: card.archetype,
      level: card.level || card.rank || null,
      atk: card.atk,
      def: card.def,
      scale: card.scale || null,
      linkval: card.linkval || null,
      linkmarkers: card.linkmarkers || [],
      imageSmall: card.card_images?.[0]?.image_url_small || '',
      imageFull: card.card_images?.[0]?.image_url || '',
      card_sets: card.card_sets || [],
      matchedSetCode,
      isExternal: false,
    })

    if (results.length >= maxResults) break
  }

  // 2. If no local results or if advanced criteria provided, check YGOPRODeck API
  if (results.length === 0) {
    try {
      const queryParams = new URLSearchParams()
      if (name) queryParams.append('name', name)
      else if (cleanQuery) queryParams.append('fname', cleanQuery)
      else if (fname) queryParams.append('fname', fname)

      if (id) queryParams.append('id', id)
      if (type) queryParams.append('type', type)
      if (race) queryParams.append('race', race)
      if (attribute) queryParams.append('attribute', attribute)
      if (archetype) queryParams.append('archetype', archetype)
      if (level) queryParams.append('level', level)
      if (atk) queryParams.append('atk', atk)
      if (def) queryParams.append('def', def)
      if (scale) queryParams.append('scale', scale)
      if (link) queryParams.append('link', link)
      if (linkmarker) queryParams.append('linkmarker', linkmarker)
      if (cardset) queryParams.append('cardset', cardset)
      if (banlist) queryParams.append('banlist', banlist)
      if (format) queryParams.append('format', format)
      if (staple) queryParams.append('staple', staple)
      if (sort) queryParams.append('sort', sort)

      const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?${queryParams.toString()}`

      // Check in-memory API cache first
      let apiCards = null
      if (apiCache.has(url)) {
        const cachedEntry = apiCache.get(url)
        if (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
          console.log(`[CardSearch] Returning cached API results for ${url}`)
          apiCards = cachedEntry.data
        }
      }

      if (!apiCards) {
        console.log(`[CardSearch] Fetching from YGOPRODeck API: ${url}`)
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          apiCards = json.data || []
          apiCache.set(url, { timestamp: Date.now(), data: apiCards })
        }
      }

      if (apiCards && apiCards.length > 0) {
        for (const card of apiCards) {
          const sets = card.card_sets || []
          const formatted = {
            id: String(card.id),
            name: card.name,
            type: card.type,
            humanReadableCardType: card.humanReadableCardType || card.type,
            race: card.race,
            attribute: card.attribute,
            archetype: card.archetype,
            level: card.level || card.rank || null,
            atk: card.atk,
            def: card.def,
            scale: card.scale || null,
            linkval: card.linkval || null,
            linkmarkers: card.linkmarkers || [],
            imageSmall: card.card_images?.[0]?.image_url_small || '',
            imageFull: card.card_images?.[0]?.image_url || '',
            card_sets: sets,
            matchedSetCode: sets[0] ? sets[0].set_code : null,
            isExternal: true,
          }
          externalCardsCache.set(String(card.id), formatted)
          results.push(formatted)
          if (results.length >= maxResults) break
        }
      }
    } catch (err) {
      console.error('[CardSearch] Error searching YGOPRODeck API:', err.message)
    }
  }

  // Sort local results if sort option specified
  if (sort && results.length > 0) {
    results.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'atk') return (b.atk || 0) - (a.atk || 0)
      if (sort === 'def') return (b.def || 0) - (a.def || 0)
      if (sort === 'level') return (b.level || 0) - (a.level || 0)
      return 0
    })
  }

  return results
}

/**
 * Backward-compatible helper for basic name search
 */
export async function searchCardsByName(query, maxResults = 25) {
  return searchCardsAdvanced({ query }, maxResults)
}

/**
 * Find card details by card ID.
 */
export async function findCardById(cardId) {
  if (!cardId) return null
  const targetId = String(cardId)
  const catalog = getCardsCatalog()

  // 1. Check local catalog
  const found = catalog.find((c) => String(c.id) === targetId)
  if (found) {
    return {
      id: String(found.id),
      name: found.name,
      type: found.type,
      humanReadableCardType: found.humanReadableCardType || found.type,
      race: found.race,
      attribute: found.attribute,
      archetype: found.archetype,
      level: found.level || found.rank || null,
      atk: found.atk,
      def: found.def,
      imageSmall: found.card_images?.[0]?.image_url_small || '',
      imageFull: found.card_images?.[0]?.image_url || '',
      card_sets: found.card_sets || [],
      isExternal: false,
    }
  }

  // 2. Check external cache
  if (externalCardsCache.has(targetId)) {
    return externalCardsCache.get(targetId)
  }

  // 3. Fallback: Fetch single card info by ID from YGOPRODeck API
  try {
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(targetId)}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      const card = json.data?.[0]
      if (card) {
        const sets = card.card_sets || []
        const formatted = {
          id: String(card.id),
          name: card.name,
          type: card.type,
          humanReadableCardType: card.humanReadableCardType || card.type,
          race: card.race,
          attribute: card.attribute,
          archetype: card.archetype,
          level: card.level || card.rank || null,
          atk: card.atk,
          def: card.def,
          imageSmall: card.card_images?.[0]?.image_url_small || '',
          imageFull: card.card_images?.[0]?.image_url || '',
          card_sets: sets,
          matchedSetCode: sets[0] ? sets[0].set_code : null,
          isExternal: true,
        }
        externalCardsCache.set(targetId, formatted)
        return formatted
      }
    }
  } catch (err) {
    console.error('[CardSearch] Error fetching card by ID from YGOPRODeck fallback:', err.message)
  }

  return null
}
