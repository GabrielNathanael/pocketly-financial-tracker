/**
 * Clean up transaction description to extract pure human-readable text
 * and strip out system metadata tags like [Items: ...], [Memo: ...], [Tukar Valas: ...]
 */
export function getCleanDescription(rawDesc?: string | null): string {
  if (!rawDesc) return ''

  // Extract memo if present
  const memoMatch = rawDesc.match(/\[Memo:\s*([^\]]+)\]/)
  const memo = memoMatch ? memoMatch[1].trim() : ''

  // Clean description removing all structured metadata brackets
  const clean = rawDesc
    .replace(/\[Items:\s*[^\]]+\]/g, '')
    .replace(/\[Memo:\s*[^\]]+\]/g, '')
    .replace(/\[Tukar Valas:\s*[^\]]+\]/g, '')
    .trim()

  if (clean) return clean
  if (memo) return memo
  return ''
}

/**
 * Format transfer descriptions cleanly without raw bracket syntax
 */
export function getCleanTransferDescription(rawDesc?: string | null): string {
  if (!rawDesc) return ''

  const userNote = rawDesc
    .replace(/\[Tukar Valas:\s*[^\]]+\]/g, '')
    .replace(/\[Items:\s*[^\]]+\]/g, '')
    .replace(/\[Memo:\s*[^\]]+\]/g, '')
    .trim()

  if (userNote) return userNote

  const valasMatch = rawDesc.match(/\[Tukar Valas:\s*([^\]]+)\]/)
  if (valasMatch) {
    return valasMatch[1].trim() // e.g. "1 USD = 16.200 IDR • Terima: Rp 4.050.000"
  }

  return ''
}
