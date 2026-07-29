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
    const response = await fetch('/api/deck')
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
  window.open('/api/deck/ydk', '_blank')
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
  let modal = document.querySelector('.card-modal')
  if (!modal) {
    modal = document.createElement('div')
    modal.className = 'card-modal'
    modal.innerHTML = `
      <div class="card-modal-content">
        <img id="modalImage" src="" alt="">
        <div id="modalName" class="modal-name"></div>
        <div id="modalType" class="modal-type"></div>
        <button id="modalClose" class="modal-close">Cerrar</button>
      </div>
    `
    document.body.appendChild(modal)

    document.getElementById('modalClose').addEventListener('click', () => {
      modal.classList.remove('active')
    })

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active')
      }
    })
  }

  const modalImage = document.getElementById('modalImage')
  const modalName = document.getElementById('modalName')
  const modalType = document.getElementById('modalType')

  modalImage.src = card.imageFull || card.imageSmall || ''
  modalName.textContent = card.name
  modalType.textContent = card.type
  modal.classList.add('active')
}

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
