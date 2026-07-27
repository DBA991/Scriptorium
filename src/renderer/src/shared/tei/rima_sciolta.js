import { Utils } from './utils'

const markVerseEnd = (line, id) => {
  const escapedLine = Utils.simpleXmlEscape(line)
  const endWord = Utils.extractEndWord(line, true, true)
  if (!endWord) return escapedLine

  const wordEscaped = Utils.simpleXmlEscape(endWord)
  const regex = new RegExp(`(${wordEscaped})([\\W_]*)$`, 'i')
  const match = escapedLine.match(regex)
  if (!match) return escapedLine

  const before = escapedLine.substring(0, match.index)
  const wordSection = match[1]
  const after = match[2]
  return `${before}<seg type="verse-end" xml:id="${id}">${wordSection}</seg>${after}`
}

export const RimaSciolta = {
  options: {
    title: 'Rima Sciolta Tagging',
    description:
      'TEI XML tagging for versi sciolti (unrhymed free verse): stanzas separated by blank lines, no fixed rhyme scheme.',
    fields: [
      { name: 'title', label: 'Poem title', type: 'text', default: '' },
      { name: 'poet', label: 'Poet name', type: 'text', default: '' },
      {
        name: 'stanza_separator',
        label: 'Stanza separator',
        type: 'dropdown',
        values: ['blank-line', 'none'],
        default: 'blank-line'
      },
      { name: 'add_stanza_id', label: 'Add xml:id to stanzas', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true },
      {
        name: 'mark_verse_end',
        label: 'Mark verse-end word (no rhyme label)',
        type: 'checkbox',
        default: false
      }
    ]
  },

  process: (inputText, opts) => {
    const { title, poet, stanza_separator, add_stanza_id, add_verse_id, mark_verse_end } = opts

    const poemId =
      (title + '-' + poet)
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'rima-sciolta'

    const rawStanzas = stanza_separator === 'none' ? [inputText] : inputText.split(/\n\s*\n+/)

    const stanzas = rawStanzas
      .map((s) =>
        s
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l)
      )
      .filter((lines) => lines.length > 0)

    if (stanzas.length === 0) return '<e>No text provided</e>'

    let output = []
    let pAttrs = [`xml:id="${poemId}"`]
    if (title) pAttrs.push(`title="${Utils.simpleXmlEscape(title)}"`)
    if (poet) pAttrs.push(`poet="${Utils.simpleXmlEscape(poet)}"`)
    output.push(`<lg type="rima-sciolta" ${pAttrs.join(' ')}>`)

    let vCounter = 1
    stanzas.forEach((lines, sIdx) => {
      const stanzaNum = sIdx + 1
      let sAttrs = ['type="stanza"']
      if (add_stanza_id) sAttrs.push(`xml:id="${poemId}-s${stanzaNum}"`)
      output.push(`\t<lg ${sAttrs.join(' ')}>`)

      lines.forEach((line) => {
        const verseId = `${poemId}-v${vCounter}`
        const markedText = mark_verse_end
          ? markVerseEnd(line, `${poemId}-w${vCounter}`)
          : Utils.simpleXmlEscape(line)

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${verseId}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${markedText}</l>`)
        vCounter++
      })

      output.push('\t</lg>')
    })

    output.push('</lg>')
    return output.join('\n')
  }
}
