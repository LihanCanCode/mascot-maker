import type { KeyColourName } from '../core/types'

const GREENISH = /green|lime|emerald|olive|mint|jade|teal|chartreuse/i
const PINKISH = /magenta|pink|purple|violet|fuchsia|lilac|lavender|mauve/i

/**
 * Green unless the character is itself greenish (then magenta); blue when it is both
 * greenish and pinkish, because then neither green nor magenta is safe.
 * White, grey and black are never offered: the character's own pale or dark areas would be keyed out.
 */
export function pickKeyColour(describe: string): KeyColourName {
  const text = describe || ''
  if (!GREENISH.test(text)) return 'green'
  return PINKISH.test(text) ? 'blue' : 'magenta'
}
