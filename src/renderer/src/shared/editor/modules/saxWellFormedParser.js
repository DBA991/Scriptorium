import Sax from 'sax/lib/sax.js'

export function createSaxWellFormedParser() {
  return {
    /**
     * Valida la buona formattazione di una stringa XML usando un parser SAX.
     * @param {string} xmlContent - Il contenuto XML da validare.
     * @returns {Promise<Array<{message: string, line: number, column: number}>>}
     * Una promise che si risolve con un array di errori di formattazione.
     */
    validate(xmlContent) {
      return new Promise((resolve) => {
        const parser = Sax.parser(true, { position: true })
        const errors = []
        const errorsLimit = 50
        const stack = []

        parser.onerror = (e) => {
          if (errors.length < errorsLimit) {
            errors.push({
              message: e.message.replace(/^Error:\s*/, '').trim(),
              line: parser.line + 1,
              column: parser.column + 1
            })
          }
          parser.resume()
        }

        parser.onopentag = (node) => {
          stack.push({ name: node.name, line: parser.line + 1, column: parser.column + 1 })
        }

        parser.onclosetag = (tagName) => {
          const open = stack.pop()
          if (!open) {
            errors.push({
              message: `Chiusura imprevista di </${tagName}>`,
              line: parser.line + 1,
              column: parser.column + 1
            })
          } else if (open.name !== tagName) {
            errors.push({
              message: `Tag di apertura <${open.name}> aperto a riga ${open.line}, colonna ${open.column} non chiuso correttamente (trovato </${tagName}>)`,
              line: parser.line + 1,
              column: parser.column + 1
            })
          }
        }

        parser.onend = () => {
          while (stack.length && errors.length < errorsLimit) {
            const open = stack.pop()
            errors.push({
              message: `Manca </${open.name}> per il tag aperto qui`,
              line: open.line,
              column: open.column
            })
          }
          resolve(errors)
        }

        parser.write(xmlContent).close()
      })
    }
  }
}
