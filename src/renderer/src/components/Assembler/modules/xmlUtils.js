export const TEI_NS = 'http://www.tei-c.org/ns/1.0'
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function indentContent(content, baseIndent) {
  const indent = ' '.repeat(baseIndent)
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      return trimmed === '' ? '' : indent + trimmed
    })
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * Parsa una stringa XML in Document. Lancia un errore leggibile se malformato.
 * [NOTA] richiede DOMParser, disponibile nel renderer Electron (contesto browser).
 */
export function parseXml(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')
  const errorNode = doc.getElementsByTagName('parsererror')[0]
  if (errorNode) {
    throw new Error(`XML non valido: ${errorNode.textContent.split('\n')[0]}`)
  }
  return doc
}

export function serializeXml(node) {
  return new XMLSerializer().serializeToString(node)
}

export function findFirst(root, localName) {
  const all = root.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i]
  }
  return null
}

export function findAll(root, localName) {
  const all = root.getElementsByTagName('*')
  const result = []
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) result.push(all[i])
  }
  return result
}

export function getXmlId(el) {
  return el.getAttributeNS(XML_NS, 'id') || el.getAttribute('xml:id')
}

export function setXmlId(el, value) {
  el.setAttributeNS(XML_NS, 'xml:id', value)
}
