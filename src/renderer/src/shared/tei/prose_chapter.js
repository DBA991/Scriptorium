import { Utils } from './utils'

export const ProseChapter = {
  options: {
    title: 'Prose Chapter Tagging',
    description: 'TEI XML tagging for prose chapters with hierarchical divisions and paragraphs',
    fields: [
      { name: 'work_title', label: 'Work title', type: 'text', default: 'Opera' },
      {
        name: 'division_type',
        label: 'Division type',
        type: 'dropdown',
        values: ['chapter', 'section', 'part', 'book'],
        default: 'chapter'
      },
      {
        name: 'division_number',
        label: 'Division number (e.g., I, 1, Uno)',
        type: 'text',
        default: 'I'
      },
      { name: 'division_title', label: 'Division title (optional)', type: 'text', default: '' },
      { name: 'add_div_id', label: 'Add xml:id to division', type: 'checkbox', default: true },
      { name: 'add_p_id', label: 'Add xml:id to paragraphs', type: 'checkbox', default: true },
      {
        name: 'paragraph_separator',
        label: 'Paragraph separator',
        type: 'dropdown',
        values: ['double-line', 'single-line', 'indent'],
        default: 'double-line'
      }
    ]
  },

  process: (inputText, opts) => {
    const {
      work_title,
      division_type,
      division_number,
      division_title,
      add_div_id,
      add_p_id,
      paragraph_separator
    } = opts

    const divisionPrefix =
      `${work_title.replace(/[^\w]+/g, '-').toLowerCase()}-${division_type}-${division_number}`
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')

    let paragraphs = []
    const lines = inputText.split('\n')
    let currentParagraph = ''

    switch (paragraph_separator) {
      case 'double-line':
        paragraphs = inputText
          .split(/\n\s*\n+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
        break

      case 'single-line':
        paragraphs = inputText
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
        break

      case 'indent':
        lines.forEach((line) => {
          if (line.match(/^\s+/) || line.trim().length === 0) {
            if (currentParagraph.trim()) {
              paragraphs.push(currentParagraph.trim())
            }
            currentParagraph = line.trim()
          } else {
            currentParagraph += (currentParagraph ? ' ' : '') + line.trim()
          }
        })

        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim())
        }
        break
    }

    if (paragraphs.length === 0) {
      return '<e>No paragraphs detected. Check paragraph separator setting.</e>'
    }

    let output = []

    let divAttrs = [`type="${division_type}"`]
    if (add_div_id) divAttrs.push(`xml:id="${divisionPrefix}"`)
    if (division_number) divAttrs.push(`n="${division_number}"`)

    output.push(`<div ${divAttrs.join(' ')}>`)

    if (division_title) {
      output.push(`\t<head>${Utils.simpleXmlEscape(division_title)}</head>`)
    }

    paragraphs.forEach((paragraph, index) => {
      const pNumber = index + 1
      const pContent = Utils.simpleXmlEscape(paragraph)

      let pAttrs = []
      if (add_p_id) pAttrs.push(`xml:id="${divisionPrefix}-p${pNumber}"`)

      if (pAttrs.length > 0) {
        output.push(`\t<p ${pAttrs.join(' ')}>${pContent}</p>`)
      } else {
        output.push(`\t<p>${pContent}</p>`)
      }
    })

    output.push('</div>')

    return output.join('\n')
  }
}
