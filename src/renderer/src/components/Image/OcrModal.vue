<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Tesseract from 'tesseract.js'
import { langOptions, defaultLang } from './modules/ocrLangs'

const { t } = useI18n()
const ocrText = ref('')
const isLoading = ref(false)
const progress = ref(0)
const progressStatus = ref(t('ocrModal.progressWaiting'))
const errorMessage = ref(null)
const selectedLang = ref(defaultLang)
const langOptionsRef = ref(langOptions)

const autoMode = ref(false)
const pageNumber = ref(null)
const pendingCssStyles = ref(null)
const pendingGrade = ref(0)
const pendingAutoPayload = ref(null)

const imageDataUrl = ref(null)
watch(imageDataUrl, (newUrl) => {
  if (newUrl) {
    performOcr(newUrl)
  }
})

watch(selectedLang, async (newLang) => {
  await window.electronAPI.setSpellCheckerLanguage(newLang)
  if (autoMode.value && pendingAutoPayload.value) {
    performOcrAuto(pendingAutoPayload.value)
  } else if (imageDataUrl.value && !autoMode.value) {
    performOcr(imageDataUrl.value)
  }
})

const textareaLang = computed(
  () => langOptionsRef.value.find((l) => l.value === selectedLang.value)?.lang
)

async function handleClose() {
  if (autoMode.value) {
    window.electronAPI.stopOcrAutomation()
    autoMode.value = false
  }
  await window.electronAPI.restoreDefaultSpellChecker()
  ocrText.value = ''
  isLoading.value = false
  progress.value = 0
  progressStatus.value = t('ocrModal.progressWaiting')
  errorMessage.value = null
  pageNumber.value = null
  pendingCssStyles.value = null
  pendingGrade.value = 0
  pendingAutoPayload.value = null
  window.electronAPI.closeOcrWindow()
}

const handleSendToEditor = () => {
  if (!ocrText.value) return
  window.electronAPI.sendTextToEditor(ocrText.value)

  if (autoMode.value) {
    advanceAutoPage()
  } else {
    handleClose()
  }
}

function handleLanguageChange(event) {
  selectedLang.value = event.target.value
}

function advanceAutoPage() {
  if (autoMode.value) {
    window.electronAPI.sendOcrAutoPageDone()
    ocrText.value = ''
    progress.value = 0
    progressStatus.value = t('ocrModal.progressWaitingNextPage')
  }
}

async function runTesseract(imageUrl) {
  const langPath = `./tesseract/lang-data/`
  const corePath = './tesseract/tesseract-core.wasm.js'
  const workerPath = './tesseract/worker.min.js'
  const { data } = await Tesseract.recognize(imageUrl, selectedLang.value, {
    langPath,
    corePath,
    workerPath,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        progress.value = m.progress * 100
        progressStatus.value = t('ocrModal.progressRecognizing', {
          percent: Math.round(m.progress * 100)
        })
      } else {
        progressStatus.value = m.status
      }
    }
  })
  return data.text
}

function preprocessImageForOcr(imageUrl, cssStyles, grade) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const rotationInRadians = (Number(grade || 0) * Math.PI) / 180
      const absCos = Math.abs(Math.cos(rotationInRadians))
      const absSin = Math.abs(Math.sin(rotationInRadians))
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = w * absCos + h * absSin
      canvas.height = w * absSin + h * absCos

      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rotationInRadians)

      if (cssStyles) {
        const f = cssStyles
        ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%)`
      } else {
        ctx.filter = 'none'
      }

      ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.restore()

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Caricamento immagine fallito'))
    img.src = imageUrl
  })
}

async function performOcr(imageUrl) {
  if (!imageUrl) {
    errorMessage.value = t('ocrModal.errorNoImage')
    return
  }

  ocrText.value = ''
  isLoading.value = true
  progress.value = 0
  progressStatus.value = t('ocrModal.progressStarting', { lang: selectedLang.value.toUpperCase() })
  errorMessage.value = null

  try {
    ocrText.value = await runTesseract(imageUrl)
  } catch (error) {
    console.error("Errore durante l'OCR:", error)
    errorMessage.value = t('ocrModal.errorOcrGeneric')
  } finally {
    isLoading.value = false
    progress.value = 100
    progressStatus.value = t('ocrModal.progressCompleted')
  }
}

async function performOcrAuto(payload) {
  pendingAutoPayload.value = payload
  const { imageUrl, isBlank, cssStyles, grade, pageNumber: pageNum } = payload
  if (!imageUrl) {
    errorMessage.value = t('ocrModal.errorNoImage')
    return
  }

  pageNumber.value = pageNum
  pendingCssStyles.value = cssStyles
  pendingGrade.value = grade
  errorMessage.value = null

  if (isBlank) {
    ocrText.value = `<pb n="${pageNum}" />\n`
    isLoading.value = false
    progress.value = 100
    progressStatus.value = t('ocrModal.progressBlankPage', { page: pageNum })
    return
  }

  ocrText.value = ''
  isLoading.value = true
  progress.value = 0
  progressStatus.value = t('ocrModal.progressPreprocessingPage', { page: pageNum })

  try {
    const processedUrl = await preprocessImageForOcr(imageUrl, cssStyles, grade)
    progressStatus.value = t('ocrModal.progressRecognizingPage', {
      page: pageNum,
      lang: selectedLang.value.toUpperCase()
    })
    const text = await runTesseract(processedUrl)
    ocrText.value = `<pb n="${pageNum}" />\n${text}`
  } catch (error) {
    console.error("Errore durante l'OCR automatizzato:", error)
    errorMessage.value = t('ocrModal.errorOcrGeneric')
  } finally {
    isLoading.value = false
    progress.value = 100
    progressStatus.value = t('ocrModal.progressPageCompleted', { page: pageNum })
  }
}

function copyToClipboard() {
  if (!ocrText.value) return
  navigator.clipboard.writeText(ocrText.value)
  if (autoMode.value) {
    advanceAutoPage()
  } else {
    handleClose()
  }
}

onMounted(() => {
  window.electronAPI.onOcrImageData((data) => {
    imageDataUrl.value = data
  })

  window.electronAPI.onOcrAutoPage((payload) => {
    autoMode.value = true
    performOcrAuto(payload)
  })

  window.electronAPI.onOcrAutoFinished(() => {
    autoMode.value = false
    pageNumber.value = null
    pendingCssStyles.value = null
    pendingGrade.value = 0
    pendingAutoPayload.value = null
    progressStatus.value = t('ocrModal.progressAutomationCompleted')
  })

  window.electronAPI.sendOcrAutoReady()
})

onUnmounted(() => {
  window.electronAPI.onOcrImageData(null)
})
</script>

<template>
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">
        {{ $t('ocrModal.title') }}
        <span v-if="autoMode" class="auto-badge">{{
          $t('ocrModal.automationBadge', { page: pageNumber })
        }}</span>
      </h3>
    </div>

    <div class="modal-body">
      <div class="lang-selector-container">
        <label for="lang-select">{{ $t('ocrModal.languageLabel') }}</label>
        <select
          id="lang-select"
          v-model="selectedLang"
          @change="handleLanguageChange"
          :disabled="isLoading"
        >
          <option v-for="lang in langOptionsRef" :key="lang.value" :value="lang.value">
            {{ lang.label }}
          </option>
        </select>
      </div>

      <div v-if="isLoading" class="progress-status-container">
        <p class="progress-text">{{ progressStatus }}</p>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="progress-percentage">{{ Math.round(progress) }}%</p>
      </div>

      <div v-if="errorMessage" class="error-message">
        <strong>{{ $t('ocrModal.errorLabel') }}</strong>
        <p>{{ errorMessage }}</p>
        <button v-if="imageDataUrl" @click="performOcr(imageDataUrl)" class="retry-btn">
          {{ $t('ocrModal.retry') }}
        </button>
      </div>

      <div class="textarea-container">
        <label for="ocr-text">{{ $t('ocrModal.recognizedTextLabel') }}</label>
        <textarea
          id="ocr-text"
          v-model="ocrText"
          class="ocr-textarea"
          rows="12"
          :placeholder="$t('ocrModal.recognizedTextPlaceholder')"
          :disabled="isLoading"
          :lang="textareaLang"
          :key="textareaLang"
          spellcheck="true"
        ></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button @click="copyToClipboard" class="btn btn-secondary" :disabled="!ocrText || isLoading">
        {{ $t('ocrModal.copyText') }}
      </button>
      <button @click="handleSendToEditor" :disabled="!ocrText" class="btn btn-secondary">
        {{ $t('ocrModal.sendToEditor') }}
      </button>

      <button @click="handleClose" class="btn btn-primary">{{ $t('ocrModal.close') }}</button>
    </div>
  </div>
</template>

<style scoped>
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

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  min-height: 600px;
  min-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  color: #2d3748;
}

.auto-badge {
  display: inline-block;
  margin-left: 10px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  background-color: #f56565;
  border-radius: 10px;
  vertical-align: middle;
}

.modal-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.lang-selector-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lang-selector-container label {
  font-weight: 600;
  color: #2d3748;
  min-width: 50px;
}

.lang-selector-container select {
  padding: 8px 12px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  min-width: 120px;
}

.lang-selector-container select:disabled {
  background-color: #f7fafc;
  color: #a0aec0;
}

.progress-status-container {
  background-color: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 15px;
}

.progress-text {
  margin: 0 0 10px 0;
  font-weight: 500;
  color: #2d3748;
}

.progress-bar-container {
  width: 100%;
  height: 10px;
  background-color: #e2e8f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4299e1, #3182ce);
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-percentage {
  margin: 0;
  text-align: right;
  font-size: 0.9rem;
  color: #4a5568;
  font-weight: 500;
}

.textarea-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.textarea-container label {
  font-weight: 600;
  color: #2d3748;
}

.ocr-textarea {
  width: 100%;
  padding: 12px;
  box-sizing: border-box;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 200px;
  flex-grow: 1;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Open Sans',
    'Helvetica Neue',
    sans-serif;
  color: #2d3748;
}

.ocr-textarea:disabled {
  background-color: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

.ocr-textarea:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.error-message {
  background-color: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 6px;
  padding: 15px;
  color: #c53030;
}

.error-message strong {
  display: block;
  margin-bottom: 5px;
}

.error-message p {
  margin: 0 0 10px 0;
}

.retry-btn {
  background-color: #c53030;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background-color: #9c2626;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3182ce;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #2d3748;
}

.btn-secondary:hover {
  background-color: #cbd5e0;
}

.btn:disabled {
  background-color: #e2e8f0;
  color: #a0aec0;
  cursor: not-allowed;
}
</style>
