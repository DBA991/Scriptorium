<script setup>
import { ref, watch } from 'vue'
import { useImageFilters } from './modules/useImageFilters'

const props = defineProps({
  initialFilters: {
    type: Object,
    required: true
  }
})
const emit = defineEmits(['close', 'update-filters'])

const { filtersDefinition, filterValues, updateFilter, resetFilters, applyNegative } =
  useImageFilters(props.initialFilters)

watch(
  filterValues,
  (newValues) => {
    emit('update-filters', newValues)
  },
  { deep: true }
)

function handleUpdateFilter(filterName, value) {
  updateFilter(filterName, value)
}

function handleResetFilters() {
  resetFilters()
  emit('update-filters', filterValues.value)
}

function handleApplyNegative() {
  applyNegative()
  emit('update-filters', filterValues.value)
}

function closePanel() {
  emit('close')
}
</script>

<template>
  <div class="filters-panel">
    <div class="header">
      <h3>{{ $t('imageFiltersPanel.title') }}</h3>
      <button @click="closePanel" class="close-btn">
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

    <div class="filters-container">
      <div class="filter-item" v-for="filter in filtersDefinition" :key="filter.name">
        <label>{{ filter.label }}</label>
        <div class="controls">
          <input
            type="range"
            :min="filter.min"
            :max="filter.max"
            v-model="filterValues[filter.name]"
            @input="handleUpdateFilter(filter.name, $event.target.value)"
          />
          <input
            type="number"
            :min="filter.min"
            :max="filter.max"
            v-model="filterValues[filter.name]"
            @change="handleUpdateFilter(filter.name, $event.target.value)"
          />
        </div>
      </div>

      <div class="presets">
        <button class="btn" @click="handleResetFilters">{{ $t('imageFiltersPanel.reset') }}</button>
        <button class="btn" @click="handleApplyNegative">
          {{ $t('imageFiltersPanel.negative') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  width: 320px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.filters-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.filter-item label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.controls input[type='range'] {
  flex: 1;
}

.controls input[type='number'] {
  width: 70px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.presets {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.presets button {
  padding: 6px 12px;
  background: #eee;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
