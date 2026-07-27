export const Utils = {
  removeMultipleSpaces: (text) =>
    text
      .split('\n')
      .map((line) => line.replace(/ {2,}/g, ' '))
      .join('\n'),

  removeEmptyLines: (text) =>
    text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n'),

  simpleXmlEscape: (line) =>
    !line ? '' : line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),

  cleanApostrophes: (word) => {
    const lowerWord = word.toLowerCase()
    const apostrophes = ["'", '’', '`']
    let minIndex = lowerWord.length
    apostrophes.forEach((ap) => {
      const index = lowerWord.indexOf(ap)
      if (index !== -1 && index < minIndex) minIndex = index
    })
    if (minIndex < lowerWord.length) {
      if (minIndex === lowerWord.length - 1) return ''
      return lowerWord.substring(minIndex + 1)
    }
    return lowerWord
  },

  extractEndWord: (line, removePunct = true, cleanArticles = true) => {
    if (!line) return ''
    const parts = line.trim().split(/\s+/)
    if (parts.length === 0) return ''
    let word = parts[parts.length - 1]
    if (cleanArticles) word = Utils.cleanApostrophes(word)
    if (removePunct) word = word.replace(/^[\W_]+|[\W_]+$/gu, '')
    return word ? word.toLowerCase() : ''
  }
}

export const markRhyme = (line, label, id, knownWord = null) => {
  const escapedLine = Utils.simpleXmlEscape(line)
  const rawEndWord = knownWord || Utils.extractEndWord(line, true, true)

  if (!rawEndWord) return escapedLine

  const wordEscaped = Utils.simpleXmlEscape(rawEndWord)
  const regex = new RegExp(`(${wordEscaped})([\\W_]*)$`, 'i')

  const match = escapedLine.match(regex)
  if (match) {
    const before = escapedLine.substring(0, match.index)
    const wordSection = match[1]
    const after = match[2]
    return `${before}<seg type="rhyme" rhyme="${label}" xml:id="${id}">${wordSection}</seg>${after}`
  }

  return escapedLine
}

export const idxToLabel = (idx) => {
  const base = idx % 26
  const overflow = Math.floor(idx / 26)
  return String.fromCharCode(65 + base) + '+'.repeat(overflow)
}

export const generateRhymeLabels = (n) => {
  let labels = []
  let stanzaIdx = 0
  let vIdx = 0
  while (vIdx < n) {
    const la = idxToLabel(stanzaIdx)
    const lb = idxToLabel(stanzaIdx + 1)
    const rem = n - vIdx
    if (rem >= 3) {
      labels.push(la, lb, la)
      vIdx += 3
    } else if (rem === 2) {
      labels.push(la, lb)
      vIdx += 2
    } else {
      labels.push(la)
      vIdx += 1
    }
    stanzaIdx++
  }
  return labels
}
