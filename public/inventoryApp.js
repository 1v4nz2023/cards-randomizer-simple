// Dynamic API Base helper (supports subpath deployments like /cards/)
const API_BASE = window.API_BASE || (window.location.pathname.includes('/cards/') ? '/cards/api' : '/api')
const getInventoryApiUrl = (path = '') => `${API_BASE}/inventory${path}`

// Token & Authentication handling (Protección estricta - Redirige si no hay token)
const token = localStorage.getItem('ygo_token')
const userStr = localStorage.getItem('ygo_user')

if (!token) {
  window.location.href = 'login.html'
}

let currentUser = null
try {
  currentUser = JSON.parse(userStr)
} catch (e) {}

// DOM Elements
const userEmailSpan = document.getElementById('userEmailSpan')
const logoutBtn = document.getElementById('logoutBtn')

const totalCardsCountEl = document.getElementById('totalCardsCount')
const uniqueCardsCountEl = document.getElementById('uniqueCardsCount')
const totalPagesCountEl = document.getElementById('totalPagesCount')
const extraDeckCountEl = document.getElementById('extraDeckCount')
const spellsCountEl = document.getElementById('spellsCount')
const trapsCountEl = document.getElementById('trapsCount')

const openAddModalBtn = document.getElementById('openAddModalBtn')
const filterSearchInput = document.getElementById('filterSearchInput')
const filterTypeSelect = document.getElementById('filterTypeSelect')
const filterAttributeSelect = document.getElementById('filterAttributeSelect')
const filterRaceSelect = document.getElementById('filterRaceSelect')
const filterSetSelect = document.getElementById('filterSetSelect')
const filterPageSelect = document.getElementById('filterPageSelect')

const inventoryLoading = document.getElementById('inventoryLoading')
const inventoryGrid = document.getElementById('inventoryGrid')
const emptyState = document.getElementById('emptyState')

// Pagination Elements
const paginationWrap = document.getElementById('paginationWrap')
const paginationInfo = document.getElementById('paginationInfo')
const paginationPageNum = document.getElementById('paginationPageNum')
const prevPageBtn = document.getElementById('prevPageBtn')
const nextPageBtn = document.getElementById('nextPageBtn')

// Modals
const addCardModal = document.getElementById('addCardModal')
const closeAddModalBtn = document.getElementById('closeAddModalBtn')
const cancelAddBtn = document.getElementById('cancelAddBtn')

const editCardModal = document.getElementById('editCardModal')
const closeEditModalBtn = document.getElementById('closeEditModalBtn')
const cancelEditBtn = document.getElementById('cancelEditBtn')

// Autocomplete & Add Form elements
const cardSearchInput = document.getElementById('cardSearchInput')
const modalSearchType = document.getElementById('modalSearchType')
const modalSearchAttribute = document.getElementById('modalSearchAttribute')
const modalSearchRace = document.getElementById('modalSearchRace')
const modalSearchLevel = document.getElementById('modalSearchLevel')
const autocompleteResults = document.getElementById('autocompleteResults')
const selectedCardPreview = document.getElementById('selectedCardPreview')
const previewImage = document.getElementById('previewImage')
const previewName = document.getElementById('previewName')
const previewType = document.getElementById('previewType')
const addCardForm = document.getElementById('addCardForm')

const addCardId = document.getElementById('addCardId')
const addSetSelect = document.getElementById('addSetSelect')
const addRarity = document.getElementById('addRarity')
const addCardCode = document.getElementById('addCardCode')
const addQuantity = document.getElementById('addQuantity')
const addCondition = document.getElementById('addCondition')
const addBinderPage = document.getElementById('addBinderPage')
const addBinderSlot = document.getElementById('addBinderSlot')
const addNotes = document.getElementById('addNotes')

// Edit Form elements
const editCardForm = document.getElementById('editCardForm')
const editInventoryId = document.getElementById('editInventoryId')
const editPreviewImage = document.getElementById('editPreviewImage')
const editPreviewName = document.getElementById('editPreviewName')
const editPreviewType = document.getElementById('editPreviewType')
const editSetName = document.getElementById('editSetName')
const editRarity = document.getElementById('editRarity')
const editCardCode = document.getElementById('editCardCode')
const editQuantity = document.getElementById('editQuantity')
const editCondition = document.getElementById('editCondition')
const editBinderPage = document.getElementById('editBinderPage')
const editBinderSlot = document.getElementById('editBinderSlot')
const editNotes = document.getElementById('editNotes')

// Local state
let inventoryData = []
let searchDebounceTimeout = null
const CARDS_PER_PAGE = 40
let currentPaginationPage = 1

// Avatar & User Dropdown Elements
const userAvatarBtn = document.getElementById('userAvatarBtn')
const userInitials = document.getElementById('userInitials')
const userDropdown = document.getElementById('userDropdown')
const userDropdownEmail = document.getElementById('userDropdownEmail')

if (currentUser) {
  if (userDropdownEmail) userDropdownEmail.textContent = currentUser.email
  if (userInitials && currentUser.email) {
    const parts = currentUser.email.split('@')[0].split(/[._-]/)
    const initials = parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : currentUser.email.substring(0, 2).toUpperCase()
    userInitials.textContent = initials
  }
}

userAvatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  userDropdown?.classList.toggle('hidden')
})

document.addEventListener('click', () => {
  userDropdown?.classList.add('hidden')
})

// Logout event
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('ygo_token')
  localStorage.removeItem('ygo_user')
  window.location.href = 'login.html'
})

// Initialize Page
async function init() {
  await fetchInventory()
}

// Fetch Inventory Data
async function fetchInventory() {
  inventoryLoading.classList.remove('hidden')
  inventoryGrid.classList.add('hidden')
  emptyState.classList.add('hidden')

  try {
    const res = await fetch(getInventoryApiUrl(), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (res.status === 401 || !data.success) {
      localStorage.removeItem('ygo_token')
      window.location.href = 'login.html'
      return
    }

    inventoryData = data.data || []
    updateDashboardMetrics()
    populateFilters()
    renderInventory()
  } catch (err) {
    console.error('Error loading inventory:', err)
  } finally {
    inventoryLoading.classList.add('hidden')
  }
}

// Update Dashboard Metrics
function updateDashboardMetrics() {
  let totalCards = 0
  const uniqueCardsSet = new Set()
  const pagesSet = new Set()
  let extraDeckCards = 0
  let spellsCards = 0
  let trapsCards = 0

  const extraDeckKeywords = ['fusion', 'synchro', 'xyz', 'link']

  inventoryData.forEach((item) => {
    const qty = parseInt(item.quantity, 10) || 1
    totalCards += qty
    uniqueCardsSet.add(item.card_id)
    if (item.binder_page !== null && item.binder_page !== undefined) {
      pagesSet.add(item.binder_page)
    }

    const typeStr = (item.card_type || item.humanReadableCardType || '').toLowerCase()
    if (extraDeckKeywords.some((k) => typeStr.includes(k))) {
      extraDeckCards += qty
    } else if (typeStr.includes('spell')) {
      spellsCards += qty
    } else if (typeStr.includes('trap')) {
      trapsCards += qty
    }
  })

  if (totalCardsCountEl) totalCardsCountEl.textContent = totalCards
  if (uniqueCardsCountEl) uniqueCardsCountEl.textContent = uniqueCardsSet.size
  if (totalPagesCountEl) totalPagesCountEl.textContent = pagesSet.size
  if (extraDeckCountEl) extraDeckCountEl.textContent = extraDeckCards
  if (spellsCountEl) spellsCountEl.textContent = spellsCards
  if (trapsCountEl) trapsCountEl.textContent = trapsCards
}

// Populate Set and Page Filter Dropdowns
function populateFilters() {
  const currentSetVal = filterSetSelect.value
  const currentPageVal = filterPageSelect.value

  const sets = new Set()
  const pages = new Set()

  inventoryData.forEach(item => {
    if (item.set_name) sets.add(item.set_name)
    if (item.binder_page) pages.add(item.binder_page)
  })

  // Sets dropdown
  filterSetSelect.innerHTML = '<option value="">Todos los Sets</option>'
  Array.from(sets).sort().forEach(setName => {
    const opt = document.createElement('option')
    opt.value = setName
    opt.textContent = setName
    filterSetSelect.appendChild(opt)
  })
  filterSetSelect.value = currentSetVal

  // Pages dropdown
  filterPageSelect.innerHTML = '<option value="">Todas las Páginas</option>'
  Array.from(pages).sort((a, b) => a - b).forEach(pageNum => {
    const opt = document.createElement('option')
    opt.value = pageNum
    opt.textContent = `Página ${pageNum}`
    filterPageSelect.appendChild(opt)
  })
  filterPageSelect.value = currentPageVal
}

// Render Inventory Cards Grid (Paginación de 40 cartas por hoja en Desktop)
function renderInventory() {
  const searchFilter = (filterSearchInput.value || '').trim().toLowerCase()
  const normSearchFilter = searchFilter.replace(/[^a-z0-9]/g, '')
  const typeFilter = (filterTypeSelect?.value || '').toLowerCase()
  const attributeFilter = (filterAttributeSelect?.value || '').toLowerCase()
  const raceFilter = (filterRaceSelect?.value || '').toLowerCase()
  const setFilter = filterSetSelect.value
  const pageFilter = filterPageSelect.value

  const filtered = inventoryData.filter(item => {
    const cardCode = (item.card_code || '').toLowerCase()
    const normCode = cardCode.replace(/[^a-z0-9]/g, '')

    const matchesSearch = !searchFilter ||
      (item.card_name && item.card_name.toLowerCase().includes(searchFilter)) ||
      (cardCode && cardCode.includes(searchFilter)) ||
      (normSearchFilter.length >= 3 && normCode && normCode.includes(normSearchFilter)) ||
      (item.set_name && item.set_name.toLowerCase().includes(searchFilter)) ||
      (item.rarity && item.rarity.toLowerCase().includes(searchFilter)) ||
      (item.card_id && String(item.card_id).toLowerCase().includes(searchFilter))

    const itemType = (item.card_type || item.humanReadableCardType || '').toLowerCase()
    const matchesType = !typeFilter || itemType.includes(typeFilter)

    const itemAttr = (item.attribute || '').toLowerCase()
    const matchesAttribute = !attributeFilter || itemAttr.includes(attributeFilter)

    const itemRace = (item.race || '').toLowerCase()
    const matchesRace = !raceFilter || itemRace.includes(raceFilter)

    const matchesSet = !setFilter || item.set_name === setFilter
    const matchesPage = !pageFilter || String(item.binder_page) === pageFilter

    return matchesSearch && matchesType && matchesAttribute && matchesRace && matchesSet && matchesPage
  })

  // Pagination calculation (40 cartas por página/hoja)
  const totalItems = filtered.length
  const totalPages = Math.ceil(totalItems / CARDS_PER_PAGE) || 1

  if (currentPaginationPage > totalPages) {
    currentPaginationPage = totalPages
  }
  if (currentPaginationPage < 1) {
    currentPaginationPage = 1
  }

  const startIdx = (currentPaginationPage - 1) * CARDS_PER_PAGE
  const endIdx = startIdx + CARDS_PER_PAGE
  const paginatedItems = filtered.slice(startIdx, endIdx)

  inventoryGrid.innerHTML = ''

  if (totalItems === 0) {
    emptyState.classList.remove('hidden')
    inventoryGrid.classList.add('hidden')
    if (paginationWrap) paginationWrap.classList.add('hidden')
    return
  }

  emptyState.classList.add('hidden')
  inventoryGrid.classList.remove('hidden')
  if (paginationWrap) paginationWrap.classList.remove('hidden')

  // Update Pagination Controls Info
  const displayEnd = Math.min(endIdx, totalItems)
  if (paginationInfo) {
    paginationInfo.textContent = `Mostrando ${startIdx + 1}-${displayEnd} de ${totalItems} cartas`
  }
  if (paginationPageNum) {
    paginationPageNum.textContent = `Hoja / Página ${currentPaginationPage} de ${totalPages}`
  }

  if (prevPageBtn) prevPageBtn.disabled = currentPaginationPage <= 1
  if (nextPageBtn) nextPageBtn.disabled = currentPaginationPage >= totalPages

  paginatedItems.forEach(item => {
    const cardEl = document.createElement('div')
    cardEl.className = 'binder-card'

    const condClass = getConditionBadgeClass(item.condition)

    cardEl.innerHTML = `
      <div class="binder-card-img-wrap">
        <img src="${item.imageFull || item.imageSmall || 'placeholder.jpg'}" alt="${item.card_name}" loading="lazy">
        <span class="binder-quantity-badge">${item.quantity}x</span>
        ${item.condition ? `<span class="condition-badge ${condClass}">${getConditionShort(item.condition)}</span>` : ''}
      </div>

      <div class="binder-card-body">
        <h4 class="binder-card-title" title="${item.card_name}">${item.card_name}</h4>
        <div class="binder-card-sub">
          <span class="set-code">${item.card_code || item.set_name || 'Sin set'}</span>
          ${item.rarity ? `<span class="rarity">${item.rarity}</span>` : ''}
        </div>

        <div class="binder-location">
          ${item.binder_page ? `📖 Pág. <strong>${item.binder_page}</strong>` : ''}
          ${item.binder_slot ? ` • Slot <strong>${item.binder_slot}</strong>` : ''}
          ${!item.binder_page && !item.binder_slot ? '📍 Sin Ubicar' : ''}
        </div>

        ${item.notes ? `<div class="binder-notes" title="${item.notes}">📝 ${item.notes}</div>` : ''}
      </div>

      <div class="binder-card-actions">
        <div class="quick-qty-controls">
          <button class="btn-qty btn-minus" data-id="${item.id}">-</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="btn-qty btn-plus" data-id="${item.id}">+</button>
        </div>
        <div class="card-btn-group">
          <button class="btn-icon btn-edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-delete" data-id="${item.id}" title="Eliminar">🗑️</button>
        </div>
      </div>
    `

    // Zoom modal image and title click
    cardEl.querySelector('.binder-card-img-wrap')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-select-checkbox')) return
      openCardZoomModal(item)
    })
    cardEl.querySelector('.binder-card-title')?.addEventListener('click', () => openCardZoomModal(item))

    // Quantity Plus/Minus handlers
    cardEl.querySelector('.btn-plus').addEventListener('click', () => changeQuantity(item, 1))
    cardEl.querySelector('.btn-minus').addEventListener('click', () => changeQuantity(item, -1))

    // Edit button handler
    cardEl.querySelector('.btn-edit').addEventListener('click', () => openEditModal(item))

    // Delete button handler
    cardEl.querySelector('.btn-delete').addEventListener('click', () => deleteCard(item.id))

    inventoryGrid.appendChild(cardEl)
  })
}

// Helpers for Condition Badges
function getConditionBadgeClass(condition) {
  switch (condition) {
    case 'Near Mint': return 'cond-nm'
    case 'Lightly Played': return 'cond-lp'
    case 'Moderately Played': return 'cond-mp'
    case 'Heavily Played': return 'cond-hp'
    case 'Damaged': return 'cond-d'
    default: return 'cond-nm'
  }
}

function getConditionShort(condition) {
  switch (condition) {
    case 'Near Mint': return 'NM'
    case 'Lightly Played': return 'LP'
    case 'Moderately Played': return 'MP'
    case 'Heavily Played': return 'HP'
    case 'Damaged': return 'D'
    default: return condition
  }
}

// Quick Quantity Change (+ / -)
async function changeQuantity(item, delta) {
  const newQty = item.quantity + delta
  if (newQty < 1) {
    if (confirm(`¿Deseas eliminar "${item.card_name}" de tu binder?`)) {
      await deleteCard(item.id)
    }
    return
  }

  try {
    const res = await fetch(getInventoryApiUrl(`/${item.id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ quantity: newQty })
    })
    const data = await res.json()
    if (data.success) {
      const idx = inventoryData.findIndex(i => i.id === item.id)
      if (idx !== -1) {
        inventoryData[idx] = data.data
      }
      updateDashboardMetrics()
      renderInventory()
    }
  } catch (err) {
    console.error('Error updating quantity:', err)
  }
}

// Delete Card from Binder
async function deleteCard(id) {
  if (!confirm('¿Estás seguro de eliminar esta carta de tu binder?')) return

  try {
    const res = await fetch(getInventoryApiUrl(`/${id}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.success) {
      inventoryData = inventoryData.filter(i => i.id !== id)
      updateDashboardMetrics()
      populateFilters()
      renderInventory()
    }
  } catch (err) {
    console.error('Error deleting card:', err)
  }
}

// Add Modal Events
openAddModalBtn.addEventListener('click', () => {
  resetAddForm()
  addCardModal.classList.remove('hidden')
  cardSearchInput.focus()
})

closeAddModalBtn.addEventListener('click', () => addCardModal.classList.add('hidden'))
cancelAddBtn.addEventListener('click', () => addCardModal.classList.add('hidden'))

// Autocomplete Search against cards.json and YGOPRODeck API
function triggerCatalogSearch() {
  const query = (cardSearchInput.value || '').trim()
  const type = modalSearchType?.value || ''
  const attribute = modalSearchAttribute?.value || ''
  const race = modalSearchRace?.value || ''
  const level = modalSearchLevel?.value || ''

  clearTimeout(searchDebounceTimeout)

  if (!query && !type && !attribute && !race && !level) {
    autocompleteResults.innerHTML = ''
    autocompleteResults.classList.add('hidden')
    return
  }

  searchDebounceTimeout = setTimeout(async () => {
    try {
      const queryParams = new URLSearchParams()
      if (query) queryParams.append('q', query)
      if (type) queryParams.append('type', type)
      if (attribute) queryParams.append('attribute', attribute)
      if (race) queryParams.append('race', race)
      if (level) queryParams.append('level', level)

      const res = await fetch(getInventoryApiUrl(`/search?${queryParams.toString()}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success && data.data.length > 0) {
        renderAutocompleteResults(data.data)
      } else {
        autocompleteResults.innerHTML = '<div class="autocomplete-item empty">No se encontraron cartas con esos criterios</div>'
        autocompleteResults.classList.remove('hidden')
      }
    } catch (err) {
      console.error('Error in search:', err)
    }
  }, 250)
}

cardSearchInput?.addEventListener('input', triggerCatalogSearch)
modalSearchType?.addEventListener('change', triggerCatalogSearch)
modalSearchAttribute?.addEventListener('change', triggerCatalogSearch)
modalSearchRace?.addEventListener('change', triggerCatalogSearch)
modalSearchLevel?.addEventListener('change', triggerCatalogSearch)

function renderAutocompleteResults(cards) {
  autocompleteResults.innerHTML = ''
  cards.forEach(card => {
    const item = document.createElement('div')
    item.className = 'autocomplete-item'
    const codeTag = card.matchedSetCode
      ? `<span class="badge-code-highlight">${card.matchedSetCode}</span>`
      : (card.card_sets && card.card_sets[0] ? `<span class="badge-code">${card.card_sets[0].set_code}</span>` : '')

    item.innerHTML = `
      <img src="${card.imageSmall}" alt="${card.name}">
      <div class="item-info">
        <div class="item-title-row">
          <span class="item-name">${card.name}</span>
          ${codeTag}
        </div>
        <span class="item-type">${card.humanReadableCardType || card.type}</span>
      </div>
    `
    item.addEventListener('click', () => selectCardFromCatalog(card))
    autocompleteResults.appendChild(item)
  })
  autocompleteResults.classList.remove('hidden')
}

function selectCardFromCatalog(card) {
  autocompleteResults.classList.add('hidden')
  cardSearchInput.value = card.name

  addCardId.value = card.id
  previewImage.src = card.imageSmall || card.imageFull
  previewName.textContent = card.name
  previewType.textContent = card.humanReadableCardType || card.type
  selectedCardPreview.classList.remove('hidden')

  // Populate set / expansion dropdown
  addSetSelect.innerHTML = ''
  let selectedIndexToSet = 0

  if (card.card_sets && card.card_sets.length > 0) {
    card.card_sets.forEach((s, idx) => {
      const opt = document.createElement('option')
      opt.value = s.set_name
      opt.dataset.code = s.set_code
      opt.dataset.rarity = s.set_rarity
      opt.textContent = `[${s.set_code}] ${s.set_name} - ${s.set_rarity}`
      addSetSelect.appendChild(opt)

      // If user searched by a specific set code, select that set!
      if (card.matchedSetCode && s.set_code.toLowerCase() === card.matchedSetCode.toLowerCase()) {
        selectedIndexToSet = idx
      }
    })

    addSetSelect.selectedIndex = selectedIndexToSet
    const chosen = card.card_sets[selectedIndexToSet]
    addCardCode.value = chosen.set_code
    addRarity.value = chosen.set_rarity
  } else {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = 'Set genérico / Sin especificación'
    addSetSelect.appendChild(opt)
    addCardCode.value = ''
    addRarity.value = ''
  }

  addSetSelect.onchange = () => {
    const selectedOpt = addSetSelect.options[addSetSelect.selectedIndex]
    if (selectedOpt && selectedOpt.dataset.code) {
      addCardCode.value = selectedOpt.dataset.code
      addRarity.value = selectedOpt.dataset.rarity
    }
  }

  addCardForm.classList.remove('hidden')
}

function resetAddForm() {
  cardSearchInput.value = ''
  autocompleteResults.innerHTML = ''
  autocompleteResults.classList.add('hidden')
  selectedCardPreview.classList.add('hidden')
  addCardForm.classList.add('hidden')
  addCardForm.reset()
}

// Add Form Submission
addCardForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const cardId = addCardId.value
  if (!cardId) return

  const payload = {
    card_id: cardId,
    set_name: addSetSelect.value,
    rarity: addRarity.value,
    card_code: addCardCode.value,
    quantity: parseInt(addQuantity.value, 10) || 1,
    condition: addCondition.value,
    binder_page: addBinderPage.value ? parseInt(addBinderPage.value, 10) : null,
    binder_slot: addBinderSlot.value ? parseInt(addBinderSlot.value, 10) : null,
    notes: addNotes.value,
  }

  try {
    const res = await fetch(getInventoryApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (data.success) {
      addCardModal.classList.add('hidden')
      inventoryData.unshift(data.data)
      updateDashboardMetrics()
      populateFilters()
      renderInventory()
    } else {
      alert(data.error || 'Error al guardar carta.')
    }
  } catch (err) {
    console.error('Error adding card:', err)
  }
})

// Edit Modal Functions
function openEditModal(item) {
  editInventoryId.value = item.id
  editPreviewImage.src = item.imageSmall || item.imageFull
  editPreviewName.textContent = item.card_name
  editPreviewType.textContent = item.humanReadableCardType || item.card_type

  editSetName.value = item.set_name || ''
  editRarity.value = item.rarity || ''
  editCardCode.value = item.card_code || ''
  editQuantity.value = item.quantity || 1
  editCondition.value = item.condition || 'Near Mint'
  editBinderPage.value = item.binder_page || ''
  editBinderSlot.value = item.binder_slot || ''
  editNotes.value = item.notes || ''

  editCardModal.classList.remove('hidden')
}

closeEditModalBtn.addEventListener('click', () => editCardModal.classList.add('hidden'))
cancelEditBtn.addEventListener('click', () => editCardModal.classList.add('hidden'))

// Edit Form Submission
editCardForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const id = editInventoryId.value
  const payload = {
    set_name: editSetName.value,
    rarity: editRarity.value,
    card_code: editCardCode.value,
    quantity: parseInt(editQuantity.value, 10) || 1,
    condition: editCondition.value,
    binder_page: editBinderPage.value ? parseInt(editBinderPage.value, 10) : null,
    binder_slot: editBinderSlot.value ? parseInt(editBinderSlot.value, 10) : null,
    notes: editNotes.value,
  }

  try {
    const res = await fetch(getInventoryApiUrl(`/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (data.success) {
      editCardModal.classList.add('hidden')
      const idx = inventoryData.findIndex(i => i.id === parseInt(id, 10))
      if (idx !== -1) {
        inventoryData[idx] = data.data
      }
      updateDashboardMetrics()
      populateFilters()
      renderInventory()
    } else {
      alert(data.error || 'Error al actualizar carta.')
    }
  } catch (err) {
    console.error('Error updating card:', err)
  }
})

// YDK Import Elements & Events
const openImportYdkModalBtn = document.getElementById('openImportYdkModalBtn')
const importYdkModal = document.getElementById('importYdkModal')
const closeImportYdkModalBtn = document.getElementById('closeImportYdkModalBtn')
const cancelImportYdkBtn = document.getElementById('cancelImportYdkBtn')
const importYdkForm = document.getElementById('importYdkForm')
const ydkFileInput = document.getElementById('ydkFileInput')
const ydkTextarea = document.getElementById('ydkTextarea')
const importCondition = document.getElementById('importCondition')
const importBinderPage = document.getElementById('importBinderPage')
const importNotes = document.getElementById('importNotes')
const importYdkStatus = document.getElementById('importYdkStatus')

openImportYdkModalBtn?.addEventListener('click', () => {
  importYdkForm.reset()
  importYdkStatus.classList.add('hidden')
  importYdkModal.classList.remove('hidden')
})

closeImportYdkModalBtn?.addEventListener('click', () => importYdkModal.classList.add('hidden'))
cancelImportYdkBtn?.addEventListener('click', () => importYdkModal.classList.add('hidden'))

// When a file is selected, read its content into ydkTextarea
ydkFileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (evt) => {
      ydkTextarea.value = evt.target.result
    }
    reader.readAsText(file)
  }
})

// Submit YDK import form
importYdkForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  importYdkStatus.classList.add('hidden')

  const content = ydkTextarea.value.trim()
  if (!content) {
    importYdkStatus.textContent = 'Por favor selecciona un archivo .ydk o pega el contenido.'
    importYdkStatus.classList.remove('hidden')
    return
  }

  const payload = {
    ydkContent: content,
    condition: importCondition.value,
    binder_page: importBinderPage.value ? parseInt(importBinderPage.value, 10) : null,
    notes: importNotes.value || 'Importado desde baraja .ydk',
  }

  try {
    const submitBtn = document.getElementById('submitImportYdkBtn')
    if (submitBtn) submitBtn.disabled = true

    const res = await fetch(getInventoryApiUrl('/import-ydk'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (data.success) {
      alert(data.message || '¡Baraja YDK importada exitosamente!')
      importYdkModal.classList.add('hidden')
      await fetchInventory()
    } else {
      importYdkStatus.textContent = data.error || 'Error al importar la baraja YDK.'
      importYdkStatus.classList.remove('hidden')
    }
  } catch (err) {
    console.error('Error importing YDK:', err)
    importYdkStatus.textContent = 'Error de conexión al importar YDK.'
    importYdkStatus.classList.remove('hidden')
  } finally {
    const submitBtn = document.getElementById('submitImportYdkBtn')
    if (submitBtn) submitBtn.disabled = false
  }
})

// Export Binder to .ydk file
const exportYdkBtn = document.getElementById('exportYdkBtn')

exportYdkBtn?.addEventListener('click', () => {
  if (!inventoryData || inventoryData.length === 0) {
    alert('Tu binder está vacío. No hay cartas para exportar.')
    return
  }

  const lines = []
  lines.push('#created with YGO Randomizer Binder')
  lines.push('#main')

  const extraDeckKeywords = ['fusion', 'synchro', 'xyz', 'link']
  const mainDeckLines = []
  const extraDeckLines = []

  inventoryData.forEach((item) => {
    const qty = parseInt(item.quantity, 10) || 1
    const cardId = String(item.card_id)
    const typeStr = (item.card_type || item.humanReadableCardType || '').toLowerCase()

    const isExtra = extraDeckKeywords.some((k) => typeStr.includes(k))

    for (let i = 0; i < qty; i++) {
      if (isExtra) {
        extraDeckLines.push(cardId)
      } else {
        mainDeckLines.push(cardId)
      }
    }
  })

  mainDeckLines.forEach((id) => lines.push(id))
  lines.push('#extra')
  extraDeckLines.forEach((id) => lines.push(id))
  lines.push('!side')

  const ydkContent = lines.join('\n')

  const blob = new Blob([ydkContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const dateStr = new Date().toISOString().slice(0, 10)
  a.download = `mi_binder_ygo_${dateStr}.ydk`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})

// Filter listeners (Resets to page 1 on filter change)
function onFilterChange() {
  currentPaginationPage = 1
  renderInventory()
}

filterSearchInput?.addEventListener('input', onFilterChange)
filterTypeSelect?.addEventListener('change', onFilterChange)
filterAttributeSelect?.addEventListener('change', onFilterChange)
filterRaceSelect?.addEventListener('change', onFilterChange)
filterSetSelect?.addEventListener('change', onFilterChange)
filterPageSelect?.addEventListener('change', onFilterChange)

// Pagination button listeners
prevPageBtn?.addEventListener('click', () => {
  if (currentPaginationPage > 1) {
    currentPaginationPage--
    renderInventory()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

nextPageBtn?.addEventListener('click', () => {
  currentPaginationPage++
  renderInventory()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

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

  let cardDesc = item.desc || item.description || ''
  if (!cardDesc && item.notes && !item.notes.toLowerCase().includes('importado')) {
    cardDesc = item.notes
  }
  if (!cardDesc) {
    cardDesc = 'Sin descripción disponible.'
  }
  if (zoomCardDesc) zoomCardDesc.textContent = cardDesc

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

// Run initialization
init()

