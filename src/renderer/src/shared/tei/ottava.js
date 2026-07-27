import { Utils, markRhyme } from './utils'

const idxToLabel = (idx) => {
  const base = idx % 26
  const overflow = Math.floor(idx / 26)
  return String.fromCharCode(65 + base) + '+'.repeat(overflow)
}

const generateOttavaSchemeLabels = (stanzaIndex, stanzaSize) => {
  const baseIndex = (stanzaIndex - 1) * 3

  const labelX = idxToLabel(baseIndex)
  const labelY = idxToLabel(baseIndex + 1)
  const labelZ = idxToLabel(baseIndex + 2)

  const fullScheme = [labelX, labelY, labelX, labelY, labelX, labelY, labelZ, labelZ]

  return fullScheme.slice(0, stanzaSize)
}

export const Ottava = {
  options: {
    title: 'Ottava Rima Tagging',
    description:
      'TEI XML tagging for Ottava Rima with progressive rhyme labels per stanza (e.g., ABABABCC, DEDEDEFF), supporting A+ overflow.',
    fields: [
      { name: 'title', label: 'Poem title', type: 'text', default: '' },
      { name: 'canto', label: 'Canto/Capitolo', type: 'text', default: '' },
      { name: 'mark_rhymes', label: 'Mark end-word rhymes', type: 'checkbox', default: true },
      { name: 'add_stanza_id', label: 'Add xml:id to stanzas', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true }
    ]
  },
  process: (inputText, opts) => {
    const { title, canto, mark_rhymes, add_stanza_id, add_verse_id } = opts
    const poemId =
      (title + '-' + canto)
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'incremental-ottava'
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l)

    if (lines.length === 0) return '<e>No text provided</e>'

    const STANZA_SIZE = 8
    const numStanzas = Math.ceil(lines.length / STANZA_SIZE)
    let output = []

    let pAttrs = [`xml:id="${poemId}"`]
    if (title) pAttrs.push(`title="${Utils.simpleXmlEscape(title)}"`)
    if (canto) pAttrs.push(`canto="${Utils.simpleXmlEscape(canto)}"`)
    output.push(`<lg type="ottava-rima" ${pAttrs.join(' ')}>`)

    let vCounter = 1
    for (let s = 1; s <= numStanzas; s++) {
      const stanzaStart = (s - 1) * STANZA_SIZE
      const stanzaEnd = Math.min(s * STANZA_SIZE, lines.length)
      const stanzaLines = lines.slice(stanzaStart, stanzaEnd)
      const linesInStanza = stanzaLines.length

      if (linesInStanza === 0) continue

      const rhymeLabels = mark_rhymes
        ? generateOttavaSchemeLabels(s, linesInStanza)
        : Array(linesInStanza).fill('X')

      const currentScheme = rhymeLabels.join('')

      let sAttrs = [`type="${linesInStanza === STANZA_SIZE ? 'stanza' : 'fragment'}"`]
      if (add_stanza_id) sAttrs.push(`xml:id="${poemId}-s${s}"`)
      if (mark_rhymes) sAttrs.push(`rhyme="${currentScheme}"`)

      output.push(`\t<lg ${sAttrs.join(' ')}>`)

      stanzaLines.forEach((line, i) => {
        const label = rhymeLabels[i] || 'X'
        let markedText = Utils.simpleXmlEscape(line)

        if (mark_rhymes) {
          markedText = markRhyme(line, label, `${poemId}-R-${label}-${vCounter}`)
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${poemId}-v${vCounter}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${markedText}</l>`)

        vCounter++
      })
      output.push('\t</lg>')
    }

    output.push('</lg>')
    return output.join('\n')
  }
}
