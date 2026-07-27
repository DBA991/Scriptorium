<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useXmlStore } from '@renderer/stores/xmlStore'
import MonacoEditor from '@renderer/shared/editor/MonacoEditor.vue'
import StatusToast from '@renderer/shared/notify/StatusToast.vue'
import { useNotify } from '@renderer/shared/notify/useNotify'

const { t } = useI18n()
const xmlStore = useXmlStore()
const { statusMessage, statusType, notify } = useNotify()

const isCreating = ref(false)
const progress = ref(0)
const progressMessage = ref('')
const vocabulary = ref({})
const stats = ref(null)
const selectedWord = ref(null)
const editorRef = ref(null)

function toSerializableVocabulary(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

const config = ref({
  caseSensitive: false,
  minLength: 3,
  excludeNumbers: true,
  excludePunctuation: true,
  language: 'romance',
  sortBy: 'alphabetical'
})

const hasXmlContent = computed(() => !!(xmlStore.xmlContent && xmlStore.xmlContent.trim()))
const wordCount = computed(() => Object.keys(vocabulary.value).length)

const sortedWords = computed(() => {
  const entries = Object.entries(vocabulary.value).map(([word, data]) => ({
    word,
    count: data.occurrences?.length || 0
  }))
  if (config.value.sortBy === 'frequency') {
    entries.sort((a, b) => b.count - a.count)
  } else {
    entries.sort((a, b) => a.word.localeCompare(b.word))
  }
  return entries
})

onMounted(() => {
  if (window.electronAPI.onSaxProgress) {
    window.electronAPI.onSaxProgress((p, msg) => {
      progress.value = p
      progressMessage.value = msg
    })
  }
})

async function handleCreateVocabulary() {
  if (!hasXmlContent.value) {
    notify(t('vocabulary.notifyNoXmlContent'), 'error')
    return
  }

  isCreating.value = true
  progress.value = 0
  progressMessage.value = t('vocabulary.progressInitializing')

  try {
    const workPath = await window.electronAPI.getDocumentsPath()
    const tempXmlPath = `${workPath}/Scriptorium/temp-coder-content.xml`
    await window.electronAPI.saveFile(tempXmlPath, xmlStore.xmlContent)

    const result = await window.electronAPI.createVocabulary([tempXmlPath], {
      caseSensitive: config.value.caseSensitive,
      minLength: config.value.minLength,
      excludeNumbers: config.value.excludeNumbers,
      excludePunctuation: config.value.excludePunctuation,
      language: config.value.language,
      sortBy: config.value.sortBy
    })

    vocabulary.value = toSerializableVocabulary(result.vocabulary || {})
    stats.value = result.stats || null
    notify(
      t('vocabulary.notifyWordsExtracted', { count: Object.keys(vocabulary.value).length }),
      'success'
    )
  } catch (error) {
    console.error('Errore creazione vocabolario:', error)
    notify(t('vocabulary.notifyGenericError', { error: error.message }), 'error')
  } finally {
    isCreating.value = false
    progress.value = 0
    progressMessage.value = ''
  }
}

const editorJson = computed({
  get() {
    return JSON.stringify(vocabulary.value, null, 2)
  },
  set(newValue) {
    try {
      vocabulary.value = JSON.parse(newValue)
    } catch {}
  }
})

function handleSelectWord(word) {
  selectedWord.value = word
}

async function handleExport() {
  if (wordCount.value === 0) return notify(t('vocabulary.notifyCreateFirst'), 'error')
  try {
    const filePath = await window.electronAPI.saveFileDialog('vocabolario.json', [
      { name: 'File JSON', extensions: ['json'] }
    ])
    if (filePath) {
      await window.electronAPI.saveJson(filePath, toSerializableVocabulary(vocabulary.value), 2)
      notify(t('vocabulary.notifyVocabularyExported'), 'success')
    }
  } catch (error) {
    notify(t('vocabulary.notifyExportError', { error: error.message }), 'error')
  }
}

async function handleImport() {
  try {
    const filePath = await window.electronAPI.openJsonFile()
    if (!filePath) return
    const data = await window.electronAPI.loadJson(filePath)
    vocabulary.value = toSerializableVocabulary(data || {})
    stats.value = null
    notify(t('vocabulary.notifyVocabularyImported'), 'success')
  } catch (error) {
    notify(t('vocabulary.notifyImportError', { error: error.message }), 'error')
  }
}

async function handleValidate() {
  try {
    const result = await window.electronAPI.validateVocabulary(
      toSerializableVocabulary(vocabulary.value)
    )
    if (result.valid) {
      notify(t('vocabulary.notifyVocabularyValid'), 'success')
    } else {
      notify(t('vocabulary.notifyValidationErrors', { errors: result.errors.join(' | ') }), 'error')
    }
  } catch (error) {
    notify(t('vocabulary.notifyValidationError', { error: error.message }), 'error')
  }
}

function handleClear() {
  vocabulary.value = {}
  stats.value = null
  selectedWord.value = null
}

const occurrenceModal = ref(null)
const occurrenceEditorRef = ref(null)

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getOccurrenceLocationLabel(occ) {
  if (!occ || !occ.position) {
    return '—'
  }
  return `xml:id="${occ.position}"`
}

/**
 * Trova l'occorrenza basandosi sull'indice (es. la 3° volta che la parola appare)
 * simulando la lettura lineare del SaxParser.
 */
function locateOccurrence(word, targetIndex) {
  const content = xmlStore.xmlContent || ''
  if (!content.trim()) {
    return { found: false, reason: 'Nessun documento XML in Scriptor.' }
  }

  const regex = new RegExp(
    `(?:^|[^\\p{L}\\p{M}'])(${escapeRegExp(word)})(?=[^\\p{L}\\p{M}']|$)`,
    'giu'
  )

  const bodyMatch = /<text[^>]*>|<body[^>]*>/i.exec(content)
  const searchStartIndex = bodyMatch ? bodyMatch.index : 0

  let match
  let currentMatchIndex = 0

  while ((match = regex.exec(content)) !== null) {
    if (match.index < searchStartIndex) continue

    if (currentMatchIndex === targetIndex) {
      const exactMatchIndex = match.index + match[0].lastIndexOf(match[1])

      const textUpToMatch = content.slice(0, exactMatchIndex)
      const lines = textUpToMatch.split('\n')
      const lineNumber = lines.length
      const column = lines[lines.length - 1].length + 1

      return {
        found: true,
        lineNumber,
        column,
        length: match[1].length,
        content
      }
    }

    currentMatchIndex++
  }

  return {
    found: false,
    reason: `L'occorrenza #${targetIndex + 1} non è stata trovata nel testo corrente. Il documento potrebbe essere stato alterato.`
  }
}

function openOccurrenceModal(word, occ, idx) {
  const result = locateOccurrence(word, idx)
  occurrenceModal.value = { word, occ, idx, ...result }

  if (result.found) {
    nextTick(() => highlightOccurrenceWord(result.lineNumber, result.column, result.length))
  }
}

function highlightOccurrenceWord(lineNumber, column, length) {
  const editor = occurrenceEditorRef.value?.getEditor()
  if (!editor) return

  editor.revealLineInCenter(lineNumber)

  editor.deltaDecorations(
    [],
    [
      {
        range: {
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + length
        },
        options: {
          inlineClassName: 'occurrence-highlight-word',
          isWholeLine: false
        }
      }
    ]
  )

  editor.setPosition({ lineNumber, column })
}

function closeOccurrenceModal() {
  occurrenceModal.value = null
}
</script>

<template>
  <div class="vocabulary">
    <transition name="fade">
      <StatusToast :message="statusMessage" :type="statusType" />
    </transition>

    <div class="card config-card">
      <h3 class="card-title">{{ $t('vocabulary.configTitle') }}</h3>
      <p class="text-sm text-secondary">
        {{ $t('vocabulary.sourceDescPart1') }}
        <strong>{{ $t('vocabulary.sourceDescPart2') }}</strong>
        <span v-if="!hasXmlContent" class="warning-inline">
          {{ $t('vocabulary.noDocumentWarning') }}</span
        >
      </p>

      <div class="config-grid">
        <div class="form-group">
          <label class="form-label">{{ $t('vocabulary.languageLabel') }}</label>
          <select v-model="config.language" class="form-select">
            <option value="romance">{{ $t('vocabulary.languageRomance') }}</option>
            <option value="saxon">{{ $t('vocabulary.languageSaxon') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('vocabulary.sortByLabel') }}</label>
          <select v-model="config.sortBy" class="form-select">
            <option value="alphabetical">{{ $t('vocabulary.sortAlphabetical') }}</option>
            <option value="frequency">{{ $t('vocabulary.sortFrequency') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('vocabulary.minLengthLabel') }}</label>
          <input v-model.number="config.minLength" type="number" min="1" class="form-input" />
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-row">
            <input v-model="config.caseSensitive" type="checkbox" />
            <span>{{ $t('vocabulary.caseSensitive') }}</span>
          </label>
          <label class="checkbox-row">
            <input v-model="config.excludeNumbers" type="checkbox" />
            <span>{{ $t('vocabulary.excludeNumbers') }}</span>
          </label>
          <label class="checkbox-row">
            <input v-model="config.excludePunctuation" type="checkbox" />
            <span>{{ $t('vocabulary.excludePunctuation') }}</span>
          </label>
        </div>
      </div>

      <div class="config-actions">
        <button
          class="btn btn-primary"
          :disabled="isCreating || !hasXmlContent"
          @click="handleCreateVocabulary"
        >
          {{ isCreating ? $t('vocabulary.creatingInProgress') : $t('vocabulary.createButton') }}
        </button>
        <button class="btn btn-outline" :disabled="wordCount === 0" @click="handleImport">
          {{ $t('vocabulary.importButton') }}
        </button>
        <button class="btn btn-outline" :disabled="wordCount === 0" @click="handleExport">
          {{ $t('vocabulary.exportButton') }}
        </button>
        <button class="btn btn-outline" :disabled="wordCount === 0" @click="handleValidate">
          {{ $t('vocabulary.validateButton') }}
        </button>
        <button class="btn btn-outline" :disabled="wordCount === 0" @click="handleClear">
          {{ $t('vocabulary.clearButton') }}
        </button>
      </div>

      <div v-if="isCreating" class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        <span class="progress-text">{{ progress }}% — {{ progressMessage }}</span>
      </div>
    </div>

    <div v-if="stats" class="card stats-card">
      <div class="stat">
        <span class="stat-value">{{ stats.totalWords }}</span>
        <span class="stat-label">{{ $t('vocabulary.statTotalWords') }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ stats.uniqueWords }}</span>
        <span class="stat-label">{{ $t('vocabulary.statUniqueWords') }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ stats.totalOccurrences }}</span>
        <span class="stat-label">{{ $t('vocabulary.statTotalOccurrences') }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ stats.averageOccurrences?.toFixed(1) || '0' }}</span>
        <span class="stat-label">{{ $t('vocabulary.statAverageOccurrences') }}</span>
      </div>
    </div>

    <div class="vocab-body">
      <section class="panel panel-left">
        <div class="card list-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('vocabulary.wordsTitle', { count: wordCount }) }}</h3>
          </div>
          <div v-if="wordCount === 0" class="empty-state">
            <p class="text-secondary">{{ $t('vocabulary.noVocabulary') }}</p>
            <p class="text-xs text-secondary">{{ $t('vocabulary.configureHint') }}</p>
          </div>
          <div v-else class="word-list">
            <button
              v-for="entry in sortedWords"
              :key="entry.word"
              class="word-item"
              :class="{ active: selectedWord === entry.word }"
              @click="handleSelectWord(entry.word)"
            >
              <span class="word-text">{{ entry.word }}</span>
              <span class="word-count">{{ entry.count }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedWord && vocabulary[selectedWord]" class="card detail-card">
          <h3 class="card-title">{{ selectedWord }}</h3>
          <p class="text-xs text-secondary">
            {{
              $t('vocabulary.occurrencesCount', {
                count: vocabulary[selectedWord].occurrences?.length || 0
              })
            }}
          </p>
          <div class="occurrences">
            <button
              v-for="(occ, idx) in vocabulary[selectedWord].occurrences"
              :key="idx"
              class="occ-item"
              :title="$t('vocabulary.occurrenceViewTitle')"
              @click="openOccurrenceModal(selectedWord, occ, idx)"
            >
              <span class="occ-group">{{ occ.group || '?' }}</span>
              <span class="occ-pos">{{ getOccurrenceLocationLabel(occ) }}</span>
              <span v-if="occ.type" class="occ-type">{{ occ.type }}</span>
              <span class="occ-view-hint">👁</span>
            </button>
          </div>
        </div>
      </section>

      <section class="panel panel-right">
        <div class="card editor-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('vocabulary.editorTitle') }}</h3>
            <span class="text-xs text-secondary">{{ $t('vocabulary.editable') }}</span>
          </div>
          <div class="editor-wrapper">
            <MonacoEditor
              ref="editorRef"
              v-model="editorJson"
              language="json"
              :format-on-mount="true"
            />
          </div>
        </div>
      </section>
    </div>

    <div v-if="occurrenceModal" class="modal-overlay" @click.self="closeOccurrenceModal">
      <div class="modal-content occurrence-modal">
        <div class="modal-header">
          <div>
            <h3>{{ occurrenceModal.word }}</h3>
            <p class="text-xs text-secondary">
              Occorrenza #{{ occurrenceModal.idx + 1 }} in {{ occurrenceModal.occ.group || '—' }} →
              {{ getOccurrenceLocationLabel(occurrenceModal.occ) }}
            </p>
          </div>
          <button class="close-btn" @click="closeOccurrenceModal">×</button>
        </div>

        <div class="modal-body occurrence-body">
          <div v-if="occurrenceModal.found" class="occurrence-editor-wrapper">
            <MonacoEditor
              ref="occurrenceEditorRef"
              :model-value="occurrenceModal.content"
              language="xml"
              :read-only="true"
            />
          </div>
          <div v-else class="occurrence-not-found">
            <p>{{ $t('vocabulary.occurrenceNotFoundPrefix') }} {{ occurrenceModal.reason }}</p>
          </div>
        </div>

        <div class="modal-footer">
          <span class="text-xs text-secondary">{{ $t('vocabulary.readOnlyHint') }}</span>
          <button class="btn btn-primary" @click="closeOccurrenceModal">
            {{ $t('vocabulary.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vocabulary {
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
  gap: 0.75rem;
}
.card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 1rem;
}
.card-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.config-card {
  flex-shrink: 0;
}
.config-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-label {
  font-size: 0.75rem;
  color: #ccc;
}
.form-input,
.form-select {
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}
.checkbox-group {
  justify-content: center;
  gap: 0.5rem;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
}
.config-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.warning-inline {
  color: #f5d98a;
}
.progress-bar {
  position: relative;
  height: 22px;
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
  font-size: 0.72rem;
}
.stats-card {
  display: flex;
  gap: 2rem;
  flex-shrink: 0;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-value {
  font-size: 1.3rem;
  font-weight: 600;
  color: #4ec9b0;
}
.stat-label {
  font-size: 0.72rem;
  color: #999;
}
.vocab-body {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0.75rem;
  min-height: 0;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}
.panel-left {
  overflow: hidden;
}
.panel-right {
  overflow: hidden;
}
.list-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.word-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.word-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2d2d2d;
  border: 1px solid transparent;
  color: #ccc;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  text-align: left;
}
.word-item:hover {
  background: #333;
}
.word-item.active {
  border-color: #0e639c;
  background: #2a3a4a;
  color: #fff;
}
.word-count {
  background: #3c3c3c;
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
  font-size: 0.7rem;
  color: #999;
}
.detail-card {
  flex-shrink: 0;
  max-height: 35vh;
  overflow-y: auto;
}
.occurrences {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.4rem;
}
.occ-item {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  width: 100%;
  font-size: 0.72rem;
  padding: 0.3rem 0.3rem;
  border: none;
  border-bottom: 1px solid #333;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  border-radius: 3px;
  transition: background 0.15s;
}
.occ-item:hover {
  background: #2d3a45;
}
.occ-group {
  color: #4ec9b0;
  min-width: 60px;
}
.occ-pos {
  color: #ccc;
}
.occ-type {
  color: #888;
}
.occ-view-hint {
  margin-left: auto;
  opacity: 0.5;
  font-size: 0.85rem;
}
.empty-state {
  text-align: center;
  padding: 2rem 0.5rem;
  font-size: 0.85rem;
}
.editor-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.editor-wrapper {
  flex: 1;
  min-height: 200px;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;
}
.text-xs {
  font-size: 0.72rem;
}
.text-sm {
  font-size: 0.82rem;
}
.text-secondary {
  color: #999;
}
.btn {
  background: #3a3d41;
  border: none;
  color: #fff;
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
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
.btn-primary {
  background: #0e639c;
}
.btn-primary:hover:not(:disabled) {
  background: #1177bb;
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
.occurrence-modal {
  max-width: 1100px;
  height: 82vh;
}
.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}
.modal-header h3 {
  margin: 0 0 0.2rem 0;
  color: #fff;
  font-size: 1.05rem;
}
.close-btn {
  background: transparent;
  border: none;
  color: #999;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.3rem;
}
.close-btn:hover {
  color: #fff;
}
.modal-body {
  padding: 1rem;
  overflow-y: auto;
}
.occurrence-body {
  flex: 1;
  min-height: 0;
  padding: 0.75rem;
  display: flex;
  overflow: hidden;
}
.occurrence-editor-wrapper {
  flex: 1;
  min-height: 0;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;
}
.occurrence-not-found {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #f5d98a;
  padding: 2rem;
}
.modal-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
</style>

<style>
body {
  display: block;
  justify-content: initial;
  align-items: initial;
  background-color: #1e1e1e;
}

.occurrence-highlight-word {
  background-color: rgba(14, 99, 156, 0.6);
  border-radius: 2px;
  color: white;
}
</style>
