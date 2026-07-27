import { TEI_NS, findFirst } from './xmlUtils.js'

export const DEFAULT_CONTENT_TAGS = ['p', 'l', 'title', 'head', 'ab']

/**
 * @param {Array<{name:string, dom:Document}>} parsedFiles - ordine = ordine dei testimoni (w1, w2, ...)
 * @param {string[]} [contentTags]
 * @returns {Element} nodo <body> con gli <app> inseriti, pronto per l'inserimento in <text>
 */
export function buildCollation(parsedFiles, contentTags = DEFAULT_CONTENT_TAGS) {
  if (!parsedFiles || parsedFiles.length < 2) {
    throw new Error('Servono almeno due documenti per costruire una collazione')
  }

  const baseFile = parsedFiles[0]
  const baseBody = findFirst(baseFile.dom, 'body')
  if (!baseBody) {
    throw new Error(`Nessun <body> trovato nel documento base (${baseFile.name})`)
  }

  const outputBody = baseBody.cloneNode(true)
  const otherBodies = parsedFiles.slice(1).map((f) => findFirst(f.dom, 'body'))

  collateInPlace(outputBody, contentTags, otherBodies)

  return outputBody
}

function getNthByTag(root, tagName, n) {
  if (!root) return null
  const all = root.getElementsByTagName('*')
  let count = 0
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === tagName) {
      if (count === n) return all[i]
      count++
    }
  }
  return null
}

function moveContentIntoRdg(doc, sourceEl, witId) {
  const rdg = doc.createElementNS(TEI_NS, 'rdg')
  for (let i = 0; i < sourceEl.attributes.length; i++) {
    const attr = sourceEl.attributes[i]
    rdg.setAttribute(attr.name, attr.value)
  }
  rdg.setAttribute('wit', `#${witId}`)
  while (sourceEl.firstChild) rdg.appendChild(sourceEl.firstChild)
  return rdg
}

function collateInPlace(root, contentTags, otherBodies) {
  const doc = root.ownerDocument

  const all = root.getElementsByTagName('*')
  const targets = []
  for (let i = 0; i < all.length; i++) {
    if (contentTags.includes(all[i].localName)) targets.push(all[i])
  }

  const counters = Object.create(null)

  targets.forEach((baseEl) => {
    const tag = baseEl.localName
    const idx = counters[tag] || 0
    counters[tag] = idx + 1

    const app = doc.createElementNS(TEI_NS, 'app')
    app.appendChild(moveContentIntoRdg(doc, baseEl, 'w1'))
    app.appendChild(doc.createTextNode('\n'))

    otherBodies.forEach((otherBody, w) => {
      const witId = `w${w + 2}`
      const match = getNthByTag(otherBody, tag, idx)
      if (match) {
        const imported = doc.importNode(match, true)
        app.appendChild(moveContentIntoRdg(doc, imported, witId))
        app.appendChild(doc.createTextNode('\n'))
      }
    })

    baseEl.replaceWith(app)
  })
}
