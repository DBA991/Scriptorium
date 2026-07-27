<script setup>
import { ref, computed, watch } from 'vue'
import { defaultFilters } from './modules/imageUtils'
import { useImageFilters } from './modules/useImageFilters'
import { parsePageSelection } from './modules/parsePages'

const props = defineProps({
  totalPages: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'start', 'update-preview'])

const pageFlip = ref(false)
const grade = ref(0)
const gradeEven = ref(0)
const pageSelectionInput = ref('')

const { filtersDefinition, filterValues, resetFilters, applyNegative } = useImageFilters({
  ...defaultFilters
})

watch(
  filterValues,
  (newValues) => {
    emit('update-preview', { ...newValues })
  },
  { deep: true, immediate: true }
)

const parsedPages = computed(() => {
  try {
    return parsePageSelection(pageSelectionInput.value, props.totalPages || undefined)
  } catch (e) {
    return 'error'
  }
})

const selectionError = computed(
  () => parsedPages.value === 'error' && pageSelectionInput.value.trim() !== ''
)

const canStart = computed(() => {
  if (!Number.isFinite(Number(grade.value))) return false
  if (pageFlip.value && !Number.isFinite(Number(gradeEven.value))) return false
  if (selectionError.value) return false
  return true
})

function buildConfig() {
  return {
    pageFlip: pageFlip.value,
    grade: Number(grade.value),
    gradeEven: Number(gradeEven.value),
    cssStyles: { ...filterValues.value },
    pagesSelection: parsedPages.value
  }
}

function handleStart() {
  if (!canStart.value) return
  emit('start', buildConfig())
}

function closePanel() {
  emit('close')
}
</script>

<template>
  <div class="ocr-auto-modal">
    <div class="header">
      <h3>{{ $t('ocrAutomationModal.title') }}</h3>
      <button
        @click="closePanel"
        class="close-btn"
        :aria-label="$t('ocrAutomationModal.closeLabel')"
      >
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
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <div class="field-row">
        <label for="ocr-auto-pages">{{ $t('ocrAutomationModal.pagesLabel') }}</label>
        <input
          id="ocr-auto-pages"
          type="text"
          v-model="pageSelectionInput"
          :placeholder="$t('ocrAutomationModal.pagesPlaceholder')"
          :aria-invalid="selectionError"
        />
        <span class="hint" v-if="selectionError">{{ $t('ocrAutomationModal.invalidSyntax') }}</span>
        <span class="hint" v-else>
          {{ $t('ocrAutomationModal.pagesAvailableHint', { count: totalPages }) }}
        </span>
      </div>

      <div class="field-row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="pageFlip" />
          {{ $t('ocrAutomationModal.pageFlipLabel') }}
        </label>
      </div>

      <div class="grade-grid">
        <div class="field-row">
          <label for="ocr-auto-grade">{{ $t('ocrAutomationModal.gradeLabel') }}</label>
          <input id="ocr-auto-grade" type="number" v-model.number="grade" step="0.1" />
        </div>
        <div class="field-row" v-if="pageFlip">
          <label for="ocr-auto-grade-even">{{ $t('ocrAutomationModal.gradeEvenLabel') }}</label>
          <input id="ocr-auto-grade-even" type="number" v-model.number="gradeEven" step="0.1" />
        </div>
      </div>

      <div class="filters-section">
        <div class="filters-header">
          <span>{{ $t('ocrAutomationModal.filtersHeader') }}</span>
          <div class="filter-presets">
            <button class="mini-btn" @click="resetFilters">
              {{ $t('ocrAutomationModal.reset') }}
            </button>
            <button class="mini-btn" @click="applyNegative">
              {{ $t('ocrAutomationModal.negative') }}
            </button>
          </div>
        </div>
        <div class="filter-item" v-for="filter in filtersDefinition" :key="filter.name">
          <label>{{ filter.label }}</label>
          <div class="controls">
            <input
              type="range"
              :min="filter.min"
              :max="filter.max"
              v-model="filterValues[filter.name]"
            />
            <input
              type="number"
              :min="filter.min"
              :max="filter.max"
              v-model="filterValues[filter.name]"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button @click="closePanel" class="btn btn-secondary">
        {{ $t('ocrAutomationModal.cancel') }}
      </button>
      <button @click="handleStart" :disabled="!canStart" class="btn btn-primary">
        {{ $t('ocrAutomationModal.start') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ocr-auto-modal {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  width: 360px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #4a5568;
  padding: 0;
  display: flex;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-row label {
  font-weight: 500;
  color: #2d3748;
  font-size: 0.9rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.field-row input[type='number'],
.field-row input[type='text'] {
  padding: 6px 8px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}

.field-row input[aria-invalid='true'] {
  border-color: #fc8181;
  background-color: #fff5f5;
}

.hint {
  font-size: 0.75rem;
  color: #718096;
}

.grade-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filters-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
}

.filter-presets {
  display: flex;
  gap: 6px;
}

.mini-btn {
  padding: 3px 8px;
  background: #eee;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.mini-btn:hover {
  background: #ddd;
}

.filter-item label {
  display: block;
  margin-bottom: 3px;
  font-size: 0.85rem;
  color: #4a5568;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.controls input[type='range'] {
  flex: 1;
}

.controls input[type='number'] {
  width: 60px;
  padding: 3px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.btn-primary {
  background-color: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3182ce;
}

.btn-primary:disabled {
  background-color: #a0aec0;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #2d3748;
}

.btn-secondary:hover {
  background-color: #cbd5e0;
}
</style>
