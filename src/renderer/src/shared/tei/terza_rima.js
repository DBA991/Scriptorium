import { Utils, markRhyme, generateRhymeLabels } from './utils'

export const TerzaRima = {
  options: {
    title: 'Terza Rima Tagging',
    description: 'Generic tercet marking with optional rhyme scheme',
    fields: [
      { name: 'section_id', label: 'Section xml:id (e.g., poem-1)', type: 'text', default: 'poem' },
      { name: 'mark_rhymes', label: 'Mark end-word rhymes', type: 'checkbox', default: true },
      { name: 'add_section_id', label: 'Add xml:id to section', type: 'checkbox', default: true },
      { name: 'add_tercet_id', label: 'Add xml:id to tercets', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true }
    ]
  },
  process: (inputText, opts) => {
    const { section_id, mark_rhymes, add_section_id, add_tercet_id, add_verse_id } = opts
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l)

    if (!lines.length) return '<e>No text provided</e>'

    const rhymeLabels = mark_rhymes
      ? generateRhymeLabels(lines.length)
      : Array(lines.length).fill('X')

    let output = []

    let sAttrs = ['type="terza-rima"']
    if (add_section_id) sAttrs.push(`xml:id="${section_id}"`)
    output.push(`<lg ${sAttrs.join(' ')}>`)

    let vCounter = 1
    let tCounter = 1
    let vIdx = 0

    while (vIdx < lines.length) {
      const rem = lines.length - vIdx
      const count = rem >= 3 ? 3 : rem
      const tercetLabels = rhymeLabels.slice(vIdx, vIdx + count)
      const pattern = tercetLabels.join('')

      let tAttrs = [`type="${rem >= 3 ? 'tercet' : 'final'}"`]
      if (add_tercet_id) tAttrs.push(`xml:id="${section_id}-t${tCounter}"`)
      if (mark_rhymes) tAttrs.push(`rhyme="${pattern}"`)

      output.push(`\t<lg ${tAttrs.join(' ')}>`)

      for (let i = 0; i < count; i++) {
        const line = lines[vIdx]
        const label = rhymeLabels[vIdx]
        let marked = Utils.simpleXmlEscape(line)

        if (mark_rhymes) {
          marked = markRhyme(line, label, `${section_id}-R-${label}-${vCounter}`)
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${section_id}-v${vCounter}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${marked}</l>`)

        vIdx++
        vCounter++
      }
      output.push('\t</lg>')
      tCounter++
    }
    output.push('</lg>')
    return output.join('\n')
  }
}
