import { TEI_NS, XML_NS, findFirst } from './xmlUtils.js'

/**
 * @param {Array<{name:string, dom:Document}>} parsedFiles - file gia parsati, nell'ordine scelto dall'utente
 * @returns {Element} nodo <teiHeader>, pronto per l'inserimento nel documento finale
 */
export function mergeTeiHeaders(parsedFiles) {
  const baseFile = parsedFiles[0]
  const baseHeader = baseFile ? findFirst(baseFile.dom, 'teiHeader') : null

  const header = baseHeader ? baseHeader.cloneNode(true) : buildDefaultHeader(parsedFiles)

  appendSourceList(header, parsedFiles)
  return header
}

function buildDefaultHeader(parsedFiles) {
  const doc = parsedFiles[0]?.dom
  if (!doc) throw new Error('Nessun documento disponibile per costruire il teiHeader')

  const header = doc.createElementNS(TEI_NS, 'teiHeader')
  const fileDesc = doc.createElementNS(TEI_NS, 'fileDesc')

  const titleStmt = doc.createElementNS(TEI_NS, 'titleStmt')
  const title = doc.createElementNS(TEI_NS, 'title')
  title.textContent = 'Documento montato'
  titleStmt.appendChild(title)

  const publicationStmt = doc.createElementNS(TEI_NS, 'publicationStmt')
  const pubP = doc.createElementNS(TEI_NS, 'p')
  pubP.textContent = 'Generato da Scriptorium'
  publicationStmt.appendChild(pubP)

  const sourceDesc = doc.createElementNS(TEI_NS, 'sourceDesc')
  const sourceP = doc.createElementNS(TEI_NS, 'p')
  sourceP.textContent = `Compilato da ${parsedFiles.length} file`
  sourceDesc.appendChild(sourceP)

  fileDesc.append(titleStmt, publicationStmt, sourceDesc)
  header.appendChild(fileDesc)
  return header
}

function appendSourceList(header, parsedFiles) {
  const doc = header.ownerDocument

  let sourceDesc = findFirst(header, 'sourceDesc')
  if (!sourceDesc) {
    sourceDesc = doc.createElementNS(TEI_NS, 'sourceDesc')
    header.appendChild(sourceDesc)
  }

  let listWit = findFirst(sourceDesc, 'listWit')
  if (!listWit) {
    listWit = doc.createElementNS(TEI_NS, 'listWit')
    sourceDesc.appendChild(listWit)
  }

  parsedFiles.forEach((file, index) => {
    const n = index + 1
    const witness = doc.createElementNS(TEI_NS, 'witness')
    witness.setAttributeNS(XML_NS, 'xml:id', `w${n}`)
    witness.textContent = file.name
    listWit.appendChild(witness)
  })
}
