import { describe, expect, it } from 'vitest'
import { escapeHtmlAttr, escapeJsxString, sanitizeBasePath, slugify } from './escape'

describe('slugify', () => {
  it.each([
    ['Tahsan Lihan!', 'tahsan-lihan'],
    ['', 'mascot'],
    ['   ', 'mascot'],
    ['!!!', 'mascot'],
    ['---Fox---', 'fox'],
    ['Fox   &   Friends', 'fox-friends'],
    ['ÉMILIE Crème', 'emilie-creme'],
    ['🦊🦊', 'mascot'],
    ['"><script>alert(1)</script>', 'script-alert-1-script'],
  ])('slugifies %j to %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('caps the length at 40 without a trailing dash', () => {
    const slug = slugify('a'.repeat(39) + ' ' + 'b'.repeat(20))
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('tolerates a non-string at runtime', () => {
    expect(slugify(undefined as unknown as string)).toBe('mascot')
  })
})

describe('sanitizeBasePath', () => {
  it.each([
    ['/mascots', '/mascots'],
    ['/mascots/', '/mascots'],
    ['/a/b_c-d.e', '/a/b_c-d.e'],
    ['./assets', './assets'],
    ['/', ''],
    ['./', '.'],
    ['  /mascots  ', '/mascots'],
  ])('keeps the safe path %j as %j', (input, expected) => {
    expect(sanitizeBasePath(input)).toBe(expected)
  })

  it.each([
    'javascript:alert(1)',
    'https://evil.example/x',
    '//evil.example',
    '/a//b',
    '/a/../b',
    '../x',
    '/a b',
    '/a"b',
    "/a'b",
    '/a<b',
    'mascots',
    '',
    '\\\\server\\share',
  ])('falls back to /mascots for %j', (input) => {
    expect(sanitizeBasePath(input)).toBe('/mascots')
  })

  it('tolerates a non-string at runtime', () => {
    expect(sanitizeBasePath(null as unknown as string)).toBe('/mascots')
  })
})

describe('escapeHtmlAttr', () => {
  it('escapes every markup-significant character', () => {
    expect(escapeHtmlAttr(`"><script>alert('x')</script>&\``)).toBe(
      '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;&#96;',
    )
  })

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtmlAttr('&quot;')).toBe('&amp;quot;')
  })

  it('replaces control characters and newlines with spaces', () => {
    expect(escapeHtmlAttr('a\nb\r\nc\u0000d')).toBe('a b  c d')
  })

  it('leaves plain text and unicode alone', () => {
    expect(escapeHtmlAttr('Fox 🦊 café')).toBe('Fox 🦊 café')
  })
})

describe('escapeJsxString', () => {
  it('escapes quotes, angle brackets, braces and ampersands as entities', () => {
    expect(escapeJsxString('"><script>{x}&')).toBe('&quot;&gt;&lt;script&gt;&#123;x&#125;&amp;')
  })

  it('escapes single quotes and backticks', () => {
    expect(escapeJsxString("it's `x`")).toBe('it&#39;s &#96;x&#96;')
  })

  it('replaces control characters and newlines with spaces', () => {
    expect(escapeJsxString('a\nb\tc')).toBe('a b c')
  })

  it('keeps backslashes literal because JSX attribute strings have no escapes', () => {
    expect(escapeJsxString('a\\b')).toBe('a\\b')
  })
})
