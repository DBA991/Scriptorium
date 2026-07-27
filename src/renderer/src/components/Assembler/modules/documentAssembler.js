import { TEI_NS, XML_NS, parseXml, serializeXml, findFirst } from './xmlUtils.js'
import { namespaceIds } from './idManager.js'
import { mergeTeiHeaders } from './teiHeaderMerger.js'
import { buildCollation } from './collationBuilder.js'

/**
 * @param {Array<{name:string, content:string}>} files - file grezzi, nell'ordine scelto dall'utente (drag&drop)
 * @param {Object} [options]
 * @param {'simple'|'collation'} [options.mode='simple']
 * @param {string[]} [options.contentTags] - solo per mode='collation', vedi collationBuilder
 * @returns {string} XML finale (stringa), pronto per anteprima/export
 */
export function assembleDocument(files, options = {}) {
  const mode = options.mode || 'simple'
  if (!files || files.length === 0) {
    throw new Error('Nessun file da montare')
  }

  const parsedFiles = files.map((file, index) => {
    const dom = parseXml(file.content)
    namespaceIds(dom, index + 1)
    return { name: file.name, dom }
  })

  const header = mergeTeiHeaders(parsedFiles)

  if (mode === 'collation' && parsedFiles.length < 2) {
    throw new Error('La collazione richiede almeno due documenti')
  }
  const body =
    mode === 'collation'
      ? buildCollation(parsedFiles, options.contentTags)
      : buildSimpleBody(parsedFiles)

  return serializeFinalDocument(header, body)
}

function buildSimpleBody(parsedFiles) {
  const doc = parsedFiles[0].dom
  const body = doc.createElementNS(TEI_NS, 'body')

  parsedFiles.forEach((file, index) => {
    const fileId = file.name
      .replace(/\.xml$/i, '')
      .replace(/[^\w-]/g, '-')
      .toLowerCase()

    const div = doc.createElementNS(TEI_NS, 'div')
    div.setAttribute('n', String(index + 1))
    div.setAttribute('type', 'fragment')
    div.setAttribute('source', file.name)

    const head = doc.createElementNS(TEI_NS, 'head')
    head.setAttributeNS(XML_NS, 'xml:id', fileId)
    head.textContent = file.name
    div.appendChild(head)

    const sourceBody = findFirst(file.dom, 'body')
    if (sourceBody) {
      const imported = doc.importNode(sourceBody, true)
      while (imported.firstChild) div.appendChild(imported.firstChild)
    } else {
      const imported = doc.importNode(file.dom.documentElement, true)
      div.appendChild(imported)
    }

    body.appendChild(div)
  })

  return body
}

function serializeFinalDocument(header, body) {
  const doc = header.ownerDocument
  const tei = doc.createElementNS(TEI_NS, 'TEI')
  tei.appendChild(header)

  const text = doc.createElementNS(TEI_NS, 'text')
  text.appendChild(body)
  tei.appendChild(text)

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializeXml(tei)
}
