/**
 * Esegue l'escaping dei caratteri speciali HTML in una stringa per visualizzarla in modo sicuro.
 * @param {string} unsafe - La stringa da escapare.
 * @returns {string} La stringa con i caratteri HTML escapati.
 */
export function escapeHtml(unsafe) {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Formatta una chiave di oggetto (es. da camelCase o snake_case) in un formato leggibile.
 * @param {string} key - La chiave da formattare.
 * @returns {string} La chiave formattata e leggibile.
 */
export function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/Id$/, 'ID')
    .replace(/Msname/, 'Ms Name')
    .replace(/Orgname/, 'Org Name')
    .replace(/Pubplace/, 'Publication Place')
}

/**
 * Verifica se un elemento del DOM è visibile.
 * Un elemento è considerato visibile se non ha `display: none` o `visibility: hidden`.
 * @param {HTMLElement} element - L'elemento da controllare.
 * @returns {boolean} - True se l'elemento è visibile, altrimenti False.
 */
export function isElementVisible(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  let current = element.parentElement
  while (current) {
    const parentStyle = window.getComputedStyle(current)
    if (
      parentStyle.display === 'none' ||
      parentStyle.visibility === 'hidden' ||
      parentStyle.opacity === '0'
    ) {
      return false
    }
    current = current.parentElement
  }

  return true
}

/**
 * Funzione di utilità per caricare un documento XML da un URL.
 * @param {string} url - L'URL del file XML da caricare.
 * @returns {Promise<Document>} - Una Promise che risolve con un oggetto Document XML.
 */
export async function loadXml(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`)
    }
    const text = await response.text()
    const parser = new DOMParser()
    return parser.parseFromString(text, 'text/xml')
  } catch (error) {
    console.error('Errore durante il caricamento del file XML:', error)
    return null
  }
}

/**
 * Funzione per generare un slug pulito da una stringa.
 * @param {string} text - La stringa da convertire in slug.
 * @returns {string} - Lo slug generato.
 */
export function generateSlug(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

/**
 * Escape dei caratteri speciali per regex
 * @param {string} string - Stringa da processare
 * @returns {string} - Stringa con caratteri speciali escaped
 */
export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
