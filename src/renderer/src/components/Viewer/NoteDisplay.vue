<script setup>
import { computed } from 'vue'

const props = defineProps({
  activeNote: {
    type: String,
    default: ''
  },
  editingSpan: {
    type: [Object, null],
    default: null
  },
  activeNoteIsTei: {
    type: Boolean,
    default: false
  },
  noteType: {
    type: String,
    default: ''
  },
  noteValue: {
    type: String,
    default: ''
  }
})

defineEmits([
  'close',
  'update-note',
  'delete-note',
  'cancel-edit',
  'update:noteType',
  'update:noteValue'
])

const noteTitle = computed(() => {
  if (props.editingSpan) return 'Modifica Nota Utente'
  if (props.activeNoteIsTei) return 'Dettagli'
  return 'Nota Utente'
})
</script>

<template>
  <div class="viewer-note-display">
    <template v-if="activeNote || editingSpan">
      <div class="note-header">
        <h4>{{ noteTitle }}</h4>
        <button @click="$emit('close')" class="close-note-button">X</button>
      </div>
      <div class="note-content">
        <template v-if="editingSpan">
          <label for="editNoteType">{{ $t('noteDisplay.typeLabel') }}</label>
          <input
            id="editNoteType"
            :value="noteType"
            @input="$emit('update:noteType', $event.target.value)"
            :placeholder="$t('noteDisplay.typePlaceholder')"
          />

          <label for="editNoteValue">{{ $t('noteDisplay.contentLabel') }}</label>
          <textarea
            id="editNoteValue"
            :value="noteValue"
            @input="$emit('update:noteValue', $event.target.value)"
            :placeholder="$t('noteDisplay.contentPlaceholder')"
          ></textarea>

          <div class="note-actions">
            <button @click="$emit('update-note')">{{ $t('noteDisplay.updateNote') }}</button>
            <button @click="$emit('delete-note')">{{ $t('noteDisplay.deleteNote') }}</button>
            <button @click="$emit('cancel-edit')">{{ $t('noteDisplay.cancel') }}</button>
          </div>
        </template>
        <template v-else>
          <span v-html="activeNote"></span>
        </template>
      </div>
    </template>
    <template v-else>
      {{ $t('noteDisplay.noNoteSelected') }}
    </template>
  </div>
</template>

<style scoped>
.viewer-note-display {
  background: #fafafa;
  padding: 0.75rem;
  border-top: 1px solid #ccc;

  max-height: 10%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.08);
  z-index: 4;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-right: 5px;
}

.note-header h4 {
  margin: 0;
  color: #555;
  font-size: 1em;
}

.close-note-button {
  background: none;
  border: none;
  color: #888;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.close-note-button:hover {
  color: #333;
}

.note-content {
  flex: 1;
}

.note-content label {
  font-weight: bold;
  margin-top: 0.5rem;
  color: #555;
  display: block;
}

.note-content input,
.note-content textarea {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  box-sizing: border-box;
}

.note-content textarea {
  min-height: 50px;
  resize: vertical;
}

.note-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  justify-content: flex-end;
}

.note-actions button {
  padding: 8px 12px;
  background-color: #ffc107;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.note-actions button:hover {
  background-color: #e0a800;
}

.note-content :deep(pre) {
  white-space: pre-wrap;
  word-break: break-all;
  background-color: #e9ecef;
  padding: 8px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', 'Menlo', monospace;
  font-size: 0.85em;
  color: #495057;
  margin-top: 10px;
}

.note-content :deep(strong) {
  margin-bottom: 0.5rem;
  color: #555;
}

.note-content :deep(.metadata-display) {
  margin-top: 10px;
}

.note-content :deep(.metadata-display p) {
  margin: 5px 0;
  font-size: 0.9em;
}

.note-content :deep(.metadata-display strong) {
  color: #007bff;
}
</style>
