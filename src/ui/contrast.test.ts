import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance, parseTokens, readThemes, ruleBody } from './contrast'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')

/** [foreground token, background token, minimum ratio, what it is]. 4.5 = body text, 3 = large text / UI parts. */
type Pair = readonly [string, string, number, string]

const APP_PAIRS: readonly Pair[] = [
  ['ink', 'paper', 4.5, 'body text on page'],
  ['ink', 'surface', 4.5, 'text on cards'],
  ['ink', 'surface-2', 4.5, 'text on tinted surfaces'],
  ['ink-soft', 'paper', 4.5, 'muted text on page'],
  ['ink-soft', 'surface', 4.5, 'muted text on cards'],
  ['ink-soft', 'surface-2', 4.5, 'muted text on tinted surfaces'],
  ['violet-ink', 'violet', 4.5, 'primary button text'],
  ['sun-ink', 'sun', 4.5, 'selected chip and step text'],
  ['violet', 'paper', 4.5, 'links'],
  ['good', 'good-bg', 4.5, 'success banner'],
  ['warn', 'warn-bg', 4.5, 'note banner and badges'],
  ['bad', 'bad-bg', 4.5, 'problem banner and badges'],
  ['bad', 'surface', 4.5, 'error text on cards'],
  ['warn', 'paper', 4.5, 'warning text on page'],
  ['line', 'paper', 3, 'borders of inputs and cards'],
  ['focus', 'paper', 3, 'focus ring'],
]

const DEMO_PAIRS: readonly Pair[] = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink', 'surface', 4.5, 'text on cards'],
  ['ink', 'tint', 4.5, 'text on tinted sections'],
  ['ink-soft', 'bg', 4.5, 'muted text'],
  ['ink-soft', 'tint', 4.5, 'muted text on tinted sections'],
  ['ink-soft', 'surface', 4.5, 'muted text on cards'],
  ['bar-ink', 'bar', 4.5, 'header and footer text'],
  ['accent-ink', 'accent', 4.5, 'primary button and selected chip text'],
  ['accent', 'bg', 3, 'roast curve line and plan outline'],
  ['accent', 'surface', 3, 'selected plan outline'],
  ['bag-ink', 'bag-light', 4.5, 'light-roast bag'],
  ['bag-ink', 'bag-medium', 4.5, 'medium-roast bag'],
  ['bag-ink', 'bag-dark', 4.5, 'dark-roast bag'],
  ['line', 'bg', 3, 'borders and grid lines'],
  ['line', 'surface', 3, 'card and picker borders'],
  ['focus', 'bg', 3, 'focus ring'],
  ['bar-focus', 'bar', 3, 'focus ring on the header'],
]

const rows: string[] = []

function check(file: string, name: string, pairs: readonly Pair[]): void {
  const themes = readThemes(read(file))
  describe(`${name} colour tokens`, () => {
    it('keeps the OS dark block and the manual dark block identical', () => {
      expect(themes.darkBlocksMatch).toBe(true)
    })
    for (const mode of ['light', 'dark'] as const) {
      it(`meets WCAG AA in the ${mode} theme`, () => {
        for (const [fg, bg, min, what] of pairs) {
          const a = themes[mode][fg]
          const b = themes[mode][bg]
          expect(a, `${fg} missing`).toBeDefined()
          expect(b, `${bg} missing`).toBeDefined()
          const ratio = contrastRatio(a as string, b as string)
          rows.push(`${name.padEnd(5)} ${mode.padEnd(5)} ${fg} on ${bg}: ${ratio.toFixed(2)}:1 (need ${min}) ${what}`)
          expect(ratio, `${name} ${mode} ${fg} on ${bg} (${what})`).toBeGreaterThanOrEqual(min)
        }
      })
    }
  })
}

check('src/index.css', 'app', APP_PAIRS)
check('src/demo/demo.css', 'demo', DEMO_PAIRS)

describe('contrast helpers', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(luminance('#ffffff')).toBeCloseTo(1, 5)
    expect(() => luminance('red')).toThrow()
  })

  it('parses token rules', () => {
    expect(parseTokens('--a: #112233; --b: #ABCDEF; --c: 4px;')).toEqual({ a: '#112233', b: '#ABCDEF' })
    expect(() => ruleBody('a {}', 'b')).toThrow()
  })

  it('reports the ratios (visible with --reporter=verbose)', () => {
    process.stdout.write(`\nCONTRAST RATIOS\n${rows.join('\n')}\n`)
    expect(rows.length).toBeGreaterThan(0)
  })
})
