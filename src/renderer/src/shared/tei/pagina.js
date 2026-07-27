import { Utils } from './utils'

const extractPageNumber = (text) => {
  const lines = text.split('\n')
  const contentLines = [...lines]

  const firstLine = contentLines[0] ? contentLines[0].trim() : ''
  const lastLine = contentLines[contentLines.length - 1]
    ? contentLines[contentLines.length - 1].trim()
    : ''

  let pageNumber = null
  if (firstLine && /^\d+$/.test(firstLine)) {
    pageNumber = firstLine
    contentLines.shift()
  } else if (lastLine && /^\d+$/.test(lastLine)) {
    pageNumber = lastLine
    contentLines.pop()
  }

  return { pageNumber, content: contentLines.join('\n') }
}

const addLineBreaks = (text) => text.replace(/\n/g, '<lb/>\n')

const wrapAsProse = (content, poemId, addContentId) => {
  if (!content) return ''
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p)

  return paragraphs
    .map((p, idx) => {
      const withBreaks = addLineBreaks(Utils.simpleXmlEscape(p))
      const attrs = addContentId ? ` xml:id="${poemId}-p${idx + 1}"` : ''
      return `<p${attrs}>${withBreaks}<lb/></p>`
    })
    .join('\n\n')
}

const wrapAsVerse = (content, poemId, addContentId) => {
  if (!content) return ''
  const stanzas = content
    .split(/\n\s*\n+/)
    .map((s) =>
      s
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l)
    )
    .filter((lines) => lines.length > 0)

  let vCounter = 1
  return stanzas
    .map((lines, sIdx) => {
      const sAttrs = addContentId ? ` xml:id="${poemId}-s${sIdx + 1}"` : ''
      const wrappedLines = lines
        .map((line) => {
          const lAttrs = addContentId ? ` xml:id="${poemId}-v${vCounter}"` : ''
          vCounter++
          return `\t<l${lAttrs}>${Utils.simpleXmlEscape(line)}</l>`
        })
        .join('\n')
      return `<lg type="stanza"${sAttrs}>\n${wrappedLines}\n</lg>`
    })
    .join('\n\n')
}

export const Pagina = {
  options: {
    title: 'Pagina Tagging',
    description:
      'TEI XML tagging for a single page: <pb> break (with optional auto-detected page number) plus its content, either prose (<p>/<lb>) or verse (<lg>/<l>).',
    fields: [
      { name: 'work_title', label: 'Work title', type: 'text', default: '' },
      { name: 'poet', label: 'Author/Poet', type: 'text', default: '' },
      {
        name: 'detect_page_number',
        label: 'Auto-detect page number (first/last line)',
        type: 'checkbox',
        default: true
      },
      {
        name: 'manual_page_number',
        label: 'Page number (used if auto-detect is off/fails)',
        type: 'text',
        default: ''
      },
      { name: 'add_page_id', label: 'Add xml:id to <pb>', type: 'checkbox', default: true },
      {
        name: 'content_type',
        label: 'Content type',
        type: 'dropdown',
        values: ['prose', 'verse'],
        default: 'prose'
      },
      {
        name: 'add_content_id',
        label: 'Add xml:id to paragraphs/verses',
        type: 'checkbox',
        default: true
      }
    ]
  },

  process: (inputText, opts) => {
    const {
      work_title,
      poet,
      detect_page_number,
      manual_page_number,
      add_page_id,
      content_type,
      add_content_id
    } = opts

    const idPrefix =
      (work_title + '-' + poet)
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'pagina'

    let pageNumber = null
    let content = inputText

    if (detect_page_number) {
      const detected = extractPageNumber(inputText)
      pageNumber = detected.pageNumber
      content = detected.content
    }
    if (!pageNumber && manual_page_number) {
      pageNumber = manual_page_number
    }

    if (!content.trim()) {
      return '<e>No content detected. Check the input text.</e>'
    }

    const poemId = `${idPrefix}-${pageNumber || 'p'}`

    let pbAttrs = [`n="${pageNumber || ''}"`]
    if (add_page_id) pbAttrs.push(`xml:id="${poemId}"`)
    const pbTag = `<pb ${pbAttrs.join(' ')}/>`

    const wrappedContent =
      content_type === 'verse'
        ? wrapAsVerse(content, poemId, add_content_id)
        : wrapAsProse(content, poemId, add_content_id)

    return `${pbTag}\n\n${wrappedContent}`
  }
}
