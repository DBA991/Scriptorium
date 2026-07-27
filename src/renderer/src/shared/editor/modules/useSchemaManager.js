import { ref, watch, onMounted } from 'vue'
import { useXmlStore } from '../../../stores/xmlStore'
import { availableSchemas as initialSchemas } from './teiSchemaIndex.js'
import { readFile, parseXsdSchema } from './xsdParser.js'

/**
 * Hook composable per gestire la logica degli schemi XSD.
 * @returns {object} - Oggetti reattivi e funzioni per la gestione degli schemi.
 */
export function useSchemaManager() {
  const store = useXmlStore()

  const availableSchemas = ref([...initialSchemas])
  const selectedSchema = ref(availableSchemas.value[0])

  /**
   * Sincronizza lo schema selezionato con lo store all'avvio del componente.
   */
  onMounted(() => {
    if (store.currentSchema) {
      const stored = availableSchemas.value.find((s) => s.name === store.currentSchema.name)
      if (stored) {
        selectedSchema.value = stored
      }
    } else {
      store.setCurrentSchema(selectedSchema.value.schema)
    }
  })

  /**
   * Osserva i cambiamenti dello schema selezionato e aggiorna lo store.
   */
  watch(selectedSchema, (newSchemaChoice) => {
    if (newSchemaChoice) {
      store.setCurrentSchema(newSchemaChoice.schema)
    }
  })

  /**
   * Carica un nuovo schema da un file o URL, lo parsa e lo aggiunge alla lista.
   * @param {object} newSchemaData - { name, file?, url? }
   */
  async function loadNewSchema({ name, file, url }) {
    if (!name) {
      throw new Error('Schema name is required.')
    }

    let schemaContent = ''
    if (file) {
      schemaContent = await readFile(file)
    } else if (url) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch schema from URL: ${response.statusText}`)
      schemaContent = await response.text()
    } else {
      throw new Error('No schema source provided (file or URL).')
    }

    const parsedSchema = parseXsdSchema(schemaContent)
    const newSchema = { name, schema: parsedSchema }

    availableSchemas.value.push(newSchema)
    selectedSchema.value = newSchema
  }

  return {
    availableSchemas,
    selectedSchema,
    loadNewSchema
  }
}
