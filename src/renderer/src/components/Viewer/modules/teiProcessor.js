/**
 * Itera sugli elementi con `data-tag` nel DOM e applica le annotazioni interattive.
 * @param {HTMLElement} contentArea - L'elemento del DOM che contiene l'HTML del viewer.
 */
export function processTeiAnnotations(contentArea) {
  if (!contentArea) return

  const elementsToProcess = contentArea.querySelectorAll('[data-tag]:not([data-annotated])')

  elementsToProcess.forEach((el) => {
    const tag = el.dataset.tag

    const isNoteReference = (tag === 'ref' || tag === 'ptr') && el.hasAttribute('data-target')

    if (isNoteReference || ['note'].includes(tag)) {
      setupTeiAnnotation(el, contentArea)
    } else if (tag === 'seg') {
      setupSegAnnotation(el, contentArea)
    } else if (tag === 'img') {
      setupImgAnnotation(el, contentArea)
    }

    if (tag === 'persname' || tag === 'person') {
      el.classList.add('tei-person-noted')
      el.dataset.annotated = 'true'
    }

    if (tag === 'pb') {
      el.dataset.annotated = 'true'
    }
  })
}
/**
 * Configura l'annotazione per un elemento <seg>, processando i suoi attributi.
 * @param {HTMLElement} el - L'elemento <seg> da processare.
 * @param {HTMLElement} contentArea - L'area di contenuto per cercare i target dei riferimenti.
 */
function setupSegAnnotation(el, contentArea) {
  el.dataset.annotated = 'true'

  const attributesHtml = generateAttributeHtml(el, contentArea)

  if (attributesHtml) {
    const attributesSpan = document.createElement('span')
    attributesSpan.className = 'tei-seg-attributes'
    attributesSpan.innerHTML = attributesHtml

    el.prepend(attributesSpan)
  }

  const hook = document.createElement('sup')
  hook.className = 'tei-seg-symbol'
  hook.textContent = '§'
  hook.title = 'Mostra dettagli segmento'

  for (const attr in el.dataset) {
    if (Object.prototype.hasOwnProperty.call(el.dataset, attr)) {
      hook.dataset[attr] = el.dataset[attr]
    }
  }

  el.appendChild(hook)
}

/**
 * Configura l'annotazione per elementi TEI come <note>, <ref>, <ptr>.
 * @param {HTMLElement} el - L'elemento da annotare.
 * @param {HTMLElement} contentArea - L'area di contenuto per cercare i target dei riferimenti.
 */
function setupTeiAnnotation(el, contentArea) {
  el.dataset.annotated = 'true'
  const tag = el.dataset.tag

  const hook = document.createElement('sup')
  hook.className = 'tei-note-symbol'
  hook.textContent = '⁑'
  hook.title = 'Mostra annotazione TEI'

  for (const attr in el.dataset) {
    if (Object.prototype.hasOwnProperty.call(el.dataset, attr)) {
      hook.dataset[attr] = el.dataset[attr]
    }
  }

  const teiWrapper = document.createElement('span')
  teiWrapper.className = 'tei-note-wrapper'

  const hiddenContentSpan = document.createElement('span')
  hiddenContentSpan.className = 'tei-hidden-note-content'

  if (tag === 'note') {
    while (el.firstChild) {
      hiddenContentSpan.appendChild(el.firstChild)
    }
    teiWrapper.appendChild(hiddenContentSpan)
    teiWrapper.appendChild(hook)
    el.appendChild(teiWrapper)
  } else if (tag === 'ref' || tag === 'ptr') {
    const targetValue = el.dataset.target || el.dataset.ref
    const noteContent = resolveReference(targetValue, contentArea)
    hiddenContentSpan.innerHTML = noteContent
    teiWrapper.appendChild(hiddenContentSpan)
    teiWrapper.appendChild(hook)
    el.appendChild(teiWrapper)
  }
}

/**
 * Configura l'annotazione per un elemento <img>, processando i suoi attributi.
 * @param {HTMLElement} el - L'elemento <img> da processare.
 * @param {HTMLElement} contentArea - L'area di contenuto per cercare i target dei riferimenti.
 */
function setupImgAnnotation(el, contentArea) {
  el.dataset.annotated = 'true'

  const attributesHtml = generateAttributeHtml(el, contentArea)

  if (attributesHtml) {
    const attributesSpan = document.createElement('span')
    attributesSpan.className = 'tei-img-attributes'
    attributesSpan.innerHTML = attributesHtml

    el.prepend(attributesSpan)
  }

  const hook = document.createElement('sup')
  hook.className = 'tei-img-symbol'
  hook.textContent = '⧉'
  hook.title = 'Mostra dettagli immagine'

  for (const attr in el.dataset) {
    if (Object.prototype.hasOwnProperty.call(el.dataset, attr)) {
      hook.dataset[attr] = el.dataset[attr]
    }
  }

  el.appendChild(hook)
}
/**
 * Risolve un riferimento a un ID interno (#) o a una risorsa esterna.
 * @param {string} targetValue - Il valore dell'attributo data-target o data-ref.
 * @param {HTMLElement} contentArea - L'area di contenuto per cercare i target interni.
 * @returns {string} Il contenuto HTML o un messaggio di errore.
 */
function resolveReference(targetValue, contentArea) {
  if (!targetValue) {
    return 'Riferimento senza target valido.'
  }

  if (
    targetValue.startsWith('http://') ||
    targetValue.startsWith('https://') ||
    targetValue.startsWith('www.')
  ) {
    return `Vedi risorsa esterna: <a href="${targetValue}" target="_blank" rel="noopener noreferrer">${targetValue}</a>`
  }

  if (targetValue.startsWith('#')) {
    const targetId = targetValue.substring(1)
    const targetNoteElement = contentArea.querySelector(`#${targetId}, [data-id="${targetId}"]`)
    if (targetNoteElement) {
      const existingHiddenContent = targetNoteElement.querySelector('.tei-hidden-note-content')
      return existingHiddenContent ? existingHiddenContent.innerHTML : targetNoteElement.innerHTML
    }
    return `Nota interna non trovata: ${targetValue}`
  }

  return 'Riferimento senza target valido.'
}

/**
 * Genera il contenuto HTML per i metadati basandosi sugli attributi di un elemento.
 * @param {HTMLElement} el - L'elemento HTML con gli attributi da formattare.
 * @param {HTMLElement} contentArea - L'area di contenuto per risolvere i riferimenti.
 * @returns {string} Il contenuto HTML degli attributi.
 */
function generateAttributeHtml(el, contentArea) {
  let content = '<div class="tei-metadata">'
  const dataAttributes = { ...el.dataset }

  const refValue = dataAttributes.target || dataAttributes.ref
  if (refValue) {
    const resolvedRef = resolveReference(refValue, contentArea)
    content += `<div class="metadata-item"><h5>Riferimento:</h5><p>${resolvedRef}</p></div>`
    delete dataAttributes.target
    delete dataAttributes.ref
  }

  for (const attr in dataAttributes) {
    if (attr !== 'tag' && attr !== 'annotated') {
      const formattedKey = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/([A-Z])/g, ' $1')
      content += `<div class="metadata-item"><h5>${formattedKey}:</h5><p>${escapeHtml(dataAttributes[attr])}</p></div>`
    }
  }

  content += '</div>'
  return content
}

/**
 * Preserva l'ordine e la struttura dell'elemento convertendo ogni nodo in una rappresentazione strutturata.
 * @param {HTMLElement} element - L'elemento da processare
 * @returns {Object} Struttura che preserva l'ordine originale
 */
function preserveElementStructure(element) {
  const result = {
    tag: element.dataset.tag || 'text',
    attributes: {},
    content: []
  }

  for (const attr in element.dataset) {
    if (
      attr !== 'tag' &&
      attr !== 'annotated' &&
      Object.prototype.hasOwnProperty.call(element.dataset, attr)
    ) {
      result.attributes[attr] = element.dataset[attr]
    }
  }

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.trim()
      if (text) {
        result.content.push({
          type: 'text',
          value: text
        })
      }
    } else if (child.nodeType === Node.ELEMENT_NODE && child.dataset.tag) {
      result.content.push({
        type: 'element',
        value: preserveElementStructure(child)
      })
    }
  }

  return result
}

/**
 * Crea un display generico per qualsiasi elemento basato sui primi contenuti significativi.
 * @param {Object} structure - Struttura preservata
 * @returns {string} Display leggibile per la lista
 */
function createGenericDisplay(structure) {
  const firstText = extractFirstMeaningfulText(structure)

  const id = structure.attributes.id || structure.attributes.n || ''
  const idSuffix = id ? ` (${id})` : ''

  const maxLength = 80
  let display = firstText || 'Elemento senza testo'

  if (display.length > maxLength) {
    display = display.substring(0, maxLength) + '...'
  }

  return display + idSuffix
}

/**
 * Estrae il primo testo significativo da una struttura, cercando in ordine.
 * @param {Object} structure - Struttura preservata
 * @returns {string} Primo testo trovato
 */
function extractFirstMeaningfulText(structure) {
  for (const item of structure.content) {
    if (item.type === 'text' && item.value.trim()) {
      return item.value.trim()
    }
  }

  for (const item of structure.content) {
    if (item.type === 'element') {
      const childText = extractFirstMeaningfulText(item.value)
      if (childText) {
        return childText
      }
    }
  }

  return ''
}

/**
 * Converte la struttura preservata in HTML per la visualizzazione.
 * @param {Object} structure - Struttura preservata
 * @param {number} level - Livello di nidificazione
 * @returns {string} HTML generato
 */
function structureToHtml(structure, level = 0) {
  let html = ''

  const attributeKeys = Object.keys(structure.attributes)
  if (attributeKeys.length > 0) {
    html += `<div class="metadata-attributes metadata-level-${level}">`
    attributeKeys.forEach((key) => {
      const formattedKey = formatKey(key)
      html += `<div class="metadata-item">`
      html += `<h5 class="metadata-key">${formattedKey}:</h5>`
      html += `<p class="metadata-text">${escapeHtml(structure.attributes[key])}</p>`
      html += `</div>`
    })
    html += `</div>`
  }

  if (structure.content.length > 0) {
    html += `<div class="metadata-content metadata-level-${level}">`

    structure.content.forEach((item) => {
      if (item.type === 'text') {
        html += `<div class="metadata-text-content">${escapeHtml(item.value)}</div>`
      } else if (item.type === 'element') {
        const element = item.value
        const tagName = formatKey(element.tag)

        html += `<div class="metadata-element">`
        html += `<h5 class="metadata-element-title">${tagName}:</h5>`
        html += `<div class="metadata-element-content">`
        html += structureToHtml(element, level + 1)
        html += `</div>`
        html += `</div>`
      }
    })

    html += `</div>`
  }

  return html
}

/**
 * Processa una lista specifica TEI, gestendo liste annidate.
 * @param {HTMLElement} listEl - L'elemento lista da processare
 * @param {Array} allTeiLists - Array di tutte le liste estratte
 * @param {Set} processedListIds - Set degli ID già processati
 */
function processSpecificList(listEl, allTeiLists, processedListIds) {
  const listTag = listEl.dataset.tag
  const listId = listEl.dataset.id || listEl.id || listTag

  if (processedListIds.has(listId)) return
  processedListIds.add(listId)

  const nestedLists = Array.from(listEl.children).filter((child) => child.dataset.tag === listTag)

  if (nestedLists.length > 0) {
    nestedLists.forEach((nestedList, index) => {
      const nestedType = nestedList.dataset.type || `sottolista-${index + 1}`
      const nestedId = nestedList.dataset.id || nestedList.id || `${listId}-${nestedType}-${index}`

      if (!processedListIds.has(nestedId)) {
        processedListIds.add(nestedId)

        const nestedName = `${formatListName(listTag)} - ${nestedType.charAt(0).toUpperCase() + nestedType.slice(1)}`
        const nestedSlug = `${listTag.toLowerCase().replace('list', '')}-${nestedType.toLowerCase().replace(/\s+/g, '-')}`

        const nestedItems = extractItemsFromList(nestedList, nestedSlug)

        if (nestedItems.length > 0) {
          allTeiLists.push({
            name: nestedName,
            type: listTag,
            slug: nestedSlug,
            items: nestedItems
          })
        }
      }
    })
  } else {
    const listName = formatListName(listTag)
    const slug = listTag.toLowerCase().replace('list', '')

    const items = extractItemsFromList(listEl, slug)

    if (items.length > 0) {
      allTeiLists.push({
        name: listName,
        type: listTag,
        slug,
        items
      })
    }
  }
}

/**
 * Estrae gli elementi da una lista, escludendo head e testo descrittivo.
 * @param {HTMLElement} listEl - L'elemento lista
 * @param {string} slug - Lo slug per gli ID automatici
 * @returns {Array} Array degli elementi estratti
 */
function extractItemsFromList(listEl, slug) {
  const items = []

  const itemElements = Array.from(listEl.children).filter((child) => {
    if (!child.dataset.tag) return false

    if (child.dataset.tag === 'head') return false

    const parentListTag = listEl.dataset.tag
    if (child.dataset.tag === parentListTag) return false

    return true
  })

  itemElements.forEach((itemEl, index) => {
    const id = itemEl.dataset.id || itemEl.id || `_auto_${slug}_${Date.now()}_${index}`
    const structure = preserveElementStructure(itemEl)
    const display = createGenericDisplay(structure)

    items.push({
      id,
      display,
      rawData: structure,
      htmlContent: structureToHtml(structure)
    })
  })

  return items
}
function formatKey(key) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Estrae tutte le liste definite nel teiHeader e i page breaks dal contenuto HTML.
 * @param {string} htmlContent - La stringa HTML completa fornita dallo store.
 * @returns {{lists: Array, pages: Array}} Un oggetto contenente le liste TEI e la lista delle pagine.
 */
export function extractAllLists(htmlContent) {
  const allTeiLists = []
  const pageList = []
  const processedListIds = new Set()

  if (!htmlContent) return { lists: [], pages: [] }

  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const teiHeaderElement = doc.querySelector('[data-tag="teiheader"]')

  if (teiHeaderElement) {
    const specificListElements = teiHeaderElement.querySelectorAll(
      '[data-tag^="list"]:not([data-tag="list"])'
    )

    specificListElements.forEach((listEl) => {
      processSpecificList(listEl, allTeiLists, processedListIds)
    })

    const genericListElements = teiHeaderElement.querySelectorAll('[data-tag="list"]')

    genericListElements.forEach((listEl) => {
      const listId = listEl.dataset.id || listEl.id || `generic-list-${Date.now()}`

      if (processedListIds.has(listId)) return
      processedListIds.add(listId)

      const listType = listEl.dataset.type || 'generica'
      const items = []

      listEl.querySelectorAll('[data-tag="item"]').forEach((itemEl, index) => {
        if (!itemEl.dataset.tag) {
          return
        }

        if (itemEl.dataset.tag === 'head') {
          return
        }

        const id =
          itemEl.dataset.id || itemEl.id || `_auto_generic_${listType}_${Date.now()}_${index}`
        const structure = preserveElementStructure(itemEl)
        const display = createGenericDisplay(structure)

        items.push({
          id,
          display,
          rawData: structure,
          htmlContent: structureToHtml(structure)
        })
      })

      if (items.length > 0) {
        allTeiLists.push({
          name: `Lista: ${listType.charAt(0).toUpperCase() + listType.slice(1)}`,
          type: 'list',
          slug: `generic-${listType.toLowerCase().replace(/\s+/g, '-')}`,
          items
        })
      }
    })
  }

  doc.body.querySelectorAll('[data-tag="pb"]').forEach((pbEl) => {
    const pageNum = pbEl.dataset.n || 'N/A'
    const pageId = pbEl.id || `pb-${pageNum}-${Date.now()}`
    if (!pbEl.id) pbEl.id = pageId
    pageList.push({ id: pageId, n: pageNum })
  })

  allTeiLists.sort((a, b) => a.name.localeCompare(b.name))

  return { lists: allTeiLists, pages: pageList }
}

/**
 * Converte il nome di una lista TEI in un formato leggibile.
 * @param {string} listTag - Il tag della lista (es. "listperson", "listbibl")
 * @returns {string} Nome formattato (es. "Persone", "Bibliografia")
 */
function formatListName(listTag) {
  const nameMap = {
    listperson: 'Persone',
    listplace: 'Luoghi',
    listorg: 'Organizzazioni',
    listevent: 'Eventi',
    listbibl: 'Bibliografia',
    listwit: 'Testimoni',
    listrelation: 'Relazioni',
    listchange: 'Modifiche',
    listobject: 'Oggetti',
    listapp: 'Apparati',
    listtaxonomy: 'Tassonomie'
  }

  return (
    nameMap[listTag] ||
    listTag.replace('list', '').charAt(0).toUpperCase() + listTag.replace('list', '').slice(1)
  )
}
