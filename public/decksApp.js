// Auth Check
const token = localStorage.getItem('ygo_token')
const currentUser = JSON.parse(localStorage.getItem('ygo_user') || 'null')

if (!token || !currentUser) {
  window.location.href = 'index.html'
}

function getApiUrl(path) {
  return `/api/decks${path}`
}

// User Avatar Header
const userInitials = document.getElementById('userInitials')
const userAvatarBtn = document.getElementById('userAvatarBtn')
const userDropdown = document.getElementById('userDropdown')
const userDropdownEmail = document.getElementById('userDropdownEmail')
const logoutBtn = document.getElementById('logoutBtn')

if (userDropdownEmail) userDropdownEmail.textContent = currentUser.email
if (userInitials && currentUser.email) {
  const parts = currentUser.email.split('@')[0].split(/[._-]/)
  userInitials.textContent = parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : currentUser.email.substring(0, 2).toUpperCase()
}

userAvatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  userDropdown?.classList.toggle('hidden')
})
document.addEventListener('click', () => userDropdown?.classList.add('hidden'))
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('ygo_token')
  localStorage.removeItem('ygo_user')
  window.location.href = 'index.html'
})

// State
let userDecks = []
let currentDeck = null
let userBinderItems = []
let activeSectionTab = 'main' // 'main', 'extra', 'side'

// Elements - Gallery View
const decksGalleryView = document.getElementById('decksGalleryView')
const decksGrid = document.getElementById('decksGrid')
const emptyDecksState = document.getElementById('emptyDecksState')
const decksLoading = document.getElementById('decksLoading')
const decksSearchInput = document.getElementById('decksSearchInput')

// Elements - Editor View
const deckEditorView = document.getElementById('deckEditorView')
const backToDecksBtn = document.getElementById('backToDecksBtn')
const editorDeckTitle = document.getElementById('editorDeckTitle')
const editorDeckFormat = document.getElementById('editorDeckFormat')
const deckMenuBtn = document.getElementById('deckMenuBtn')
const deckMenuDropdown = document.getElementById('deckMenuDropdown')
const editorExportYdkBtn = document.getElementById('editorExportYdkBtn')
const editorEditMetaBtn = document.getElementById('editorEditMetaBtn')
const editorDeleteDeckBtn = document.getElementById('editorDeleteDeckBtn')

// Tabs Elements
const tabMainBtn = document.getElementById('tabMainBtn')
const tabExtraBtn = document.getElementById('tabExtraBtn')
const tabSideBtn = document.getElementById('tabSideBtn')
const tabMainCount = document.getElementById('tabMainCount')
const tabExtraCount = document.getElementById('tabExtraCount')
const tabSideCount = document.getElementById('tabSideCount')

const colMainDeck = document.getElementById('colMainDeck')
const colExtraDeck = document.getElementById('colExtraDeck')
const colSideDeck = document.getElementById('colSideDeck')

const mainDeckGrid = document.getElementById('mainDeckGrid')
const extraDeckGrid = document.getElementById('extraDeckGrid')
const sideDeckGrid = document.getElementById('sideDeckGrid')
const mainCountTag = document.getElementById('mainCountTag')
const extraCountTag = document.getElementById('extraCountTag')
const sideCountTag = document.getElementById('sideCountTag')

// Drawer & Bottom Sheet
const drawerSearchInput = document.getElementById('drawerSearchInput')
const drawerBinderList = document.getElementById('drawerBinderList')

const openMobileDrawerBtn = document.getElementById('openMobileDrawerBtn')
const bottomSheetOverlay = document.getElementById('bottomSheetOverlay')
const closeBottomSheetBtn = document.getElementById('closeBottomSheetBtn')
const mobileDrawerSearch = document.getElementById('mobileDrawerSearch')
const mobileDrawerBinderList = document.getElementById('mobileDrawerBinderList')

// Modals
const createDeckModal = document.getElementById('createDeckModal')
const openCreateDeckModalBtn = document.getElementById('openCreateDeckModalBtn')
const closeCreateDeckModalBtn = document.getElementById('closeCreateDeckModalBtn')
const cancelCreateDeckBtn = document.getElementById('cancelCreateDeckBtn')
const createDeckForm = document.getElementById('createDeckForm')
const createDeckName = document.getElementById('createDeckName')
const createDeckFormat = document.getElementById('createDeckFormat')

const importYdkDeckModal = document.getElementById('importYdkDeckModal')
const openImportYdkDeckModalBtn = document.getElementById('openImportYdkDeckModalBtn')
const closeImportYdkDeckModalBtn = document.getElementById('closeImportYdkDeckModalBtn')
const cancelImportYdkDeckBtn = document.getElementById('cancelImportYdkDeckBtn')
const importYdkDeckForm = document.getElementById('importYdkDeckForm')
const importDeckName = document.getElementById('importDeckName')
const importDeckFormat = document.getElementById('importDeckFormat')
const importYdkDeckFile = document.getElementById('importYdkDeckFile')
const importYdkDeckText = document.getElementById('importYdkDeckText')
const importYdkDeckStatus = document.getElementById('importYdkDeckStatus')

// Initializer
async function init() {
  await fetchDecks()
  checkUrlParams()
  setupTabListeners()
  setupMenuListeners()
  setupBottomSheetListeners()
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search)
  const deckId = params.get('id')
  if (deckId) {
    openDeckEditor(deckId)
  }
}

// Fetch all decks
async function fetchDecks() {
  decksLoading?.classList.remove('hidden')
  emptyDecksState?.classList.add('hidden')

  try {
    const res = await fetch(getApiUrl(''), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      userDecks = data.data
      renderDecksGallery()
    }
  } catch (err) {
    console.error('Error fetching decks:', err)
  } finally {
    decksLoading?.classList.add('hidden')
  }
}

// Render Decks Gallery Grid
function renderDecksGallery() {
  const query = (decksSearchInput?.value || '').trim().toLowerCase()
  const filtered = userDecks.filter(d => !query || d.name.toLowerCase().includes(query))

  decksGrid.innerHTML = ''

  if (filtered.length === 0) {
    emptyDecksState?.classList.remove('hidden')
    decksGrid?.classList.add('hidden')
    return
  }

  emptyDecksState?.classList.add('hidden')
  decksGrid?.classList.remove('hidden')

  filtered.forEach(deck => {
    const card = document.createElement('div')
    card.className = 'deck-summary-card'

    const mainOk = deck.main_count >= 40 && deck.main_count <= 60
    const extraOk = deck.extra_count <= 15
    const sideOk = deck.side_count <= 15

    card.innerHTML = `
      <div class="deck-card-top">
        <div class="deck-card-title-wrap">
          <h3 class="deck-name-title">${deck.name}</h3>
          <span class="badge-format">${deck.format || 'TCG'}</span>
        </div>
        <div class="deck-date-tag">Modificado: ${new Date(deck.updated_at).toLocaleDateString()}</div>
      </div>

      <div class="deck-card-metrics">
        <div class="metric-pill ${mainOk ? 'ok' : 'warn'}">⚔️ Main: ${deck.main_count}/40-60</div>
        <div class="metric-pill ${extraOk ? 'ok' : 'warn'}">🌟 Extra: ${deck.extra_count}/15</div>
        <div class="metric-pill ${sideOk ? 'ok' : 'warn'}">🛡️ Side: ${deck.side_count}/15</div>
      </div>

      <div class="deck-card-actions">
        <button class="btn btn-add-yellow btn-sm btn-open-editor" title="Editar"><span class="icon-emoji">✏️ </span><span class="btn-text">Editar</span></button>
        <button class="btn btn-secondary btn-sm btn-export-ydk" title="Exportar"><span class="icon-emoji">📤 </span><span class="btn-text">Exportar</span></button>
        <button class="btn btn-danger-icon btn-delete-deck" title="Eliminar"><span class="icon-emoji">🗑️</span><span class="btn-text">Eliminar</span></button>
      </div>
    `

    card.querySelector('.btn-open-editor').addEventListener('click', () => openDeckEditor(deck.id))
    card.querySelector('.btn-export-ydk').addEventListener('click', () => exportDeckYdk(deck.id))
    card.querySelector('.btn-delete-deck').addEventListener('click', () => deleteDeck(deck.id))

    decksGrid.appendChild(card)
  })
}

// Open Deck Editor
async function openDeckEditor(deckId) {
  decksGalleryView?.classList.add('hidden')
  deckEditorView?.classList.remove('hidden')

  try {
    const res = await fetch(getApiUrl(`/${deckId}`), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      currentDeck = data.data
      renderDeckEditorHeader()
      renderDeckColumns()
      await fetchBinderDrawer()
      switchTab('main')
    } else {
      alert(data.error || 'No se pudo cargar el deck.')
      backToDecksGallery()
    }
  } catch (err) {
    console.error('Error opening deck editor:', err)
  }
}

function backToDecksGallery() {
  deckEditorView?.classList.add('hidden')
  decksGalleryView?.classList.remove('hidden')
  bottomSheetOverlay?.classList.add('hidden')
  currentDeck = null
  fetchDecks()
}

// Render Header & Tab Badges
function renderDeckEditorHeader() {
  if (!currentDeck) return
  if (editorDeckTitle) editorDeckTitle.textContent = currentDeck.name
  if (editorDeckFormat) editorDeckFormat.textContent = currentDeck.format || 'TCG'

  const mainCount = currentDeck.sections.main.reduce((acc, c) => acc + c.assigned_quantity, 0)
  const extraCount = currentDeck.sections.extra.reduce((acc, c) => acc + c.assigned_quantity, 0)
  const sideCount = currentDeck.sections.side.reduce((acc, c) => acc + c.assigned_quantity, 0)

  // Update tab counts
  if (tabMainCount) tabMainCount.textContent = `${mainCount}/40`
  if (tabExtraCount) tabExtraCount.textContent = `${extraCount}/15`
  if (tabSideCount) tabSideCount.textContent = `${sideCount}/15`

  // Update tab validation classes
  tabMainBtn?.classList.toggle('warn-count', mainCount < 40 || mainCount > 60)
  tabExtraBtn?.classList.toggle('warn-count', extraCount > 15)
  tabSideBtn?.classList.toggle('warn-count', sideCount > 15)
}

// Tab Switching
function setupTabListeners() {
  [tabMainBtn, tabExtraBtn, tabSideBtn].forEach(btn => {
    btn?.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab')
      switchTab(tab)
    })
  })
}

function switchTab(tabName) {
  activeSectionTab = tabName

  // Toggle active class on tab buttons
  tabMainBtn?.classList.toggle('active', tabName === 'main')
  tabExtraBtn?.classList.toggle('active', tabName === 'extra')
  tabSideBtn?.classList.toggle('active', tabName === 'side')

  // Show/Hide columns on mobile viewports
  if (window.innerWidth <= 900) {
    colMainDeck?.classList.toggle('hidden-mobile', tabName !== 'main')
    colExtraDeck?.classList.toggle('hidden-mobile', tabName !== 'extra')
    colSideDeck?.classList.toggle('hidden-mobile', tabName !== 'side')
  } else {
    colMainDeck?.classList.remove('hidden-mobile')
    colExtraDeck?.classList.remove('hidden-mobile')
    colSideDeck?.classList.remove('hidden-mobile')
  }
}

// Header Menu Dropdown Listener
function setupMenuListeners() {
  deckMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    deckMenuDropdown?.classList.toggle('hidden')
  })
  document.addEventListener('click', () => deckMenuDropdown?.classList.add('hidden'))
}

// Bottom Sheet Listeners
function setupBottomSheetListeners() {
  openMobileDrawerBtn?.addEventListener('click', () => {
    bottomSheetOverlay?.classList.remove('hidden')
    renderMobileBinderDrawer()
  })
  closeBottomSheetBtn?.addEventListener('click', () => {
    bottomSheetOverlay?.classList.add('hidden')
  })
  bottomSheetOverlay?.addEventListener('click', (e) => {
    if (e.target === bottomSheetOverlay) {
      bottomSheetOverlay.classList.add('hidden')
    }
  })
}

// Render 3 Deck Columns with Styled Empty States
function renderDeckColumns() {
  if (!currentDeck) return

  const renderSectionCards = (gridEl, countTagEl, cardList, sectionName, sectionKey) => {
    gridEl.innerHTML = ''
    const totalSectionQty = cardList.reduce((acc, c) => acc + c.assigned_quantity, 0)
    countTagEl.textContent = `(${totalSectionQty})`

    if (cardList.length === 0) {
      gridEl.innerHTML = `
        <div class="section-empty-state">
          <div class="empty-cards-icon">🎴</div>
          <p class="empty-primary">Sin cartas en ${sectionName.toLowerCase()}.</p>
          <p class="empty-secondary">Agrega desde tu binder.</p>
        </div>
      `
      return
    }

    cardList.forEach(item => {
      const cardEl = document.createElement('div')
      cardEl.className = 'deck-item-card'
      cardEl.innerHTML = `
        <div class="deck-item-img-wrap">
          <img src="${item.imageSmall || item.imageFull}" alt="${item.card_name}">
          <span class="qty-badge-top">x${item.assigned_quantity}</span>
        </div>
        <div class="deck-item-info">
          <div class="deck-item-name" title="${item.card_name}">${item.card_name}</div>
          <div class="deck-item-sub">${item.humanReadableCardType || item.card_type}</div>
        </div>
        <div class="deck-item-controls">
          <button class="btn-item-ctrl minus-btn" title="Quitar 1 copia">-</button>
          <button class="btn-item-ctrl plus-btn" title="Añadir 1 copia">+</button>
          <button class="btn-item-ctrl remove-all-btn" title="Remover del deck">&times;</button>
        </div>
      `

      // Card Zoom Modal click
      cardEl.querySelector('.deck-item-img-wrap img')?.addEventListener('click', () => openCardZoomModal(item))
      cardEl.querySelector('.deck-item-name')?.addEventListener('click', () => openCardZoomModal(item))

      cardEl.querySelector('.minus-btn').addEventListener('click', () => {
        updateDeckCardQty(item.deck_card_id, item.assigned_quantity - 1, item.section)
      })
      cardEl.querySelector('.plus-btn').addEventListener('click', () => {
        updateDeckCardQty(item.deck_card_id, item.assigned_quantity + 1, item.section)
      })
      cardEl.querySelector('.remove-all-btn').addEventListener('click', () => {
        removeDeckCardItem(item.deck_card_id)
      })

      gridEl.appendChild(cardEl)
    })
  }

  renderSectionCards(mainDeckGrid, mainCountTag, currentDeck.sections.main, 'Main Deck', 'main')
  renderSectionCards(extraDeckGrid, extraCountTag, currentDeck.sections.extra, 'Extra Deck', 'extra')
  renderSectionCards(sideDeckGrid, sideCountTag, currentDeck.sections.side, 'Side Deck', 'side')
}

// Fetch Binder Inventory
async function fetchBinderDrawer() {
  try {
    const res = await fetch('/api/inventory', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.success) {
      userBinderItems = data.data
      renderDesktopBinderDrawer()
      renderMobileBinderDrawer()
    }
  } catch (err) {
    console.error('Error fetching binder drawer:', err)
  }
}

// Render Desktop Binder Drawer
function renderDesktopBinderDrawer() {
  if (!drawerBinderList) return
  const search = (drawerSearchInput?.value || '').trim().toLowerCase()
  renderBinderItemsList(drawerBinderList, search)
}

// Render Mobile Bottom Sheet Drawer
function renderMobileBinderDrawer() {
  if (!mobileDrawerBinderList) return
  const search = (mobileDrawerSearch?.value || '').trim().toLowerCase()
  renderBinderItemsList(mobileDrawerBinderList, search)
}

// Shared Renderer for Binder Drawer Cards (Matching Mockup Screenshot)
function renderBinderItemsList(containerEl, searchFilter) {
  const filtered = userBinderItems.filter(item => {
    return !searchFilter ||
      (item.card_name && item.card_name.toLowerCase().includes(searchFilter)) ||
      (item.card_code && item.card_code.toLowerCase().includes(searchFilter)) ||
      (item.set_name && item.set_name.toLowerCase().includes(searchFilter))
  })

  containerEl.innerHTML = ''

  if (filtered.length === 0) {
    containerEl.innerHTML = '<div class="empty-drawer-msg">No hay cartas en tu binder con esos criterios.</div>'
    return
  }

  filtered.forEach(item => {
    const isAvail = (item.available_quantity !== undefined ? item.available_quantity : item.quantity) > 0
    const availQty = item.available_quantity !== undefined ? item.available_quantity : item.quantity
    const totalQty = item.quantity || 1

    const typeStr = (item.card_type || item.humanReadableCardType || '').toLowerCase()
    const extraKeywords = ['fusion', 'synchro', 'xyz', 'link']
    const isExtraCard = extraKeywords.some(k => typeStr.includes(k))

    const itemEl = document.createElement('div')
    itemEl.className = `drawer-horizontal-card ${isAvail ? '' : 'disabled'}`

    // Button label: "+ Extra", "+ Main", or "En deck"
    let buttonHtml = ''
    if (!isAvail) {
      buttonHtml = `<button class="btn-drawer-action in-deck" disabled>En deck</button>`
    } else if (isExtraCard) {
      buttonHtml = `<button class="btn-drawer-action add-extra">+ Extra</button>`
    } else {
      buttonHtml = `
        <div class="multi-btn-group">
          <button class="btn-drawer-action add-main">+ Main</button>
          <button class="btn-drawer-action add-side">+ Side</button>
        </div>
      `
    }

    itemEl.innerHTML = `
      <img class="drawer-card-img" src="${item.imageSmall || item.imageFull}" alt="${item.card_name}">
      <div class="drawer-card-info">
        <h4 class="drawer-card-name" title="${item.card_name}">${item.card_name}</h4>
        <div class="drawer-card-meta">
          ${item.humanReadableCardType || item.card_type || 'Carta'} · <span class="avail-tag">${availQty}/${totalQty} disponibles</span>
        </div>
      </div>
      <div class="drawer-card-btn-wrap">
        ${buttonHtml}
      </div>
    `

    // Zoom modal image and name click
    itemEl.querySelector('.drawer-card-img')?.addEventListener('click', () => openCardZoomModal(item))
    itemEl.querySelector('.drawer-card-name')?.addEventListener('click', () => openCardZoomModal(item))

    // Attach click events
    if (isAvail) {
      const addExtraBtn = itemEl.querySelector('.add-extra')
      const addMainBtn = itemEl.querySelector('.add-main')
      const addSideBtn = itemEl.querySelector('.add-side')

      addExtraBtn?.addEventListener('click', () => quickAssignToCurrentDeck(item.id, 'extra'))
      addMainBtn?.addEventListener('click', () => quickAssignToCurrentDeck(item.id, 'main'))
      addSideBtn?.addEventListener('click', () => quickAssignToCurrentDeck(item.id, 'side'))
    }

    containerEl.appendChild(itemEl)
  })
}

// Quick Assign from Drawer to Deck
async function quickAssignToCurrentDeck(inventoryCardId, section) {
  if (!currentDeck) return

  try {
    const res = await fetch(getApiUrl(`/${currentDeck.id}/cards`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ inventory_card_id: inventoryCardId, section, quantity: 1 })
    })
    const data = await res.json()

    if (data.success) {
      currentDeck = data.data
      renderDeckEditorHeader()
      renderDeckColumns()
      await fetchBinderDrawer()
    } else {
      alert(data.error || 'No se pudo agregar la carta al deck.')
    }
  } catch (err) {
    console.error('Error quick assigning:', err)
  }
}

// Update Quantity or Section of a Card in Deck
async function updateDeckCardQty(deckCardId, newQuantity, section) {
  if (!currentDeck) return

  try {
    const res = await fetch(getApiUrl(`/${currentDeck.id}/cards/${deckCardId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ quantity: newQuantity, section })
    })
    const data = await res.json()

    if (data.success) {
      currentDeck = data.data
      renderDeckEditorHeader()
      renderDeckColumns()
      await fetchBinderDrawer()
    } else {
      alert(data.error || 'No se pudo actualizar la carta.')
    }
  } catch (err) {
    console.error('Error updating deck card:', err)
  }
}

// Remove Card from Deck
async function removeDeckCardItem(deckCardId) {
  if (!currentDeck) return

  try {
    const res = await fetch(getApiUrl(`/${currentDeck.id}/cards/${deckCardId}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      currentDeck = data.data
      renderDeckEditorHeader()
      renderDeckColumns()
      await fetchBinderDrawer()
    } else {
      alert(data.error || 'No se pudo remover la carta del deck.')
    }
  } catch (err) {
    console.error('Error removing card from deck:', err)
  }
}

// Create Deck Form Submit
createDeckForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = createDeckName.value.trim()
  const format = createDeckFormat.value

  try {
    const res = await fetch(getApiUrl(''), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, format })
    })
    const data = await res.json()

    if (data.success) {
      createDeckModal?.classList.add('hidden')
      createDeckForm.reset()
      await fetchDecks()
      openDeckEditor(data.data.id)
    } else {
      alert(data.error || 'Error al crear el deck.')
    }
  } catch (err) {
    console.error('Error creating deck:', err)
  }
})

// YDK Deck Import
importYdkDeckForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = importDeckName.value.trim()
  const format = importDeckFormat.value
  const file = importYdkDeckFile.files[0]
  let content = importYdkDeckText.value.trim()

  if (file) {
    const reader = new FileReader()
    reader.onload = async (event) => {
      content = event.target.result
      await processYdkDeckImport(name, format, content)
    }
    reader.readAsText(file)
  } else if (content) {
    await processYdkDeckImport(name, format, content)
  } else {
    importYdkDeckStatus.textContent = 'Selecciona un archivo .ydk o pega el texto.'
    importYdkDeckStatus.classList.remove('hidden')
  }
})

async function processYdkDeckImport(name, format, ydkContent) {
  try {
    const submitBtn = document.getElementById('submitImportYdkDeckBtn')
    if (submitBtn) submitBtn.disabled = true

    const res = await fetch(getApiUrl('/import-ydk'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, format, ydkContent })
    })
    const data = await res.json()

    if (data.success) {
      alert(data.message)
      importYdkDeckModal?.classList.add('hidden')
      importYdkDeckForm.reset()
      await fetchDecks()
      openDeckEditor(data.data.id)
    } else {
      importYdkDeckStatus.textContent = data.error || 'Error al importar YDK.'
      importYdkDeckStatus.classList.remove('hidden')
    }
  } catch (err) {
    console.error('Error importing YDK deck:', err)
    importYdkDeckStatus.textContent = 'Error de conexión al importar YDK.'
    importYdkDeckStatus.classList.remove('hidden')
  } finally {
    const submitBtn = document.getElementById('submitImportYdkDeckBtn')
    if (submitBtn) submitBtn.disabled = false
  }
}

// Delete Deck
async function deleteDeck(deckId) {
  if (!confirm('¿Estás seguro de eliminar este deck? Todas las cartas asignadas volverán a estar libres en tu binder.')) return

  try {
    const res = await fetch(getApiUrl(`/${deckId}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      await fetchDecks()
    } else {
      alert(data.error || 'Error al eliminar el deck.')
    }
  } catch (err) {
    console.error('Error deleting deck:', err)
  }
}

// Export Deck YDK with Authentication & Clean File Download
async function exportDeckYdk(deckId) {
  try {
    const res = await fetch(getApiUrl(`/${deckId}/ydk`), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deck_${deckId}.ydk`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      window.open(`${getApiUrl(`/${deckId}/ydk`)}?token=${encodeURIComponent(token)}`, '_blank')
    }
  } catch (err) {
    console.error('Error exporting YDK:', err)
    window.open(`${getApiUrl(`/${deckId}/ydk`)}?token=${encodeURIComponent(token)}`, '_blank')
  }
}

// Modal event listeners
openCreateDeckModalBtn?.addEventListener('click', () => {
  createDeckForm.reset()
  createDeckModal?.classList.remove('hidden')
})
closeCreateDeckModalBtn?.addEventListener('click', () => createDeckModal?.classList.add('hidden'))
cancelCreateDeckBtn?.addEventListener('click', () => createDeckModal?.classList.add('hidden'))

openImportYdkDeckModalBtn?.addEventListener('click', () => {
  importYdkDeckForm.reset()
  importYdkDeckStatus?.classList.add('hidden')
  importYdkDeckModal?.classList.remove('hidden')
})
closeImportYdkDeckModalBtn?.addEventListener('click', () => importYdkDeckModal?.classList.add('hidden'))
cancelImportYdkDeckBtn?.addEventListener('click', () => importYdkDeckModal?.classList.add('hidden'))

backToDecksBtn?.addEventListener('click', backToDecksGallery)
editorExportYdkBtn?.addEventListener('click', () => {
  if (currentDeck) exportDeckYdk(currentDeck.id)
})

editorEditMetaBtn?.addEventListener('click', async () => {
  if (!currentDeck) return
  const newName = prompt('Nuevo nombre del deck:', currentDeck.name)
  if (newName && newName.trim()) {
    try {
      const res = await fetch(getApiUrl(`/${currentDeck.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName.trim() })
      })
      const data = await res.json()
      if (data.success) {
        currentDeck = data.data
        renderDeckEditorHeader()
      }
    } catch (err) {
      console.error(err)
    }
  }
})

editorDeleteDeckBtn?.addEventListener('click', () => {
  if (currentDeck) deleteDeck(currentDeck.id)
})

decksSearchInput?.addEventListener('input', renderDecksGallery)
drawerSearchInput?.addEventListener('input', renderDesktopBinderDrawer)
mobileDrawerSearch?.addEventListener('input', renderMobileBinderDrawer)

// Card Zoom Modal Functions
function openCardZoomModal(item) {
  const cardZoomModal = document.getElementById('cardZoomModal')
  const closeCardZoomModalBtn = document.getElementById('closeCardZoomModalBtn')
  const zoomCardImg = document.getElementById('zoomCardImg')
  const zoomCardTitle = document.getElementById('zoomCardTitle')
  const zoomCardMeta = document.getElementById('zoomCardMeta')
  const zoomCardDesc = document.getElementById('zoomCardDesc')

  if (!cardZoomModal || !zoomCardImg) return

  const imgUrl = item.imageFull || item.card_images?.[0]?.image_url || item.imageSmall || item.card_images?.[0]?.image_url_small || item.image_url || ''
  zoomCardImg.src = imgUrl

  if (zoomCardTitle) zoomCardTitle.textContent = item.card_name || item.name || 'Carta Yu-Gi-Oh!'
  
  const typeStr = item.humanReadableCardType || item.card_type || item.type || ''
  const attrStr = item.attribute ? ` · ${item.attribute}` : ''
  const raceStr = item.race ? ` · ${item.race}` : ''
  const codeStr = item.card_code || item.set_name ? ` (${item.card_code || item.set_name})` : ''
  if (zoomCardMeta) zoomCardMeta.textContent = `${typeStr}${attrStr}${raceStr}${codeStr}`

  if (zoomCardDesc) zoomCardDesc.textContent = item.desc || item.description || item.notes || 'Sin descripción disponible.'

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

// Init
init()
