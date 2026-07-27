<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  noteType: {
    type: String,
    default: ''
  },
  noteValue: {
    type: String,
    default: ''
  },
  editingSpan: {
    type: [Object, null],
    default: null
  },
  predefinedNotes: {
    type: Array,
    default: () => ['wikimedia', 'wikipedia']
  }
})

const emit = defineEmits([
  'add-update-note',
  'delete-note',
  'cancel-edit',
  'update:noteType',
  'update:noteValue'
])

const localNoteType = ref(props.noteType)
const localNoteValue = ref(props.noteValue)
const isDropdownOpen = ref(false)

watch(
  () => props.noteType,
  (newValue) => {
    localNoteType.value = newValue
  }
)

watch(
  () => props.noteValue,
  (newValue) => {
    localNoteValue.value = newValue
  }
)

const filteredNotes = computed(() => {
  if (!localNoteType.value) {
    return props.predefinedNotes
  }
  return props.predefinedNotes.filter((note) =>
    note.toLowerCase().includes(localNoteType.value.toLowerCase())
  )
})

const handleNoteTypeInput = () => {
  emit('update:noteType', localNoteType.value)
}

const selectNoteType = (type) => {
  localNoteType.value = type
  emit('update:noteType', type)
  isDropdownOpen.value = false
}

const updateNoteValue = () => {
  emit('update:noteValue', localNoteValue.value)
}
</script>

<template>
  <div class="toolbar">
    <div class="multibox-container">
      <div class="multibox-input-wrapper">
        <input
          v-model="localNoteType"
          @input="handleNoteTypeInput"
          :placeholder="$t('noteToolbar.typePlaceholder')"
          class="note-type-input"
        />
        <button @click="isDropdownOpen = !isDropdownOpen" class="dropdown-toggle-button">
          <span class="arrow-icon" :class="{ rotated: isDropdownOpen }">▼</span>
        </button>
      </div>

      <ul v-if="isDropdownOpen && filteredNotes.length" class="multibox-dropdown-inline">
        <li
          v-for="type in filteredNotes"
          :key="type"
          @mousedown.prevent="selectNoteType(type)"
          :class="{ selected: localNoteType === type }"
        >
          {{ type }}
        </li>
      </ul>
    </div>

    <input
      v-model="localNoteValue"
      @input="updateNoteValue"
      :placeholder="$t('noteToolbar.notePlaceholder')"
      class="note-value-input"
    />

    <button
      @click="$emit('add-update-note')"
      :disabled="!localNoteType.trim()"
      class="primary-button"
    >
      {{ editingSpan ? $t('noteToolbar.updateNote') : $t('noteToolbar.addNote') }}
    </button>

    <button v-if="editingSpan" @click="$emit('delete-note')" class="danger-button">
      {{ $t('noteToolbar.deleteNote') }}
    </button>

    <button v-if="editingSpan" @click="$emit('cancel-edit')" class="secondary-button">
      {{ $t('noteToolbar.cancelEdit') }}
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: sticky;
  top: 0;
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  align-items: flex-start;
  border-bottom: 1px solid #e9ecef;
}

.multibox-container {
  flex: 0 1 160px;
  position: relative;
  min-width: 140px;
}

.multibox-input-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: white;
  transition: all 0.2s ease;
  overflow: hidden;
  height: 38px;
}

.multibox-input-wrapper:focus-within {
  border-color: #0d6efd;
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
}

.note-type-input {
  border: none;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  flex: 1;
  background: transparent;
  min-width: 0;
  height: 100%;
  border-radius: 8px 0 0 8px;
  line-height: normal;
  vertical-align: middle;
  box-sizing: border-box;
}

.note-type-input:focus {
  outline: none;
}

.note-type-input::placeholder {
  color: #6c757d;
  font-size: 0.8rem;
}

.dropdown-toggle-button {
  background-color: #f8f9fa;
  border: none;
  border-left: 1px solid #dee2e6;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
  width: 28px;
  height: 100%;
}

.dropdown-toggle-button:hover {
  background-color: #e9ecef;
}

.arrow-icon {
  font-size: 0.75rem;
  color: #6c757d;
  transition: transform 0.2s ease;
  line-height: 1;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.multibox-dropdown-inline {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0 0;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: absolute;
  width: 100%;
  z-index: 30;
  top: 100%;
}

.multibox-dropdown-inline li {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
  font-size: 0.875rem;
  border-bottom: 1px solid #f8f9fa;
}

.multibox-dropdown-inline li:last-child {
  border-bottom: none;
}

.multibox-dropdown-inline li:hover,
.multibox-dropdown-inline li.selected {
  background-color: #f8f9fa;
}

.note-value-input {
  flex: 1 1 220px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.875rem;
  min-width: 180px;
  height: 38px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.note-value-input:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
}

.note-value-input::placeholder {
  color: #6c757d;
}

.toolbar button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-button {
  background-color: #0d6efd;
  color: white;
}

.primary-button:hover:not(:disabled) {
  background-color: #0b5ed7;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.3);
}

.primary-button:disabled {
  background-color: #adb5bd;
  color: #fff;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}

.danger-button {
  background-color: #dc3545;
  color: white;
}

.danger-button:hover {
  background-color: #bb2d3b;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.secondary-button {
  background-color: #6c757d;
  color: white;
}

.secondary-button:hover {
  background-color: #5c636a;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.toolbar input:focus,
.toolbar button:focus {
  outline: none;
}

.multibox-container:last-child .multibox-dropdown-inline {
  right: 0;
  left: auto;
}
</style>
