<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../stores/imageStore.js'
import { useHtmlStore } from '../stores/htmlStore.js'
import { useXmlStore } from '../stores/xmlStore.js'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const imageStore = useImageStore()
const htmlStore = useHtmlStore()
const xmlStore = useXmlStore()
const { hasImages } = storeToRefs(imageStore)
const { htmlContent } = storeToRefs(htmlStore)
const { xmlContent } = storeToRefs(xmlStore)

const projectName = ref('')

const exportMode = ref('standard')

const pulpitumUuid = ref('')
const pulpitumTitle = ref('')
const pulpitumLanguage = ref('it')

const pulpitumStatus = ref('idle')
const pulpitumMessage = ref('')
const pulpitumExportedFiles = ref([])

const updateProjectName = () => {
  window.electronAPI.storeSet('project', projectName.value)
}

const exportPdf = () => {
  imageStore.exportToPdf()
}

const exportXml = () => {
  window.electronAPI.exportFile(projectName.value, 'xml')
}

const exportHtml = () => {
  window.electronAPI.exportFile(projectName.value, 'html')
}

/**
 * Assicura un uuid: se l'utente non ne ha inserito uno, ne genera uno.
 */
function ensureUuid() {
  if (!pulpitumUuid.value.trim()) {
    pulpitumUuid.value =
      (crypto && crypto.randomUUID && crypto.randomUUID()) ||
      'uuid-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  }
  return pulpitumUuid.value.trim()
}

/**
 * Deriva uno slug "pulito" dal nome del progetto (per i nomi file).
 * Mantiene la stessa logica di generateSlug usata altrove nell'app.
 */
function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

const canExportPulpitum = computed(() => {
  if (hasImages.value && htmlContent.value && xmlContent.value) {
    return (
      projectName.value.trim() && pulpitumTitle.value.trim() && pulpitumStatus.value !== 'exporting'
    )
  }
  return false
})

/**
 * Export completo Pulpitum in un'unica cartella usando le API esistenti.
 */
async function exportToPulpitum() {
  if (!canExportPulpitum.value) return

  pulpitumStatus.value = 'exporting'
  pulpitumMessage.value = t('export.progressInitializing')
  pulpitumExportedFiles.value = []

  const originalProjectName = projectName.value
  const uuid = ensureUuid()
  const slug = slugify(originalProjectName) || 'documento'
  const baseName = `${uuid}.${slug}`
  const jsonFileName = `html.${baseName}.json`

  try {
    const targetPath = await window.electronAPI.saveFileDialog(jsonFileName, [
      { name: 'JSON Metadata', extensions: ['json'] }
    ])

    if (!targetPath) {
      pulpitumStatus.value = 'idle'
      pulpitumMessage.value = ''
      return
    }

    const sep = targetPath.includes('/') ? '/' : '\\'
    const targetDir = targetPath.slice(0, targetPath.lastIndexOf(sep))
    const absoluteBasePath = `${targetDir}${sep}${baseName}`

    pulpitumMessage.value = t('export.progressReadingLocalData')
    const xmlData = await window.electronAPI.storeGet('xmlContent')
    const htmlData = await window.electronAPI.storeGet('htmlContent')

    if (!xmlData) {
      throw new Error(t('export.errorNoXmlContent'))
    }
    if (!htmlData) {
      throw new Error(t('export.errorNoHtmlContent'))
    }

    pulpitumMessage.value = t('export.progressWritingXml')
    const xmlPath = `${absoluteBasePath}.xml`
    await window.electronAPI.saveFile(xmlPath, xmlData)
    pulpitumExportedFiles.value.push({ name: `${baseName}.xml`, type: 'XML' })

    pulpitumMessage.value = t('export.progressWritingHtml')
    const htmlPath = `${absoluteBasePath}.html`
    await window.electronAPI.saveFile(htmlPath, htmlData)
    pulpitumExportedFiles.value.push({ name: `${baseName}.html`, type: 'HTML' })

    pulpitumMessage.value = t('export.progressWritingJson')
    const metadata = {
      uuid,
      title: pulpitumTitle.value.trim(),
      language: pulpitumLanguage.value.trim() || 'it',
      htmlPath: `/repo/html/${baseName}.html`,
      pdfPath: `/repo/pdf/${baseName}.pdf`,
      xmlPath: `/repo/xml/${baseName}.xml`
    }
    await window.electronAPI.saveJson(targetPath, metadata, 2)
    pulpitumExportedFiles.value.push({ name: jsonFileName, type: 'JSON' })

    if (hasImages.value) {
      pulpitumMessage.value = t('export.progressGeneratingPdf')
      await window.electronAPI.storeSet('project', absoluteBasePath)
      await imageStore.exportToPdf()
      pulpitumExportedFiles.value.push({ name: `${baseName}.pdf`, type: 'PDF' })
    } else {
      pulpitumExportedFiles.value.push({
        name: `${baseName}.pdf ${t('export.pulpitumSkippedNoImage')}`,
        type: 'PDF'
      })
    }

    pulpitumStatus.value = 'done'
    pulpitumMessage.value = t('export.notifyExportCompleted', { dir: targetDir })
  } catch (error) {
    console.error("Errore durante l'export Pulpitum:", error)
    pulpitumStatus.value = 'error'
    pulpitumMessage.value = t('export.notifyGenericError', { error: error.message || error })
  } finally {
    await window.electronAPI.storeSet('project', originalProjectName)
  }
}

onMounted(() => {
  htmlStore.init()
  xmlStore.init()
  imageStore.init()
  window.electronAPI.storeGet('project').then((value) => {
    if (value) {
      projectName.value = value
      if (!pulpitumTitle.value) pulpitumTitle.value = value
    }
  })

  if (!pulpitumUuid.value) {
    ensureUuid()
  }

  window.electronAPI.onStoreUpdated((key, value) => {
    if (key === 'project') {
      projectName.value = value
    }
  })
})
</script>

<template>
  <div class="export-container">
    <h2 class="title">{{ $t('export.title') }}</h2>
    <p class="subtitle">{{ $t('export.subtitle') }}</p>

    <div class="input-group">
      <label for="project-name">{{ $t('export.projectNameLabel') }}</label>
      <input
        id="project-name"
        type="text"
        v-model="projectName"
        :placeholder="$t('export.projectNamePlaceholder')"
        @input="updateProjectName"
      />
    </div>

    <div class="mode-switcher" role="radiogroup" :aria-label="$t('export.modeGroupLabel')">
      <label class="mode-option" :class="{ active: exportMode === 'standard' }">
        <input type="radio" value="standard" v-model="exportMode" />
        <span>{{ $t('export.modeStandard') }}</span>
      </label>
      <label class="mode-option" :class="{ active: exportMode === 'pulpitum' }">
        <input type="radio" value="pulpitum" v-model="exportMode" />
        <span>{{ $t('export.modePulpitum') }}</span>
      </label>
    </div>

    <div v-if="exportMode === 'standard'" class="export-buttons">
      <button @click="exportPdf" :disabled="!projectName || !hasImages">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M4 12h10M4 18h4" />
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        </svg>
        {{ $t('export.exportPdf') }}
      </button>

      <button @click="exportXml" :disabled="!projectName || !xmlContent">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        {{ $t('export.exportXml') }}
      </button>

      <button @click="exportHtml" :disabled="!projectName || !htmlContent">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m18 16 4-4-4-4" />
          <path d="m6 8-4 4 4 4" />
          <path d="m14.5 4-5 16" />
        </svg>
        {{ $t('export.exportHtml') }}
      </button>
    </div>

    <div v-else class="pulpitum-section">
      <p class="pulpitum-desc">
        {{ $t('export.pulpitumDescPart1') }} <strong>{{ $t('export.pulpitumDescPart2') }}</strong
        >{{ $t('export.pulpitumDescPart3') }} <code>/repo</code>
        {{ $t('export.pulpitumDescPart4') }} <code>/json</code>.
      </p>

      <div class="pulpitum-fields">
        <div class="input-group">
          <label for="pulpitum-uuid">{{ $t('export.pulpitumUuidLabel') }}</label>
          <input
            id="pulpitum-uuid"
            type="text"
            v-model="pulpitumUuid"
            :placeholder="$t('export.pulpitumUuidPlaceholder')"
          />
        </div>

        <div class="input-group">
          <label for="pulpitum-title">{{ $t('export.pulpitumTitleLabel') }}</label>
          <input
            id="pulpitum-title"
            type="text"
            v-model="pulpitumTitle"
            :placeholder="$t('export.pulpitumTitlePlaceholder')"
          />
        </div>

        <div class="input-group">
          <label for="pulpitum-lang">{{ $t('export.pulpitumLangLabel') }}</label>
          <input
            id="pulpitum-lang"
            type="text"
            v-model="pulpitumLanguage"
            :placeholder="$t('export.pulpitumLangPlaceholder')"
          />
        </div>
      </div>

      <div class="pulpitum-preview">
        <span class="preview-label">{{ $t('export.previewLabel') }}</span>
        <code class="preview-name"
          >html.{{ pulpitumUuid || $t('export.previewUuidFallback') }}.{{
            projectName || $t('export.previewNameFallback')
          }}.json</code
        >
        <code class="preview-name"
          >{{ pulpitumUuid || $t('export.previewUuidFallback') }}.{{
            projectName || $t('export.previewNameFallback')
          }}.html</code
        >
        <code class="preview-name"
          >{{ pulpitumUuid || $t('export.previewUuidFallback') }}.{{
            projectName || $t('export.previewNameFallback')
          }}.pdf</code
        >
        <code class="preview-name"
          >{{ pulpitumUuid || $t('export.previewUuidFallback') }}.{{
            projectName || $t('export.previewNameFallback')
          }}.xml</code
        >
      </div>

      <button class="btn-export-pulpitum" @click="exportToPulpitum" :disabled="!canExportPulpitum">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {{
          pulpitumStatus === 'exporting'
            ? $t('export.exportingStatus')
            : $t('export.exportForPulpitum')
        }}
      </button>

      <div v-if="pulpitumStatus === 'exporting'" class="pulpitum-feedback exporting">
        {{ pulpitumMessage }}
      </div>

      <div v-if="pulpitumStatus === 'done'" class="pulpitum-feedback done">
        <p>{{ pulpitumMessage }}</p>
        <ul class="exported-list">
          <li v-for="f in pulpitumExportedFiles" :key="f.name">
            <span class="file-type-badge">{{ f.type }}</span> {{ f.name }}
          </li>
        </ul>
      </div>

      <div v-if="pulpitumStatus === 'error'" class="pulpitum-feedback error">
        {{ pulpitumMessage }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-container {
  background-color: #1e1e1e;
  color: #fff;
  padding: 24px;
  border-radius: 6px;
  max-width: 560px;
  margin: 20px auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: #999;
  font-size: 13px;
  margin: -8px 0 0 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 12px;
  font-weight: 600;
  color: #999;
}

.input-group input {
  background-color: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 8px 10px;
  color: #fff;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.input-group input::placeholder {
  color: #777;
}

.input-group input:focus {
  border-color: #0e639c;
  box-shadow: 0 0 0 2px rgba(14, 99, 156, 0.3);
}

.mode-switcher {
  display: flex;
  gap: 8px;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 4px;
}

.mode-option {
  flex: 1;
  position: relative;
  cursor: pointer;
}

.mode-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.mode-option span {
  display: block;
  text-align: center;
  padding: 8px 12px;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
  color: #999;
  transition:
    background 0.15s,
    color 0.15s;
}

.mode-option:hover span {
  color: #ddd;
}

.mode-option.active span {
  background: #0e639c;
  color: #fff;
}

.export-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.export-buttons button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  background-color: #0e639c;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color 0.2s,
    transform 0.1s;
}

.export-buttons button:hover:not(:disabled) {
  background-color: #1177bb;
  transform: translateY(-1px);
}

.export-buttons button:disabled {
  background-color: #3a3d41;
  color: #888;
  cursor: not-allowed;
}

.export-buttons button svg {
  vertical-align: middle;
}

.pulpitum-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pulpitum-desc {
  margin: 0;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
}

.pulpitum-desc strong {
  color: #a5c8f8;
}

.pulpitum-desc code {
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 12px;
  color: #dcdcaa;
}

.pulpitum-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pulpitum-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #252526;
  border: 1px dashed #3c3c3c;
  border-radius: 4px;
  padding: 10px 12px;
}

.preview-label {
  font-size: 11px;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.preview-name {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: #9cdcfe;
  word-break: break-all;
}

.btn-export-pulpitum {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 4px;
  background-color: #2d7a3e;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color 0.2s,
    transform 0.1s;
}

.btn-export-pulpitum:hover:not(:disabled) {
  background-color: #389349;
  transform: translateY(-1px);
}

.btn-export-pulpitum:disabled {
  background-color: #3a3d41;
  color: #888;
  cursor: not-allowed;
}

.pulpitum-feedback {
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.4;
}

.pulpitum-feedback.exporting {
  background: #1e2f3f;
  border: 1px solid #0e639c;
  color: #a5c8f8;
}

.pulpitum-feedback.done {
  background: #1b4332;
  border: 1px solid #2d7a3e;
  color: #b8e6c4;
}

.pulpitum-feedback.done p {
  margin: 0 0 8px 0;
  word-break: break-all;
}

.exported-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}

.file-type-badge {
  display: inline-block;
  min-width: 38px;
  text-align: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 700;
  margin-right: 6px;
}

.pulpitum-feedback.error {
  background: #3a1e1e;
  border: 1px solid #a33;
  color: #f8a5a5;
}
</style>

<style>
body {
  margin: 0;
  background-color: #1e1e1e;
}
</style>
