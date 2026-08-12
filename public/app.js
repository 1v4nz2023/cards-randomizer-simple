const getDeckApiUrl = () => `${window.API_BASE || '/api'}/deck`

const generateBtn = document.getElementById('generateBtn')
const downloadBtn = document.getElementById('downloadBtn')
const loadingEl = document.getElementById('loading')
const deckDisplayEl = document.getElementById('deckDisplay')
const deckInfoEl = document.getElementById('deckInfo')
const errorEl = document.getElementById('error')
const mainDeckCardsEl = document.getElementById('mainDeckCards')
const extraDeckCardsEl = document.getElementById('extraDeckCards')
const mainCountEl = document.getElementById('mainCount')
const extraCountEl = document.getElementById('extraCount')

let currentDeckData = null

generateBtn.addEventListener('click', async () => {
  hide(errorEl)
  show(loadingEl)
  hide(deckDisplayEl)
  hide(deckInfoEl)
  downloadBtn.disabled = true

  try {
    const response = await fetch(getDeckApiUrl())
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Error desconocido')
    }

    currentDeckData = result.data
    renderDeck(currentDeckData)

    show(deckDisplayEl)
    show(deckInfoEl)
    downloadBtn.disabled = false
  } catch (err) {
    showError(err.message)
  } finally {
    hide(loadingEl)
  }
})

downloadBtn.addEventListener('click', () => {
  window.open(`${getDeckApiUrl()}/ydk`, '_blank')
})

function renderDeck(data) {
  mainDeckCardsEl.innerHTML = ''
  extraDeckCardsEl.innerHTML = ''

  mainCountEl.textContent = `Main Deck: ${data.mainCount} cartas`
  extraCountEl.textContent = `Extra Deck: ${data.extraCount} cartas`

  data.cards.forEach(card => {
    mainDeckCardsEl.appendChild(createCardElement(card))
  })

  data.extra.forEach(card => {
    extraDeckCardsEl.appendChild(createCardElement(card))
  })
}

function createCardElement(card) {
  const container = document.createElement('div')
  container.className = 'card-container'

  const img = document.createElement('img')
  img.src = card.imageSmall || card.imageFull || ''
  img.alt = card.name
  img.loading = 'lazy'

  const nameEl = document.createElement('div')
  nameEl.className = 'card-name'
  nameEl.textContent = card.name

  const typeEl = document.createElement('div')
  typeEl.className = 'card-type-label'
  typeEl.textContent = card.humanReadableCardType || card.type

  container.appendChild(img)
  container.appendChild(nameEl)
  container.appendChild(typeEl)

  container.addEventListener('click', () => showCardModal(card))

  return container
}

function showCardModal(card) {
  const cardZoomModal = document.getElementById('cardZoomModal')
  const closeCardZoomModalBtn = document.getElementById('closeCardZoomModalBtn')
  const zoomCardImg = document.getElementById('zoomCardImg')
  const zoomCardTitle = document.getElementById('zoomCardTitle')
  const zoomCardMeta = document.getElementById('zoomCardMeta')
  const zoomCardDesc = document.getElementById('zoomCardDesc')

  if (!cardZoomModal || !zoomCardImg) {
    console.error('cardZoomModal not found in DOM')
    return
  }

  const imgUrl = card.imageFull || card.card_images?.[0]?.image_url || card.imageSmall || card.card_images?.[0]?.image_url_small || card.image_url || ''
  zoomCardImg.src = imgUrl

  if (zoomCardTitle) zoomCardTitle.textContent = card.name || card.card_name || 'Carta Yu-Gi-Oh!'
  
  const typeStr = card.humanReadableCardType || card.type || card.card_type || ''
  const attrStr = card.attribute ? ` · ${card.attribute}` : ''
  const raceStr = card.race ? ` · ${card.race}` : ''
  const atkStr = card.atk !== undefined && card.atk !== null ? ` · ATK/${card.atk}` : ''
  const defStr = card.def !== undefined && card.def !== null ? ` DEF/${card.def}` : ''
  if (zoomCardMeta) zoomCardMeta.textContent = `${typeStr}${attrStr}${raceStr}${atkStr}${defStr}`

  if (zoomCardDesc) zoomCardDesc.textContent = card.desc || card.description || card.notes || 'Sin descripción disponible.'

  if (closeCardZoomModalBtn) closeCardZoomModalBtn.onclick = () => cardZoomModal.classList.add('hidden')
  cardZoomModal.onclick = (e) => {
    if (e.target === cardZoomModal) cardZoomModal.classList.add('hidden')
  }

  cardZoomModal.classList.remove('hidden')
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('cardZoomModal')
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden')
    }
  }
})

function show(el) {
  el.classList.remove('hidden')
}

function hide(el) {
  el.classList.add('hidden')
}

function showError(message) {
  errorEl.textContent = message
  show(errorEl)
}
