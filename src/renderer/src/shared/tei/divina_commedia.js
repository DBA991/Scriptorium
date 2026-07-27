import { Utils, markRhyme, generateRhymeLabels } from './utils'

export const DivinaCommedia = {
  options: {
    title: 'Divina Commedia Tagging',
    description: 'TEI XML tagging for tercets with terza rima scheme',
    fields: [
      { name: 'cantica', label: 'Cantica (e.g., Inf)', type: 'text', default: 'Inf' },
      { name: 'canto_num', label: 'Canto number', type: 'text', default: 'I' },
      { name: 'mark_rhymes', label: 'Mark rhymes', type: 'checkbox', default: true },
      { name: 'add_canto_id', label: 'Add xml:id to canto', type: 'checkbox', default: true },
      { name: 'add_terzina_id', label: 'Add xml:id to tercets', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add xml:id to verses', type: 'checkbox', default: true }
    ]
  },
  process: (inputText, opts) => {
    const { cantica, canto_num, mark_rhymes, add_canto_id, add_terzina_id, add_verse_id } = opts
    const cantoPrefix = `${cantica}-${canto_num}`
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l)

    if (!lines.length) return '<e>No text provided</e>'

    const rhymeLabels = generateRhymeLabels(lines.length)
    let output = []

    output.push(add_canto_id ? `<lg type="canto" xml:id="${cantoPrefix}">` : `<lg type="canto">`)

    let vCounter = 1
    let sCounter = 1
    let vIdx = 0

    while (vIdx < lines.length) {
      const rem = lines.length - vIdx
      const count = rem >= 3 ? 3 : rem
      const tercetLabels = rhymeLabels.slice(vIdx, vIdx + count)
      const pattern = tercetLabels.join('')

      let tAttrs = [`type="${rem >= 3 ? 'tercet' : 'final'}"`]
      if (add_terzina_id) tAttrs.push(`xml:id="${cantoPrefix}-t${sCounter}"`)
      if (mark_rhymes) tAttrs.push(`rhyme="${pattern}"`)

      output.push(`\t<lg ${tAttrs.join(' ')}>`)

      for (let i = 0; i < count; i++) {
        const line = lines[vIdx]
        const label = rhymeLabels[vIdx]
        let marked = Utils.simpleXmlEscape(line)

        if (mark_rhymes) {
          marked = markRhyme(line, label, `${cantoPrefix}-R-${label}-${vCounter}`)
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${cantoPrefix}-v${vCounter}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${marked}</l>`)

        vIdx++
        vCounter++
      }
      output.push('\t</lg>')
      sCounter++
    }
    output.push('</lg>')
    return output.join('\n')
  }
}
