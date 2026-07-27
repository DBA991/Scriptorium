import { Utils, markRhyme } from './utils'

export const Sestina = {
  options: {
    title: 'Sestina Tagging',
    description: 'Retrogradatio cruciata tagging',
    fields: [
      { name: 'title', label: 'Title', type: 'text', default: '' },
      { name: 'poet', label: 'Poet', type: 'text', default: '' },
      { name: 'mark_rhymes', label: 'Mark end-words', type: 'checkbox', default: true },
      { name: 'add_stanza_id', label: 'Add stanza IDs', type: 'checkbox', default: true },
      { name: 'add_verse_id', label: 'Add verse IDs', type: 'checkbox', default: true }
    ]
  },
  process: (inputText, opts) => {
    const { title, poet, mark_rhymes, add_stanza_id, add_verse_id } = opts
    const poemId = (title + '-' + poet).replace(/[^\w]+/g, '-').toLowerCase() || 'sestina'
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l)

    if (lines.length < 6) return '<e>Text too short for Sestina</e>'

    const endWords = lines.map((l) => Utils.extractEndWord(l, true, true))
    const firstSix = endWords.slice(0, 6)
    const wordToLabel = {}
    firstSix.forEach((w, i) => (wordToLabel[w] = String.fromCharCode(65 + i)))

    const calcPattern = (stanzaNum, isTornada = false) => {
      if (isTornada) return [0, 5, 1, 4, 2, 3]
      if (stanzaNum === 1) return [0, 1, 2, 3, 4, 5]
      let curr = [0, 1, 2, 3, 4, 5]
      for (let i = 0; i < stanzaNum - 1; i++) {
        curr = [curr[5], curr[0], curr[4], curr[1], curr[3], curr[2]]
      }
      return curr
    }

    const numComplete = Math.floor(lines.length / 6)
    const remaining = lines.length % 6
    let output = []

    let pAttrs = ['type="sestina"', `xml:id="${poemId}"`]
    if (title) pAttrs.push(`title="${Utils.simpleXmlEscape(title)}"`)
    if (poet) pAttrs.push(`poet="${Utils.simpleXmlEscape(poet)}"`)
    output.push(`<lg ${pAttrs.join(' ')}>`)

    output.push(
      add_stanza_id
        ? `\t<lg type="sestina-body" xml:id="${poemId}-body">`
        : '\t<lg type="sestina-body">'
    )

    let vCounter = 1
    for (let s = 1; s <= numComplete; s++) {
      const pattern = calcPattern(s)
      const patternStr = pattern.map((p) => wordToLabel[firstSix[p]] || '?').join('')

      let sAttrs = ['type="stanza"']
      if (add_stanza_id) sAttrs.push(`xml:id="${poemId}-s${s}"`)
      if (mark_rhymes) sAttrs.push(`rhyme="${patternStr}"`)
      output.push(`\t\t<lg ${sAttrs.join(' ')}>`)

      for (let p = 0; p < 6; p++) {
        const vIndex = (s - 1) * 6 + p
        const line = lines[vIndex]
        const word = endWords[vIndex]
        const label = wordToLabel[word] || 'X'

        let marked = Utils.simpleXmlEscape(line)
        if (mark_rhymes) {
          marked = markRhyme(line, label, `${poemId}-R-${label}-${vCounter}`, word)
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${poemId}-v${vCounter}"`)
        output.push(`\t\t\t<l ${vAttrs.join(' ')}>${marked}</l>`)
        vCounter++
      }
      output.push('\t\t</lg>')
    }
    output.push('\t</lg>')

    if (remaining > 0) {
      const tornadaStart = numComplete * 6
      const tornadaWords = endWords.slice(tornadaStart)
      const patternStr = tornadaWords.map((w) => wordToLabel[w] || '?').join('')

      let tAttrs = ['type="tornada"']
      if (add_stanza_id) tAttrs.push(`xml:id="${poemId}-tornada"`)
      if (mark_rhymes) tAttrs.push(`rhyme="${patternStr}"`)
      output.push(`\t<lg ${tAttrs.join(' ')}>`)

      for (let i = 0; i < remaining; i++) {
        const line = lines[tornadaStart + i]
        const wEnd = endWords[tornadaStart + i]
        const label = wordToLabel[wEnd] || 'X'
        let marked = Utils.simpleXmlEscape(line)

        if (mark_rhymes) {
          marked = markRhyme(line, label, `${poemId}-R-${label}-${vCounter}`, wEnd)

          firstSix.forEach((internalWord, idx) => {
            if (internalWord === wEnd) return
            const internalLabel = wordToLabel[internalWord]
            const regex = new RegExp(`\\b${Utils.simpleXmlEscape(internalWord)}\\b`, 'gi')
            let internalCount = 1
            marked = marked.replace(regex, (match) => {
              const iId = `${poemId}-I-${internalLabel}-${vCounter}-${internalCount++}`
              return `<seg xml:id="${iId}" type="rhyme" rhyme="${internalLabel}">${match}</seg>`
            })
          })
        }

        let vAttrs = ['type="verse"']
        if (add_verse_id) vAttrs.push(`xml:id="${poemId}-v${vCounter}"`)
        output.push(`\t\t<l ${vAttrs.join(' ')}>${marked}</l>`)
        vCounter++
      }
      output.push('\t</lg>')
    }

    output.push('</lg>')
    return output.join('\n')
  }
}
