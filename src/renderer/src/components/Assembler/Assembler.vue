<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import MonacoEditor from '@renderer/shared/editor/MonacoEditor.vue'
import StatusToast from '@renderer/shared/notify/StatusToast.vue'
import { useNotify } from '@renderer/shared/notify/useNotify'
import { assembleDocument } from './modules/documentAssembler.js'

const { t } = useI18n()
const { statusMessage, statusType, notify } = useNotify()
const xmlFiles = ref([])
const assemblyMode = ref('simple')
const activeFilePath = ref(null)
const editorContent = ref('')
const isDirty = ref(false)
const isLoadingFile = ref(false)
const isGenerating = ref(false)
const previewContent = ref('')
const showPreview = ref(false)
const editorRef = ref(null)
const previewEditorRef = ref(null)

const hasFiles = computed(() => xmlFiles.value.length > 0)
const activeFile = computed(() => xmlFiles.value.find((f) => f.path === activeFilePath.value))

async function loadFileList() {
  try {
    const settings = await window.electronAPI.loadSettings()
    if (settings.xmlCorpora && settings.xmlCorpora.length > 0) {
      xmlFiles.value = settings.xmlCorpora.map((f) => ({
        path: f.path,
        name: f.name,
        sizeFormatted: f.sizeFormatted || ''
      }))
    }
  } catch (error) {
    console.error('Errore caricamento lista file:', error)
  }
}

async function handleImportFiles() {
  try {
    const newFiles = await window.electronAPI.openXmlFiles()
    if (newFiles && newFiles.length > 0) {
      await loadFileList()
      notify(t('assembler.notifyFilesImported', { count: newFiles.length }), 'success')
    }
  } catch (error) {
    notify(t('assembler.notifyImportError', { error: error.message }), 'error')
  }
}

async function handleSelectFile(file) {
  if (isDirty.value && activeFilePath.value) {
    if (!confirm(t('assembler.confirmDiscardChanges'))) {
      return
    }
  }
  isLoadingFile.value = true
  try {
    const content = await window.electronAPI.readFile(file.path)
    activeFilePath.value = file.path
    editorContent.value = content
    isDirty.value = false
  } catch (error) {
    notify(t('assembler.notifyReadError', { name: file.name, error: error.message }), 'error')
  } finally {
    isLoadingFile.value = false
  }
}

function handleEditorInput(value) {
  editorContent.value = value
  isDirty.value = activeFilePath.value !== null
}

async function handleSaveFile() {
  if (!activeFilePath.value) return
  try {
    await window.electronAPI.saveFile(activeFilePath.value, editorContent.value)
    isDirty.value = false
    notify(t('assembler.notifyFileSaved', { name: activeFile.value?.name }), 'success')
  } catch (error) {
    notify(t('assembler.notifySaveError', { error: error.message }), 'error')
  }
}

function handleRemoveFile(file) {
  xmlFiles.value = xmlFiles.value.filter((f) => f.path !== file.path)
  if (activeFilePath.value === file.path) {
    activeFilePath.value = null
    editorContent.value = ''
    isDirty.value = false
  }
}

async function handleGenerateDocument() {
  if (xmlFiles.value.length === 0) {
    notify(t('assembler.notifyNoFilesToAssemble'), 'error')
    return
  }
  if (assemblyMode.value === 'collation' && xmlFiles.value.length < 2) {
    notify(t('assembler.notifyCollationNeedsTwo'), 'error')
    return
  }

  isGenerating.value = true
  try {
    const filesContent = []
    for (const file of xmlFiles.value) {
      const content = await window.electronAPI.readFile(file.path)
      filesContent.push({ name: file.name, content })
    }

    previewContent.value = assembleDocument(filesContent, { mode: assemblyMode.value })
    showPreview.value = true
    notify(
      assemblyMode.value === 'collation'
        ? t('assembler.notifyCollationGenerated')
        : t('assembler.notifyDocumentAssembled'),
      'success'
    )
  } catch (error) {
    console.error('Errore montaggio:', error)
    notify(t('assembler.notifyGenericError', { error: error.message }), 'error')
  } finally {
    isGenerating.value = false
  }
}

async function handleExportDocument() {
  if (!previewContent.value) {
    notify(t('assembler.notifyGenerateFirst'), 'error')
    return
  }
  try {
    const filePath = await window.electronAPI.saveFileDialog('documento-tei.xml', [
      { name: 'File XML', extensions: ['xml'] }
    ])
    if (filePath) {
      await window.electronAPI.saveFile(filePath, previewContent.value)
      notify(t('assembler.notifyDocumentExported'), 'success')
    }
  } catch (error) {
    notify(t('assembler.notifyExportError', { error: error.message }), 'error')
  }
}

async function handleValidateXml() {
  if (!previewContent.value) return
  try {
    const result = await window.electronAPI.validateTeiXml(previewContent.value)
    if (result.valid) {
      notify(t('assembler.notifyXmlValid'), 'success')
    } else {
      notify(t('assembler.notifyValidationErrors', { errors: result.errors.join(' | ') }), 'error')
    }
  } catch (error) {
    notify(t('assembler.notifyValidationError', { error: error.message }), 'error')
  }
}

async function handleCopy() {
  if (window.electronAPI?.copyClipboardItem) {
    try {
      await window.electronAPI.copyClipboardItem(previewContent.value)
      notify(t('assembler.notifyCopiedToClipboard'), 'success')
      return
    } catch (error) {
      console.warn('copyClipboardItem fallito, provo i fallback nel renderer:', error)
    }
  }

  try {
    await navigator.clipboard.writeText(previewContent.value)
    notify(t('assembler.notifyCopiedToClipboard'), 'success')
    return
  } catch (error) {
    console.warn('navigator.clipboard.writeText fallito, uso fallback execCommand:', error)
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = previewContent.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!ok) throw new Error('execCommand copy ha restituito false')
    notify(t('assembler.notifyCopiedToClipboard'), 'success')
  } catch (error) {
    notify(t('assembler.notifyCopyError', { error: error.message }), 'error')
  }
}

onMounted(() => {
  loadFileList()
})
</script>

<template>
  <div class="assembler">
    <transition name="fade">
      <StatusToast :message="statusMessage" :type="statusType" />
    </transition>

    <div class="asm-body">
      <section class="panel panel-left">
        <div class="card list-card">
          <div class="card-header">
            <h3 class="card-title">
              {{ $t('assembler.filesImported', { count: xmlFiles.length }) }}
            </h3>
            <button class="btn btn-primary btn-sm" @click="handleImportFiles">
              {{ $t('assembler.importButton') }}
            </button>
          </div>

          <div v-if="!hasFiles" class="empty-state">
            <p>{{ $t('assembler.emptyTitle') }}</p>
            <p class="text-xs text-secondary">{{ $t('assembler.emptyHint') }}</p>
          </div>

          <draggable
            v-else
            v-model="xmlFiles"
            item-key="path"
            handle=".drag-handle"
            class="file-list"
          >
            <template #item="{ element }">
              <div
                class="file-item"
                :class="{ active: activeFilePath === element.path }"
                @click="handleSelectFile(element)"
              >
                <span class="drag-handle" @click.stop>⠿</span>
                <div class="file-info">
                  <span class="file-name">{{ element.name }}</span>
                  <span class="file-size">{{ element.sizeFormatted }}</span>
                </div>
                <button
                  class="btn-remove"
                  :title="$t('assembler.removeFromListTitle')"
                  @click.stop="handleRemoveFile(element)"
                >
                  ✕
                </button>
              </div>
            </template>
          </draggable>
        </div>

        <div class="card actions-card">
          <div class="mode-select">
            <label class="mode-option">
              <input type="radio" value="simple" v-model="assemblyMode" />
              {{ $t('assembler.modeSimple') }}
            </label>
            <label class="mode-option">
              <input type="radio" value="collation" v-model="assemblyMode" />
              {{ $t('assembler.modeCollation') }}
            </label>
          </div>
          <p class="text-xs text-secondary mode-hint">
            {{ $t('assembler.modeHint') }}
          </p>
          <button
            class="btn btn-primary full"
            :disabled="isGenerating || !hasFiles"
            @click="handleGenerateDocument"
          >
            {{
              isGenerating
                ? $t('assembler.generateInProgress')
                : $t('assembler.generateButton', { count: xmlFiles.length })
            }}
          </button>
        </div>
      </section>

      <section class="panel panel-right">
        <div class="card editor-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                {{ activeFile ? activeFile.name : $t('assembler.editorDefaultTitle') }}
                <span v-if="isDirty" class="dirty-dot" :title="$t('assembler.unsavedChangesTitle')"
                  >●</span
                >
              </h3>
              <p class="text-xs text-secondary">
                <span v-if="activeFile">{{ $t('assembler.editorHintSelected') }}</span>
                <span v-else>{{ $t('assembler.editorHintNone') }}</span>
              </p>
            </div>
            <div class="card-actions">
              <button
                class="btn btn-success btn-sm"
                :disabled="!activeFilePath || !isDirty"
                @click="handleSaveFile"
              >
                {{ $t('assembler.save') }}
              </button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div v-if="isLoadingFile" class="loading-overlay">{{ $t('assembler.loading') }}</div>
            <MonacoEditor
              ref="editorRef"
              :model-value="editorContent"
              language="xml"
              :read-only="!activeFilePath"
              :format-on-mount="false"
              @update:model-value="handleEditorInput"
            />
          </div>
        </div>

        <div v-if="showPreview && previewContent" class="card editor-card preview-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('assembler.previewTitle') }}</h3>
            <div class="card-actions">
              <button class="btn btn-outline btn-sm" @click="handleValidateXml">
                {{ $t('assembler.validate') }}
              </button>
              <button class="btn btn-outline btn-sm" @click="handleCopy">
                {{ $t('assembler.copy') }}
              </button>
              <button class="btn btn-success btn-sm" @click="handleExportDocument">
                {{ $t('assembler.export') }}
              </button>
            </div>
          </div>
          <div class="editor-wrapper preview-editor">
            <MonacoEditor
              ref="previewEditorRef"
              v-model="previewContent"
              language="xml"
              :read-only="true"
              :format-on-mount="true"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.assembler {
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

.asm-body {
  flex: 1;
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1rem;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}
.panel-left {
  overflow-y: auto;
}
.panel-right {
  overflow-y: auto;
}

.card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 1rem;
}
.card-title {
  margin: 0;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.card-actions {
  display: flex;
  gap: 0.4rem;
}

.text-xs {
  font-size: 0.75rem;
}
.text-secondary {
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 1.5rem 0.5rem;
  color: #888;
  font-size: 0.85rem;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 60vh;
  overflow-y: auto;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.file-item:hover {
  border-color: #555;
}
.file-item.active {
  border-color: #0e639c;
  background: #2a3a4a;
}
.drag-handle {
  cursor: grab;
  color: #666;
  font-size: 1.1rem;
}
.drag-handle:active {
  cursor: grabbing;
}
.file-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  font-size: 0.7rem;
  color: #777;
}
.btn-remove {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
}
.btn-remove:hover {
  color: #f8a5a5;
  background: #3a1e1e;
}

.dirty-dot {
  color: #f5d98a;
  font-size: 0.7rem;
}

.editor-card {
  display: flex;
  flex-direction: column;
  min-height: 300px;
  flex: 1;
}
.editor-wrapper {
  flex: 1;
  min-height: 240px;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.preview-card {
  flex: 0 0 auto;
  min-height: 280px;
  max-height: 45vh;
}
.preview-editor {
  min-height: 200px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(30, 30, 30, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  font-size: 0.85rem;
  color: #ccc;
}

.actions-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mode-select {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.mode-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.mode-hint {
  margin: 0 0 0.2rem;
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
.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
}
.btn.full {
  width: 100%;
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
