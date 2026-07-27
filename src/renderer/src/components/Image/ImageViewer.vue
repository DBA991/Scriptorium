<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import ImageFiltersPanel from './ImageFiltersPanel.vue'
import ImageStraightenPanel from './ImageStraightenPanel.vue'
import OcrAutomationModal from './OcrAutomationModal.vue'
import { useZoom } from './modules/useZoom'
import { useDrawing } from './modules/useDrawing'

const props = defineProps({
  images: {
    type: Array,
    default: () => []
  },
  currentImageIndex: {
    type: Number,
    default: -1
  }
})

const emit = defineEmits([
  'update:currentImageIndex',
  'update-filters',
  'update-dimensions',
  'update-rotation'
])

const wrapperRef = ref(null)
const imageRef = ref(null)
const drawCanvas = ref(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const showFilters = ref(false)
const showStraightenPanel = ref(false)
const showOcrModal = ref(false)
const ocrImageDataUrl = ref(null)

const showOcrAutoModal = ref(false)
const autoRunning = ref(false)
const autoProgress = ref({ currentIndex: 0, total: 0, pageNumber: 0 })
const autoAbsoluteIndices = ref([])
const hasImages = computed(() => props.images.length > 0)

const previewFilters = ref(null)

const {
  zoom,
  zoomInput,
  showZoomModal,
  containerStyle,
  toggleZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  updateZoomFromInput,
  centerImage
} = useZoom(wrapperRef, naturalWidth, naturalHeight)

const {
  drawing,
  drawColor,
  drawLineWidth,
  eraserMode,
  canvasStyle: drawingCanvasStyle,
  toggleDraw,
  startDraw,
  draw,
  stopDraw,
  clearCanvas
} = useDrawing(naturalWidth, naturalHeight, drawCanvas)

const currentImage = computed(() => props.images[props.currentImageIndex] || null)
const hasPrev = computed(() => props.currentImageIndex > 0)
const hasNext = computed(() => props.currentImageIndex < props.images.length - 1)

const imageStyle = computed(() => {
  const style = {
    display: 'block',
    width: `${naturalWidth.value}px`,
    height: `${naturalHeight.value}px`,
    transform: `rotate(${currentImage.value?.rotation || 0}deg)`
  }
  const f = previewFilters.value || currentImage.value?.filters
  if (f) {
    style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%)`
  }
  return style
})

watch(
  currentImage,
  (newImg) => {
    drawing.value = false
    resetZoom()
    nextTick(() => {
      clearCanvas()
    })
    if (newImg?.width && newImg?.height) {
      naturalWidth.value = newImg.width
      naturalHeight.value = newImg.height
    }
  },
  { immediate: true }
)

watch(drawing, (isDrawingActive) => {
  if (!isDrawingActive) {
    stopDraw()
  }
})

watch(eraserMode, (newVal) => {
  if (drawCanvas.value) {
    const ctx = drawCanvas.value.getContext('2d')
    ctx.globalCompositeOperation = newVal ? 'destination-out' : 'source-over'
  }
})

const prevImage = () => {
  if (hasPrev.value) {
    emit('update:currentImageIndex', props.currentImageIndex - 1)
  }
}

const nextImage = () => {
  if (hasNext.value) {
    emit('update:currentImageIndex', props.currentImageIndex + 1)
  }
}

const onImageLoad = (e) => {
  naturalWidth.value = e.target.naturalWidth
  naturalHeight.value = e.target.naturalHeight
  emit('update-dimensions', {
    index: props.currentImageIndex,
    width: naturalWidth.value,
    height: naturalHeight.value
  })
  centerImage()
}

const toggleFilters = () => {
  showFilters.value = !showFilters.value
}

const handleFiltersUpdate = (filters) => {
  emit('update-filters', { index: props.currentImageIndex, filters })
}

const toggleStraightenPanel = () => {
  showStraightenPanel.value = !showStraightenPanel.value
}

const handleRotationUpdate = (angle) => {
  emit('update-rotation', { index: props.currentImageIndex, angle })
}

const resetFilters = () => {
  emit('update-filters', {
    index: props.currentImageIndex,
    filters: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0
    }
  })
  emit('update-rotation', { index: props.currentImageIndex, angle: 0 })
  clearCanvas()
}

const getProcessedImageAsDataUrl = () => {
  if (!imageRef.value) {
    console.error('Nessuna immagine o ref immagine disponibile.')
    return null
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const rotationAngle = currentImage.value?.rotation || 0
  const rotationInRadians = (rotationAngle * Math.PI) / 180
  const { naturalWidth: w, naturalHeight: h } = imageRef.value
  const absCos = Math.abs(Math.cos(rotationInRadians))
  const absSin = Math.abs(Math.sin(rotationInRadians))
  canvas.width = w * absCos + h * absSin
  canvas.height = w * absSin + h * absCos

  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rotationInRadians)

  if (currentImage.value?.filters) {
    const f = currentImage.value.filters
    ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%)`
  } else {
    ctx.filter = 'none'
  }

  ctx.drawImage(imageRef.value, -w / 2, -h / 2, w, h)
  ctx.restore()

  if (drawCanvas.value) {
    ctx.drawImage(drawCanvas.value, 0, 0, canvas.width, canvas.height)
  }

  return canvas.toDataURL('image/png')
}

const handleOcrClick = () => {
  if (!imageRef.value) {
    console.warn('Immagine non ancora caricata.')
    return
  }
  const processedImage = getProcessedImageAsDataUrl()
  if (processedImage) {
    window.electronAPI.openOcrWindow(processedImage)
  }
}

const onToggleAutoOcr = () => {
  if (autoRunning.value) {
    window.electronAPI.stopOcrAutomation()
    return
  }
  showOcrAutoModal.value = true
}

const onAutoStart = (config) => {
  const pageNumbers = config.pagesSelection
  const allPages = props.images.map((img, index) => ({
    url: img.url,
    isBlank: !!img.isBlank,
    oneBased: index + 1
  }))

  const selected = pageNumbers ? allPages.filter((p) => pageNumbers.includes(p.oneBased)) : allPages

  if (selected.length === 0) {
    showOcrAutoModal.value = false
    return
  }

  autoAbsoluteIndices.value = selected.map((p) => p.oneBased - 1)

  const startIndex = selected[0].oneBased - 1

  const payload = {
    pages: selected.map((p) => ({ url: p.url, isBlank: p.isBlank })),
    cssStyles: config.cssStyles,
    pageFlip: config.pageFlip,
    grade: config.grade,
    gradeEven: config.gradeEven,
    startIndex
  }

  window.electronAPI.startOcrAutomation(payload)
  autoRunning.value = true
  previewFilters.value = null
  showOcrAutoModal.value = false
}

const onAutoPreviewFilters = (filters) => {
  previewFilters.value = filters
}

const onAutoClose = () => {
  previewFilters.value = null
  showOcrAutoModal.value = false
}

onMounted(() => {
  window.electronAPI.onOcrAutoProgress((progress) => {
    autoProgress.value = progress

    const absoluteIndex = autoAbsoluteIndices.value[progress.currentIndex]

    if (absoluteIndex !== undefined) {
      emit('update:currentImageIndex', absoluteIndex)
    }
  })

  window.electronAPI.onOcrAutoFinished(() => {
    autoRunning.value = false
    autoProgress.value = { currentIndex: 0, total: 0, pageNumber: 0 }
    autoAbsoluteIndices.value = []
  })
})

onBeforeUnmount(() => {
  if (autoRunning.value) {
    window.electronAPI.stopOcrAutomation()
  }
})
</script>

<template>
  <div class="viewer">
    <div class="viewer-toolbar">
      <div class="nav-controls">
        <button
          @click="prevImage"
          class="toolbar-btn"
          :disabled="!hasPrev"
          aria-label="Immagine precedente"
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          @click="nextImage"
          class="toolbar-btn"
          :disabled="!hasNext"
          aria-label="Immagine successiva"
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
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div class="center-controls">
        <button
          @click="handleOcrClick"
          class="toolbar-btn"
          :disabled="!currentImage || !imageRef"
          aria-label="Riconoscimento OCR"
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 13.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
            <path d="M6 13.5c.5 1.5 2 2.5 4.5 2.5s4-1 4.5-2.5" />
          </svg>
        </button>

        <button
          @click="onToggleAutoOcr"
          :class="['toolbar-btn', { active: autoRunning }]"
          :disabled="!hasImages || (!autoRunning && !currentImage)"
          :aria-label="autoRunning ? 'Ferma automazione OCR' : 'Avvia automazione OCR'"
          :title="
            autoRunning
              ? `Automazione in corso (${autoProgress.pageNumber}/${autoProgress.total})`
              : 'Automazione OCR'
          "
        >
          <svg
            v-if="!autoRunning"
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
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <svg
            v-else
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
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>

        <button
          @click="resetFilters"
          class="toolbar-btn"
          :disabled="!currentImage"
          aria-label="Reimposta filtri e rotazione"
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
            <path d="M3 13a9 9 0 1 0 9-9" />
            <path d="M3 13V8h5" />
          </svg>
        </button>
      </div>

      <div class="tool-controls">
        <button
          @click="toggleDraw"
          class="toolbar-btn"
          :disabled="!currentImage"
          aria-label="Disegna"
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
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
        <button @click="toggleZoom" class="toolbar-btn" :disabled="!currentImage" aria-label="Zoom">
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button
          @click="toggleStraightenPanel"
          class="toolbar-btn"
          :disabled="!currentImage"
          aria-label="Raddrizza"
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
            <path d="M21.5 12a9.5 9.5 0 1 1-2.2-6.5" />
            <path d="M22 6.5l-2.2-2.2v4.4" />
          </svg>
        </button>
        <button
          @click="toggleFilters"
          class="toolbar-btn"
          :disabled="!currentImage"
          aria-label="Filtri"
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
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
      </div>
    </div>

    <div class="canvas-wrapper" ref="wrapperRef">
      <div class="canvas-container" v-if="currentImage" :style="containerStyle">
        <img
          :src="currentImage.url"
          @load="onImageLoad"
          class="image-layer"
          alt="Immagine corrente"
          :style="imageStyle"
          ref="imageRef"
        />
        <canvas
          v-show="drawing"
          ref="drawCanvas"
          class="draw-layer"
          :width="naturalWidth"
          :height="naturalHeight"
          :style="drawingCanvasStyle"
          @mousedown="startDraw"
          @mousemove="draw"
          @mouseup="stopDraw"
          @mouseout="stopDraw"
        />
      </div>
      <div v-else class="placeholder">{{ $t('imageViewer.noImageSelected') }}</div>
    </div>

    <ImageFiltersPanel
      v-if="showFilters && currentImage"
      :initial-filters="currentImage.filters"
      @close="toggleFilters"
      @update-filters="handleFiltersUpdate"
    />

    <ImageStraightenPanel
      v-if="showStraightenPanel && currentImage"
      :initial-angle="currentImage.rotation || 0"
      @close="toggleStraightenPanel"
      @update-angle="handleRotationUpdate"
    />

    <OcrAutomationModal
      v-if="showOcrAutoModal && hasImages"
      :total-pages="props.images.length"
      @start="onAutoStart"
      @update-preview="onAutoPreviewFilters"
      @close="onAutoClose"
    />

    <div v-if="showZoomModal" class="zoom-modal">
      <button class="close-btn" @click="toggleZoom">
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
      <h3>{{ $t('imageViewer.zoomControlTitle') }}</h3>
      <div class="zoom-controls">
        <div class="zoom-group">
          <button class="btn" @click="zoomOut">
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
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <input
            type="number"
            v-model="zoomInput"
            @change="updateZoomFromInput"
            class="zoom-input"
            min="20"
            max="300"
          />
          <button class="btn" @click="zoomIn">
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
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <button class="btn" @click="resetZoom">{{ $t('imageViewer.resetZoom') }}</button>
      </div>
    </div>

    <div v-if="drawing" class="draw-modal">
      <button class="close-btn" @click="toggleDraw">
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
      <h3>{{ $t('imageViewer.drawToolsTitle') }}</h3>
      <div class="draw-tools">
        <div class="tool-group">
          <label for="draw-color">{{ $t('imageViewer.colorLabel') }}</label>
          <input type="color" id="draw-color" v-model="drawColor" />
        </div>
        <div class="tool-group">
          <label for="draw-linewidth">{{ $t('imageViewer.thicknessLabel') }}</label>
          <input type="range" id="draw-linewidth" v-model="drawLineWidth" min="1" max="20" />
          <span>{{ drawLineWidth }}px</span>
        </div>
        <div class="tool-group">
          <label>
            <input type="checkbox" v-model="eraserMode" /> {{ $t('imageViewer.eraserLabel') }}
          </label>
        </div>
        <button class="btn" @click="clearCanvas">{{ $t('imageViewer.clearAll') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  background-color: #f8f8f8;
  border-left: 1px solid #e0e0e0;
  position: relative;
  overflow: hidden;
}

.viewer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #f0f4f8;
  border-bottom: 1px solid #e2e8f0;
  gap: 20px;
  z-index: 1;
}

.toolbar-btn {
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
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background-color: #a0aec0;
  transform: scale(1.1);
}

.toolbar-btn:disabled {
  background-color: #e2e8f0;
  color: #a0aec0;
  cursor: not-allowed;
  transform: scale(1);
}

.toolbar-btn.active {
  background-color: #f56565;
  color: white;
}

.toolbar-btn.active:hover {
  background-color: #e53e3e;
}

.center-controls {
  display: flex;
  gap: 10px;
}
.nav-controls,
.tool-controls {
  display: flex;
  gap: 10px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  position: relative;
}

.canvas-container {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-layer {
  display: block;
  max-width: none;
}

.draw-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
  cursor: crosshair;
  z-index: 2;
}

.placeholder {
  width: 500px;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border: 2px dashed #ccc;
  color: #777;
}

.draw-modal,
.zoom-modal {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  width: 240px;
}
.draw-tools,
.zoom-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-group label {
  font-weight: 500;
  flex-shrink: 0;
}
.tool-group input[type='range'],
.tool-group input[type='color'] {
  flex-grow: 1;
}
.tool-group input[type='range'] {
  height: 20px;
}
.zoom-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.zoom-input {
  width: 60px;
  padding: 6px;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
