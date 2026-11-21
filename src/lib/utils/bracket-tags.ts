/**
 * Balanced-bracket helpers for system metadata tags embedded in descriptions.
 *
 * Split-bill items store their portion metadata with a NESTED bracket, e.g.
 *   [Items: tes2 (Rp 25.000) [÷3, mine Rp 8.334], tes (Rp 9.000)]
 * A regex such as /\[Items:\s*[^\]]+\]/ stops at the FIRST `]`, leaving a
 * dangling `, tes (Rp 9.000)]` behind. These helpers count bracket depth so
 * nested metadata is consumed completely.
 */

export interface BracketTag {
  /** Full match, including the surrounding square brackets. */
  full: string;
  /** Contents between `[tag:` and the matching closing bracket. */
  inner: string;
  start: number;
  /** Exclusive end index. */
  end: number;
}

/** Find the first balanced `[tag: ...]` block in `text` (case-insensitive tag). */
export function findBracketTag(text: string, tag: string): BracketTag | null {
  const marker = `[${tag}:`;
  const start = text.toLowerCase().indexOf(marker.toLowerCase());
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return {
          full: text.slice(start, i + 1),
          inner: text.slice(start + marker.length, i).trim(),
          start,
          end: i + 1,
        };
      }
    }
  }
  // Unbalanced tag: don't consume arbitrary trailing text.
  return null;
}

/** Find every balanced `[tag: ...]` block, with offsets into the original text. */
export function findAllBracketTags(text: string, tag: string): BracketTag[] {
  const out: BracketTag[] = [];
  let remaining = text;
  let offset = 0;

  while (remaining.length > 0) {
    const found = findBracketTag(remaining, tag);
    if (!found) break;
    out.push({
      ...found,
      start: found.start + offset,
      end: found.end + offset,
    });
    offset += found.end;
    remaining = remaining.slice(found.end);
  }
  return out;
}

/** Remove every balanced `[tag: ...]` block and normalize leftover whitespace. */
export function stripBracketTag(text: string, tag: string): string {
  const tags = findAllBracketTags(text, tag);
  let out = text;
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i];
    out = out.slice(0, t.start) + out.slice(t.end);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** All system metadata tags stored inside transaction descriptions. */
export const SYSTEM_TAG_NAMES = ["Items", "Memo", "Tukar Valas", "Ref"] as const;

/** Strip every known system metadata tag from a description. */
export function stripSystemTags(text: string): string {
  return SYSTEM_TAG_NAMES.reduce(
    (acc, tag) => stripBracketTag(acc, tag),
    text,
  ).trim();
}
