import { Utils, markRhyme } from './utils'

export const EnglishSonnet = {
  options: {
    title: 'English Sonnet Tagging',
    description: 'TEI XML tagging for English/Shakespearean sonnets',
    fields: [
      { name: 'title', label: 'Poem title', type: 'text', default: '' },
      { name: 'poet', label: 'Poet name', type: 'text', default: '' },
      { name: 'mark_rhymes', label: 'Mark end-word rhymes', type: 'checkbox', default: true },
      { name: 'add_stanza_id', label: 'Add xml:id to stanzas', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true }
    ]
  },
  process: (inputText, opts) => {
    const { title, poet, mark_rhymes, add_stanza_id, add_verse_id } = opts
    const poemId =
      (title + '-' + poet)
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'sonnet'
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l)

    if (lines.length === 0) return '<e>No text provided</e>'

    const rhymePattern = 'ABABCDCDEFEFGG'
    let output = []

    let attrs = [`xml:id="${poemId}"`]
    if (title) attrs.push(`title="${Utils.simpleXmlEscape(title)}"`)
    if (poet) attrs.push(`poet="${Utils.simpleXmlEscape(poet)}"`)
    output.push(`<lg type="sonnet" form="english" ${attrs.join(' ')}>`)

    const sections = [
      { type: 'quatrain', start: 0, end: 4, scheme: 'ABAB', id: `${poemId}-q1` },
      { type: 'quatrain', start: 4, end: 8, scheme: 'CDCD', id: `${poemId}-q2` },
      { type: 'quatrain', start: 8, end: 12, scheme: 'EFEF', id: `${poemId}-q3` },
      { type: 'couplet', start: 12, end: 14, scheme: 'GG', id: `${poemId}-c1` }
    ]

    sections.forEach((sec) => {
      if (sec.start >= lines.length) return
      const sectionVerses = lines.slice(sec.start, Math.min(sec.end, lines.length))
      if (sectionVerses.length === 0) return

      let sAttrs = [`type="${sec.type}"`]
      if (add_stanza_id) sAttrs.push(`xml:id="${sec.id}"`)
      if (mark_rhymes) sAttrs.push(`rhyme="${sec.scheme}"`)

      output.push(`\t<lg ${sAttrs.join(' ')}>`)

      sectionVerses.forEach((line, i) => {
        const verseNum = sec.start + i + 1
        const label = sec.start + i < rhymePattern.length ? rhymePattern[sec.start + i] : 'X'
        let markedText = Utils.simpleXmlEscape(line)

        if (mark_rhymes) {
          markedText = markRhyme(line, label, `${poemId}-R-${label}-${verseNum}`)
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${poemId}-v${verseNum}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${markedText}</l>`)
      })
      output.push('\t</lg>')
    })
    output.push('</lg>')
    return output.join('\n')
  }
}
