<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useXmlStore } from '@renderer/stores/xmlStore'
import MonacoEditor from '@renderer/shared/editor/MonacoEditor.vue'
import StatusToast from '@renderer/shared/notify/StatusToast.vue'
import { useNotify } from '@renderer/shared/notify/useNotify'

const { t } = useI18n()
const xmlStore = useXmlStore()
const { statusMessage, statusType, notify } = useNotify()

const isExtracting = ref(false)
const isGenerating = ref(false)
const progress = ref(0)
const progressMessage = ref('')
const termLists = ref({})
const headerContent = ref('')
const headerEditorRef = ref(null)

const extractableElements = ref([
  { key: 'persName', label: 'Persone', selected: true },
  { key: 'placeName', label: 'Luoghi', selected: true },
  { key: 'orgName', label: 'Organizzazioni', selected: true },
  { key: 'date', label: 'Date', selected: false },
  { key: 'bibl', label: 'Bibliografia', selected: false },
  { key: 'term', label: 'Termini/Parole chiave', selected: false }
])

const hasXmlContent = computed(() => !!(xmlStore.xmlContent && xmlStore.xmlContent.trim()))
const totalTerms = computed(() =>
  Object.values(termLists.value).reduce((sum, list) => sum + (list?.length || 0), 0)
)

let progressCleanup = null
onMounted(() => {
  if (window.electronAPI.onSaxProgress) {
    progressCleanup = window.electronAPI.onSaxProgress((p, msg) => {
      progress.value = p
      progressMessage.value = msg
    })
  }
})

async function handleExtractTerms() {
  if (!hasXmlContent.value) {
    notify(t('headerBuilder.notifyNoXmlContent'), 'error')
    return
  }

  isExtracting.value = true
  progress.value = 0
  progressMessage.value = t('headerBuilder.progressInitializing')

  try {
    const selectedElements = extractableElements.value.filter((e) => e.selected).map((e) => e.key)

    const workPath = await window.electronAPI.getDocumentsPath()
    const tempXmlPath = `${workPath}/Scriptorium/temp-coder-content.xml`
    await window.electronAPI.saveFile(tempXmlPath, xmlStore.xmlContent)

    const extracted = await window.electronAPI.extractTeiTerms([tempXmlPath], {
      elements: selectedElements
    })

    termLists.value = extracted
    notify(
      t('headerBuilder.notifyTermsExtracted', {
        count: Object.values(extracted).reduce((s, l) => s + (l?.length || 0), 0)
      }),
      'success'
    )
  } catch (error) {
    console.error('Errore estrazione termini:', error)
    notify(t('headerBuilder.notifyGenericError', { error: error.message }), 'error')
  } finally {
    isExtracting.value = false
    progress.value = 0
    progressMessage.value = ''
  }
}

async function handleGenerateHeader() {
  if (totalTerms.value === 0) {
    notify(t('headerBuilder.notifyExtractFirst'), 'error')
    return
  }

  isGenerating.value = true
  try {
    const rawTermLists = JSON.parse(JSON.stringify(termLists.value))
    const header = await window.electronAPI.generateTeiHeader(rawTermLists)
    headerContent.value = header
    notify(t('headerBuilder.notifyHeaderGenerated'), 'success')
  } catch (error) {
    console.error('Errore generazione header:', error)
    notify(t('headerBuilder.notifyGenericError', { error: error.message }), 'error')
  } finally {
    isGenerating.value = false
  }
}

async function handleApplyToCoder() {
  if (!headerContent.value) {
    notify(t('headerBuilder.notifyGenerateFirst'), 'error')
    return
  }
  if (!hasXmlContent.value) {
    notify(t('headerBuilder.notifyNoDocumentToApply'), 'error')
    return
  }

  try {
    const current = xmlStore.xmlContent
    const cleanHeader = headerContent.value.replace(/<\?xml[^>]*\?>\s*/i, '').trim()

    const headerEndRegex = /^([\s\S]*?<\/teiHeader>)\s*/i
    let updated

    if (headerEndRegex.test(current)) {
      const preambleMatch = current.match(
        /^([\s\S]*?)(<teiHeader[\s\S]*?<\/teiHeader>)\s*([\s\S]*)$/i
      )
      if (preambleMatch) {
        updated = `${preambleMatch[1]}${cleanHeader}\n${preambleMatch[3]}`
      } else {
        updated = current.replace(headerEndRegex, `${cleanHeader}\n`)
      }
    } else {
      updated = current.replace(/(<TEI[^>]*>)/i, `$1\n${cleanHeader}\n`)
    }

    await xmlStore.setXmlContent(updated)
    xmlStore.handleExternalUpdate(updated)
    notify(t('headerBuilder.notifyHeaderApplied'), 'success')
  } catch (error) {
    console.error('Errore applicazione header:', error)
    notify(t('headerBuilder.notifyGenericError', { error: error.message }), 'error')
  }
}

async function handleExportHeader() {
  if (!headerContent.value) {
    notify(t('headerBuilder.notifyGenerateFirst'), 'error')
    return
  }
  try {
    const filePath = await window.electronAPI.saveFileDialog('teiHeader.xml', [
      { name: 'File XML', extensions: ['xml'] }
    ])
    if (filePath) {
      await window.electronAPI.saveFile(filePath, headerContent.value)
      notify(t('headerBuilder.notifyHeaderExported'), 'success')
    }
  } catch (error) {
    notify(t('headerBuilder.notifyExportError', { error: error.message }), 'error')
  }
}
</script>

<template>
  <div class="header-builder">
    <transition name="fade">
      <StatusToast :message="statusMessage" :type="statusType" />
    </transition>

    <div class="hb-body">
      <section class="panel panel-left">
        <div class="card">
          <h3 class="card-title">{{ $t('headerBuilder.extractionTitle') }}</h3>
          <p class="text-sm text-secondary">
            {{ $t('headerBuilder.sourceDescPart1') }}
            <strong>{{ $t('headerBuilder.sourceDescPart2') }}</strong
            >.
          </p>
          <div v-if="!hasXmlContent" class="warning-box">
            {{ $t('headerBuilder.warningNoDocument') }}
          </div>

          <div class="elements-grid">
            <label v-for="el in extractableElements" :key="el.key" class="element-chip">
              <input type="checkbox" v-model="el.selected" />
              <span>{{ el.label }}</span>
            </label>
          </div>

          <button
            class="btn btn-primary full"
            :disabled="isExtracting || !hasXmlContent"
            @click="handleExtractTerms"
          >
            {{
              isExtracting
                ? $t('headerBuilder.extractingInProgress')
                : $t('headerBuilder.extractButton')
            }}
          </button>

          <div v-if="isExtracting" class="progress-bar">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            <span class="progress-text">{{ progress }}% — {{ progressMessage }}</span>
          </div>
        </div>

        <div v-if="totalTerms > 0" class="card">
          <h3 class="card-title">
            {{ $t('headerBuilder.extractedTermsTitle', { count: totalTerms }) }}
          </h3>
          <div class="terms-sections">
            <details
              v-for="(list, key) in termLists"
              :key="key"
              class="terms-group"
              :open="list && list.length > 0"
            >
              <summary>
                {{ key }} <span v-if="list" class="badge">{{ list.length }}</span>
              </summary>
              <ul v-if="list && list.length" class="terms-list">
                <li v-for="term in list" :key="term.id">
                  <span class="term-text">{{ term.term }}</span>
                  <span v-if="term.count > 1" class="term-count">×{{ term.count }}</span>
                </li>
              </ul>
            </details>
          </div>
        </div>
      </section>

      <section class="panel panel-right">
        <div class="card editor-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ $t('headerBuilder.teiHeaderTitle') }}</h3>
              <p class="text-xs text-secondary">
                {{ $t('headerBuilder.teiHeaderDesc') }}
              </p>
            </div>
          </div>
          <div class="editor-wrapper">
            <MonacoEditor
              ref="headerEditorRef"
              v-model="headerContent"
              language="xml"
              :format-on-mount="true"
            />
          </div>
        </div>

        <div class="card actions-card">
          <button
            class="btn btn-primary"
            :disabled="isGenerating || totalTerms === 0"
            @click="handleGenerateHeader"
          >
            {{
              isGenerating
                ? $t('headerBuilder.generatingInProgress')
                : $t('headerBuilder.generateHeaderButton')
            }}
          </button>
          <button class="btn btn-success" :disabled="!headerContent" @click="handleApplyToCoder">
            {{ $t('headerBuilder.applyToScriptor') }}
          </button>
          <button class="btn btn-outline" :disabled="!headerContent" @click="handleExportHeader">
            {{ $t('headerBuilder.exportXml') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.header-builder {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #fff;
  padding: 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.hb-body {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1rem;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0;
}

.card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 1rem;
}
.card-title {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.text-xs {
  font-size: 0.75rem;
}
.text-sm {
  font-size: 0.85rem;
}
.text-secondary {
  color: #999;
}

.warning-box {
  background: #4a3a1e;
  color: #f5d98a;
  padding: 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin: 0.5rem 0;
}

.elements-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  margin: 0.75rem 0;
}
.element-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #2d2d2d;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
.element-chip input {
  cursor: pointer;
}

.progress-bar {
  position: relative;
  height: 24px;
  background: #2d2d2d;
  border-radius: 4px;
  margin-top: 0.75rem;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #0e639c;
  transition: width 0.3s;
}
.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.terms-sections {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.terms-group summary {
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.3rem;
  background: #2d2d2d;
  border-radius: 4px;
}
.badge {
  background: #0e639c;
  color: #fff;
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
  font-size: 0.7rem;
  margin-left: 0.3rem;
}
.terms-list {
  list-style: none;
  padding: 0.4rem 0.6rem;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
.terms-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid #333;
}
.term-count {
  color: #888;
}

.editor-card {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  flex: 1;
}
.editor-wrapper {
  flex: 1;
  min-height: 220px;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;
}

.actions-card {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  background: #3a3d41;
  border: none;
  color: #fff;
  padding: 0.45rem 0.8rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  background: #55595e;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.full {
  width: 100%;
  margin-top: 0.5rem;
}
.btn-primary {
  background: #0e639c;
}
.btn-primary:hover:not(:disabled) {
  background: #1177bb;
}
.btn-success {
  background: #2d7a3e;
}
.btn-success:hover:not(:disabled) {
  background: #38934a;
}
.btn-outline {
  background: transparent;
  border: 1px solid #555;
}
.btn-outline:hover:not(:disabled) {
  background: #333;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
body {
  display: block;
  justify-content: initial;
  align-items: initial;
  background-color: #1e1e1e;
}
</style>
