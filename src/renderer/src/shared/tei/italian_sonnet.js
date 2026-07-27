import { Utils, markRhyme } from './utils'

export const ItalianSonnet = {
  options: {
    title: 'Italian Sonnet Tagging',
    description: 'TEI XML tagging for Italian/Petrarchan sonnets',
    fields: [
      { name: 'title', label: 'Poem title', type: 'text', default: '' },
      { name: 'poet', label: 'Poet name', type: 'text', default: '' },
      { name: 'mark_rhymes', label: 'Mark end-word rhymes', type: 'checkbox', default: true },
      {
        name: 'add_stanza_id',
        label: 'Add xml:id to quartets/tercets',
        type: 'checkbox',
        default: true
      },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true },
      {
        name: 'sestet_scheme',
        label: 'Sestet rhyme scheme',
        type: 'dropdown',
        values: ['auto', 'CDECDE', 'CDCDCD', 'CDECED', 'CDEEDC'],
        default: 'auto'
      }
    ]
  },
  process: (inputText, opts) => {
    const { title, poet, mark_rhymes, add_stanza_id, add_verse_id, sestet_scheme } = opts
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

    let scheme = sestet_scheme
    if (scheme === 'auto') {
      if (lines.length >= 14) {
        const sestetLines = lines.slice(8, 14)
        const endWords = sestetLines.map((l) => Utils.extractEndWord(l, true, true))

        if (endWords.length === 6) {
          const rhymeKeys = endWords.map((w) => (w.length > 3 ? w.slice(-3) : w))
          const rhymeMap = {}
          let labelCode = 67

          const patternArr = rhymeKeys.map((key) => {
            if (!rhymeMap[key]) {
              rhymeMap[key] = String.fromCharCode(labelCode++)
            }
            return rhymeMap[key]
          })

          const detected = patternArr.join('')
          const knownPatterns = ['CDECDE', 'CDCDCD', 'CDECED', 'CDEEDC', 'CDCEDC']
          if (
            knownPatterns.includes(detected) ||
            (detected.length === 6 && !detected.includes('X'))
          ) {
            scheme = detected
          } else {
            scheme = 'CDECDE'
          }
        } else {
          scheme = 'CDECDE'
        }
      } else {
        scheme = 'CDECDE'
      }
    }

    const fullPattern = 'ABBAABBA' + scheme
    let output = []

    let attrs = [`xml:id="${poemId}"`]
    if (title) attrs.push(`title="${Utils.simpleXmlEscape(title)}"`)
    if (poet) attrs.push(`poet="${Utils.simpleXmlEscape(poet)}"`)
    output.push(`<lg type="sonnet" form="italian" ${attrs.join(' ')}>`)

    const sections = [
      { type: 'quartet', start: 0, end: 4, scheme: 'ABBA', id: `${poemId}-q1` },
      { type: 'quartet', start: 4, end: 8, scheme: 'ABBA', id: `${poemId}-q2` },
      { type: 'tercet', start: 8, end: 11, scheme: scheme.substring(0, 3), id: `${poemId}-t1` },
      { type: 'tercet', start: 11, end: 14, scheme: scheme.substring(3, 6), id: `${poemId}-t2` }
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
        const label = sec.start + i < fullPattern.length ? fullPattern[sec.start + i] : 'X'
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
