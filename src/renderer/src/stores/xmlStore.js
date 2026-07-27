import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createSaxWellFormedParser } from '../shared/editor/modules/saxWellFormedParser'
import { createDomSchemaValidator } from '../shared/editor/modules/domSchemaValidator'

export const useXmlStore = defineStore('xml', () => {
  const xmlContent = ref('')
  const wellFormedErrors = ref([])
  const schemaErrors = ref([])
  const isProcessing = ref(false)
  const lastValidationTime = ref(0)
  const currentSchema = ref(null)

  let debounceTimer = null

  /** Controlla se ci sono errori di buona formazione. */
  const hasWellFormedErrors = computed(() => wellFormedErrors.value.length > 0)

  /** Controlla se ci sono errori di validazione dello schema. */
  const hasSchemaErrors = computed(() => schemaErrors.value.length > 0)

  /** Controlla se c'è un qualsiasi tipo di errore. */
  const hasAnyError = computed(() => hasWellFormedErrors.value || hasSchemaErrors.value)

  /**
   * Imposta il contenuto XML, lo salva e avvia la validazione con debounce.
   * @param {string} content - Il nuovo contenuto XML.
   */
  async function setXmlContent(content) {
    if (xmlContent.value === content) return
    xmlContent.value = content
    await save()

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => validateWellFormed(), 500)
  }

  /**
   * Gestisce un aggiornamento del contenuto XML da una fonte esterna, validando senza debounce.
   * @param {string} content - Il nuovo contenuto XML.
   */
  function handleExternalUpdate(content) {
    if (xmlContent.value === content) return
    xmlContent.value = content
    validateWellFormed()
  }

  /**
   * Imposta lo schema di validazione corrente e resetta gli errori precedenti.
   * @param {object} schema - Il nuovo schema da utilizzare per la validazione.
   */
  function setCurrentSchema(schema) {
    currentSchema.value = schema
    schemaErrors.value = []
  }

  /**
   * Valida la buona formazione del documento XML.
   */
  async function validateWellFormed() {
    if (isProcessing.value) return
    if (xmlContent.value.trim() === '') {
      wellFormedErrors.value = []
      return
    }

    isProcessing.value = true
    try {
      const parser = createSaxWellFormedParser()
      wellFormedErrors.value = await parser.validate(xmlContent.value)
    } catch (error) {
      console.error('SAX validation error:', error)
      wellFormedErrors.value = [{ message: error.message, line: 1, column: 1 }]
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Valida il documento XML rispetto allo schema corrente.
   */
  async function validateSchema() {
    if (!currentSchema.value) {
      throw new Error('No schema selected')
    }
    if (xmlContent.value.trim() === '') {
      schemaErrors.value = []
      return
    }

    isProcessing.value = true
    schemaErrors.value = []

    try {
      const validator = createDomSchemaValidator(currentSchema.value)
      schemaErrors.value = await validator.validate(xmlContent.value)
    } catch (error) {
      console.error('Schema validation error:', error)
      schemaErrors.value = [{ message: error.message, line: 1, column: 1 }]
    } finally {
      isProcessing.value = false
      lastValidationTime.value = Date.now()
    }
  }

  /**
   * Salva il contenuto XML corrente nello store di Electron.
   */
  async function save() {
    await window.electronAPI.storeSet('xmlContent', xmlContent.value)
  }

  /**
   * Pulisce completamente lo store, sia localmente che su Electron.
   */
  async function clearAll() {
    await window.electronAPI.storeClear('xmlContent')
    xmlContent.value = ''
    wellFormedErrors.value = []
    schemaErrors.value = []
  }

  /**
   * Inizializza lo store caricando i dati salvati e avviando la prima validazione.
   * Registra anche i listener per gli aggiornamenti cross-finestra: quando
   * un'altra finestra (es. HeaderBuilder) modifica xmlContent nello store
   * Electron, il main emette 'xmlContent:updated' e 'store:updated' a tutte
   * le altre finestre. Qui intercettiamo l'evento e aggiorniamo xmlContent
   * locale senza debounce, così l'editor (che fa watch su xmlContent)
   * si aggiorna immediatamente.
   */
  async function init() {
    const saved = await window.electronAPI.storeGet('xmlContent')
    if (saved != null) {
      xmlContent.value = saved
      await validateWellFormed()
    }

    window.electronAPI.onXmlUpdated((content) => {
      if (content !== xmlContent.value) {
        handleExternalUpdate(content)
      }
    })

    window.electronAPI.onStoreUpdated((key, value) => {
      if (key === 'xmlContent' && value !== xmlContent.value) {
        handleExternalUpdate(value)
      }
    })

    window.electronAPI.onStoreReinitialized((key, value) => {
      if (key === 'xmlContent' && value !== xmlContent.value) {
        handleExternalUpdate(value)
      }
    })
  }

  return {
    xmlContent,
    wellFormedErrors,
    schemaErrors,
    isProcessing,
    lastValidationTime,
    currentSchema,

    hasWellFormedErrors,
    hasSchemaErrors,
    hasAnyError,

    init,
    save,
    clearAll,
    setXmlContent,
    handleExternalUpdate,
    setCurrentSchema,
    validateWellFormed,
    validateSchema
  }
})
