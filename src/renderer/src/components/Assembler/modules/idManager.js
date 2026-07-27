import { getXmlId, setXmlId } from './xmlUtils.js'

/**
 * Appende `${separator}${sourceIndex}` a ogni xml:id trovato nel documento (in-place).
 * @param {Document|Element} root - radice su cui operare
 * @param {number} sourceIndex - indice del file sorgente, a partire da 1
 * @param {string} [separator='-']
 * @returns {Map<string,string>} mappa oldId -> newId
 */
export function namespaceIds(root, sourceIndex, separator = '-') {
  const changes = new Map()
  const all = root.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const oldId = getXmlId(el)
    if (oldId) {
      const newId = `${oldId}${separator}${sourceIndex}`
      setXmlId(el, newId)
      changes.set(oldId, newId)
    }
  }
  return changes
}
