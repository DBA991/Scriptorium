<script setup>
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import ImageViewer from './ImageViewer.vue'
import ImageSidebar from './ImageSidebar.vue'
import StatusToast from '@renderer/shared/notify/StatusToast.vue'
import { useNotify } from '@renderer/shared/notify/useNotify'

const imageStore = useImageStore()
const initialized = ref(false)
const { t } = useI18n()
const { statusMessage, statusType, notify } = useNotify()

onMounted(async () => {
  await imageStore.init()
  initialized.value = true

  if (imageStore.missingImagePaths.length > 0) {
    notify(t('image.notifyMissingImages', { count: imageStore.missingImagePaths.length }), 'error')
  }
})

const { images, currentImageIndex, hasImages } = storeToRefs(imageStore)

const safeImages = ref([])

watch(
  images,
  (newVal) => {
    safeImages.value = newVal
  },
  { immediate: true }
)

function reorderImages(newImageList) {
  imageStore.setImages(newImageList)
}

async function handleFileSelection(files) {
  const failedCount = await imageStore.addImages(files)
  if (failedCount > 0) {
    notify(t('image.notifyMissingImages', { count: failedCount }), 'error')
  }
}

function addBlankPage(orientation) {
  imageStore.addBlankPage(orientation)
}

function removeImage(index) {
  imageStore.removeImage(index)
}

function removeCurrentImage() {
  imageStore.removeCurrentImage()
}

function updateImageFilters({ index, filters }) {
  imageStore.updateFiltersForImage({ index, filters })
}

function updateImageDimensions({ index, width, height }) {
  imageStore.updateDimensionsForImage({ index, width, height })
}

function updateImageRotation({ index, angle }) {
  imageStore.updateRotationForImage({ index, angle })
}

async function handleImageImport(paths) {
  const failedCount = await imageStore.addImages(paths)
  if (failedCount > 0) {
    notify(t('image.notifyMissingImages', { count: failedCount }), 'error')
  }
}
async function exportToPdf() {
  await imageStore.exportToPdf()
}
</script>

<template>
  <div v-if="initialized" class="app-container">
    <div class="sidebar-container">
      <ImageSidebar
        :images="images"
        :currentImageIndex="currentImageIndex"
        :hasImages="hasImages"
        @import-images="handleImageImport"
        @update:images="reorderImages"
        @images-loaded="handleFileSelection"
        @add-blank-page="addBlankPage"
        @remove-image="removeImage"
        @remove-current-image="removeCurrentImage"
        @export-pdf="exportToPdf"
        @update:currentImageIndex="(val) => imageStore.setCurrentImageIndex(val)"
      />
    </div>
    <div class="main-container">
      <ImageViewer
        :images="images"
        :currentImageIndex="currentImageIndex"
        @update:currentImageIndex="(val) => imageStore.setCurrentImageIndex(val)"
        @update-filters="updateImageFilters"
        @update-dimensions="updateImageDimensions"
        @update-rotation="updateImageRotation"
      />
    </div>
  </div>
  <div v-else class="loading-screen">
    <svg class="spinner" viewBox="0 0 50 50">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
    </svg>
    <p class="loading-text">{{ $t('image.loading') }}</p>
  </div>

  <StatusToast :message="statusMessage" :type="statusType" />
</template>

<style>
body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  font-family: Arial, sans-serif;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar-container {
  width: 300px;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid #ccc;
  background: #f5f5f5;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;

  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background-color: #f0f4f8;
  color: #4a5568;
  cursor: pointer;

  transition:
    background-color 0.2s ease,
    transform 0.1s ease,
    box-shadow 0.2s ease;
  outline: none;
}

.btn:hover:not(:disabled) {
  background-color: #e2e8f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn:active:not(:disabled) {
  background-color: #cbd5e1;
  transform: translateY(0);
  box-shadow: none;
}

.btn:disabled {
  background: #f8fafc;
  color: #a0aec0;
  cursor: not-allowed;
  border-color: #e2e8f0;
}

.close-btn {
  position: absolute;
  top: 5px;
  right: 8px;
  background: none;
  border: none;
  font-size: 18px;
  font-weight: bold;
  color: #333;
  cursor: pointer;
}
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
.loading-screen {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  background-color: #f0f4f8;
  color: #4a5568;
  font-size: 1.2rem;
}

.spinner {
  animation: rotate 2s linear infinite;
  margin-bottom: 20px;
  width: 60px;
  height: 60px;
}

.spinner .path {
  stroke: #4a5568;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.loading-text {
  font-weight: 500;
  color: #4a5568;
}
</style>
