import { defineStore } from 'pinia'
import { useXmlStore } from './xmlStore'
import { ref, watch } from 'vue'

export const useHtmlStore = defineStore('html', () => {
  const htmlContent = ref('')
  const isConverting = ref(false)
  const lastProcessedXml = ref('')
  const notes = ref([])
  const noteSymbols = ref({})
  const activeNoteId = ref(null)
  const pages = ref([])
  const currentPage = ref(0)

  const xmlStore = useXmlStore()

  function convertXmlStringToHtml(xmlString) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'text/xml')
    const root = doc.documentElement

    if (doc.getElementsByTagName('parsererror').length) {
      console.error('XML parsing error!')
      throw new Error('Failed to parse XML.')
    }

    function processElement(el) {
      if (el.nodeType === Node.TEXT_NODE) {
        return el.textContent
      }
      if (el.nodeType !== Node.ELEMENT_NODE) {
        return ''
      }

      const tagNameParts = el.tagName.split(':')
      const tagName = tagNameParts.pop().toLowerCase()

      let html = `<span class="tei-${tagName}" data-tag="${tagName}"`

      for (const attr of el.attributes) {
        const attrNameParts = attr.name.split(':')
        let cleanAttrName = attrNameParts.pop()
        html += ` data-${cleanAttrName}="${attr.value}"`
      }
      html += '>'

      for (const child of el.childNodes) {
        html += processElement(child)
      }

      html += '</span> '
      return html
    }

    return processElement(root)
  }

  /**
   * Genera una "signature" testuale attorno a una selezione data, catturando frammenti di testo a diverse distanze.
   * Questo aiuta a identificare univocamente una posizione testuale anche se il testo esatto cambia leggermente.
   * @param {string} fullText - Il testo completo del documento.
   * @param {number} index - L'indice di inizio della selezione nel fullText.
   * @param {'before'|'after'} type - Indica se generare la signature prima ('before') o dopo ('after') la selezione.
   * @param {number} selectionLength - La lunghezza della selezione.
   * @param {number[]} distances - Un array di distanze dal punto di riferimento per estrarre i frammenti.
   * @returns {string[]} Un array di stringhe, che rappresenta la signature.
   */
  function _generateTextSignature(fullText, index, type, selectionLength, distances) {
    const signature = []
    distances.forEach((dist) => {
      let startIndex
      let substring = ''

      if (type === 'before') {
        startIndex = index - dist - 3
        if (startIndex >= 0) {
          substring = fullText.substring(startIndex, startIndex + 3)
        }
      } else {
        startIndex = index + selectionLength + dist
        if (startIndex + 3 <= fullText.length) {
          substring = fullText.substring(startIndex, startIndex + 3)
        }
      }
      signature.push(substring)
    })
    return signature
  }

  /**
   * Conta il numero di match ordinati tra due signature.
   * Usato per determinare quanto bene una signature generata sul momento corrisponde a una signature salvata.
   * @param {string[]} currentSignature - La signature generata dal testo corrente.
   * @param {string[]} savedSignature - La signature estratta e salvata in precedenza.
   * @returns {number} Il numero di frammenti che corrispondono in ordine e valore.
   */
  function _countOrderedSignatureMatches(currentSignature, savedSignature) {
    let matches = 0
    const minLength = Math.min(currentSignature.length, savedSignature.length)
    for (let i = 0; i < minLength; i++) {
      if (currentSignature[i] && savedSignature[i] && currentSignature[i] === savedSignature[i]) {
        matches++
      }
    }
    return matches
  }

  /**
   * Esegue l'escaping dei caratteri HTML speciali in una stringa.
   * @param {string} unsafe - La stringa da escapare.
   * @returns {string} La stringa con i caratteri HTML escapati.
   */
  function escapeHtml(unsafe) {
    if (!unsafe) return ''
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function _extractUserNotesFromHtml(htmlString) {
    const extractedNotes = []
    if (!htmlString || htmlString.includes('class="error"')) {
      return extractedNotes
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlString, 'text/html')
    const userNoteSpans = doc.querySelectorAll('.note-wrapper')

    const distances = [4, 8, 15, 25, 40]

    userNoteSpans.forEach((span) => {
      const id = span.dataset.noteId
      if (!id) {
        console.warn('Found .note-wrapper span without data-note-id, skipping extraction.')
        return
      }

      const fullNoteHtml = span.outerHTML

      const tempDivForText = document.createElement('div')
      Array.from(span.childNodes).forEach((node) => {
        if (
          !node.classList ||
          (!node.classList.contains('note-symbol') &&
            !node.classList.contains('user-hidden-note-content'))
        ) {
          tempDivForText.appendChild(node.cloneNode(true))
        }
      })
      const originalSelectionText = escapeHtml(tempDivForText.textContent || '')

      const fullText = doc.body.textContent || ''
      const spanText = span.textContent || ''

      let signatureBefore = []
      let signatureAfter = []
      let contextBefore = ''
      let contextAfter = ''

      const spanIndexInFullText = fullText.indexOf(spanText)

      if (spanIndexInFullText !== -1) {
        signatureBefore = _generateTextSignature(
          fullText,
          spanIndexInFullText,
          'before',
          spanText.length,
          distances
        )
        signatureAfter = _generateTextSignature(
          fullText,
          spanIndexInFullText,
          'after',
          spanText.length,
          distances
        )

        contextBefore = fullText.substring(
          Math.max(0, spanIndexInFullText - 25),
          spanIndexInFullText
        )
        contextAfter = fullText.substring(
          spanIndexInFullText + spanText.length,
          spanIndexInFullText + spanText.length + 25
        )
      }

      extractedNotes.push({
        id,
        fullNoteHtml,
        originalSelectionText,
        contextBefore,
        contextAfter,
        signatureBefore,
        signatureAfter
      })
    })

    return extractedNotes
  }

  function _reapplyUserNotes(baseHtml, userNotes) {
    if (!userNotes || userNotes.length === 0 || !baseHtml) {
      return baseHtml
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(baseHtml, 'text/html')
    const body = doc.body

    const sortedNotes = [...userNotes].sort((a, b) => {
      return b.contextBefore.localeCompare(a.contextBefore)
    })

    const distances = [4, 8, 15, 25, 40]

    sortedNotes.forEach((note) => {
      const {
        id,
        fullNoteHtml,
        originalSelectionText,
        contextBefore,
        contextAfter,
        signatureBefore,
        signatureAfter
      } = note

      const tempElement = doc.createElement('div')
      tempElement.innerHTML = fullNoteHtml
      const noteSpan = tempElement.firstChild

      const fullText = body.textContent || ''
      let matchIndex = -1
      let foundWithSignature = false
      const selectionLength = originalSelectionText.length

      for (let i = 0; i <= fullText.length - selectionLength; i++) {
        const potentialMatchText = fullText.substring(i, i + selectionLength)

        if (potentialMatchText === originalSelectionText) {
          const currentSignatureBefore = _generateTextSignature(
            fullText,
            i,
            'before',
            selectionLength,
            distances
          )
          const currentSignatureAfter = _generateTextSignature(
            fullText,
            i,
            'after',
            selectionLength,
            distances
          )

          const matchesBefore = _countOrderedSignatureMatches(
            currentSignatureBefore,
            signatureBefore
          )
          const matchesAfter = _countOrderedSignatureMatches(currentSignatureAfter, signatureAfter)

          if (
            (matchesBefore >= 3 && matchesAfter >= 3) ||
            (matchesBefore === 5 && matchesAfter >= 2) ||
            (matchesAfter === 5 && matchesBefore >= 2)
          ) {
            matchIndex = i
            foundWithSignature = true
            break
          }
        }
      }

      if (!foundWithSignature) {
        console.warn(
          `Note signature not found for note ${id}. Attempting fallback to context search.`
        )

        let tempMatchIndex = -1

        const searchPatternFull = contextBefore + originalSelectionText + contextAfter
        tempMatchIndex = fullText.indexOf(searchPatternFull)

        if (tempMatchIndex !== -1) {
          matchIndex = tempMatchIndex + contextBefore.length
        } else {
          const searchPatternBefore = contextBefore + originalSelectionText
          tempMatchIndex = fullText.indexOf(searchPatternBefore)

          if (tempMatchIndex !== -1) {
            matchIndex = tempMatchIndex + contextBefore.length
          } else {
            const searchPatternAfter = originalSelectionText + contextAfter
            tempMatchIndex = fullText.indexOf(searchPatternAfter)

            if (tempMatchIndex !== -1) {
              matchIndex = tempMatchIndex
            } else {
              console.warn(
                `Neither full context nor partial context found for note ${id}. Attempting a less precise match with only original text.`
              )
              matchIndex = fullText.indexOf(originalSelectionText)

              if (matchIndex === -1) {
                console.warn(`Note original text not found for note ${id}. Skipping reapplication.`)
                return
              }
            }
          }
        }
      }

      if (matchIndex !== -1) {
        const startOffset = matchIndex
        const endOffset = startOffset + originalSelectionText.length

        const textNodes = []
        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT)
        let currentPosition = 0

        while (walker.nextNode()) {
          const node = walker.currentNode
          const textLength = node.textContent.length
          const nodeStart = currentPosition
          const nodeEnd = currentPosition + textLength

          if (nodeEnd > startOffset && nodeStart < endOffset) {
            textNodes.push({ node, start: nodeStart, end: nodeEnd })
          }
          currentPosition = nodeEnd
        }

        if (textNodes.length > 0) {
          const range = doc.createRange()
          const firstNodeInfo = textNodes[0]
          const lastNodeInfo = textNodes[textNodes.length - 1]

          range.setStart(firstNodeInfo.node, startOffset - firstNodeInfo.start)
          range.setEnd(lastNodeInfo.node, endOffset - lastNodeInfo.start)

          range.deleteContents()
          range.insertNode(noteSpan)
        } else {
          console.warn(
            `Could not find text nodes for note ${id} at calculated index ${matchIndex}.`
          )
        }
      }
    })

    return body.innerHTML
  }

  async function saveHtmlContentToElectronStore() {
    await window.electronAPI.storeSet('htmlContent', htmlContent.value)
  }

  function processXml(xml) {
    const currentNotes = htmlContent.value.includes('class="error"')
      ? [...notes.value]
      : _extractUserNotesFromHtml(htmlContent.value)

    if (xml === lastProcessedXml.value && notes.value.length === currentNotes.length) {
      return
    }

    if (!xml || !xml.trim()) {
      notes.value = currentNotes
      htmlContent.value = ''
      lastProcessedXml.value = ''
      saveHtmlContentToElectronStore()
      return
    }

    try {
      isConverting.value = true
      const convertedHtml = convertXmlStringToHtml(xml)

      const htmlWithNotes = _reapplyUserNotes(convertedHtml, currentNotes)

      if (htmlContent.value !== htmlWithNotes) {
        htmlContent.value = htmlWithNotes

        notes.value = _extractUserNotesFromHtml(htmlWithNotes)
      }

      lastProcessedXml.value = xml
    } catch (e) {
      console.error('XML processing failed:', e)
      htmlContent.value = `<div class="error">Errore di elaborazione XML.</div>`
      lastProcessedXml.value = ''
    } finally {
      isConverting.value = false
      saveHtmlContentToElectronStore()
    }
  }

  function handleExternalHtmlUpdate(newHtml) {
    if (newHtml !== htmlContent.value) {
      htmlContent.value = newHtml
      notes.value = _extractUserNotesFromHtml(newHtml)
      lastProcessedXml.value = ''
      saveHtmlContentToElectronStore()
    }
  }

  async function init() {
    let htmlLoadedFromStore = false

    const savedHtml = await window.electronAPI.storeGet('htmlContent')
    if (savedHtml) {
      htmlContent.value = savedHtml
      htmlLoadedFromStore = true
      notes.value = _extractUserNotesFromHtml(savedHtml)
    } else {
      if (xmlStore.xmlContent) {
        processXml(xmlStore.xmlContent)
      }
    }

    window.electronAPI.onXmlUpdated(processXml)
    window.electronAPI.onHtmlUpdated(handleExternalHtmlUpdate)
    window.electronAPI.onStoreUpdated((key, value) => {
      if (key === 'htmlContent') {
        handleExternalHtmlUpdate(value)
      }
    })

    watch(
      () => xmlStore.xmlContent,
      (newXml, oldXml) => {
        if (newXml && newXml !== oldXml) {
          processXml(newXml)
        } else if (!newXml && oldXml) {
          processXml('')
        }
      },
      { immediate: true }
    )

    if (!htmlLoadedFromStore && xmlStore.xmlContent) {
      processXml(xmlStore.xmlContent)
    }
  }

  function setActiveNote(id) {
    activeNoteId.value = id
  }

  function nextPage() {
    if (currentPage.value < pages.value.length - 1) currentPage.value++
  }

  function prevPage() {
    if (currentPage.value > 0) currentPage.value--
  }

  return {
    htmlContent,
    notes,
    noteSymbols,
    activeNoteId,
    pages,
    currentPage,
    isConverting,

    init,
    setActiveNote,
    nextPage,
    prevPage,

    ...(() => {
      watch(
        htmlContent,
        (newHtml) => {
          if (newHtml) {
            saveHtmlContentToElectronStore()
          }
        },
        { immediate: true }
      )
    })()
  }
})
