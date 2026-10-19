/** WCAG 2.x contrast helpers, used by the CSS token checks. */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) throw new Error(`Not a 6-digit hex colour: ${hex}`)
  const n = parseInt(m[1], 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Custom properties (`--name: #rrggbb;`) declared in one CSS rule body. */
export function parseTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    if (m[1] && m[2]) out[m[1]] = m[2]
  }
  return out
}

/** The body of the first rule whose selector is exactly `selector` (braces are not nested in token rules). */
export function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`No rule for ${selector}`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

export interface ThemeTokens {
  readonly light: Record<string, string>
  readonly dark: Record<string, string>
  /** True when the OS-preference block and the manual [data-theme='dark'] block agree. */
  readonly darkBlocksMatch: boolean
}

export function readThemes(css: string): ThemeTokens {
  const light = parseTokens(ruleBody(css, ':root'))
  const auto = parseTokens(ruleBody(css, ":root:not([data-theme='light'])"))
  const manual = parseTokens(ruleBody(css, ":root[data-theme='dark']"))
  const darkBlocksMatch = JSON.stringify(auto) === JSON.stringify(manual)
  return { light, dark: { ...light, ...manual }, darkBlocksMatch }
}
