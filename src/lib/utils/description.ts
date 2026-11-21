import { findBracketTag, stripSystemTags } from './bracket-tags'

/**
 * Clean up transaction description to extract pure human-readable text
 * and strip out system metadata tags like [Items: ...], [Memo: ...], [Tukar Valas: ...]
 */
export function getCleanDescription(rawDesc?: string | null): string {
  if (!rawDesc) return ''

  // Extract memo if present (balanced: item metadata may contain nested brackets)
  const memoTag = findBracketTag(rawDesc, 'Memo')
  const memo = memoTag ? memoTag.inner.trim() : ''

  // Clean description removing all structured metadata brackets
  const clean = stripSystemTags(rawDesc)

  if (clean) return clean
  if (memo) return memo
  return ''
}

/**
 * Format transfer descriptions cleanly without raw bracket syntax
 */
export function getCleanTransferDescription(rawDesc?: string | null): string {
  if (!rawDesc) return ''

  const userNote = stripSystemTags(rawDesc)

  if (userNote) return userNote

  const valasTag = findBracketTag(rawDesc, 'Tukar Valas')
  if (valasTag) {
    return valasTag.inner.trim() // e.g. "1 USD = 16.200 IDR • Terima: Rp 4.050.000"
  }

  return ''
}
