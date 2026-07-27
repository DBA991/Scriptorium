<script setup>
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'

const props = defineProps({
  images: {
    type: Array,
    default: () => []
  },
  currentImageIndex: {
    type: Number,
    default: -1
  },
  hasImages: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'import-images',
  'update:images',
  'update:currentImageIndex',
  'images-loaded',
  'add-blank-page',
  'remove-image',
  'remove-current-image',
  'export-pdf'
])

const showOrientationModal = ref(false)
const newPageOrientation = ref('portrait')
const isDropdownOpen = ref(false)

const currentIndex = computed(() => props.currentImageIndex)

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const triggerFileInput = async () => {
  const paths = await window.electronAPI.openImagesDialog()
  if (paths && paths.length > 0) {
    emit('import-images', paths)
  }
}

const onFiles = (e) => {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  emit('images-loaded', files)
  e.target.value = ''
}

const confirmAddBlankPage = () => {
  emit('add-blank-page', newPageOrientation.value)
  showOrientationModal.value = false
}

const select = (idx) => {
  emit('update:currentImageIndex', idx)
}

const onDragEnd = () => {
  emit('update:images', props.images)
}
</script>

<template>
  <div class="sidebar">
    <div class="controls-dropdown">
      <button class="dropdown-btn" @click="toggleDropdown" aria-label="Opzioni">
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
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      <div class="dropdown-menu" v-if="isDropdownOpen">
        <button class="menu-item" @click="triggerFileInput">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21.2 15c.7-1.2 1.2-2.5 1.4-4 .2-1.4-.2-2.8-.8-4.1-.7-1.2-1.8-2.3-3.2-2.9-1.4-.6-3-1-4.7-.9-1.7 0-3.3.4-4.8 1.1-1.5.7-2.7 1.7-3.7 3-1.1 1.4-1.8 3-2.1 4.7-.3 1.7-.2 3.4.4 5 .5 1.5 1.5 2.8 2.8 3.8 1.3 1 2.8 1.6 4.3 1.8 1.6.2 3.2 0 4.6-.7 1.4-.7 2.6-1.7 3.5-3 .9-1.3 1.3-2.8 1.3-4.3v-1.7"
            />
            <path d="M12 12V3" />
          </svg>
          <span>{{ $t('imageSidebar.loadImages') }}</span>
        </button>
        <button class="menu-item" @click="showOrientationModal = true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 12h8M8 16h8" />
          </svg>
          <span>{{ $t('imageSidebar.blankPage') }}</span>
        </button>
        <button class="menu-item" :disabled="!hasImages" @click="$emit('remove-current-image')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span>{{ $t('imageSidebar.remove') }}</span>
        </button>
        <button class="menu-item" :disabled="!hasImages" @click="$emit('export-pdf')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M11 15h2v3h-2zM10 12h4M9 9h6" />
          </svg>
          <span>{{ $t('imageSidebar.exportPdf') }}</span>
        </button>
      </div>
    </div>

    <draggable :list="images" item-key="id" class="thumbnails" @end="onDragEnd">
      <template #item="{ element: img, index }">
        <div
          v-if="img"
          class="thumb"
          :class="{ active: index === currentIndex }"
          @click="select(index)"
        >
          <img :src="img.thumbnail || img.url" alt="thumb" class="thumb-img" />
          <span class="page-num">{{ index + 1 }}</span>
          <button class="remove" @click.stop="$emit('remove-image', index)">×</button>
        </div>
      </template>
    </draggable>

    <input
      type="file"
      ref="fileInputRef"
      multiple
      accept="image/*"
      class="hidden"
      @change="onFiles"
    />

    <div v-if="showOrientationModal" class="orientation-modal">
      <div class="modal-header">
        <h3>{{ $t('imageSidebar.orientationTitle') }}</h3>
        <button class="close-btn" @click="showOrientationModal = false">
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
        <label>
          <input
            type="radio"
            value="portrait"
            v-model="newPageOrientation"
            name="pageOrientation"
          />
          {{ $t('imageSidebar.portrait') }}
        </label>
        <label>
          <input
            type="radio"
            value="landscape"
            v-model="newPageOrientation"
            name="pageOrientation"
          />
          {{ $t('imageSidebar.landscape') }}
        </label>
      </div>
      <button class="btn" @click="confirmAddBlankPage">{{ $t('imageSidebar.add') }}</button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  background: #f5f5f5;
  padding: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.controls-dropdown {
  position: relative;
  display: inline-block;
  margin-bottom: 15px;
}

.dropdown-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  padding: 0;

  border: none;
  border-radius: 50%;
  background-color: #cbd5e1;
  color: #4a5568;
  cursor: pointer;
  outline: none;

  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.dropdown-btn:hover {
  background-color: #a0aec0;
  transform: scale(1.1);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: white;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 5px;
}

.menu-item {
  color: #333;
  padding: 10px 16px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-item:hover:not(:disabled) {
  background-color: #f1f1f1;
}

.menu-item:disabled {
  color: #a0aec0;
  cursor: not-allowed;
  background-color: #f9f9f9;
}

.menu-item svg {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.hidden {
  display: none;
}
.thumbnails {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 5px;
}
.thumb {
  position: relative;
  margin: 5px 0;
  border: 2px solid transparent;
  padding: 5px;
  background: white;
  border-radius: 6px;
  cursor: grab;
  transition: transform 0.2s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.thumb:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
.thumb.active {
  border-color: #cbd5e1;
}
.thumb-img {
  width: 100%;
  height: 120px;
  object-fit: contain;
  display: block;
  background: #f0f0f0;
}
.page-num {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #4a5568;
  color: #fff;
  border: none;
  width: 20px;
  height: 20px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.orientation-modal {
  position: absolute;
  top: 50px;
  left: 30px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.add-btn {
  margin-top: 10px;
}
</style>
