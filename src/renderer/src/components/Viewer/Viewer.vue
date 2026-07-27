<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHtmlStore } from '../../stores/htmlStore'

import NoteToolbar from './NoteToolbar.vue'
import SearchSection from './SearchSection.vue'
import Sidebar from './Sidebar.vue'
import NoteDisplay from './NoteDisplay.vue'
import HeaderModal from './HeaderModal.vue'

import * as teiProcessor from './modules/teiProcessor.js'
import * as userNotes from './modules/userNotes.js'
import * as search from './modules/search.js'
import * as utils from './modules/utils.js'
import * as teiHeaderProcessor from './modules/teiHeaderProcessor.js'

import './styles/styles.css'

const { t } = useI18n()
const htmlStore = useHtmlStore()
const contentArea = ref(null)
const teiSidebar = ref(null)

const noteType = ref('')
const noteValue = ref('')
const editingSpan = ref(null)
const activeNote = ref('')
const activeNoteIsTei = ref(false)

const searchTerm = ref('')
const searchResults = ref([])
const showSearchResults = ref(false)
const highlightedElements = ref([])
const currentResultIndex = ref(-1)
const isSearching = ref(false)

const allTeiLists = ref([])
const pageList = ref([])

const activePageIndex = ref(0)

const isPageSidebarVisible = ref(false)
const isMetadataSidebarVisible = ref(false)
const isSmallScreen = ref(false)
let mediaQueryList = null

const showHeaderModal = ref(false)
const processedHeaderContent = ref('')
const hasHeaderAvailable = ref(false)

const PREDEFINITED_NOTE = ['wikimedia', 'wikipedia']
const CLASSES_TO_EXCLUDE_FROM_SEARCH = [
  'tei-hidden-note-content',
  'user-hidden-note-content',
  'metadata-sidebar',
  'page-sidebar'
]

const hasAnyList = computed(() => allTeiLists.value.length > 0)

const checkScreenSize = (event) => {
  isSmallScreen.value = event.matches
  if (!isSmallScreen.value) {
    isPageSidebarVisible.value = false
    isMetadataSidebarVisible.value = false
  }
}

const showTeiHeader = () => {
  if (processedHeaderContent.value) {
    showHeaderModal.value = !showHeaderModal.value
  }
}

onMounted(async () => {
  await htmlStore.init()
  updateContentFromStore()
  watch(() => htmlStore.htmlContent, updateContentFromStore)
  if (contentArea.value) {
    contentArea.value.addEventListener('scroll', updateActivePage)
  }

  mediaQueryList = window.matchMedia('(max-width: 992px)')
  checkScreenSize({ matches: mediaQueryList.matches })
  mediaQueryList.addEventListener('change', checkScreenSize)

  nextTick(() => {
    if (contentArea.value) {
      updateActivePage()
    }
  })
})

const updateContentFromStore = () => {
  if (!contentArea.value) return

  const scrollTop = contentArea.value.scrollTop

  contentArea.value.innerHTML = htmlStore.htmlContent

  if (teiHeaderProcessor.hasTeiHeader(contentArea.value)) {
    processedHeaderContent.value = teiHeaderProcessor.extractAndProcessTeiHeader(contentArea.value)
    hasHeaderAvailable.value = true
  }

  nextTick(() => {
    contentArea.value.scrollTop = scrollTop
    teiProcessor.processTeiAnnotations(contentArea.value)
    const { lists, pages } = teiProcessor.extractAllLists(htmlStore.htmlContent)
    allTeiLists.value = lists
    pageList.value = pages
  })
}

const updateActivePage = () => {
  if (!contentArea.value || !pageList.value.length) return

  const scrollPosition = contentArea.value.scrollTop
  let newActivePageIndex = 0

  for (let i = 0; i < pageList.value.length; i++) {
    const pageElement = contentArea.value.querySelector(
      `[data-tag="pb"][data-n="${pageList.value[i].n}"]`
    )
    if (pageElement) {
      const pageTop = pageElement.offsetTop
      if (scrollPosition >= pageTop) {
        newActivePageIndex = i
      } else {
        break
      }
    }
  }

  if (activePageIndex.value !== newActivePageIndex) {
    activePageIndex.value = newActivePageIndex
  }
}

const handleAddUpdateNote = async () => {
  const result = userNotes.wrapSelectionWithNote(
    contentArea.value,
    noteType.value,
    noteValue.value,
    editingSpan.value
  )
  if (result && result.newHtml) {
    await nextTick()
    htmlStore.htmlContent = result.newHtml
    editingSpan.value = result.editingSpan
    clearDisplayStates()
    clearEditing()
  }
}

const handleDeleteNote = async () => {
  if (!editingSpan.value) return
  const result = userNotes.deleteNote(contentArea.value, editingSpan.value)
  if (result && result.newHtml) {
    await nextTick()
    htmlStore.htmlContent = result.newHtml
  }
  clearEditing()
  clearDisplayStates()
}

const clearEditing = () => {
  editingSpan.value = null
  noteType.value = ''
  noteValue.value = ''
}

const clearDisplayStates = () => {
  activeNote.value = ''
  activeNoteIsTei.value = false
  if (editingSpan.value) {
    clearEditing()
  }
}

const handlePerformSearch = () => {
  if (!searchTerm.value) {
    handleClearSearch()
    return
  }

  isSearching.value = true
  highlightedElements.value = search.performSearch(
    searchTerm.value,
    contentArea.value,
    CLASSES_TO_EXCLUDE_FROM_SEARCH
  )

  searchResults.value = highlightedElements.value.length
  showSearchResults.value = true
  currentResultIndex.value = highlightedElements.value.length > 0 ? 0 : -1

  if (currentResultIndex.value !== -1) {
    focusOnCurrentResult()
  }

  isSearching.value = false
}

const handleClearSearch = () => {
  search.clearSearch(contentArea.value)
  searchTerm.value = ''
  searchResults.value = 0
  showSearchResults.value = false
  highlightedElements.value = []
  currentResultIndex.value = -1
}

const goToNextResult = () => {
  if (highlightedElements.value.length === 0) return
  currentResultIndex.value = (currentResultIndex.value + 1) % highlightedElements.value.length
  focusOnCurrentResult()
}

const goToPreviousResult = () => {
  if (highlightedElements.value.length === 0) return
  currentResultIndex.value =
    (currentResultIndex.value - 1 + highlightedElements.value.length) %
    highlightedElements.value.length
  focusOnCurrentResult()
}

const focusOnCurrentResult = () => {
  highlightedElements.value.forEach((el, index) => {
    el.classList.toggle('current-search-result', index === currentResultIndex.value)
  })
  const target = highlightedElements.value[currentResultIndex.value]
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

watch(searchTerm, (newTerm) => {
  if (newTerm === '') {
    handleClearSearch()
  }
})

const displayTeiAnnotationDetails = (symbol) => {
  const teiWrapper = symbol.closest('.tei-note-wrapper, .tei-seg-wrapper, .tei-img-wrapper')
  const attributes = symbol.dataset

  let htmlContent = '<div class="metadata-display">'
  htmlContent += `<h4>${attributes.tag || 'Elemento'}</h4>`

  for (const key in attributes) {
    if (key !== 'tag' && key !== 'annotated') {
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
      htmlContent += `<p><strong>${formattedKey}:</strong> ${attributes[key]}</p>`
    }
  }

  const hiddenContent = teiWrapper?.querySelector(
    '.tei-hidden-note-content, .tei-hidden-seg-content, .tei-hidden-img-content'
  )
  if (hiddenContent && hiddenContent.innerHTML.trim()) {
    htmlContent += '<div class="tei-original-content">'
    htmlContent += hiddenContent.innerHTML
    htmlContent += '</div>'
  }

  htmlContent += '</div>'

  activeNote.value = htmlContent
  activeNoteIsTei.value = true
}

const onClickHandler = (event) => {
  const target = event.target

  clearDisplayStates()

  const noteSymbol = target.closest('.note-symbol')
  const teiSymbol = target.closest('.tei-note-symbol, .tei-seg-symbol, .tei-img-symbol')

  if (noteSymbol) {
    const noteDetails = userNotes.getNoteDetails(noteSymbol)
    if (noteDetails) {
      if (editingSpan.value === noteDetails.editingSpan) {
        clearEditing()
      } else {
        editingSpan.value = noteDetails.editingSpan
        noteType.value = noteDetails.noteType
        noteValue.value = noteDetails.noteValue
        activeNote.value = `<strong>Tipo:</strong> ${noteDetails.noteType}<br/><strong>Contenuto:</strong> ${noteDetails.noteValue}`
        activeNoteIsTei.value = false
      }
    }
  } else if (teiSymbol) {
    displayTeiAnnotationDetails(teiSymbol)

    const ref = teiSymbol.dataset.ref || teiSymbol.dataset.src
    const tag = teiSymbol.dataset.tag
    if (tag === 'img' && ref) {
      window.open(ref, '_blank', 'noopener,noreferrer')
    }
  }
}

const handleDisplayListItem = ({ item, group, groupId }) => {
  if (item && item.htmlContent) {
    const htmlContent = `<h4>${group.name}</h4><div class="metadata-display">${item.htmlContent}</div>`
    activeNote.value = htmlContent
    activeNoteIsTei.value = true
  } else {
    activeNote.value = 'Dettagli non disponibili.'
    activeNoteIsTei.value = false
  }
}

const handleGoToPage = (page) => {
  const pageData = page.item ? page.item : page
  if (!contentArea.value) return

  if (!pageData.n) {
    console.warn('Il numero di pagina non è definito:', pageData)
    return
  }

  const targetElement = contentArea.value.querySelector(`[data-tag="pb"][data-n="${pageData.n}"]`)
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    nextTick(() => {
      updateActivePage()
    })
  } else {
    console.warn('Nessun elemento <pb> trovato per il numero di pagina:', pageData.n)
  }
}

onUnmounted(() => {
  if (contentArea.value) {
    contentArea.value.removeEventListener('scroll', updateActivePage)
  }
  if (mediaQueryList) {
    mediaQueryList.removeEventListener('change', checkScreenSize)
  }
})
</script>

<template>
  <div class="viewer-container">
    <NoteToolbar
      v-model:noteType="noteType"
      v-model:noteValue="noteValue"
      :editing-span="editingSpan"
      :predefined-notes="PREDEFINITED_NOTE"
      @add-update-note="handleAddUpdateNote"
      @delete-note="handleDeleteNote"
      @cancel-edit="clearEditing"
    />

    <hr />

    <SearchSection
      v-model:searchTerm="searchTerm"
      :search-results="searchResults"
      :show-search-results="showSearchResults"
      :highlighted-elements="highlightedElements"
      :current-result-index="currentResultIndex"
      :is-searching="isSearching"
      @perform-search="handlePerformSearch"
      @clear-search="handleClearSearch"
      @next-result="goToNextResult"
      @prev-result="goToPreviousResult"
    />

    <hr />

    <button
      v-if="isSmallScreen && pageList.length > 0"
      class="sidebar-toggle sidebar-toggle-left"
      @click="isPageSidebarVisible = !isPageSidebarVisible"
      aria-label="Mostra o nascondi l'Indice delle Pagine"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    </button>

    <button
      v-if="isSmallScreen && hasAnyList"
      class="sidebar-toggle sidebar-toggle-right"
      @click="isMetadataSidebarVisible = !isMetadataSidebarVisible"
      aria-label="Mostra o nascondi le Liste TEI"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    </button>

    <div v-if="hasHeaderAvailable" class="header-section">
      <button class="header-btn" @click="showTeiHeader">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </button>
    </div>

    <div class="main-content-wrapper">
      <Sidebar
        :title="t('sidebar.pagesIndexTitle')"
        :items="pageList"
        :is-visible="pageList.length > 0"
        sidebar-class="page-sidebar"
        :class="{ 'sidebar-visible': isPageSidebarVisible }"
        list-class="page-list"
        :show-item-id="false"
        :active-page-index="activePageIndex"
        @item-click="handleGoToPage"
      >
        <template #item="{ item }">
          {{ $t('sidebar.pageLabel') }} <strong>{{ item.n }}</strong>
        </template>
      </Sidebar>

      <div class="viewer-content" ref="contentArea" @click="onClickHandler"></div>

      <Sidebar
        :title="t('sidebar.teiListsTitle')"
        :is-visible="hasAnyList"
        :groups="allTeiLists"
        sidebar-class="metadata-sidebar"
        :class="{ 'sidebar-visible': isMetadataSidebarVisible }"
        @item-click="handleDisplayListItem"
        ref="teiSidebar"
      />
    </div>

    <NoteDisplay
      :active-note="activeNote"
      :editing-span="editingSpan"
      :active-note-is-tei="activeNoteIsTei"
      v-model:note-type="noteType"
      v-model:noteValue="noteValue"
      @close="clearDisplayStates"
      @update-note="handleAddUpdateNote"
      @delete-note="handleDeleteNote"
      @cancel-edit="clearEditing"
    />

    <HeaderModal
      :is-visible="showHeaderModal"
      :header-content="processedHeaderContent"
      @note-click="onClickHandler"
    />
  </div>
</template>

<style scoped>
body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}
:deep(.sidebar-content::-webkit-scrollbar),
.viewer-content::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

:deep(.sidebar-content::-webkit-scrollbar-track),
.viewer-content::-webkit-scrollbar-track {
  background: rgba(52, 58, 64, 0.1);
  border-radius: 10px;
}

:deep(.sidebar-content::-webkit-scrollbar-thumb),
.viewer-content::-webkit-scrollbar-thumb {
  background-color: rgba(52, 58, 64, 0.65);
  border-radius: 10px;
  border: 3px solid rgba(52, 58, 64, 0.1);
}

:deep(.sidebar-content::-webkit-scrollbar-thumb:hover),
.viewer-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(33, 37, 41, 0.9);
}

:deep(.sidebar-content),
.viewer-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(52, 58, 64, 0.65) rgba(52, 58, 64, 0.1);
}

.viewer-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.viewer-content {
  flex: 1;
  overflow: auto;
  padding: 1rem 3.5rem;
  background-color: #f8f9fa;
  line-height: 1.6;
  font-size: 1.1em;
  color: #333;
  order: 2;
}

:deep(.page-sidebar) {
  order: 1;
}

:deep(.metadata-sidebar) {
  order: 3;
}

:deep(.metadata-display) {
  margin-top: 10px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.4;
}

:deep(.metadata-display h4) {
  color: #007bff;
  border-bottom: 2px solid #007bff;
  padding-bottom: 5px;
  margin-bottom: 15px;
}

:deep(.metadata-attributes) {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
  border-left: 4px solid #007bff;
}

:deep(.metadata-content) {
  margin-bottom: 10px;
}

:deep(.metadata-item) {
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

:deep(.metadata-key) {
  color: #495057;
  margin: 0;
  font-size: 0.9em;
  font-weight: 600;
  min-width: 80px;
  flex-shrink: 0;
}

:deep(.metadata-text) {
  color: #333;
  margin: 0;
  flex-grow: 1;
}

:deep(.metadata-element) {
  margin-bottom: 15px;
  border-left: 3px solid #e9ecef;
  padding-left: 12px;
}

:deep(.metadata-element-title) {
  color: #6f42c1;
  margin: 0 0 8px 0;
  font-size: 1em;
  font-weight: 600;
  text-transform: capitalize;
}

:deep(.metadata-element-content) {
  margin-left: 0;
}

:deep(.metadata-text-content) {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 3px;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-style: italic;
  color: #856404;
}

:deep(.metadata-level-0) {
}

:deep(.metadata-level-1) {
  margin-left: 20px;
  border-left: 2px solid #dee2e6;
  padding-left: 15px;
}

:deep(.metadata-level-1 .metadata-element-title) {
  color: #28a745;
  font-size: 0.95em;
}

:deep(.metadata-level-2) {
  margin-left: 15px;
  border-left: 1px solid #dee2e6;
  padding-left: 12px;
}

:deep(.metadata-level-2 .metadata-element-title) {
  color: #fd7e14;
  font-size: 0.9em;
}

:deep(.metadata-level-3) {
  margin-left: 10px;
  padding-left: 8px;
}

:deep(.metadata-level-3 .metadata-element-title) {
  color: #6c757d;
  font-size: 0.85em;
}

:deep(.metadata-level-1 .metadata-attributes) {
  background-color: #e8f5e8;
  border-left-color: #28a745;
}

:deep(.metadata-level-2 .metadata-attributes) {
  background-color: #fff4e6;
  border-left-color: #fd7e14;
}

:deep(.metadata-level-3 .metadata-attributes) {
  background-color: #f1f3f4;
  border-left-color: #6c757d;
}

:deep(.metadata-level-1 .metadata-text-content) {
  background-color: #e8f5e8;
  border-color: #c3e6cb;
  color: #155724;
}

:deep(.metadata-level-2 .metadata-text-content) {
  background-color: #fff4e6;
  border-color: #fdbf47;
  color: #975a16;
}

:deep(.metadata-item:has(.metadata-array)) .metadata-key {
  color: #6f42c1;
}

:deep(.metadata-level-1 .metadata-key) {
  color: #28a745;
  font-size: 0.9em;
}

:deep(.metadata-level-2 .metadata-key) {
  color: #fd7e14;
  font-size: 0.85em;
}

:deep(.page-list li:hover),
:deep(.generic-list li:hover) {
  background-color: #e2f0ff;
}

hr {
  border: 0;
  height: 1px;
  background: #ddd;
  margin: 0;
}

:deep(.highlighted-search-result) {
  background-color: yellow;
  border-radius: 2px;
}

:deep(.current-search-result) {
  background-color: orange !important;
  font-weight: bold;
}

:deep(.tei-person-noted) {
  font-weight: bold;
  color: #8b0000;
  text-decoration: underline dotted;
}

:deep(.tei-note-symbol),
:deep(.note-symbol),
:deep(.tei-seg-symbol) {
  cursor: pointer;
  color: #007bff;
  font-weight: bold;
  margin-left: 2px;
}

:deep(.tei-note-symbol:hover),
:deep(.note-symbol:hover),
:deep(.tei-seg-symbol:hover) {
  text-decoration: underline;
}

:deep(.tei-hidden-note-content),
:deep(.user-hidden-note-content) {
  display: none;
}

.list-navigation-and-selectors {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.list-navigation-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 5px;
}

.list-navigation-buttons button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 1em;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.list-navigation-buttons button:hover:not(:disabled) {
  background-color: #0056b3;
}

.list-navigation-buttons button:disabled {
  background-color: #adb5bd;
  cursor: not-allowed;
  opacity: 0.7;
}

.list-navigation-buttons span {
  font-size: 0.9em;
  color: #6c757d;
}

.list-selectors {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}

.list-selectors button {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.85em;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
}

.list-selectors button:hover:not(.active) {
  background-color: #5a6268;
  transform: translateY(-1px);
}

.list-selectors button.active {
  background-color: #28a745;
  font-weight: bold;
  cursor: default;
}

:deep(.page-list) {
  list-style-type: none;
}

.metadata-display p {
  margin: 5px 0;
  line-height: 1.4;
}

.metadata-display strong {
  color: #333;
  margin-right: 5px;
}

.sidebar-toggle {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 44px;
  height: 44px;

  background-color: rgba(52, 58, 64, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  backdrop-filter: blur(5px);

  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease-in-out;
}

.sidebar-toggle:hover {
  background-color: rgba(33, 37, 41, 0.9);
  transform: translateY(-50%) scale(1.1);
  border-color: rgba(255, 255, 255, 0.25);
}

.sidebar-toggle svg {
  width: 22px;
  height: 22px;
}

.sidebar-toggle-left {
  left: 12px;
}

.sidebar-toggle-right {
  right: 12px;
}

.header-section {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 10;
  width: 40px;
  height: 40px;

  background-color: rgba(52, 58, 64, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  backdrop-filter: blur(6px);

  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.header-section:hover {
  background-color: rgba(33, 37, 41, 0.9);
  transform: translateY(-50%) scale(1.1);
  border-color: rgba(255, 255, 255, 0.25);
}

.header-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-btn svg {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.85);
  transition: color 0.2s ease;
}

.header-btn:hover svg {
  color: rgba(255, 255, 255, 1);
}

@media (max-width: 992px) {
  .main-content-wrapper {
    overflow-x: hidden;
  }

  :deep(.page-sidebar),
  :deep(.metadata-sidebar) {
    position: absolute;
    top: 0;
    height: 100%;
    width: 280px;
    z-index: 1;
    background: white;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    display: flex !important;
    visibility: visible !important;
  }

  :deep(.metadata-sidebar) {
    right: 0;
    left: auto;
    transform: translateX(100%);
  }

  :deep(.page-sidebar.sidebar-visible),
  :deep(.metadata-sidebar.sidebar-visible) {
    transform: translateX(0);
  }

  .viewer-content {
    order: 0;
  }
}
</style>
