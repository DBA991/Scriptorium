import { Utils } from '../../../shared/tei/utils'

const ELEMENT_TYPE_MAP = {
  persName: 'person',
  person: 'person',
  placeName: 'place',
  place: 'place',
  orgName: 'organization',
  org: 'organization',
  name: 'name',
  title: 'title',
  date: 'date',
  rs: 'reference',
  term: 'term',
  bibl: 'bibliography',
  q: 'quote',
  quote: 'quote',
  note: 'note',
  corr: 'correction',
  ref: 'link',
  reg: 'regularization',
  orig: 'original',
  sic: 'sic',
  add: 'addition',
  del: 'deletion',
  supplied: 'supplied',
  unclear: 'unclear',
  damage: 'damage',
  gap: 'gap'
}

const VERSE_ELEMENT = 'l'
const PARAGRAPH_ELEMENT = 'p'
const STANZA_ELEMENT = 'lg'
const DIV_ELEMENT = 'div'
const SENTENCE_END_RE = /[.!?;]+\s*$/

function localNameOf(el) {
  if (el.localName) return el.localName
  return (el.tagName || '').toLowerCase()
}

function isTeiHeader(localName) {
  const n = String(localName || '').toLowerCase()
  return n === 'teiheader' || n.endsWith(':teiheader')
}

const APOSTROPHES = "''\u2019`"
const APOSTROPHE_CLASS = `[${APOSTROPHES}]`

function buildWordRegex(language) {
  if (language === 'saxon') {
    return new RegExp(`[\\p{L}\\p{M}]+(?:${APOSTROPHE_CLASS}[\\p{L}\\p{M}]+)*`, 'gu')
  }
  return new RegExp(`(?:${APOSTROPHE_CLASS}?[\\p{L}\\p{M}]+${APOSTROPHE_CLASS}?)`, 'gu')
}

function buildCleanRegex() {
  return new RegExp(`[^\\p{L}\\p{M}${APOSTROPHES}]`, 'gu')
}

function estimateSyllables(text) {
  if (!text) return 0
  const matches = text.toLowerCase().match(/[aeiouàèéìòóùâêîôûäëïöü]+/g)
  return matches ? matches.length : 0
}

function normalizeForStopword(word) {
  if (!word) return ''
  let w = String(word).toLowerCase()
  w = w
    .replace(/[àáâäæãåā]/g, 'a')
    .replace(/[èéêëēėę]/g, 'e')
    .replace(/[ìíîïī]/g, 'i')
    .replace(/[òóôöøō]/g, 'o')
    .replace(/[ùúûüū]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
  w = w.replace(/[''`’]/g, '')
  return w.trim()
}

function parseXml(xmlString) {
  const parser = new DOMParser()
  let doc = parser.parseFromString(xmlString, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    doc = parser.parseFromString(`<div>${xmlString}</div>`, 'text/html')
  }
  return doc
}

function walkDom(node, ctx) {
  const root = node.documentElement || node.body || node
  walkElement(root, ctx)
}

function walkElement(el, ctx) {
  if (!el || el.nodeType !== 1) return

  const localName = localNameOf(el)

  if (isTeiHeader(localName)) return
  const isMetric = localName === STANZA_ELEMENT

  ctx.elementCount++
  ctx.tagCounts.set(localName, (ctx.tagCounts.get(localName) || 0) + 1)
  if (el.attributes) {
    for (const attr of el.attributes) {
      ctx.attributeCount++
      const aName = attr.name
      ctx.attributeCounts.set(aName, (ctx.attributeCounts.get(aName) || 0) + 1)
    }
  }

  const openedUnit = openTextUnit(localName, el, ctx)

  let pushedType = null
  let newType = null
  if (localName === 'seg' && el.getAttribute('type')) {
    newType = el.getAttribute('type')
  } else if (ELEMENT_TYPE_MAP[localName]) {
    newType = ELEMENT_TYPE_MAP[localName]
  }
  if (newType) {
    ctx.typeStack.push(newType)
    pushedType = newType
  } else {
    ctx.typeStack.push(null)
  }

  const captureEntity = !!ELEMENT_TYPE_MAP[localName]
  let entityBuffer = null
  if (captureEntity) {
    entityBuffer = {
      type: ELEMENT_TYPE_MAP[localName],
      element: localName,
      attributes: collectAttributes(el),
      text: ''
    }
    ctx.entityStack.push(entityBuffer)
  }

  let lastText = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === 3) {
      const text = child.nodeValue || ''
      if (text.trim()) {
        processText(text, ctx, lastText)
        if (entityBuffer) entityBuffer.text += text
        lastText = text
      }
    } else if (child.nodeType === 1) {
      walkElement(child, ctx)
    }
  }

  if (captureEntity && ctx.entityStack.length > 0) {
    const ent = ctx.entityStack.pop()
    registerEntity(ent, ctx)
  }

  if (openedUnit) closeTextUnit(localName, ctx)

  ctx.typeStack.pop()
}

function collectAttributes(el) {
  const out = {}
  if (el.attributes) {
    for (const attr of el.attributes) out[attr.name] = attr.value
  }
  return out
}

function openTextUnit(localName, el, ctx) {
  if (localName === VERSE_ELEMENT) {
    ctx.verseCount++
    ctx.currentUnit = { type: 'verse', words: 0, syllables: 0, text: '' }
    ctx.unitStack.push(ctx.currentUnit)
    return true
  }
  if (localName === PARAGRAPH_ELEMENT) {
    ctx.paragraphCount++
    ctx.currentUnit = { type: 'paragraph', words: 0, text: '' }
    ctx.unitStack.push(ctx.currentUnit)
    return true
  }
  if (localName === STANZA_ELEMENT) {
    ctx.stanzaCount++
  }
  if (localName === DIV_ELEMENT) {
    ctx.divCount++
  }
  return false
}

function closeTextUnit(localName, ctx) {
  if (localName === VERSE_ELEMENT || localName === PARAGRAPH_ELEMENT) {
    const unit = ctx.unitStack.pop()
    if (unit) {
      if (unit.type === 'verse') {
        ctx.verseLengths.push(unit.words)
        ctx.verseSyllables.push(unit.syllables || estimateSyllables(unit.text))
      }
      ctx.currentUnit = ctx.unitStack[ctx.unitStack.length - 1] || null
    }
  }
}

function processText(text, ctx, previousText) {
  const opts = ctx.options
  const regex = ctx.wordRegex

  const textStartsAfterSentenceEnd = previousText.length === 0 || SENTENCE_END_RE.test(previousText)

  let match
  let isFirstInBlock = true
  while ((match = regex.exec(text)) !== null) {
    let word = match[0]
    if (!word) continue

    if (opts.excludePunctuation) {
      word = word.replace(ctx.cleanRegex, '')
    }
    if (!word) {
      isFirstInBlock = false
      continue
    }
    if (opts.excludeNumbers && /\d/.test(word)) {
      isFirstInBlock = false
      continue
    }
    if (word.length < opts.minLength) {
      isFirstInBlock = false
      continue
    }

    let normalized = word
    if (isFirstInBlock && textStartsAfterSentenceEnd) {
      const startsCapital = /^\p{Lu}/u.test(word)
      const currentType = topNonNull(ctx.typeStack)
      const isCapitalizedEntity =
        currentType && ['person', 'place', 'organization', 'title', 'name'].includes(currentType)
      if (startsCapital && !isCapitalizedEntity) {
        normalized = word.charAt(0).toLowerCase() + word.slice(1)
      }
    }
    if (!opts.caseSensitive) {
      normalized = normalized.toLowerCase()
    }

    ctx.contentChars += word.length

    ctx.totalTokens++
    ctx.wordLengthSum += normalized.length
    const prev = ctx.wordCounts.get(normalized)
    if (prev) prev.push(currentUnitRef(ctx))
    else ctx.wordCounts.set(normalized, [currentUnitRef(ctx)])

    if (ctx.currentUnit) {
      ctx.currentUnit.words++
      if (ctx.currentUnit.type === 'verse') {
        ctx.currentUnit.syllables = (ctx.currentUnit.syllables || 0) + estimateSyllables(normalized)
        ctx.currentUnit.text += (ctx.currentUnit.text ? ' ' : '') + normalized
      }
    }

    if (textStartsAfterSentenceEnd && isFirstInBlock) {
      ctx.sentenceCount++
    }

    isFirstInBlock = false
  }

  if (SENTENCE_END_RE.test(text)) {
  }
}

function currentUnitRef(ctx) {
  if (!ctx.currentUnit) return null
  return { unitType: ctx.currentUnit.type }
}

function topNonNull(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]) return stack[i]
  }
  return null
}

function registerEntity(ent, ctx) {
  const termText = (ent.text || '').replace(/\s+/g, ' ').trim()
  if (!termText) return

  let id = null
  const a = ent.attributes
  if (a.ref) {
    id = a.ref.replace(/^#/, '')
  } else if (a['xml:id'] || a.id) {
    id = a['xml:id'] || a.id
  } else if (ent.element === 'date' && a.when) {
    id = `date_${a.when}`
  } else if (ent.element === 'bibl' && (a['xml:id'] || a.n)) {
    id = a['xml:id'] || `bibl_${a.n}`
  } else {
    const norm = termText
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    id = `${ent.type}_${norm}`
  }

  const bucket = ctx.entities[ent.type] || (ctx.entities[ent.type] = new Map())
  if (bucket.has(id)) {
    const e = bucket.get(id)
    e.count++
  } else {
    bucket.set(id, { id, term: termText, type: ent.type, count: 1 })
  }
}

function buildNgrams(sequence, n, stopwordSet) {
  const map = new Map()
  for (let i = 0; i + n <= sequence.length; i++) {
    const gram = sequence.slice(i, i + n)
    if (stopwordSet && stopwordSet.size > 0) {
      const allStop = gram.every((w) => stopwordSet.has(normalizeForStopword(w)))
      if (allStop) continue
    }
    const key = gram.join(' ')
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

/**
 * Analizza una stringa XML e restituisce tutte le metriche filologiche.
 * @param {string} xmlString - Il documento XML (tipicamente xmlStore.xmlContent)
 * @param {Object} options - { caseSensitive, minLength, excludeNumbers,
 *   excludePunctuation, language ('romance'|'saxon'), topN, stopwordSet (Set),
 *   ngramsEnabled }
 * @returns {Object} Risultato strutturato (overview, topWords, hapax,
 *   ngrams, tagStats, entities, distributions)
 */
export function analyzeXml(xmlString, options = {}) {
  const opts = {
    caseSensitive: false,
    minLength: 2,
    excludeNumbers: true,
    excludePunctuation: true,
    language: 'romance',
    topN: 25,
    stopwordSet: new Set(),
    ngramsEnabled: true,
    ...options
  }

  const ctx = {
    options: opts,
    wordRegex: buildWordRegex(opts.language),
    cleanRegex: buildCleanRegex(),

    elementCount: 0,
    attributeCount: 0,
    tagCounts: new Map(),
    attributeCounts: new Map(),

    contentChars: 0,
    totalTokens: 0,
    wordLengthSum: 0,
    wordCounts: new Map(),
    wordSequence: [],
    sentenceCount: 0,

    verseCount: 0,
    paragraphCount: 0,
    stanzaCount: 0,
    divCount: 0,
    verseLengths: [],
    verseSyllables: [],

    typeStack: [],
    entityStack: [],
    unitStack: [],
    currentUnit: null,

    entities: {}
  }

  const origProcess = processText
  const sequence = ctx.wordSequence

  let totalChars = 0
  let markupChars = 0
  try {
    if (xmlString && xmlString.trim()) {
      totalChars = xmlString.length
      const doc = parseXml(xmlString)
      walkDom(doc, ctx)

      const fullText = (doc.documentElement || doc.body || doc).textContent || ''
      markupChars = Math.max(0, totalChars - fullText.replace(/\s+/g, '').length)
      ctx.contentChars = fullText.replace(/\s+/g, '').length
    }
  } catch (e) {
    console.error('Speculum analyzeXml error:', e)
  }

  void origProcess

  const wordEntries = Array.from(ctx.wordCounts.entries())
  const uniqueWords = wordEntries.length
  const totalOccurrences = wordEntries.reduce((s, [, refs]) => s + refs.length, 0)

  const stopwordSet = opts.stopwordSet || new Set()
  const contentWords = []
  let contentOccurrences = 0
  let stopOccurrences = 0
  for (const [word, refs] of wordEntries) {
    const count = refs.length
    const isStop = stopwordSet.has(normalizeForStopword(word))
    contentWords.push({ word, count, isStop })
    if (isStop) stopOccurrences += count
    else contentOccurrences += count
  }

  const topWords = contentWords
    .filter((w) => !w.isStop)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, opts.topN)

  const topStopwords = contentWords
    .filter((w) => w.isStop)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, Math.min(opts.topN, 20))

  const hapax = contentWords
    .filter((w) => !w.isStop && w.count === 1)
    .map((w) => w.word)
    .sort((a, b) => a.localeCompare(b))

  let bigrams = []
  let trigrams = []
  if (opts.ngramsEnabled) {
    const sequence = extractOrderedSequence(xmlString, opts, stopwordSet)
    bigrams = topFromMap(buildNgrams(sequence, 2, stopwordSet), opts.topN)
    trigrams = topFromMap(buildNgrams(sequence, 3, stopwordSet), opts.topN)
  }

  const tagStats = topFromMap(ctx.tagCounts, opts.topN)
  const attributeStats = topFromMap(ctx.attributeCounts, opts.topN)

  const entities = {}
  for (const [type, map] of Object.entries(ctx.entities)) {
    entities[type] = Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.term.localeCompare(b.term)
    )
  }

  const distributions = {
    verseWords: ctx.verseLengths.slice(),
    verseSyllables: ctx.verseSyllables.slice(),
    wordLength: buildWordLengthHistogram(contentWords.map((w) => w.word)),
    contentVsMarkup: {
      content: ctx.contentChars,
      markup: markupChars,
      total: totalChars
    }
  }

  const overview = {
    characters: totalChars,
    contentChars: ctx.contentChars,
    markupChars,
    contentRatio: totalChars > 0 ? ctx.contentChars / totalChars : 0,
    markupRatio: totalChars > 0 ? markupChars / totalChars : 0,
    elements: ctx.elementCount,
    attributes: ctx.attributeCount,
    verses: ctx.verseCount,
    paragraphs: ctx.paragraphCount,
    stanzas: ctx.stanzaCount,
    divs: ctx.divCount,
    sentences: Math.max(ctx.sentenceCount, 0),
    tokens: totalOccurrences,
    types: uniqueWords,
    ttr: totalOccurrences > 0 ? uniqueWords / totalOccurrences : 0,
    averageWordLength: totalOccurrences > 0 ? ctx.wordLengthSum / totalOccurrences : 0,
    hapaxCount: hapax.length,
    hapaxRatio: uniqueWords > 0 ? hapax.length / uniqueWords : 0,
    contentWordOccurrences: contentOccurrences,
    stopwordOccurrences: stopOccurrences,
    contentWordRatio: totalOccurrences > 0 ? contentOccurrences / totalOccurrences : 0
  }

  return {
    overview,
    topWords,
    topStopwords,
    hapax,
    bigrams,
    trigrams,
    tagStats,
    attributeStats,
    entities,
    distributions,
    meta: {
      ok: !!(xmlString && xmlString.trim()),
      options: { ...opts, stopwordSetSize: stopwordSet.size }
    }
  }
}

function extractOrderedSequence(xmlString, opts, stopwordSet) {
  const sequence = []
  if (!xmlString || !xmlString.trim()) return sequence
  let doc
  try {
    doc = parseXml(xmlString)
  } catch {
    return sequence
  }
  const root = doc.documentElement || doc.body || doc

  const regex = buildWordRegex(opts.language)
  const cleanRegex = buildCleanRegex()

  const visit = (el) => {
    if (!el || el.nodeType !== 1) return
    const ln = localNameOf(el)
    if (isTeiHeader(ln)) return
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i]
      if (child.nodeType === 3) {
        const text = child.nodeValue || ''
        if (!text.trim()) continue
        let m
        regex.lastIndex = 0
        while ((m = regex.exec(text)) !== null) {
          let word = m[0]
          if (!word) continue
          if (opts.excludePunctuation) word = word.replace(cleanRegex, '')
          if (!word) continue
          if (opts.excludeNumbers && /\d/.test(word)) continue
          if (word.length < opts.minLength) continue
          if (!opts.caseSensitive) word = word.toLowerCase()
          if (stopwordSet && stopwordSet.size && stopwordSet.has(normalizeForStopword(word)))
            continue
          sequence.push(word)
        }
      } else if (child.nodeType === 1) {
        visit(child)
      }
    }
  }
  visit(root)
  return sequence
}

function topFromMap(map, n) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n)
}

function buildWordLengthHistogram(words) {
  const buckets = new Map()
  for (const w of words) {
    const len = w.length
    buckets.set(len, (buckets.get(len) || 0) + 1)
  }
  return Array.from(buckets.entries())
    .map(([length, count]) => ({ length, count }))
    .sort((a, b) => a.length - b.length)
}

export { estimateSyllables, normalizeForStopword }
