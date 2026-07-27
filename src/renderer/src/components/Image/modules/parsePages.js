/**
 * Converte una stringa di selezione pagine in un array di indici 1-based.
 * @param {string} input es. "1; 4-6"
 * @param {number} total numero totale di pagine disponibili (per il clamp)
 * @returns {number[]|null} array di numeri di pagina (1-based), oppure null
 *   se l'input è vuoto/"all" (significa: tutte le pagine). Lancia errore
 *   (stringa in `error`) per input non valido.
 */
export function parsePageSelection(input, total) {
  if (input == null) return null
  const trimmed = String(input).trim().toLowerCase()
  if (trimmed === '' || trimmed === 'all' || trimmed === '*') return null

  const result = new Set()
  const tokens = trimmed.split(/[;,]/)
  for (const raw of tokens) {
    const token = raw.trim()
    if (token === '') continue

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/)
    const singleMatch = token.match(/^(\d+)$/)
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10)
      let end = parseInt(rangeMatch[2], 10)
      if (start > end) [start, end] = [end, start]
      for (let p = start; p <= end; p++) {
        result.add(p)
      }
    } else if (singleMatch) {
      result.add(parseInt(singleMatch[1], 10))
    } else {
      const err = new Error(`Token non valido: "${token}"`)
      err.token = token
      throw err
    }
  }

  if (result.size === 0) return null

  const sorted = [...result]
    .filter((p) => Number.isFinite(p) && p >= 1 && (total == null || p <= total))
    .sort((a, b) => a - b)

  return sorted.length > 0 ? sorted : null
}
