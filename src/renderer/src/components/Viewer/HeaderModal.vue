<script setup>
import './styles/tei-header.css'

defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  headerContent: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['note-click'])

const handleContentClick = (event) => {
  const target = event.target
  const isAnnotationHook =
    target.classList.contains('tei-note-symbol') ||
    target.classList.contains('tei-seg-symbol') ||
    target.classList.contains('tei-img-symbol')

  if (isAnnotationHook) {
    const parentElement = target.closest('[data-tag]')
    if (parentElement) {
      emit('note-click', event)
    }
  }
}
</script>

<template>
  <div v-if="isVisible" class="header-modal-overlay" @click.self="closeModal">
    <div class="header-modal">
      <div class="header-modal-header">
        <h3>{{ $t('headerModal.title') }}</h3>
      </div>

      <div class="header-modal-content" v-html="headerContent" @click="handleContentClick"></div>
    </div>
  </div>
</template>

<style scoped>
.header-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3;
  padding: 20px;
  box-sizing: border-box;
}
.header-modal {
  background: white;
  border-radius: 8px;
  max-width: 90%;
  max-height: 90%;
  width: 900px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.header-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.header-modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.header-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  color: #6c757d;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-close-btn:hover {
  background-color: #e9ecef;
  color: #333;
}

.header-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
