import sax from 'sax'

/**
 * Modulo SAX per creazione vocabolario
 * SUPPORTA STRUTTURE DUALI: Metrica (lg/l) E Prosaica (div/p)
 * Con normalizzazione intelligente delle maiuscole iniziali di frase
 * ENHANCED: Cattura anche apostrofi isolati per analisi metrica (es. Dante)
 */
class SaxParserVocabulary {
  constructor() {
    this.progressCallback = null
  }

  /**
   * Imposta callback per progress tracking
   * @param {Function} callback - Funzione chiamata con (progress, message)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback
  }

  /**
   * Emette evento di progresso
   */
  emitProgress(progress, message) {
    if (this.progressCallback) {
      this.progressCallback(progress, message)
    }
  }

  /**
   * Verifica se un local name (con eventuale prefisso namespace, es. "tei:teiHeader")
   * corrisponde al tag indicato, confrontando solo la parte dopo i due punti.
   * @private
   */
  matchesLocalName(nodeName, localName) {
    const n = String(nodeName || '').toLowerCase()
    const target = localName.toLowerCase()
    return n === target || n.endsWith(`:${target}`)
  }

  /**
   * Mappa tag TEI a type
   */
  getTeiElementType(tagName) {
    const typeMap = {
      persName: 'person',
      placeName: 'place',
      orgName: 'organization',
      name: 'name',
      title: 'title',
      date: 'date',
      rs: 'reference'
    }
    return typeMap[tagName] || null
  }

  /**
   * Verifica se un type indica un'entità che richiede maiuscola
   */
  isCapitalizedEntityType(type) {
    const capitalizedTypes = ['person', 'place', 'organization', 'title', 'name']
    return capitalizedTypes.includes(type)
  }

  /**
   * Crea vocabolario JSON da file XML
   * @param {Array} xmlFiles - Array di {path, name, content}
   * @param {Object} options - Opzioni {caseSensitive, minLength, excludeNumbers, excludePunctuation, sortBy, language}
   * @returns {Promise<Object>} Vocabolario formato specificato
   */
  async createVocabulary(xmlFiles, options = {}) {
    const {
      caseSensitive = false,
      minLength = 3,
      excludeNumbers = true,
      excludePunctuation = true,
      sortBy = 'alphabetical',
      language = 'romance'
    } = options

    this.emitProgress(0, 'Inizializzazione vocabolario...')

    const vocabulary = new Map()
    const totalFiles = xmlFiles.length
    let processedFiles = 0

    for (const file of xmlFiles) {
      this.emitProgress(
        Math.round((processedFiles / totalFiles) * 70),
        `Estrazione parole da ${file.name}...`
      )

      await this.parseFileForVocabulary(file, vocabulary, {
        caseSensitive,
        minLength,
        excludeNumbers,
        excludePunctuation,
        language
      })

      processedFiles++
    }

    this.emitProgress(80, 'Ordinamento vocabolario...')

    // Converti Map in oggetto ordinato
    let entries = Array.from(vocabulary.entries())

    if (sortBy === 'frequency') {
      entries.sort((a, b) => b[1].occurrences.length - a[1].occurrences.length)
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]))
    }

    const result = {}
    entries.forEach(([word, data]) => {
      result[word] = data
    })

    this.emitProgress(100, 'Vocabolario completato!')

    return result
  }

  /**
   * Parsa file analizzando linearmente parola per parola
   * SUPPORTA STRUTTURE DUALI: lg/l (metrica) E div/p (prosa)
   * @private
   */
  async parseFileForVocabulary(file, vocabulary, options) {
    return new Promise((resolve, reject) => {
      const parser = sax.parser(true, {
        trim: false,
        normalize: false
      })

      // === STATO DUALE: Metriche E Prosa ===
      let currentGroup = null
      let contextStack = []
      let currentType = 'word'
      let lastTextInUnit = '' // Traccia l'ultimo testo processato nell'unità corrente

      // === ESCLUSIONE teiHeader ===
      // Contatore di profondità (non booleano) cosi' l'esclusione regge anche
      // se il teiHeader, per errori di codifica, non e' perfettamente bilanciato.
      let teiHeaderDepth = 0

      // === COORDINATE (ancore) PER OGNI PAROLA DEL BODY ===
      // Ogni parola del body deve avere SEMPRE una coordinata di posizione,
      // per due scopi: (1) permettere al component di ritrovare l'occorrenza
      // nel documento, (2) supportare l'analisi dei dati (raggruppamenti per
      // unita' testuale). La gerarchia, dalla piu' alla meno specifica, e':
      //   1. xml:id/id dell'elemento piu' vicino che lo dichiara (qualunque
      //      tag esso sia: <l>, <p>, <div>, <seg>, ecc. - non solo l/p)
      //   2. se l'elemento e' <l>/<p> senza xml:id/id, il numero di riga in
      //      cui il tag si apre (comportamento gia' esistente per l/p)
      //   3. altrimenti, per qualunque altro testo nel body (fuori da l/p e
      //      senza id sopra di se'), il numero di riga corrente come fallback
      //      generico di posizione nel documento.
      // Usiamo uno STACK di ancore (non un singolo valore) perche' un id piu'
      // interno deve prevalere finche' siamo dentro quell'elemento, per poi
      // tornare all'ancora del livello superiore quando si chiude (es. un
      // <seg xml:id="..."> dentro un <p> senza id: dentro il seg vince il suo
      // id, appena il seg si chiude si torna alla coordinata del <p>).
      let anchorStack = []

      const metricClusterTypes = ['canto', 'terza-rima', 'sonnet', 'sestina', 'ottava-rima']

      // Ancora attualmente attiva: cima dello stack, o null se siamo fuori
      // dal body (teiHeader, o prima/dopo il body stesso).
      const currentAnchor = () =>
        anchorStack.length > 0 ? anchorStack[anchorStack.length - 1] : null

      parser.onopentag = (node) => {
        // === TRACKING teiHeader (va per primo: esclude a monte tutto il resto) ===
        if (this.matchesLocalName(node.name, 'teiHeader')) {
          teiHeaderDepth++
        }

        // === IDENTIFICAZIONE GRUPPI ===
        if (node.name === 'lg' && metricClusterTypes.includes(node.attributes.type)) {
          currentGroup = node.attributes['xml:id'] || node.attributes.id
        } else if (node.name === 'div') {
          currentGroup =
            node.attributes['xml:id'] ||
            node.attributes.id ||
            `div-${node.attributes.type || 'unknown'}`
        }

        const explicitId = node.attributes['xml:id'] || node.attributes.id || null

        if (explicitId) {
          // Tag con xml:id/id: livello univoco
          anchorStack.push({ value: explicitId, kind: 'xml', sourceTag: node.name })
        } else {
          // Nessun xml:id: eredita l'ancora del padre
          const inherited = currentAnchor()
          anchorStack.push(
            inherited ? { ...inherited } : { value: null, kind: 'xml', sourceTag: node.name }
          )
        }

        // === DETERMINAZIONE TYPE PER PAROLE ===
        let newType = null

        if (node.name === 'seg' && node.attributes.type) {
          newType = node.attributes.type
        } else {
          newType = this.getTeiElementType(node.name)
        }

        if (newType) {
          contextStack.push(newType)
          currentType = newType
        } else {
          contextStack.push(null)
        }
      }

      parser.ontext = (text) => {
        // ESCLUSIONE teiHeader: nessun testo del teiHeader entra nel vocabolario.
        if (teiHeaderDepth > 0) return
        if (!text.trim()) return

        const anchor = currentAnchor()
        // Fuori dal body (testo prima/dopo <text>, o whitespace di impaginazione
        // XML tra i tag radice) non abbiamo alcuna ancora sullo stack: non c'e'
        // nulla da registrare, non essendoci un contenitore del body attivo.
        if (!anchor) return

        this.processWords(
          text,
          vocabulary,
          options,
          file.name,
          currentGroup,
          anchor.value,
          currentType,
          lastTextInUnit
        )
        // Aggiorna il contesto di testo precedente
        lastTextInUnit += text
      }

      parser.onclosetag = (tagName) => {
        // === TRACKING teiHeader: decremento simmetrico all'apertura. Math.max
        // a 0 e' una difesa contro markup irregolare (chiusura senza apertura
        // corrispondente), per evitare che il contatore vada negativo e falsi
        // lo stato per il resto del documento.
        if (this.matchesLocalName(tagName, 'teiHeader')) {
          teiHeaderDepth = Math.max(0, teiHeaderDepth - 1)
        }

        // Rimuovi l'ancora di questo elemento: si torna all'ancora del padre,
        // rispettando la gerarchia (es. usciti da un <seg xml:id> dentro un
        // <p>, si torna a riportare la coordinata del <p>).
        anchorStack.pop()

        // Rimuovi dal contesto stack
        contextStack.pop()

        // Aggiorna currentType
        if (contextStack.length > 0) {
          for (let i = contextStack.length - 1; i >= 0; i--) {
            if (contextStack[i] !== null) {
              currentType = contextStack[i]
              return
            }
          }
        }
        currentType = 'word'

        // Reset unità (manteniamo il reset di lastTextInUnit alla chiusura di
        // l/p, coerente con l'originale: il testo precedente non deve
        // "sconfinare" nel confronto per la normalizzazione maiuscole).
        if (tagName === 'l' || tagName === 'p') {
          lastTextInUnit = ''
        }

        // Reset gruppo
        if (tagName === 'lg' || tagName === 'div') {
          currentGroup = null
        }
      }

      parser.onerror = (error) => {
        console.error(`Errore parsing ${file.name}:`, error)
        reject(error)
      }

      parser.onend = () => {
        resolve()
      }

      try {
        parser.write(file.content).close()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Processa parole dal testo con il type corrente
   * Gestisce normalizzazione maiuscole iniziali di frase
   * ENHANCED: Cattura anche apostrofi isolati
   * @private
   */
  processWords(text, vocabulary, options, fileName, group, position, type, previousText) {
    const {
      caseSensitive,
      minLength,
      excludeNumbers,
      excludePunctuation,
      language = 'romance'
    } = options

    // Caratteri speciali apostrofi
    const specialChars = "''\u2019`"
    const charClass = `[${specialChars}]`

    // Segni di punteggiatura che indicano fine frase
    const sentenceEndMarkers = /[.!?;:]\s*$/

    let wordRegex
    if (language === 'saxon') {
      // Saxon: cattura parole + apostrofi isolati
      wordRegex = new RegExp(`[\\p{L}\\p{M}]+(?:${charClass}[\\p{L}\\p{M}]+)*|${charClass}`, 'gu')
    } else {
      // Romance: cattura parole con apostrofi + apostrofi isolati
      wordRegex = new RegExp(`(?:${charClass}?[\\p{L}\\p{M}]+${charClass}?)|(?:${charClass})`, 'gu')
    }

    // Verifica se il testo corrente inizia dopo punteggiatura
    const textStartsAfterPunctuation =
      previousText.length === 0 || sentenceEndMarkers.test(previousText)

    let match
    let isFirstWordInText = true

    while ((match = wordRegex.exec(text)) !== null) {
      let word = match[0]

      // === GESTIONE APOSTROFI ISOLATI ===
      const onlySpecialCharsRegex = new RegExp(`^${charClass}+$`)
      const isIsolatedApostrophe = onlySpecialCharsRegex.test(word)

      if (isIsolatedApostrophe) {
        // Se è un apostrofo isolato, lo processiamo come token speciale
        // Non applichiamo filtri di lunghezza o punteggiatura
        const normalizedWord = caseSensitive ? word : word.toLowerCase()

        const occurrence = {
          file: fileName,
          group: group,
          position: position || null,
          type: 'metric-symbol',
          startPhrase: false
        }

        if (vocabulary.has(normalizedWord)) {
          const data = vocabulary.get(normalizedWord)
          data.occurrences.push(occurrence)
        } else {
          vocabulary.set(normalizedWord, {
            occurrences: [occurrence],
            correlated: [],
            meanings: [],
            translations: []
          })
        }

        isFirstWordInText = false
        continue // Passa alla prossima iterazione
      }

      // === GESTIONE PAROLE NORMALI ===
      // Applica filtri
      if (excludePunctuation) {
        const cleanRegex = new RegExp(`[^\\p{L}\\p{M}${specialChars}]`, 'gu')
        word = word.replace(cleanRegex, '')
      }

      // Skip se vuoto dopo pulizia
      if (!word) continue

      // Applica filtro lunghezza minima
      if (word.length < minLength) continue

      // Escludi se contiene numeri
      if (excludeNumbers && /\d/.test(word)) continue

      // === LOGICA DI NORMALIZZAZIONE MAIUSCOLE ===
      let normalizedWord = word
      let isStartOfPhrase = false

      // Verifica se è la prima parola di questo blocco di testo E segue punteggiatura
      if (isFirstWordInText && textStartsAfterPunctuation) {
        const startsWithCapital = /^\p{Lu}/u.test(word)

        if (startsWithCapital && !this.isCapitalizedEntityType(type)) {
          // Normalizza a minuscolo
          normalizedWord = word.charAt(0).toLowerCase() + word.slice(1)
          isStartOfPhrase = true
        }
      }

      // Applica case sensitivity generale
      if (!caseSensitive) {
        normalizedWord = normalizedWord.toLowerCase()
      }

      // Aggiungi al vocabolario
      const occurrence = {
        file: fileName,
        group: group,
        position: position || null, // Niente più fallback su lineNumber
        type: type, // ('metric-symbol' nel blocco per l'apostrofo)
        startPhrase: isStartOfPhrase
      }

      if (vocabulary.has(normalizedWord)) {
        const data = vocabulary.get(normalizedWord)
        data.occurrences.push(occurrence)
      } else {
        vocabulary.set(normalizedWord, {
          occurrences: [occurrence],
          correlated: [],
          meanings: [],
          translations: []
        })
      }

      isFirstWordInText = false
    }
  }

  /**
   * Ottiene statistiche da vocabolario
   * @param {Object} vocabulary - Vocabolario
   * @returns {Object} Statistiche
   */
  getVocabularyStats(vocabulary) {
    const words = Object.keys(vocabulary)
    const totalOccurrences = words.reduce(
      (sum, word) => sum + vocabulary[word].occurrences.length,
      0
    )

    // Conta simboli metrici separatamente
    const metricSymbols = words.filter((word) => {
      const firstOccurrence = vocabulary[word].occurrences[0]
      return firstOccurrence && firstOccurrence.type === 'metric-symbol'
    })

    return {
      totalWords: totalOccurrences,
      uniqueWords: words.length,
      totalOccurrences: totalOccurrences,
      averageOccurrences: words.length > 0 ? totalOccurrences / words.length : 0,
      metricSymbols: metricSymbols.length,
      metricSymbolsList: metricSymbols
    }
  }
}

// Esporta singleton
export default new SaxParserVocabulary()
