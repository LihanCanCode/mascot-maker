import { describe, expect, it } from 'vitest'
import type { EmbedOptions } from '../core/types'
import { assetNames, buildEmbed, htmlSnippet, reactSnippet } from './index'

const BASE: EmbedOptions = { name: 'Tahsan Lihan!', basePath: '/mascots', size: 140, label: 'fox' }
const EVIL = '"><script>alert(1)</script>'

describe('assetNames', () => {
  it('derives file names from the slug', () => {
    expect(assetNames('fox')).toEqual({
      directions: 'fox-directions.webp',
      reactions: 'fox-reactions.webp',
      script: 'page-mascot.js',
      component: 'Mascot.tsx',
    })
  })
})

describe('reactSnippet', () => {
  it('renders the Mascot with slugged asset paths', () => {
    const text = reactSnippet(BASE)
    expect(text).toContain("import { Mascot } from './Mascot'")
    expect(text).toContain('directions="/mascots/tahsan-lihan-directions.webp"')
    expect(text).toContain('reactions="/mascots/tahsan-lihan-reactions.webp"')
    expect(text).toContain('size={140}')
    expect(text).toContain('label="fox"')
    expect(text).toMatch(/^\/\/.*page-mascot/m)
  })

  it('escapes a hostile label so it cannot close the attribute or open a tag', () => {
    const text = reactSnippet({ ...BASE, label: EVIL })
    expect(text).not.toContain(EVIL)
    expect(text).not.toContain('<script>')
    expect(text).toContain('label="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
  })

  it('slugs a hostile name and sanitises a hostile base path', () => {
    const text = reactSnippet({ ...BASE, name: EVIL, basePath: 'javascript:alert(1)' })
    expect(text).not.toContain('javascript:')
    expect(text).not.toContain('<script>')
    expect(text).toContain('directions="/mascots/script-alert-1-script-directions.webp"')
  })

  it('falls back to the name, then to "mascot", for an empty label', () => {
    expect(reactSnippet({ ...BASE, label: '  ' })).toContain('label="Tahsan Lihan!"')
    expect(reactSnippet({ ...BASE, label: '', name: '' })).toContain('label="mascot"')
  })
})

describe('htmlSnippet', () => {
  it('renders the module script and the custom element', () => {
    const text = htmlSnippet(BASE)
    expect(text).toContain('<script type="module" src="/mascots/page-mascot.js"></script>')
    expect(text).toContain('<page-mascot')
    expect(text).toContain('directions="/mascots/tahsan-lihan-directions.webp"')
    expect(text).toContain('size="140"')
    expect(text).toContain('label="fox"')
    expect(text).toContain('</page-mascot>')
    expect(text).toMatch(/<!--.*page-mascot.*-->/)
  })

  it('escapes a hostile label', () => {
    const text = htmlSnippet({ ...BASE, label: EVIL })
    expect(text).not.toContain(EVIL)
    expect(text.match(/<script/g)).toHaveLength(1)
    expect(text).toContain('label="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
  })

  it('cannot be broken out of by single quotes or a hostile base path', () => {
    const text = htmlSnippet({ ...BASE, label: "x' onmouseover='alert(1)", basePath: '/a"onload="x' })
    expect(text).not.toContain("' onmouseover")
    expect(text).not.toContain('onload="x')
    expect(text).toContain('src="/mascots/page-mascot.js"')
  })
})

describe('size clamping', () => {
  it.each([
    [10, 48],
    [48, 48],
    [140.4, 140],
    [512, 512],
    [9999, 512],
    [Number.NaN, 140],
    [Number.POSITIVE_INFINITY, 512],
    [-5, 48],
  ])('clamps %s to %s', (input, expected) => {
    expect(reactSnippet({ ...BASE, size: input })).toContain(`size={${expected}}`)
    expect(htmlSnippet({ ...BASE, size: input })).toContain(`size="${expected}"`)
  })
})

describe('buildEmbed', () => {
  it('bundles snippets, asset names and the raw sources', () => {
    const bundle = buildEmbed(BASE)
    expect(bundle.assetNames).toEqual(assetNames('tahsan-lihan'))
    expect(bundle.react).toBe(reactSnippet(BASE))
    expect(bundle.html).toBe(htmlSnippet(BASE))
    expect(bundle.componentSource).toContain('export function Mascot')
    expect(bundle.scriptSource).toContain('page-mascot')
    expect(bundle.scriptSource).toContain('customElements')
  })

  it('ships component source that imports only react', () => {
    const imports = [...buildEmbed(BASE).componentSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(imports.length).toBeGreaterThan(0)
    expect(new Set(imports)).toEqual(new Set(['react']))
  })
})
