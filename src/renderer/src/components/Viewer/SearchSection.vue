<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  searchTerm: {
    type: String,
    default: ''
  },
  searchResults: {
    type: [Array, Number],
    default: () => []
  },
  showSearchResults: {
    type: Boolean,
    default: false
  },
  highlightedElements: {
    type: Array,
    default: () => []
  },
  currentResultIndex: {
    type: Number,
    default: -1
  },
  isSearching: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'perform-search',
  'clear-search',
  'prev-result',
  'next-result',
  'update:searchTerm'
])

const localSearchTerm = ref(props.searchTerm)

watch(localSearchTerm, (newValue, oldValue) => {
  if (oldValue.trim() !== '') {
    emit('clear-search')
  }
  emit('update:searchTerm', newValue)
})

const searchStats = computed(() => {
  if (props.highlightedElements.length === 0) {
    return null
  }
  const count = props.highlightedElements.length
  return `${count} ${count === 1 ? 'risultato trovato' : 'risultati trovati'} nel documento`
})

const showNoResults = computed(() => {
  return (
    props.showSearchResults &&
    localSearchTerm.value.trim() !== '' &&
    !props.isSearching &&
    props.highlightedElements.length === 0
  )
})

const updateSearchTerm = () => {
  emit('update:searchTerm', localSearchTerm.value)
}

const handleClearSearch = () => {
  localSearchTerm.value = ''
  updateSearchTerm()
  emit('clear-search')
}

const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'f':
        event.preventDefault()
        document.querySelector('.search-input')?.focus()
        break
      case 'g':
        event.preventDefault()
        if (props.highlightedElements.length === 0) return
        if (event.shiftKey) {
          emit('prev-result')
        } else {
          emit('next-result')
        }
        break
    }
  } else if (event.key === 'Escape') {
    if (localSearchTerm.value || props.highlightedElements.length > 0) {
      handleClearSearch()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="search-section">
    <div class="search-input-group">
      <input
        v-model="localSearchTerm"
        @input="updateSearchTerm"
        @keyup.enter="$emit('perform-search')"
        :placeholder="$t('searchSection.placeholder')"
        class="search-input"
        :disabled="isSearching"
      />

      <button
        @click="$emit('perform-search')"
        :disabled="!localSearchTerm.trim() || isSearching"
        class="search-button"
      >
        {{ isSearching ? $t('searchSection.searching') : $t('searchSection.search') }}
      </button>

      <button
        @click="handleClearSearch"
        v-if="localSearchTerm || highlightedElements.length > 0"
        class="clear-button"
      >
        {{ $t('searchSection.clearSearch') }}
      </button>
    </div>

    <div class="search-navigation" v-if="highlightedElements.length > 0">
      <div class="navigation-buttons">
        <button
          @click="$emit('prev-result')"
          :disabled="highlightedElements.length === 0 || currentResultIndex === 0"
          class="nav-button"
          :title="$t('searchSection.prevResultTitle')"
        >
          {{ $t('searchSection.prev') }}
        </button>

        <span class="result-counter">
          {{ currentResultIndex + 1 }} / {{ highlightedElements.length }}
        </span>

        <button
          @click="$emit('next-result')"
          :disabled="
            highlightedElements.length === 0 ||
            currentResultIndex === highlightedElements.length - 1
          "
          class="nav-button"
          :title="$t('searchSection.nextResultTitle')"
        >
          {{ $t('searchSection.next') }}
        </button>
      </div>

      <div class="search-info" v-if="searchStats">
        <small>{{ searchStats }}</small>
      </div>
    </div>

    <div v-if="showNoResults" class="no-results">
      <span>{{ $t('searchSection.noResultsFor', { term: localSearchTerm }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.search-section {
  margin-top: 5px;
  padding: 15px;
  border: 1px solid #ddd;
  background: linear-gradient(135deg, #f9f9f9 0%, #f1f1f1 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-input-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.search-input {
  flex: 1 1 250px;
  padding: 10px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s ease;
  min-width: 200px;
}

.search-input:focus {
  outline: none;
  border-color: #28a745;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.search-input:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.7;
}

.search-button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 100px;
}

.search-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #218838 0%, #1ba085 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.search-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.clear-button {
  padding: 10px 16px;
  background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.clear-button:hover {
  background: linear-gradient(135deg, #c82333 0%, #e8690b 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.search-navigation {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  margin-top: 10px;
}

.navigation-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.nav-button {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s ease;
}

.nav-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a6268 0%, #343a40 100%);
  transform: translateY(-1px);
}

.nav-button:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

.result-counter {
  font-size: 0.9em;
  color: #495057;
  font-weight: 500;
  padding: 4px 8px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  min-width: 60px;
  text-align: center;
}

.search-info {
  text-align: center;
  color: #6c757d;
  font-style: italic;
}

.no-results {
  padding: 15px;
  text-align: center;
  color: #856404;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  margin-top: 10px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-navigation,
.no-results {
  animation: fadeIn 0.3s ease-out;
}

.search-section:focus-within .search-input {
  border-color: #28a745;
}
</style>
