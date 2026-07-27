<script setup>
import { ref, computed, watch } from 'vue'
import unicodeGrouped from '../../assets/unicode_grouped.json'

const emit = defineEmits(['close', 'select'])
const props = defineProps({
  show: Boolean
})

const selectedCategory = ref('')
const unicodeCategories = ref([])
const charsInCategory = ref([])
const loading = ref(false)
const currentPage = ref(1)
const searchQuery = ref('')
const itemsPerPage = 100

const categoryLabels = {
  Lu: 'Uppercase Letters',
  Ll: 'Lowercase Letters',
  Lt: 'Titlecase Letters',
  Lm: 'Modifier Letters',
  Lo: 'Other Letters',
  Mn: 'Nonspacing Marks',
  Mc: 'Spacing Marks',
  Me: 'Enclosing Marks',
  Nd: 'Decimal Numbers',
  Nl: 'Letter Numbers',
  No: 'Other Numbers',
  Pc: 'Connector Punctuation',
  Pd: 'Dash Punctuation',
  Ps: 'Open Punctuation',
  Pe: 'Close Punctuation',
  Pi: 'Initial Punctuation',
  Pf: 'Final Punctuation',
  Po: 'Other Punctuation',
  Sm: 'Math Symbols',
  Sc: 'Currency Symbols',
  Sk: 'Modifier Symbols',
  So: 'Other Symbols'
}

unicodeCategories.value = Object.keys(unicodeGrouped)
  .filter((cat) => Array.isArray(unicodeGrouped[cat]) && unicodeGrouped[cat].length > 0)
  .sort()

const paginatedChars = computed(() => {
  if (searchQuery.value) return filteredChars.value
  const start = (currentPage.value - 1) * itemsPerPage
  return charsInCategory.value.slice(start, start + itemsPerPage)
})

const filteredChars = computed(() => {
  if (!searchQuery.value) return []
  const query = searchQuery.value.trim().toUpperCase()
  return Object.values(unicodeGrouped)
    .flat()
    .filter((charObj) => charObj.codepoint.replace('U+', '') === query)
})

const totalPages = computed(() => Math.ceil(charsInCategory.value.length / itemsPerPage))

watch(selectedCategory, (cat) => {
  currentPage.value = 1
  searchQuery.value = ''
  if (cat) {
    loading.value = true
    setTimeout(() => {
      charsInCategory.value = unicodeGrouped[cat] || []
      loading.value = false
    }, 50)
  } else {
    charsInCategory.value = []
  }
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      searchQuery.value = ''
      selectedCategory.value = ''
    }
  }
)

function handleSearch() {
  searchQuery.value = searchQuery.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
  if (searchQuery.value) currentPage.value = 1
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function getCategoryLabel(cat) {
  return categoryLabels[cat] || cat
}

function selectChar(charObj) {
  if (charObj?.char) emit('select', charObj.char)
}
</script>

<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('unicodeModal.title') }}</h3>
        <button @click="$emit('close')" class="close-btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            :placeholder="$t('unicodeModal.searchPlaceholder')"
            @input="handleSearch"
          />
        </div>

        <select v-model="selectedCategory" class="category-select">
          <option value="">{{ $t('unicodeModal.selectCategoryOption') }}</option>
          <option v-for="cat in unicodeCategories" :key="cat" :value="cat">
            {{ getCategoryLabel(cat) }}
          </option>
        </select>

        <div v-if="loading" class="loading">{{ $t('unicodeModal.loading') }}</div>

        <div v-else>
          <div v-if="paginatedChars.length" class="chars-grid">
            <span
              v-for="(charObj, index) in paginatedChars"
              :key="index"
              class="char-box"
              @click="selectChar(charObj)"
              :title="charObj.codepoint"
            >
              {{ charObj.char }}
            </span>
          </div>
          <div v-else class="no-chars">
            <span v-if="searchQuery">
              {{ $t('unicodeModal.noCharacterFound', { query: searchQuery }) }}
            </span>
            <span v-else>
              {{
                selectedCategory
                  ? $t('unicodeModal.noCharactersInCategory')
                  : $t('unicodeModal.selectCategoryToDisplay')
              }}
            </span>
          </div>

          <div v-if="totalPages > 1" class="pagination">
            <button @click="prevPage" :disabled="currentPage === 1">
              {{ $t('unicodeModal.prev') }}
            </button>
            <span>{{
              $t('unicodeModal.pageOf', { current: currentPage, total: totalPages })
            }}</span>
            <button @click="nextPage" :disabled="currentPage === totalPages">
              {{ $t('unicodeModal.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #444;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #ccc;
}

.close-btn svg {
  background: transparent;
  border: none;
  color: #ccc;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 10px;
}

.close-btn:hover svg {
  color: #fff;
}

.modal-body {
  padding: 1rem;
  overflow-y: auto;
  flex-grow: 1;
}

.search-box {
  margin-bottom: 1rem;
}

.search-box input {
  width: 100%;
  padding: 0.5rem;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  box-sizing: border-box;
}

.category-select {
  width: 100%;
  padding: 0.5rem;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.chars-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 5px;
  font-family: 'Segoe UI Symbol', 'Arial Unicode MS', 'Apple Symbols', sans-serif;
}

.char-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 1.4rem;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.char-box:hover {
  background: #3e3e3e;
  transform: scale(1.1);
  border-color: #007acc;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #444;
  text-align: right;
}

.no-chars {
  padding: 2rem;
  text-align: center;
  color: #999;
  font-style: italic;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: #ccc;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  border-top: 1px solid #444;
}

.pagination button {
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
}

.pagination button:disabled {
  background: #555;
  cursor: not-allowed;
}

.pagination span {
  color: #ccc;
}
</style>
