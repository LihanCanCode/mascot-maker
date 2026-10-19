/** Escaping and sanitising for user-controlled values that end up in copy-paste snippets. */

const MAX_SLUG_LENGTH = 40
const FALLBACK_SLUG = 'mascot'
const FALLBACK_BASE_PATH = '/mascots'
const SAFE_BASE_PATH = /^(\/|\.\/)[A-Za-z0-9/_.-]*$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '`': '&#96;',
  '{': '&#123;',
  '}': '&#125;',
}

function replaceChars(input: string, pattern: RegExp): string {
  const text = typeof input === 'string' ? input : ''
  return text.replace(CONTROL_CHARS, ' ').replace(pattern, (ch) => ENTITIES[ch] ?? ch)
}

/** [a-z0-9-], at most 40 characters, never empty. */
export function slugify(name: string): string {
  const text = typeof name === 'string' ? name : ''
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
  return slug || FALLBACK_SLUG
}

/**
 * A served directory the user's page can reference: `/dir` or `./dir`, safe characters only,
 * no `//` and no `..`. Anything else (including URLs and javascript:) becomes `/mascots`.
 * A trailing slash is dropped so callers can join with `/`.
 */
export function sanitizeBasePath(p: string): string {
  const path = (typeof p === 'string' ? p : '').trim()
  const isSafe = SAFE_BASE_PATH.test(path) && !path.includes('//') && !path.includes('..')
  return isSafe ? path.replace(/\/+$/, '') : FALLBACK_BASE_PATH
}

/** For a double-quoted HTML attribute value (also safe in single-quoted and unquoted positions). */
export function escapeHtmlAttr(s: string): string {
  return replaceChars(s, /[&"'<>`]/g)
}

/**
 * For a double-quoted JSX attribute string. JSX attribute strings have no backslash escapes,
 * so characters are written as HTML entities, which JSX decodes.
 */
export function escapeJsxString(s: string): string {
  return replaceChars(s, /[&"'<>`{}]/g)
}
