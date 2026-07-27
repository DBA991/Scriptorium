function resolveSnippetLength(insertText) {
  return insertText.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\d+/g, '').length
}

export function registerXsdCompletion(monaco, editor, xsdData) {
  const cleanupCommandId = editor.addCommand(
    0,
    (_accessor, wordStartLineNumber, wordStartColumn, resolvedLength) => {
      const model = editor.getModel()
      if (!model) return

      const edits = []

      const afterColumn = wordStartColumn + resolvedLength
      const afterRange = {
        startLineNumber: wordStartLineNumber,
        startColumn: afterColumn,
        endLineNumber: wordStartLineNumber,
        endColumn: afterColumn + 1
      }
      if (model.getValueInRange(afterRange) === '>') {
        edits.push({ range: afterRange, text: '' })
      }

      const beforeChar = model.getValueInRange({
        startLineNumber: wordStartLineNumber,
        startColumn: wordStartColumn - 1,
        endLineNumber: wordStartLineNumber,
        endColumn: wordStartColumn
      })

      if (beforeChar === '<') {
        edits.push({
          range: {
            startLineNumber: wordStartLineNumber,
            startColumn: wordStartColumn - 1,
            endLineNumber: wordStartLineNumber,
            endColumn: wordStartColumn
          },
          text: ''
        })
      } else if (beforeChar === '/') {
        const lineContent = model.getLineContent(wordStartLineNumber)
        const textBeforeSlash = lineContent.slice(0, wordStartColumn - 2)
        const ltIndex = textBeforeSlash.lastIndexOf('<')
        const deleteFromColumn = ltIndex !== -1 ? ltIndex + 1 : wordStartColumn - 1
        edits.push({
          range: {
            startLineNumber: wordStartLineNumber,
            startColumn: deleteFromColumn,
            endLineNumber: wordStartLineNumber,
            endColumn: wordStartColumn
          },
          text: ''
        })
      }

      if (edits.length) {
        model.pushEditOperations([], edits, () => null)
      }
    }
  )

  return monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<', ' ', ':', '/'],
    provideCompletionItems: (model, position) => {
      const textUntilCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const wordStartColumn = model.getWordUntilPosition(position).startColumn

      const suggestions = []

      for (const tagName in xsdData.globalElements) {
        const element = xsdData.globalElements[tagName]
        const requiredAttrs = element.attributes?.filter((a) => a.use === 'required') || []
        let i = 1

        const insertText = `<${tagName}${
          requiredAttrs.length > 0
            ? ' ' + requiredAttrs.map((attr) => `${attr.name}="\${${i++}:${attr.name}}"`).join(' ')
            : ''
        }>$0</${tagName}>`

        suggestions.push({
          label: tagName,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: `TEI element: <${tagName}>`,
          command: {
            id: cleanupCommandId,
            title: 'Rimuovi caratteri superflui',
            arguments: [position.lineNumber, wordStartColumn, resolveSnippetLength(insertText)]
          }
        })

        const namespacedInsertText = `<tei:${tagName}${
          requiredAttrs.length > 0
            ? ' ' + requiredAttrs.map((attr) => `${attr.name}="\${${i++}:${attr.name}}"`).join(' ')
            : ''
        }>$0</tei:${tagName}>`

        suggestions.push({
          label: `tei:${tagName}`,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: namespacedInsertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: `TEI element with namespace: <tei:${tagName}>`,
          command: {
            id: cleanupCommandId,
            title: 'Rimuovi caratteri superflui',
            arguments: [
              position.lineNumber,
              wordStartColumn,
              resolveSnippetLength(namespacedInsertText)
            ]
          }
        })
      }

      const tagMatch = textUntilCursor.match(/<(\w+:)?(\w+)([^<>]*)?$/)
      if (tagMatch) {
        const tagName = tagMatch[2]
        const element = xsdData.globalElements[tagName]

        if (element?.attributes) {
          element.attributes.forEach((attr) => {
            suggestions.push({
              label: `${attr.name}${attr.use === 'required' ? ' (required)' : ''}`,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: `${attr.name}="$0"`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: `Type: ${attr.type || 'string'}`
            })
          })
        }
      }

      const parentTagMatch = textUntilCursor.match(/<(\w+:)?(\w+)[^>]*>[^<]*$/)
      if (parentTagMatch) {
        const parentTag = parentTagMatch[2]
        const element = xsdData.globalElements[parentTag]

        if (element?.children) {
          element.children.forEach((childName) => {
            if (childName) {
              suggestions.push({
                label: childName,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: `<${childName}>$0</${childName}>`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: `Child element of <${parentTag}>`
              })

              suggestions.push({
                label: `tei:${childName}`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: `<tei:${childName}>$0</tei:${childName}>`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: `Child element of <tei:${parentTag}>`
              })
            }
          })
        }
      }

      return { suggestions }
    }
  })
}
