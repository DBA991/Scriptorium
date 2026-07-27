<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'load'])

const newSchema = ref({
  name: '',
  file: null,
  url: ''
})

/**
 * Resetta il form quando la modale viene chiusa/riaperta.
 */
watch(
  () => props.show,
  (isVisible) => {
    if (isVisible) {
      newSchema.value = { name: '', file: null, url: '' }
    }
  }
)

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    newSchema.value.file = file
    newSchema.value.url = ''
  }
}

/**
 * Emette l'evento 'load' con i dati del form.
 */
function submitSchema() {
  if (newSchema.value.name && (newSchema.value.file || newSchema.value.url)) {
    emit('load', { ...newSchema.value })
  } else {
    alert('Please provide a name and a file or URL.')
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('loadSchemaModal.title') }}</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>{{ $t('loadSchemaModal.nameLabel') }}</label>
          <input
            v-model="newSchema.name"
            type="text"
            :placeholder="$t('loadSchemaModal.namePlaceholder')"
          />
        </div>

        <div class="form-group">
          <label>{{ $t('loadSchemaModal.uploadLabel') }}</label>
          <input type="file" accept=".xsd" @change="handleFileUpload" />
        </div>

        <div class="form-group">
          <label>{{ $t('loadSchemaModal.urlLabel') }}</label>
          <input
            v-model="newSchema.url"
            type="text"
            :placeholder="$t('loadSchemaModal.urlPlaceholder')"
          />
        </div>
      </div>

      <div class="modal-footer">
        <button @click="submitSchema" class="action-btn">
          {{ $t('loadSchemaModal.loadSchema') }}
        </button>
        <button @click="$emit('close')" class="close-btn">
          {{ $t('loadSchemaModal.cancel') }}
        </button>
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
  max-width: 500px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h3 {
  margin: 0;
  color: #ccc;
}

.modal-body {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #ccc;
}

.form-group input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #444;
  text-align: right;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.action-btn,
.close-btn {
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.action-btn {
  background: #007acc;
  color: white;
}

.action-btn:hover {
  background: #005f9e;
}

.close-btn {
  background: transparent;
  color: #ccc;
  font-size: 1rem;
}
.modal-header .close-btn {
  font-size: 1.5rem;
  padding: 0 10px;
}

.close-btn:hover {
  color: #fff;
}
</style>
