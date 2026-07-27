<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useXmlStore } from '../../stores/xmlStore'
import MonacoXmlEditor from '@renderer/shared/editor/MonacoXmlEditor.vue'
import UnicodeModal from './UnicodeModal.vue'
import LoadSchemaModal from './LoadSchemaModal.vue'
import TagMagicBox from './TagMagicBox.vue'
import PoeticProcessor from './PoeticProcessor.vue'
import StatusToast from '@renderer/shared/notify/StatusToast.vue'
import { useNotify } from '@renderer/shared/notify/useNotify'
import { useSchemaManager } from '@renderer/shared/editor/modules/useSchemaManager.js'

const store = useXmlStore()
const monacoEditor = ref(null)
const { t } = useI18n()
const { statusMessage, statusType, notify } = useNotify()
const isLoadingXml = ref(false)

async function handleLoadXml() {
  if (store.xmlContent.trim() && !confirm(t('coder.confirmDiscardChanges'))) {
    return
  }
  isLoadingXml.value = true
  try {
    const filesInfo = await window.electronAPI.openXmlFiles()
    if (!filesInfo || filesInfo.length === 0) return
    const content = await window.electronAPI.readFile(filesInfo[0].path)
    await store.setXmlContent(content)
    notify(t('coder.notifyXmlLoaded', { name: filesInfo[0].name }), 'success')
  } catch (error) {
    console.error('Errore caricamento XML nel Coder:', error)
    notify(t('coder.notifyXmlLoadError', { error: error.message }), 'error')
  } finally {
    isLoadingXml.value = false
  }
}

function handleApplyTag(tagFn) {
  monacoEditor.value?.wrapSelectionWithTag(tagFn)
}

function handleInsertPoeticXml(xml) {
  monacoEditor.value?.insertText(xml, poeticSelectionRange.value)
  poeticSelectionRange.value = null
}

const isUnicodeModalVisible = ref(false)
const isSchemaModalVisible = ref(false)
const isPoeticModalVisible = ref(false)
const receivedText = ref(null)

const poeticInitialText = ref('')
const poeticSelectionRange = ref(null)

function openPoeticModal() {
  const { text, range } = monacoEditor.value?.getSelectionInfo() ?? { text: '', range: null }
  poeticInitialText.value = text
  poeticSelectionRange.value = text ? range : null
  isPoeticModalVisible.value = true
}

const { availableSchemas, selectedSchema, loadNewSchema } = useSchemaManager()

async function handleSchemaLoad(schemaData) {
  try {
    await loadNewSchema(schemaData)
    isSchemaModalVisible.value = false
  } catch (error) {
    console.error('Failed to handle schema load:', error)
  }
}

const formatCode = () => monacoEditor.value?.formatCode()
const triggerSearch = () => monacoEditor.value?.handleSearch()
const triggerSearchAndReplace = () => monacoEditor.value?.handleSearchAndReplace()
const insertChar = (char) => monacoEditor.value?.insertText(char)
const validateSchema = () => store.validateSchema()
const toggleComment = () => monacoEditor.value?.handleCommentLine()
const foldAll = () => monacoEditor.value?.handleFoldAll()
const unfoldAll = () => monacoEditor.value?.handleUnfoldAll()
const undo = () => monacoEditor.value?.handleUndo()
const redo = () => monacoEditor.value?.handleRedo()
const goToLine = () => monacoEditor.value?.handleGoToLine()
const copyAll = () => monacoEditor.value?.handleCopyAll()

watch(receivedText, (newText) => {
  if (newText) {
    insertChar(newText)
  }
})

onMounted(() => {
  window.electronAPI.onReceiveTextFromOcr((text) => {
    receivedText.value = text
  })
})

onBeforeUnmount(() => {
  window.electronAPI.onReceiveTextFromOcr(null)
})
</script>

<template>
  <div class="coder">
    <div class="toolbar">
      <div class="toolbar-group">
        <select
          v-model="selectedSchema"
          class="schema-select"
          :title="$t('coder.selectSchemaTitle')"
        >
          <option v-for="schema in availableSchemas" :key="schema.name" :value="schema">
            {{ schema.name }}
          </option>
        </select>
        <button @click="isSchemaModalVisible = true" :title="$t('coder.loadSchemaTitle')">
          {{ $t('coder.loadSchema') }}
        </button>
        <button @click="handleLoadXml" :disabled="isLoadingXml" :title="$t('coder.loadXmlTitle')">
          {{ $t('coder.loadXml') }}
        </button>
        <button @click="validateSchema" :title="$t('coder.validateTitle')">
          {{ $t('coder.validate') }}
        </button>
        <button @click="formatCode" :title="$t('coder.formatTitle')">
          {{ $t('coder.format') }}
        </button>
      </div>

      <div class="toolbar-group">
        <button @click="undo" :title="$t('coder.undoTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6 0 1.57-.6 3-1.59 4.07l1.42 1.42A7.96 7.96 0 0 0 20 13c0-4.42-3.58-8-8-8z"
            />
          </svg>
        </button>

        <button @click="redo" :title="$t('coder.redoTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6 0 1.57.6 3 1.59 4.07l-1.42 1.42A7.96 7.96 0 0 1 4 13c0-4.42 3.58-8 8-8z"
            />
          </svg>
        </button>

        <button @click="toggleComment" :title="$t('coder.toggleCommentTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M9 22V19H5a2 2 0 0 1-2-2V5c0-1.11.89-2 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H13l-4 4z"
            />
          </svg>
        </button>

        <button @click="foldAll" :title="$t('coder.foldAllTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 15l6-6 6 6H6z" />
          </svg>
        </button>

        <button @click="unfoldAll" :title="$t('coder.unfoldAllTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 9l6-6 6 6H6zm0 6h12l-6 6-6-6z" />
          </svg>
        </button>
      </div>

      <div class="toolbar-group">
        <button @click="triggerSearch" :title="$t('coder.searchTitle')">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.57 4.23l5.42 5.42-1.42 1.42-5.42-5.42A6.48 6.48 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3z"
            />
          </svg>
        </button>
        <button @click="triggerSearchAndReplace" :title="$t('coder.searchAndReplaceTitle')">
          {{ $t('coder.searchAndReplace') }}
        </button>
      </div>

      <div class="toolbar-group">
        <TagMagicBox @apply-tag="handleApplyTag" />
        <button @click="openPoeticModal" :title="$t('coder.autotagPoeticTitle')">
          {{ $t('coder.autotag') }}
        </button>
        <button @click="isUnicodeModalVisible = true" :title="$t('coder.insertSpecialCharTitle')">
          Ω
        </button>
        <button @click="copyAll" :title="$t('coder.copyAllTitle')">{{ $t('coder.copy') }}</button>
        <button @click="goToLine" :title="$t('coder.goToLineTitle')">{{ $t('coder.line') }}</button>
      </div>
    </div>

    <div class="editor-wrapper">
      <MonacoXmlEditor ref="monacoEditor" theme="vs-dark" />
    </div>

    <UnicodeModal
      :show="isUnicodeModalVisible"
      @close="isUnicodeModalVisible = false"
      @select="insertChar"
    />
    <LoadSchemaModal
      :show="isSchemaModalVisible"
      @close="isSchemaModalVisible = false"
      @load="handleSchemaLoad"
    />
    <PoeticProcessor
      :show="isPoeticModalVisible"
      :initial-text="poeticInitialText"
      @close="isPoeticModalVisible = false"
      @insert-xml="handleInsertPoeticXml"
    />

    <StatusToast :message="statusMessage" :type="statusType" />
  </div>
</template>

<style scoped>
body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}
.coder {
  position: relative;
  padding: 1rem;
  background: #1e1e1e;
  color: #fff;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100vh;
  width: 100vw;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: #252526;
  padding: 8px;
  border-radius: 6px;
}

.toolbar-group {
  display: flex;
  gap: 0.3rem;
  padding-right: 0.8rem;
  border-right: 1px solid #444;
}
.toolbar-group:last-child {
  border-right: none;
}

.schema-select {
  background: #2d2d2d;
  color: white;
  border: 1px solid #444;
  padding: 8px 12px;
  border-radius: 4px;
  min-width: 150px;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  border: 1px solid #444;
}

button {
  background: #3a3d41;
  border: none;
  color: white;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s;
}
button:hover {
  background: #55595e;
}

svg {
  display: block;
}
</style>
