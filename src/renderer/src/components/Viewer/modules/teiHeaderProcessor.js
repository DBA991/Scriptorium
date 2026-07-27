/**
 * Modulo per processare e preparare il contenuto del TEI Header per la visualizzazione
 */
import { processTeiAnnotations } from './teiProcessor'
/**
 * Estrae e processa il contenuto del TEI Header dall'HTML
 * @param {HTMLElement} contentArea - L'area contenuto del viewer
 * @returns {string} - HTML processato del TEI Header
 */
export function extractAndProcessTeiHeader(contentArea) {
  const teiHeaderElement = contentArea.querySelector("[data-tag='teiheader']")

  if (!teiHeaderElement) {
    return ''
  }

  const headerClone = teiHeaderElement.cloneNode(true)

  headerClone.setAttribute('data-tag', 'teiheader-cloned')
  headerClone.classList.remove('tei-teiheader')
  headerClone.classList.add('tei-teiheader-cloned')

  removeLists(headerClone)
  processTeiAnnotations(headerClone)
  processHeaderElements(headerClone)

  return headerClone.outerHTML
}

/**
 * Verifica se il TEI Header è presente nel contenuto
 * @param {HTMLElement} contentArea - L'area contenuto del viewer
 * @returns {boolean}
 */
export function hasTeiHeader(contentArea) {
  return !!contentArea.querySelector("[data-tag='teiheader']")
}

/**
 * Rimuove gli elementi delle liste dal TEI Header
 * @param {HTMLElement} headerElement - L'elemento header da processare
 */
function removeLists(headerElement) {
  const listSelectors = [
    '[data-tag="listperson"]',
    '[data-tag="listplace"]',
    '[data-tag="listorg"]',
    '[data-tag="listbibl"]',
    '[data-tag="listevent"]',
    '[data-tag="list"]',
    '[data-tag="taxonomy"]',
    '[data-tag="classdecl"]',
    '[data-tag="keywords"]'
  ]

  listSelectors.forEach((selector) => {
    const elements = headerElement.querySelectorAll(selector)
    elements.forEach((el) => el.remove())
  })
}

/**
 * Processa gli elementi del header per migliorare la visualizzazione
 * @param {HTMLElement} headerElement - L'elemento header da processare
 */
function processHeaderElements(headerElement) {
  headerElement.classList.add('tei-header-display')

  processBlockElements(headerElement)
  processInlineElements(headerElement)
}

/**
 * Processa elementi a blocco per una migliore visualizzazione
 * @param {HTMLElement} headerElement - L'elemento header
 */
function processBlockElements(headerElement) {
  const blockElements = [
    'filedesc',
    'titlestmt',
    'publicationstmt',
    'sourcedesc',
    'profiledesc',
    'revisiondesc',
    'encodingdesc',
    'seriesstmt',
    'notesstmt',
    'respstmt',
    'biblstruct',
    'monogr',
    'imprint'
  ]

  blockElements.forEach((tagName) => {
    const elements = headerElement.querySelectorAll(`[data-tag="${tagName}"]`)
    elements.forEach((el) => {
      el.classList.add('tei-header-block')

      if (!el.querySelector('.tei-header-label')) {
        const label = createLabel(tagName)
        if (label) {
          el.insertAdjacentHTML('afterbegin', `<div class="tei-header-label">${label}</div>`)
        }
      }
    })
  })
}

/**
 * Processa elementi inline per una migliore visualizzazione
 * @param {HTMLElement} headerElement - L'elemento header
 */
function processInlineElements(headerElement) {
  const inlineElements = [
    'title',
    'author',
    'editor',
    'publisher',
    'date',
    'pubplace',
    'licence',
    'resp',
    'name',
    'persname',
    'orgname',
    'placename'
  ]

  inlineElements.forEach((tagName) => {
    const elements = headerElement.querySelectorAll(`[data-tag="${tagName}"]`)
    elements.forEach((el) => {
      el.classList.add('tei-header-inline')
      el.classList.add(`tei-header-${tagName}`)
    })
  })
}

/**
 * Crea un'etichetta leggibile per un elemento TEI
 * @param {string} tagName - Nome del tag TEI
 * @returns {string} - Etichetta leggibile
 */
function createLabel(tagName) {
  const labels = {
    filedesc: 'Descrizione del File',
    titlestmt: 'Informazioni sul Titolo',
    publicationstmt: 'Informazioni sulla Pubblicazione',
    sourcedesc: 'Descrizione della Fonte',
    profiledesc: 'Profilo del Documento',
    revisiondesc: 'Storia delle Revisioni',
    encodingdesc: 'Descrizione della Codifica',
    seriesstmt: 'Informazioni sulla Serie',
    notesstmt: 'Note',
    respstmt: 'Responsabilità',
    biblstruct: 'Struttura Bibliografica',
    monogr: 'Monografia',
    imprint: 'Informazioni Editoriali'
  }

  return labels[tagName] || ''
}

/**
 * Estrae metadati di base dal TEI Header per anteprima
 * @param {HTMLElement} contentArea - L'area contenuto del viewer
 * @returns {Object} - Oggetto con metadati di base
 */
export function extractBasicMetadata(contentArea) {
  const teiHeaderElement = contentArea.querySelector('[data-tag="teiheader"]')

  if (!teiHeaderElement) {
    return {}
  }

  const metadata = {}

  const titleEl = teiHeaderElement.querySelector('[data-tag="title"]')
  if (titleEl) {
    metadata.title = titleEl.textContent.trim()
  }

  const authorEl = teiHeaderElement.querySelector('[data-tag="author"], [data-tag="persname"]')
  if (authorEl) {
    metadata.author = authorEl.textContent.trim()
  }

  const dateEl = teiHeaderElement.querySelector('[data-tag="date"]')
  if (dateEl) {
    metadata.date = dateEl.dataset.when || dateEl.textContent.trim()
  }

  const publisherEl = teiHeaderElement.querySelector('[data-tag="publisher"]')
  if (publisherEl) {
    metadata.publisher = publisherEl.textContent.trim()
  }

  return metadata
}
