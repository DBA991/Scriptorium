<script setup>
import 'monaco-editor/esm/vs/editor/editor.main.js'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import xmlFormatter from 'xml-formatter'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'xml' },
  theme: { type: String, default: 'vs-dark' },
  readOnly: { type: Boolean, default: false },
  formatOnMount: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

self.MonacoEnvironment = self.MonacoEnvironment || {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    if (['css', 'scss', 'less'].includes(label)) return new cssWorker()
    if (['html', 'handlebars', 'razor', 'xml'].includes(label)) return new htmlWorker()
    return new editorWorker()
  }
}

const container = ref(null)
let editor = null
let changeDisposable = null

function safeFormat(value) {
  try {
    return xmlFormatter(value, { indentation: '  ', collapseContent: true })
  } catch {
    return value
  }
}

onMounted(() => {
  let initial = props.modelValue || ''
  if (props.formatOnMount && props.language === 'xml' && initial.trim()) {
    initial = safeFormat(initial)
    emit('update:modelValue', initial)
  }

  editor = monaco.editor.create(container.value, {
    value: initial,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
    autoClosingQuotes: 'always',
    autoClosingBrackets: 'always',
    autoClosingTags: 'always',
    tabCompletion: 'on',
    autoIndent: 'advanced'
  })

  changeDisposable = editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue())
  })
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (!editor) return
    const current = editor.getValue()
    if (newValue !== current) {
      editor.setValue(newValue ?? '')
    }
  }
)

watch(
  () => props.readOnly,
  (ro) => editor?.updateOptions({ readOnly: ro })
)

onBeforeUnmount(() => {
  changeDisposable?.dispose()
  editor?.dispose()
})

function format() {
  if (!editor) return
  if (props.language === 'xml') {
    const formatted = safeFormat(editor.getValue())
    editor.setValue(formatted)
  } else {
    editor.getAction('editor.action.formatDocument')?.run()
  }
}

function getEditor() {
  return editor
}

defineExpose({ format, getEditor })
</script>

<template>
  <div ref="container" class="monaco-generic"></div>
</template>

<style scoped>
.monaco-generic {
  height: 100%;
  width: 100%;
  position: relative;
  min-height: 200px;
}
</style>
