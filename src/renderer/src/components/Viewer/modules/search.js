import { isElementVisible, escapeRegex } from './utils.js'

/**
 * Trova tutti i nodi di testo all'interno di un elemento HTML, escludendo i tag di script e stile.
 * @param {HTMLElement} element - L'elemento radice da cui iniziare la ricerca.
 * @param {Array<string>} classesToExclude - Classi CSS da escludere dalla ricerca.
 * @returns {Array<Text>} - Una lista di nodi di testo trovati.
 */
function findTextNodes(element, classesToExclude = []) {
  const textNodes = []
  const walk = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.parentNode.nodeName === 'SCRIPT' || node.parentNode.nodeName === 'STYLE') {
          return NodeFilter.FILTER_REJECT
        }

        let currentElement = node.parentElement
        while (currentElement) {
          if (classesToExclude.some((className) => currentElement.classList.contains(className))) {
            return NodeFilter.FILTER_REJECT
          }
          currentElement = currentElement.parentElement
        }

        if (node.nodeValue.trim() !== '') {
          return NodeFilter.FILTER_ACCEPT
        }
        return NodeFilter.FILTER_REJECT
      }
    },
    false
  )

  let node
  while ((node = walk.nextNode())) {
    textNodes.push(node)
  }
  return textNodes
}

/**
 * Esegue la ricerca di un termine nel documento e ne evidenzia le occorrenze.
 * L'evidenziazione avviene prima su tutti gli elementi, e poi i risultati
 * vengono filtrati per visibilità.
 * @param {string} searchTerm - Il termine di ricerca.
 * @param {HTMLElement} contentContainer - Il contenitore del documento dove eseguire la ricerca.
 * @param {Array<string>} classesToExclude - Classi CSS da escludere dalla ricerca.
 * @returns {Array<HTMLElement>} - Una lista degli elementi <mark> creati e visibili.
 */
export function performSearch(searchTerm, contentContainer, classesToExclude = []) {
  if (!searchTerm || !searchTerm.trim()) {
    clearSearch(contentContainer)
    return []
  }

  clearSearch(contentContainer)

  const allHighlightedElements = []
  const textNodes = findTextNodes(contentContainer, classesToExclude)

  textNodes.forEach((node) => {
    const parent = node.parentElement
    if (parent) {
      const originalText = node.nodeValue
      const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi')

      if (regex.test(originalText)) {
        const span = document.createElement('span')
        span.className = 'search-highlight-container'
        span.innerHTML = originalText.replace(
          regex,
          `<mark class="highlighted-search-result">$1</mark>`
        )
        node.replaceWith(span)
        allHighlightedElements.push(...Array.from(span.querySelectorAll('mark')))
      }
    }
  })

  const visibleHighlightedElements = allHighlightedElements.filter((el) => isElementVisible(el))

  return visibleHighlightedElements
}

/**
 * Rimuove tutte le evidenziazioni create dalla funzione di ricerca.
 * @param {HTMLElement} contentContainer - Il contenitore del documento.
 */
export function clearSearch(contentContainer) {
  const highlightContainers = contentContainer.querySelectorAll('.search-highlight-container')
  highlightContainers.forEach((container) => {
    const parent = container.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(container.textContent), container)
      parent.normalize()
    }
  })

  const highlightedMarks = contentContainer.querySelectorAll('mark.highlighted-search-result')
  highlightedMarks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent), mark)
      parent.normalize()
    }
  })
}
