import { readFileSync } from 'fs'
import { CARDS_FILE_PATH } from '../config.js'

let cardsCache = null
const externalCardsCache = new Map()

// In-memory cache for YGOPRODeck API requests to respect rate limits (TTL: 12 hours)
const apiCache = new Map()
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

// Cache for Spanish -> English translations
const translationCache = new Map()

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
 * Parses set code string (e.g. INFO-SP088, LBD-S001, SDK-ES001) and returns English equivalent info.
 */
export function parseSetCode(codeStr) {
  if (!codeStr || typeof codeStr !== 'string') return null
  const clean = codeStr.trim().toUpperCase()

  // Match prefix, region, and optional 1-4 digits number (e.g. INFO-SP088, INFO-SP08, INFO-SP)
  const regex = /^([A-Z0-9]{2,6})[-_\s]?([A-Z]{1,3})(\d{1,4})?$/i
  const match = clean.match(regex)
  if (!match) return null

  const setPrefix = match[1]
  const regionTag = match[2]
  const num = match[3] || ''

  const nonEnRegions = ['SP', 'ES', 'DE', 'FR', 'IT', 'PT', 'JP', 'JA', 'KR', 'S', 'E', 'G', 'F', 'I']
  const isRegional = nonEnRegions.includes(regionTag)

  const convertedCode = `${setPrefix}-EN${num}`
  const baseCode = `${setPrefix}-${num}`

  return {
    isRegional,
    originalCode: clean,
    convertedCode,
    setPrefix,
    regionTag,
    num,
    baseCode,
  }
}

const YGO_ES_DICTIONARY = {
  'mago oscuro': 'Dark Magician',
  'dragon blanco de ojos azules': 'Blue-Eyes White Dragon',
  'dragón blanco de ojos azules': 'Blue-Eyes White Dragon',
  'dragon negro de ojos rojos': 'Red-Eyes Black Dragon',
  'dragón negro de ojos rojos': 'Red-Eyes Black Dragon',
  'gamba exterminadora': 'Zapper Shrimp',
  'heroe elemental': 'Elemental HERO',
  'héroe elemental': 'Elemental HERO',
  'heroe del destino': 'Destiny HERO',
  'héroe del destino': 'Destiny HERO',
  'dragón de polvo de estrellas': 'Stardust Dragon',
  'dragon de polvo de estrellas': 'Stardust Dragon',
  'dragón cibernético': 'Cyber Dragon',
  'dragon cibernetico': 'Cyber Dragon',
}

const SPANISH_COMMON_SYNONYMS = {
  'gamba': ['shrimp', 'prawn'],
  'camaron': ['shrimp', 'prawn'],
  'camarón': ['shrimp', 'prawn'],
  'mago': ['magician', 'wizard', 'mage'],
  'maga': ['magician', 'witch', 'mage'],
  'ojos': ['eyes', 'eye'],
  'ojo': ['eye'],
  'dragon': ['dragon'],
  'dragón': ['dragon'],
  'monstruo': ['monster'],
  'espejo': ['mirror'],
  'negro': ['black', 'dark'],
  'blanco': ['white'],
  'azul': ['blue'],
  'rojo': ['red'],
  'fuego': ['fire'],
  'agua': ['water'],
  'tierra': ['earth'],
  'viento': ['wind'],
  'luz': ['light'],
  'oscuridad': ['dark'],
  'oscuro': ['dark'],
  'oscura': ['dark'],
  'héroe': ['hero'],
  'heroe': ['hero'],
  'destino': ['destiny'],
  'polimerizacion': ['polymerization'],
  'polimerización': ['polymerization'],
  'ciber': ['cyber'],
  'cibernetico': ['cyber'],
  'cibernético': ['cyber'],
  'despia': ['despia'],
  'kashtira': ['kashtira'],
  'labrynth': ['labrynth'],
  'purrely': ['purrely'],
}

/**
 * Extracts searchable English tokens/synonyms for a given Spanish query and translated string.
 */
export function getSearchTokens(text, translatedFull = '') {
  const tokenSet = new Set()
  if (!text || typeof text !== 'string') return []

  const words = text.toLowerCase().trim().split(/[^a-z0-9áéíóúñ]+/i)
  words.forEach((w) => {
    if (SPANISH_COMMON_SYNONYMS[w]) {
      SPANISH_COMMON_SYNONYMS[w].forEach((syn) => tokenSet.add(syn))
    }
  })

  if (translatedFull && typeof translatedFull === 'string') {
    const transWords = translatedFull.toLowerCase().trim().split(/[^a-z0-9]+/i)
    transWords.forEach((w) => {
      if (w.length >= 3) tokenSet.add(w)
    })
  }

  return Array.from(tokenSet)
}

/**
 * Translates text from Spanish to English using YGO dictionary and Yu-Gi-Oh! Spanish Wiki API ONLY.
 */
export async function translateEsToEn(text) {
  if (!text || typeof text !== 'string') return text
  const cleanText = text.trim()
  if (cleanText.length < 2) return cleanText

  const cacheKey = cleanText.toLowerCase()

  // 0. Check Yu-Gi-Oh! Spanish Dictionary
  if (YGO_ES_DICTIONARY[cacheKey]) {
    return YGO_ES_DICTIONARY[cacheKey]
  }

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }

  // 1. Yu-Gi-Oh! Spanish Wiki API (Traducciones oficiales de cartas Yu-Gi-Oh!)
  try {
    const wikiUrl = `https://yugioh.fandom.com/es/api.php?action=opensearch&limit=1&format=json&search=${encodeURIComponent(cleanText)}`
    const wikiRes = await fetch(wikiUrl)
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json()
      if (wikiData && wikiData[1] && wikiData[1].length > 0) {
        const pageTitle = wikiData[1][0]
        const pageUrl = `https://yugioh.fandom.com/es/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=${encodeURIComponent(pageTitle)}`
        const pageRes = await fetch(pageUrl)
        if (pageRes.ok) {
          const pageData = await pageRes.json()
          const pages = pageData.query?.pages || {}
          const page = Object.values(pages)[0]
          const content = page?.revisions?.[0]?.['*'] || ''
          const matchEng = content.match(/\|\s*ingl[eé]s\s*=\s*([^|\n}]+)/i) || content.match(/\|\s*nombre_ingl[eé]s\s*=\s*([^|\n}]+)/i)
          if (matchEng && matchEng[1]) {
            const officialEnName = matchEng[1].trim()
            console.log(`[Translate YGO-Wiki] "${cleanText}" -> "${officialEnName}"`)
            translationCache.set(cacheKey, officialEnName)
            return officialEnName
          }
        }
      }
    }
  } catch (err) {
    console.error('[Translate YGO-Wiki Error]:', err.message)
  }

  return cleanText
}

const spanishDescCache = new Map()

/**
 * Fetches official Spanish card description/effect text from Yu-Gi-Oh! Spanish Wiki API.
 */
export async function fetchSpanishDescription(text) {
  if (!text || typeof text !== 'string') return null
  const cleanText = text.trim()
  if (cleanText.length < 2) return null

  const cacheKey = cleanText.toLowerCase()
  if (spanishDescCache.has(cacheKey)) {
    return spanishDescCache.get(cacheKey)
  }

  try {
    const wikiUrl = `https://yugioh.fandom.com/es/api.php?action=opensearch&limit=1&format=json&search=${encodeURIComponent(cleanText)}`
    const wikiRes = await fetch(wikiUrl)
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json()
      if (wikiData && wikiData[1] && wikiData[1].length > 0) {
        const pageTitle = wikiData[1][0]
        const pageUrl = `https://yugioh.fandom.com/es/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=${encodeURIComponent(pageTitle)}`
        const pageRes = await fetch(pageUrl)
        if (pageRes.ok) {
          const pageData = await pageRes.json()
          const pages = pageData.query?.pages || {}
          const page = Object.values(pages)[0]
          const content = page?.revisions?.[0]?.['*'] || ''

          const matchDesc = content.match(/\|\s*descripci[oó]n\s*=\s*([^|\n}]+)/i) ||
                            content.match(/\|\s*texto\s*=\s*([^|\n}]+)/i) ||
                            content.match(/\|\s*efecto\s*=\s*([^|\n}]+)/i)

          if (matchDesc && matchDesc[1]) {
            const cleanDesc = matchDesc[1]
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
              .replace(/'''?/g, '')
              .trim()

            if (cleanDesc) {
              console.log(`[Wiki Info] Found Spanish info for "${cleanText}" -> "${pageTitle}"`)
              const payload = { spanishName: pageTitle, spanishDesc: cleanDesc }
              spanishDescCache.set(cacheKey, payload)
              return payload
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Wiki Desc Error]:', err.message)
  }

  return null
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
 */
export async function searchCardsAdvanced(options = {}, maxResults = 35) {
  const opts = typeof options === 'string' ? { query: options } : options

  const {
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

  const rawQuery = opts.query || opts.q || opts.fname || fname || ''
  const cleanQuery = rawQuery.trim().toLowerCase()
  const normQuery = cleanQuery.replace(/[^a-z0-9]/g, '')
  const cleanName = (name || '').trim().toLowerCase()
  const cleanId = (id || '').trim().toLowerCase()
  const cleanType = (type || '').trim().toLowerCase()
  const cleanRace = (race || '').trim().toLowerCase()
  const cleanAttribute = (attribute || '').trim().toLowerCase()
  const cleanArchetype = (archetype || '').trim().toLowerCase()
  const cleanSet = (cardset || '').trim().toLowerCase()

  const parsedSetQuery = parseSetCode(rawQuery)

  const catalog = getCardsCatalog()

  function performLocalSearch(queryStr, translatedFromStr = null) {
    const searchLower = queryStr.toLowerCase().trim()
    const normSearch = searchLower.replace(/[^a-z0-9]/g, '')
    const searchParsedSet = parseSetCode(searchLower)
    const tokens = getSearchTokens(searchLower, translatedFromStr ? queryStr : '')

    const localResults = []

    for (const card of catalog) {
      // ID match
      if (cleanId && String(card.id).toLowerCase() !== cleanId) continue

      // Name match
      if (cleanName && card.name && !cleanName.split('|').some((n) => card.name.toLowerCase().includes(n.trim()))) {
        continue
      }

      let relevanceScore = 0
      let matchedSetCode = null

      if (searchLower) {
        const cName = (card.name || '').toLowerCase()
        const normCName = cName.replace(/[^a-z0-9]/g, '')
        const cId = String(card.id).toLowerCase()
        const sets = card.card_sets || []

        let matchesCode = false
        if (cName === searchLower) {
          relevanceScore += 1000
          matchesCode = true
        } else if (cName.includes(searchLower) || (normSearch.length >= 3 && normCName.includes(normSearch))) {
          relevanceScore += 500
          matchesCode = true
        } else if (cId === searchLower) {
          relevanceScore += 900
          matchesCode = true
        }

        // Token match (e.g. gamba -> shrimp)
        if (!matchesCode && tokens.length > 0) {
          for (const token of tokens) {
            if (cName.includes(token) || normCName.includes(token)) {
              relevanceScore += 400
              matchesCode = true
              break
            }
          }
        }

        // Set code match
        for (const s of sets) {
          if (!s || !s.set_code) continue
          const sCode = s.set_code.toLowerCase().trim()
          const normSCode = sCode.replace(/[^a-z0-9]/g, '')

          if (sCode === searchLower) {
            relevanceScore += 800
            matchedSetCode = s.set_code
            matchesCode = true
            break
          } else if (sCode.includes(searchLower) || (normSearch.length >= 3 && normSCode.includes(normSearch))) {
            relevanceScore += 400
            matchedSetCode = s.set_code
            matchesCode = true
            break
          }

          // Regional set code equivalence (e.g. INFO-SP088 or INFO-SP08 vs INFO-EN088)
          const parsedCardSet = parseSetCode(s.set_code)
          if (searchParsedSet && parsedCardSet) {
            if (searchParsedSet.setPrefix === parsedCardSet.setPrefix) {
              if (!searchParsedSet.num || (parsedCardSet.num && parsedCardSet.num.includes(searchParsedSet.num))) {
                relevanceScore += 750
                matchedSetCode = (searchParsedSet.isRegional ? searchParsedSet.originalCode : s.set_code)
                matchesCode = true
                break
              }
            }
          }
          if (parsedSetQuery && parsedCardSet) {
            if (parsedSetQuery.setPrefix === parsedCardSet.setPrefix) {
              if (!parsedSetQuery.num || (parsedCardSet.num && parsedCardSet.num.includes(parsedSetQuery.num))) {
                relevanceScore += 750
                matchedSetCode = (parsedSetQuery.isRegional ? parsedSetQuery.originalCode : s.set_code)
                matchesCode = true
                break
              }
            }
          }
        }

        if (!matchesCode) continue
      }

      // Type filter
      if (cleanType && card.type && !card.type.toLowerCase().includes(cleanType)) continue

      // Race filter
      if (cleanRace && card.race && card.race.toLowerCase() !== cleanRace) continue

      // Attribute filter
      if (cleanAttribute && card.attribute && card.attribute.toLowerCase() !== cleanAttribute) continue

      // Archetype filter
      if (cleanArchetype && card.archetype && !card.archetype.toLowerCase().includes(cleanArchetype)) continue

      // Level / Rank filter
      if (level && !matchNumericOperator(card.level || card.rank, level)) continue

      // ATK filter
      if (atk && !matchNumericOperator(card.atk, atk)) continue

      // DEF filter
      if (def && !matchNumericOperator(card.def, def)) continue

      // Set filter
      if (cleanSet) {
        const hasSet = (card.card_sets || []).some((s) => s.set_name && s.set_name.toLowerCase().includes(cleanSet))
        if (!hasSet) continue
      }

      const sets = card.card_sets || []
      localResults.push({
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
        desc: card.desc || card.description || '',
        imageSmall: card.card_images?.[0]?.image_url_small || '',
        imageFull: card.card_images?.[0]?.image_url || '',
        card_sets: sets,
        matchedSetCode: matchedSetCode || (sets[0] ? sets[0].set_code : null),
        relevanceScore,
        translatedFrom: translatedFromStr,
        isExternal: false,
      })
    }

    localResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return localResults
  }

  let localResults = performLocalSearch(cleanQuery)

  // 2. If 0 local results and query is Spanish, attempt Spanish Wiki translation
  let translatedFrom = null
  if (localResults.length === 0 && cleanQuery.length >= 2 && !parsedSetQuery?.isRegional) {
    const translatedQuery = await translateEsToEn(cleanQuery)
    if (translatedQuery && translatedQuery.toLowerCase() !== cleanQuery) {
      console.log(`[CardSearch] Retrying local search with translated query: "${translatedQuery}"`)
      localResults = performLocalSearch(translatedQuery, rawQuery)
      if (localResults.length > 0) {
        translatedFrom = rawQuery
      }
    }
  }

  const cappedResults = localResults.slice(0, maxResults)

  // 3. Fallback to YGOPRODeck API if no local results
  if (cappedResults.length === 0 && (rawQuery || cleanName || cleanId)) {
    try {
      let searchQuery = cleanQuery
      if (parsedSetQuery && parsedSetQuery.isRegional) {
        searchQuery = parsedSetQuery.convertedCode
      }

      let url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(searchQuery)}`
      if (cleanId) {
        url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(cleanId)}`
      } else if (parsedSetQuery && parsedSetQuery.isRegional) {
        url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(parsedSetQuery.setPrefix)}`
      }

      let apiCards = null
      if (apiCache.has(url)) {
        const cachedEntry = apiCache.get(url)
        if (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
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
            desc: card.desc || card.description || '',
            imageSmall: card.card_images?.[0]?.image_url_small || '',
            imageFull: card.card_images?.[0]?.image_url || '',
            card_sets: sets,
            matchedSetCode: sets[0] ? sets[0].set_code : null,
            translatedFrom,
            isExternal: true,
          }
          externalCardsCache.set(String(card.id), formatted)
          localResults.push(formatted)
          if (localResults.length >= maxResults) break
        }
      }
    } catch (err) {
      console.error('[CardSearch] Error searching YGOPRODeck API:', err.message)
    }
  }

  const finalResults = cappedResults.length > 0 ? cappedResults : localResults

  if (sort && finalResults.length > 0) {
    finalResults.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'atk') return (b.atk || 0) - (a.atk || 0)
      if (sort === 'def') return (b.def || 0) - (a.def || 0)
      if (sort === 'level') return (b.level || 0) - (a.level || 0)
      return 0
    })
  }

  return finalResults.slice(0, maxResults)
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
      desc: found.desc || found.description || '',
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
          desc: card.desc || card.description || '',
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
