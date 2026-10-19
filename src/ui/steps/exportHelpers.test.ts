import { describe, expect, it } from 'vitest'
import { adaptSnippetExtension, extensionFor, sheetFileName } from './exportHelpers'

describe('exportHelpers', () => {
  it('maps mime types to extensions', () => {
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('image/png')).toBe('png')
  })

  it('builds sheet file names from the slug', () => {
    expect(sheetFileName('mochi', 'directions', 'webp')).toBe('mochi-directions.webp')
    expect(sheetFileName('mochi', 'reactions', 'png')).toBe('mochi-reactions.png')
  })

  it('rewrites only the sheet file names when PNG is used', () => {
    const code = '<Mascot directions="/m/mochi-directions.webp" reactions="/m/mochi-reactions.webp" label="a.webp" />'
    const out = adaptSnippetExtension(code, 'mochi', 'png')
    expect(out).toContain('mochi-directions.png')
    expect(out).toContain('mochi-reactions.png')
    expect(out).toContain('label="a.webp"')
  })

  it('leaves the snippet alone for webp', () => {
    const code = 'x mochi-directions.webp'
    expect(adaptSnippetExtension(code, 'mochi', 'webp')).toBe(code)
  })

  it('escapes regex characters in the slug', () => {
    expect(adaptSnippetExtension('a.b-directions.webp', 'a.b', 'png')).toBe('a.b-directions.png')
    expect(adaptSnippetExtension('axb-directions.webp', 'a.b', 'png')).toBe('axb-directions.webp')
  })
})
