/**
 * Parses XSD content into a simplified JSON structure for validation and completion.
 * @param {string} xsdContent - The string content of the XSD file.
 * @returns {object} A schema object with globalElements.
 */
export function parseXsdSchema(xsdContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xsdContent, 'application/xml')

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Failed to parse XSD file. Check for XML errors.')
  }

  const XSD_NS = 'http://www.w3.org/2001/XMLSchema'
  const schemaRoot = doc.documentElement

  const globalElements = {}
  const complexTypes = {}
  const globalGroups = {}

  /**
   * Gets direct child elements by namespace and local name.
   * @param {Element} element - The parent element.
   * @param {string} ns - The namespace URI.
   * @param {string} localName - The local name of the tag.
   * @returns {Element[]} An array of child elements.
   */
  const getDirectChildElementsByTagNameNS = (element, ns, localName) => {
    const children = []
    for (const child of element.childNodes) {
      if (child.nodeType === 1 && child.namespaceURI === ns && child.localName === localName) {
        children.push(child)
      }
    }
    return children
  }

  /**
   * Extracts the local name from a qualified name (e.g., "xs:string" -> "string").
   * @param {string | null} qname - The qualified name.
   * @returns {string | null} The local name.
   */
  const getLocalName = (qname) => {
    if (!qname) return null
    return qname.includes(':') ? qname.split(':')[1] : qname
  }

  /**
   * Recursively parses a content model (sequence, choice, all, group) to find all possible child elements.
   * @param {Element} contentNode - The node containing the content model (e.g., <xs:sequence>).
   * @returns {string[]} A flat list of allowed child element names.
   */
  const parseContentModel = (contentNode) => {
    let children = []
    if (!contentNode) return children

    for (const child of contentNode.childNodes) {
      if (child.nodeType !== 1 || child.namespaceURI !== XSD_NS) continue

      switch (child.localName) {
        case 'element': {
          const name = getLocalName(child.getAttribute('name') || child.getAttribute('ref'))
          if (name) children.push(name)
          break
        }
        case 'group': {
          const ref = getLocalName(child.getAttribute('ref'))
          if (ref && globalGroups[ref]) {
            children = children.concat(globalGroups[ref])
          }
          break
        }
        case 'choice':
        case 'sequence':
        case 'all': {
          children = children.concat(parseContentModel(child))
          break
        }
      }
    }
    return [...new Set(children)]
  }

  /**
   * Parses attributes from a complexType or extension/restriction node.
   * @param {Element} typeElement - The element containing attribute definitions.
   * @returns {object[]} A list of attribute objects.
   */
  const parseAttributes = (typeElement) => {
    const attributes = []
    getDirectChildElementsByTagNameNS(typeElement, XSD_NS, 'attribute').forEach((attr) => {
      attributes.push({
        name: getLocalName(attr.getAttribute('name')),
        type: getLocalName(attr.getAttribute('type')),
        use: attr.getAttribute('use') || 'optional'
      })
    })
    return attributes
  }

  getDirectChildElementsByTagNameNS(schemaRoot, XSD_NS, 'group').forEach((groupEl) => {
    const name = getLocalName(groupEl.getAttribute('name'))
    if (name) {
      globalGroups[name] = parseContentModel(groupEl)
    }
  })

  getDirectChildElementsByTagNameNS(schemaRoot, XSD_NS, 'complexType').forEach((typeEl) => {
    const name = getLocalName(typeEl.getAttribute('name'))
    if (!name) return

    const contentModelContainer =
      getDirectChildElementsByTagNameNS(typeEl, XSD_NS, 'sequence')[0] ||
      getDirectChildElementsByTagNameNS(typeEl, XSD_NS, 'choice')[0] ||
      getDirectChildElementsByTagNameNS(typeEl, XSD_NS, 'all')[0]

    complexTypes[name] = {
      attributes: parseAttributes(typeEl),
      children: parseContentModel(contentModelContainer)
    }
  })

  getDirectChildElementsByTagNameNS(schemaRoot, XSD_NS, 'element').forEach((el) => {
    const name = getLocalName(el.getAttribute('name'))
    if (!name) return

    let attributes = []
    let children = []

    const typeName = getLocalName(el.getAttribute('type'))
    if (typeName && complexTypes[typeName]) {
      attributes = complexTypes[typeName].attributes
      children = complexTypes[typeName].children
    } else {
      const complexTypeInline = getDirectChildElementsByTagNameNS(el, XSD_NS, 'complexType')[0]
      if (complexTypeInline) {
        attributes = parseAttributes(complexTypeInline)

        const contentModelContainer =
          getDirectChildElementsByTagNameNS(complexTypeInline, XSD_NS, 'sequence')[0] ||
          getDirectChildElementsByTagNameNS(complexTypeInline, XSD_NS, 'choice')[0] ||
          getDirectChildElementsByTagNameNS(complexTypeInline, XSD_NS, 'all')[0]

        children = parseContentModel(contentModelContainer)
      }
    }

    globalElements[name] = { name, attributes, children }
  })

  return { globalElements }
}

/**
 * Reads a file and returns its content as a string. (This function remains unchanged)
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise that resolves with the file content.
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}
