<script setup>
import 'monaco-editor/esm/vs/editor/editor.main.js'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'

import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useXmlStore } from '../../stores/xmlStore'
import { registerXsdCompletion } from './modules/xsdCompletion'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js'
import xmlFormatter from 'xml-formatter'

const props = defineProps({
  theme: { type: String, default: 'vs-dark' }
})
const emit = defineEmits(['update:modelValue'])

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    if (['css', 'scss', 'less'].includes(label)) return new cssWorker()
    if (['html', 'handlebars', 'razor', 'xml'].includes(label)) return new htmlWorker()
    return new editorWorker()
  }
}

const editorContainer = ref(null)
let editorInstance = null
let completionProvider = null
let errorWatcherDispose = null

const store = useXmlStore()

const BOILERPLATE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="xsd/tei_all.xsd" type="application/xml"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>Titolo del documento</title>
        <author>Autore</author>
      </titleStmt>
      <publicationStmt>
        <publisher>Nome editore</publisher>
        <pubPlace>Luogo pubblicazione</pubPlace>
        <date>2025</date>
        <availability>
          <p>Licenza e diritti</p>
        </availability>
      </publicationStmt>
      <sourceDesc>
        <bibl>
          <author>Autore originale</author>
          <title>Titolo originale</title>
          <date>Anno originale</date>
        </bibl>
        <listPerson>
          <person xml:id="TIT">
              <persName xml:lang="it">Tizio </persName>
              <persName xml:lang="la">Titius </persName>
            </person>
            <person xml:id="CAI">
              <persName xml:lang="it">Caio </persName>
              <persName xml:lang="la">Caius </persName>
            </person>
        </listPerson>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
      <pb n="1"/>
      <p>Testo della prima pagina...</p>

      <pb n="2"/>
      <p>Testo della seconda pagina...</p>

      <pb n="3"/>
      <p>Testo della terza pagina...</p>
    </body>
  </text>
</TEI>`

/**
 * Returns the XML content for the editor, using boilerplate if the provided XML is empty.
 * @param {string} xml - The XML content from the store.
 * @returns {string} The content to display in the editor.
 */
const getEditorContent = (xml) => (xml.trim() === '' ? BOILERPLATE_XML : xml)

onMounted(async () => {
  await store.init()

  editorInstance = monaco.editor.create(editorContainer.value, {
    value: getEditorContent(store.xmlContent),
    language: 'xml',
    theme: props.theme,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
    autoClosingQuotes: 'always',
    autoClosingBrackets: 'always',
    autoClosingTags: 'always',
    suggestOnTriggerCharacters: true,
    tabCompletion: 'on',
    suggest: { showKeywords: true, showSnippets: true },
    autoIndent: 'advanced'
  })

  monaco.languages.registerDocumentFormattingEditProvider('xml', {
    provideDocumentFormattingEdits: (model) => {
      const original = model.getValue()
      const formatted = xmlFormatter(original, {
        indentation: '  ',
        collapseContent: true
      })
      return [
        {
          range: model.getFullModelRange(),
          text: formatted
        }
      ]
    }
  })

  if (store.currentSchema) {
    completionProvider = registerXsdCompletion(monaco, editorInstance, store.currentSchema, 'xml')
  }

  editorInstance.onDidChangeModelContent(() => {
    const editorValue = editorInstance.getValue()
    if (editorValue !== store.xmlContent) {
      emit('update:modelValue', editorValue)
      store.setXmlContent(editorValue)
    }
  })

  errorWatcherDispose = watch(
    [() => store.wellFormedErrors, () => store.schemaErrors],
    ([saxErrors, schemaErrors]) => {
      const model = editorInstance.getModel()
      if (!model) return

      const markers = [
        ...saxErrors.map((err) => ({
          severity: monaco.MarkerSeverity.Error,
          message: `Well-formed error: ${err.message}`,
          startLineNumber: err.line || 1,
          startColumn: err.column || 1,
          endLineNumber: err.line || 1,
          endColumn: (err.column || 1) + 1
        })),
        ...schemaErrors.map((err) => ({
          severity: monaco.MarkerSeverity.Warning,
          message: `Schema error: ${err.message}`,
          startLineNumber: err.startLineNumber || 1,
          startColumn: err.startColumn || 1,
          endLineNumber: err.endLineNumber || 1,
          endColumn: err.endColumn || 1
        }))
      ]
      monaco.editor.setModelMarkers(model, 'xml', markers)
    },
    { deep: true, immediate: true }
  )
})

watch(
  () => store.xmlContent,
  (newXmlContent) => {
    if (!editorInstance) return
    const currentEditorValue = editorInstance.getModel().getValue()
    const desiredEditorValue = getEditorContent(newXmlContent)
    if (currentEditorValue !== desiredEditorValue) {
      editorInstance.setValue(desiredEditorValue)
    }
  },
  { immediate: false }
)

watch(
  () => store.currentSchema,
  (newSchema) => {
    completionProvider?.dispose()
    if (newSchema && editorInstance) {
      completionProvider = registerXsdCompletion(monaco, editorInstance, newSchema, 'xml')
    }
  },
  { deep: false }
)

onBeforeUnmount(() => {
  errorWatcherDispose?.()
  completionProvider?.dispose()
  editorInstance?.dispose()
})
/**
 * Formats the code in the editor.
 */
function formatCode() {
  editorInstance?.getAction('editor.action.formatDocument').run()
}

/**
 * Opens the search dialog in the editor.
 */
function handleSearch() {
  editorInstance?.getAction('actions.find').run()
}

/**
 * Opens the search and replace dialog in the editor.
 */
function handleSearchAndReplace() {
  editorInstance?.getAction('editor.action.startFindReplaceAction').run()
}

function handleCommentLine() {
  editorInstance?.getAction('editor.action.commentLine')?.run()
}

function handleFoldAll() {
  editorInstance?.getAction('editor.foldAll')?.run()
}

function handleUnfoldAll() {
  editorInstance?.getAction('editor.unfoldAll')?.run()
}

function _tryGetActionRun(ids = []) {
  for (const id of ids) {
    const act = editorInstance?.getAction?.(id)
    if (act) {
      act.run()
      return true
    }
  }
  return false
}

function _tryTrigger(ids = []) {
  for (const id of ids) {
    editorInstance?.trigger?.('toolbar', id)
    return true
  }
  return false
}

function handleUndo() {
  if (_tryGetActionRun(['undo', 'editor.action.undo', 'editor.undo'])) return true
  if (_tryTrigger(['undo', 'editor.action.undo'])) return true

  const model = editorInstance?.getModel?.()
  if (model && typeof model.undo === 'function') {
    model.undo()
    return true
  }

  return false
}

function handleRedo() {
  if (_tryGetActionRun(['redo', 'editor.action.redo', 'editor.redo'])) return true
  if (_tryTrigger(['redo', 'editor.action.redo'])) return true

  const model = editorInstance?.getModel?.()
  if (model && typeof model.redo === 'function') {
    model.redo()
    return true
  }

  return false
}

function handleGoToLine() {
  editorInstance?.focus?.()

  if (_tryGetActionRun(['editor.action.gotoLine'])) return true

  if (_tryTrigger(['editor.action.gotoLine'])) return true

  console.warn('handleGoToLine: action not available')
  return false
}

async function handleCopyAll() {
  const text = editorInstance?.getValue?.()
  if (!text) return false

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {}
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    return true
  } catch (e) {
    console.error('handleCopyAll failed:', e)
    return false
  }
}

/**
 * Inserts text at the current cursor position or replaces the current selection.
 * If a specific range is provided, that range is replaced instead of the live
 * selection (utile quando la selezione è stata "catturata" prima dell'apertura
 * di una modale, es. autotag poetico nel Coder).
 * @param {string} text - The text to insert.
 * @param {import('monaco-editor').Range} [range] - Range esplicito da sostituire.
 */
function insertText(text, range = null) {
  if (!editorInstance) return
  const targetRange = range || editorInstance.getSelection()
  const edit = {
    range: targetRange,
    text: text,
    forceMoveMarkers: true
  }
  editorInstance.executeEdits('inserter', [edit])
}

/**
 * Restituisce il testo attualmente selezionato e il relativo Range Monaco.
 * Usato per "catturare" la selezione prima di aprire una modale (es. autotag),
 * così da poterla sostituire con precisione anche se la selezione live cambia
 * nel frattempo (es. l'editor perde il focus).
 * @returns {{ text: string, range: import('monaco-editor').Range | null }}
 */
function getSelectionInfo() {
  if (!editorInstance) return { text: '', range: null }
  const selection = editorInstance.getSelection()
  const model = editorInstance.getModel()
  return {
    text: model ? model.getValueInRange(selection) : '',
    range: selection
  }
}

/**
 * Wraps the current selection with a tag produced by a tagger function.
 * If nothing is selected, inserts the empty tag at the cursor (with the
 * cursor placed inside the tag).
 * @param {(text: string) => string} tagFn - Tagger from shared/tei/tags.js
 */
function wrapSelectionWithTag(tagFn) {
  if (!editorInstance) return
  const selection = editorInstance.getSelection()
  const model = editorInstance.getModel()
  if (!model) return

  const selectedText = model.getValueInRange(selection)

  if (selectedText) {
    const wrapped = tagFn(selectedText)
    editorInstance.executeEdits('tei-tagger', [
      { range: selection, text: wrapped, forceMoveMarkers: true }
    ])
  } else {
    const emptyTag = tagFn('')
    const openEnd = emptyTag.indexOf('>') + 1
    const insertText = emptyTag.slice(0, openEnd) + emptyTag.slice(openEnd)

    editorInstance.executeEdits('tei-tagger', [
      {
        range: selection,
        text: insertText,
        forceMoveMarkers: false
      }
    ])

    const newSelection = selection
      .setEndPosition(selection.endLineNumber, selection.endColumn + openEnd)
      .setStartPosition(selection.endLineNumber, selection.endColumn + openEnd)
    editorInstance.setSelection(newSelection)
  }
  editorInstance.focus()
}

defineExpose({
  formatCode,
  handleSearch,
  handleSearchAndReplace,
  insertText,
  getSelectionInfo,
  wrapSelectionWithTag,
  handleUndo,
  handleRedo,
  handleCommentLine,
  handleFoldAll,
  handleUnfoldAll,
  handleGoToLine,
  handleCopyAll
})
</script>

<template>
  <div ref="editorContainer" style="height: 100%; width: 100%; position: relative"></div>
</template>

<style scoped>
[ref='editorContainer'] {
  height: 100%;
  width: 100%;
  min-height: 300px;
  position: relative;
}
</style>
