<script setup>
import { ref, computed, watch } from 'vue'
import { Utils } from '@renderer/shared/tei/utils.js'
import { EnglishSonnet } from '@renderer/shared/tei/english_sonnet.js'
import { ItalianSonnet } from '@renderer/shared/tei/italian_sonnet.js'
import { DivinaCommedia } from '@renderer/shared/tei/divina_commedia.js'
import { TerzaRima } from '@renderer/shared/tei/terza_rima.js'
import { Sestina } from '@renderer/shared/tei/sestina.js'
import { Ottava } from '@renderer/shared/tei/ottava.js'
import { ProseChapter } from '@renderer/shared/tei/prose_chapter.js'
import { RimaSciolta } from '@renderer/shared/tei/rima_sciolta.js'
import { Pagina } from '@renderer/shared/tei/pagina.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  initialText: { type: String, default: '' }
})
const emit = defineEmits(['close', 'insert-xml'])

const MODULES = {
  english_sonnet: EnglishSonnet,
  italian_sonnet: ItalianSonnet,
  divina_commedia: DivinaCommedia,
  terza_rima: TerzaRima,
  sestina: Sestina,
  ottava: Ottava,
  prose_chapter: ProseChapter,
  rima_sciolta: RimaSciolta,
  pagina: Pagina
}

const PROCESS_TYPES = [
  { key: 'italian_sonnet', label: 'Sonetto Italiano' },
  { key: 'english_sonnet', label: 'Sonetto Inglese' },
  { key: 'divina_commedia', label: 'Divina Commedia' },
  { key: 'terza_rima', label: 'Terza Rima' },
  { key: 'sestina', label: 'Sestina' },
  { key: 'ottava', label: 'Ottava Rima' },
  { key: 'prose_chapter', label: 'Capitolo in Prosa' },
  { key: 'rima_sciolta', label: 'Rima Sciolta' },
  { key: 'pagina', label: 'Pagina' }
]

const inputText = ref('')
const selectedModule = ref('')
const optionValues = ref({})
const result = ref('')
const errorMsg = ref('')

const currentModule = computed(() => (selectedModule.value ? MODULES[selectedModule.value] : null))

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      inputText.value = props.initialText || ''
    }
  }
)

watch(selectedModule, (key) => {
  if (!key || !MODULES[key]) return
  const defaults = {}
  MODULES[key].options.fields.forEach((f) => {
    defaults[f.name] = f.default
  })
  optionValues.value = defaults
})

function handleClean() {
  let cleaned = Utils.removeMultipleSpaces(inputText.value)
  cleaned = Utils.removeEmptyLines(cleaned)
  inputText.value = cleaned
}

async function handlePaste() {
  try {
    inputText.value = await navigator.clipboard.readText()
  } catch {}
}

function handleProcess() {
  errorMsg.value = ''
  if (!selectedModule.value || !currentModule.value) {
    errorMsg.value = 'Seleziona una forma metrica'
    return
  }
  if (!inputText.value.trim()) {
    errorMsg.value = 'Inserisci del testo da elaborare'
    return
  }
  try {
    result.value = currentModule.value.process(inputText.value, optionValues.value)
  } catch (e) {
    console.error(e)
    errorMsg.value = `Errore elaborazione: ${e.message}`
  }
}

function handleInsert() {
  if (!result.value) return
  emit('insert-xml', result.value)
  handleClose()
}

function handleClose() {
  inputText.value = ''
  selectedModule.value = ''
  optionValues.value = {}
  result.value = ''
  errorMsg.value = ''
  emit('close')
}
</script>

<template>
  <transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="handleClose">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ $t('poeticProcessor.title') }}</h3>
          <button class="btn-close" @click="handleClose">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">{{ $t('poeticProcessor.metricFormLabel') }}</label>
            <select v-model="selectedModule" class="form-select">
              <option value="" disabled>{{ $t('poeticProcessor.selectPlaceholder') }}</option>
              <option v-for="pt in PROCESS_TYPES" :key="pt.key" :value="pt.key">
                {{ pt.label }}
              </option>
            </select>
          </div>

          <p v-if="currentModule" class="module-desc text-secondary text-xs">
            {{ currentModule.options.description }}
          </p>

          <div v-if="currentModule" class="options-grid">
            <div v-for="field in currentModule.options.fields" :key="field.name" class="form-group">
              <label class="form-label">{{ field.label }}</label>

              <input
                v-if="field.type === 'text'"
                v-model="optionValues[field.name]"
                type="text"
                class="form-input"
              />

              <label v-else-if="field.type === 'checkbox'" class="checkbox-row">
                <input v-model="optionValues[field.name]" type="checkbox" />
                <span>{{ $t('poeticProcessor.activeCheckbox') }}</span>
              </label>

              <select
                v-else-if="field.type === 'dropdown'"
                v-model="optionValues[field.name]"
                class="form-select"
              >
                <option v-for="v in field.values" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <div class="input-header">
              <label class="form-label">{{ $t('poeticProcessor.textLabel') }}</label>
              <div class="input-actions">
                <button class="btn btn-sm btn-outline" @click="handleClean">
                  {{ $t('poeticProcessor.cleanButton') }}
                </button>
                <button class="btn btn-sm btn-outline" @click="handlePaste">
                  {{ $t('poeticProcessor.pasteButton') }}
                </button>
              </div>
            </div>
            <textarea
              v-model="inputText"
              class="form-textarea"
              :placeholder="$t('poeticProcessor.textPlaceholder')"
              rows="8"
            ></textarea>
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

          <div v-if="result" class="result-section">
            <label class="form-label">{{ $t('poeticProcessor.resultLabel') }}</label>
            <pre class="result-pre">{{ result }}</pre>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="handleClose">
            {{ $t('poeticProcessor.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="!selectedModule || !inputText.trim()"
            @click="handleProcess"
          >
            {{ $t('poeticProcessor.process') }}
          </button>
          <button class="btn btn-success" :disabled="!result" @click="handleInsert">
            {{ $t('poeticProcessor.insert') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #3c3c3c;
}
.modal-header h3 {
  margin: 0;
  font-size: 1rem;
}
.btn-close {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem 0.4rem;
}
.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 0.75rem;
}
.form-label {
  display: block;
  font-size: 0.8rem;
  margin-bottom: 0.3rem;
  color: #ccc;
}
.form-input,
.form-select,
.form-textarea {
  width: 100%;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.85rem;
}
.form-textarea {
  resize: vertical;
  font-family: 'Consolas', monospace;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  background: #1e1e1e;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}
.input-actions {
  display: flex;
  gap: 0.3rem;
}

.module-desc {
  margin: 0.25rem 0 0.75rem 0;
}
.text-secondary {
  color: #999;
}
.text-xs {
  font-size: 0.75rem;
}

.error-msg {
  color: #f8a5a5;
  font-size: 0.8rem;
  margin: 0.5rem 0;
}

.result-section {
  margin-top: 0.75rem;
}
.result-pre {
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 0.75rem;
  max-height: 200px;
  overflow: auto;
  font-size: 0.75rem;
  font-family: 'Consolas', monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #3c3c3c;
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
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
