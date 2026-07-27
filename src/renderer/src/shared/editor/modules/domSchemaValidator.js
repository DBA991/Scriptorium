export function createDomSchemaValidator(schema) {
  const stripNonTagRegions = (xml) =>
    xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => m.replace(/[^\n]/g, ' '))

  const buildPositionQueues = (xml) => {
    const sanitized = stripNonTagRegions(xml)
    const queues = new Map()
    const tagOpenRegex = /<([\w:.-]+)(?=[\s/>])/g

    const lines = xml.split('\n')
    const lineStartOffsets = [0]
    for (let i = 0; i < lines.length; i++) {
      lineStartOffsets.push(lineStartOffsets[i] + lines[i].length + 1)
    }

    const getPosition = (index) => {
      let low = 0
      let high = lineStartOffsets.length - 1
      while (low < high) {
        const mid = (low + high + 1) >> 1
        if (lineStartOffsets[mid] <= index) low = mid
        else high = mid - 1
      }
      const lineStart = lineStartOffsets[low]
      return { startLineNumber: low + 1, startColumn: index - lineStart + 1 }
    }

    let match
    while ((match = tagOpenRegex.exec(sanitized)) !== null) {
      const tagName = match[1]
      const pos = getPosition(match.index)
      const entry = {
        ...pos,
        endLineNumber: pos.startLineNumber,
        endColumn: pos.startColumn + tagName.length + 1
      }
      if (!queues.has(tagName)) queues.set(tagName, [])
      queues.get(tagName).push(entry)
    }
    return queues
  }

  const FALLBACK_POS = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }

  return {
    validate(xmlContent) {
      return new Promise((resolve) => {
        try {
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')
          const errors = []

          const parserErrorEl = xmlDoc.getElementsByTagName('parsererror')[0]
          if (parserErrorEl) {
            resolve([
              { message: `Malformed XML: ${parserErrorEl.textContent}`, line: 1, column: 1 }
            ])
            return
          }

          const positionQueues = buildPositionQueues(xmlContent)
          const allElements = Array.from(xmlDoc.getElementsByTagName('*'))

          const positionByElement = new Map()
          allElements.forEach((el) => {
            const queue = positionQueues.get(el.tagName)
            const pos = queue && queue.length ? queue.shift() : FALLBACK_POS
            positionByElement.set(el, pos)
          })

          const getPos = (el) => positionByElement.get(el) || FALLBACK_POS

          allElements.forEach((element) => {
            const tagName = element.localName
            const pos = getPos(element)

            const schemaElement = schema.globalElements[tagName]
            if (!schemaElement) {
              errors.push({ ...pos, message: `Undefined element: <${tagName}>` })
              return
            }

            if (Array.isArray(schemaElement.attributes)) {
              schemaElement.attributes
                .filter((attr) => attr.use === 'required')
                .forEach((attr) => {
                  if (!element.hasAttribute(attr.name)) {
                    errors.push({
                      ...pos,
                      message: `Missing required attribute '${attr.name}' on <${tagName}>`
                    })
                  }
                })
            }

            if (Array.isArray(schemaElement.children) && schemaElement.children.length > 0) {
              Array.from(element.children).forEach((child) => {
                const childName = child.localName
                const childPos = getPos(child)

                if (!schemaElement.children.includes(childName)) {
                  errors.push({
                    ...childPos,
                    message: `Invalid child element <${childName}> inside <${tagName}>. Allowed children might be: ${schemaElement.children.join(', ')}.`
                  })
                }
              })
            }
          })

          resolve(errors)
        } catch (e) {
          resolve([
            { message: 'XML validation failed due to an unexpected error.', line: 1, column: 1 }
          ])
        }
      })
    }
  }
}
