/**
 * Modulo per la gestione delle note utente.
 * Fornisce funzioni per avvolgere la selezione del testo in una nota
 * e per eliminare una nota esistente.
 */
import { escapeHtml } from './utils.js'

/**
 * Avvolge il testo selezionato o aggiorna una nota utente esistente.
 * @param {HTMLElement} contentArea - L'elemento DOM contenente il testo.
 * @param {string} noteType - Il tipo di nota.
 * @param {string} noteValue - Il contenuto della nota.
 * @param {HTMLElement | null} editingSpan - L'elemento span esistente se si sta modificando una nota.
 * @returns {{newHtml: string, editingSpan: HTMLElement | null} | null} Oggetto con i risultati o null.
 */
export function wrapSelectionWithNote(contentArea, noteType, noteValue, editingSpan) {
  const type = noteType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  const value = noteValue.trim()

  if (!type || !value) {
    return null
  }

  const sanitizedValue = escapeHtml(value)

  if (editingSpan) {
    const span = editingSpan
    const currentDataAttrs = Array.from(span.attributes).filter(
      (attr) => attr.name.startsWith('data-') && attr.name !== 'data-note-id'
    )
    currentDataAttrs.forEach((attr) => span.removeAttribute(attr.name))
    span.setAttribute(`data-${type}`, sanitizedValue)

    const symbol = span.querySelector('.note-symbol')
    if (symbol) {
      symbol.title = `Tipo: ${type} - Contenuto: ${sanitizedValue}`
    }

    return {
      newHtml: contentArea.innerHTML,
      editingSpan: editingSpan
    }
  } else {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return null
    const range = selection.getRangeAt(0)
    const fragment = range.extractContents()

    const span = document.createElement('span')
    span.className = 'note-wrapper'
    span.setAttribute(`data-${type}`, sanitizedValue)
    span.dataset.noteId = `user-note-${Date.now()}`

    const symbol = document.createElement('sup')
    symbol.className = 'note-symbol'
    symbol.textContent = '⁕'
    symbol.title = `Tipo: ${type} - Contenuto: ${sanitizedValue}`

    span.appendChild(fragment)
    span.appendChild(symbol)

    range.insertNode(span)
    selection.removeAllRanges()

    return {
      newHtml: contentArea.innerHTML,
      editingSpan: span
    }
  }
}

/**
 * Elimina una nota utente esistente.
 * @param {HTMLElement} contentArea - L'elemento DOM contenente la nota.
 * @param {HTMLElement} editingSpan - L'elemento span della nota da eliminare.
 * @returns {{newHtml: string} | null} L'innerHTML aggiornato di contentArea o null se l'elemento non è valido.
 */
export function deleteNote(contentArea, editingSpan) {
  if (!editingSpan || !contentArea.contains(editingSpan)) {
    return null
  }

  const textContent = Array.from(editingSpan.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('')

  const textNode = document.createTextNode(textContent)
  editingSpan.parentNode.replaceChild(textNode, editingSpan)

  return {
    newHtml: contentArea.innerHTML
  }
}

/**
 * Estrae il contenuto di una nota utente da un elemento DOM, in base alla logica del vecchio componente.
 * @param {HTMLElement} noteSymbol - L'elemento `sup` cliccato.
 * @returns {{noteType: string, noteValue: string, editingSpan: HTMLElement} | null}
 */
export function getNoteDetails(noteSymbol) {
  let noteWrapper = noteSymbol.closest('.note-wrapper')

  if (!noteWrapper) {
    return null
  }

  const dataAttr = Array.from(noteWrapper.attributes).find(
    (attr) => attr.name.startsWith('data-') && attr.name !== 'data-note-id'
  )

  if (!dataAttr) {
    return null
  }

  const noteType = dataAttr.name.replace('data-', '')
  const noteValue = dataAttr.value

  return {
    noteType,
    noteValue,
    editingSpan: noteWrapper
  }
}
