// Small drawing + colour helpers shared by the rig and the parts. Pure, DOM-free.
import type { Build, Ctx, Pt } from './types'

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))
export const TAU = Math.PI * 2

type Rgb3 = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb3 {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: Rgb3): string {
  const hx = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${hx(r)}${hx(g)}${hx(b)}`
}

function rgbToHsl([r0, g0, b0]: Rgb3): Rgb3 {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb([h0, s, l]: Rgb3): Rgb3 {
  const h = (((h0 % 360) + 360) % 360) / 360
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t0: number): number => {
    const t = (t0 + 1) % 1
    if (t < 1 / 6) return 255 * (p + (q - p) * 6 * t)
    if (t < 1 / 2) return 255 * q
    if (t < 2 / 3) return 255 * (p + (q - p) * (2 / 3 - t) * 6)
    return 255 * p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}

export interface ToneShift { readonly l?: number; readonly s?: number; readonly h?: number }

/** Shift a colour in HSL. l/s are additive (0..1), h in degrees. */
export function tone(hex: string, { l = 0, s = 0, h = 0 }: ToneShift = {}): string {
  const [hh, ss, ll] = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb([hh + h, clamp(ss + s, 0, 1), clamp(ll + l, 0.02, 0.97)]))
}

/** Darker, a little more saturated, hue nudged toward violet (richer than black mixing). */
export const shadeOf = (hex: string, k = 1): string => tone(hex, { l: -0.15 * k, s: 0.05 * k, h: -7 * k })
export const hiOf = (hex: string, k = 1): string => tone(hex, { l: 0.12 * k, s: -0.03 * k, h: 4 * k })

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t])
}

/** Raise the lightness of near-black colours so they stay distinct from the ink outline. */
export function liftDark(hex: string, minL: number): string {
  const l = rgbToHsl(hexToRgb(hex))[2]
  return l >= minL ? hex : tone(hex, { l: minL - l })
}

/** Closed (or open) smooth curve through points using quadratic midpoints. */
export function smooth(ctx: Ctx, pts: readonly Pt[], closed = true): void {
  const n = pts.length
  const first = pts[0]
  const last = pts[n - 1]
  if (!first || !last) return
  if (n < 3) {
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    return
  }
  if (closed) {
    ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
    for (let i = 0; i < n; i++) {
      const p = pts[i] as Pt, q = pts[(i + 1) % n] as Pt
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2)
    }
    ctx.closePath()
    return
  }
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < n - 1; i++) {
    const p = pts[i] as Pt, q = pts[i + 1] as Pt
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2)
  }
  ctx.lineTo(last.x, last.y)
}

export function poly(ctx: Ctx, pts: readonly Pt[], closed = true): void {
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  if (closed) ctx.closePath()
}

export interface InkOptions {
  readonly fill?: string
  readonly line?: string
  readonly w?: number
  readonly fillOnly?: boolean
  readonly swell?: number
  readonly rule?: CanvasFillRule
}

/**
 * Fill + inked outline. `build(ctx)` must only issue path commands. The outline is stroked
 * twice (second pass nudged down-right) so line weight swells on the shadow side.
 */
export function ink(ctx: Ctx, build: Build, o: InkOptions = {}): void {
  const { fill, line, w = 6, fillOnly = false, swell = 0.5, rule = 'nonzero' } = o
  if (fill) {
    ctx.beginPath(); build(ctx); ctx.fillStyle = fill; ctx.fill(rule)
  }
  if (fillOnly || !line) return
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = line
  ctx.lineWidth = w
  if (swell > 0) {
    ctx.save(); ctx.translate(w * 0.4 * swell, w * 0.76 * swell)
    ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore()
  }
  ctx.beginPath(); build(ctx); ctx.stroke()
}

/**
 * Union of several shapes with one outer outline (no inner overlaps): strokes every shape at
 * double width first, then fills them all on top. Used for clouds of curls and fluffy pom-poms.
 */
export function unionInk(ctx: Ctx, builds: readonly Build[], o: { fill: string; line: string; w: number }): void {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = o.line; ctx.lineWidth = o.w * 2
  for (const b of builds) { ctx.beginPath(); b(ctx); ctx.stroke() }
  ctx.fillStyle = o.fill
  for (const b of builds) { ctx.beginPath(); b(ctx); ctx.fill() }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU)
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r0: number): void {
  const r = Math.min(r0, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

export function heartPath(ctx: Ctx, s = 1): void {
  ctx.moveTo(0, 14 * s)
  ctx.bezierCurveTo(-30 * s, -6 * s, -22 * s, -30 * s, -9 * s, -28 * s)
  ctx.bezierCurveTo(-3 * s, -27 * s, 0, -21 * s, 0, -17 * s)
  ctx.bezierCurveTo(0, -21 * s, 3 * s, -27 * s, 9 * s, -28 * s)
  ctx.bezierCurveTo(22 * s, -30 * s, 30 * s, -6 * s, 0, 14 * s)
  ctx.closePath()
}

/** Four-point sparkle (concave diamond). */
export function sparklePath(ctx: Ctx, r: number, pinch = 0.2): void {
  ctx.moveTo(0, -r)
  ctx.quadraticCurveTo(r * pinch, -r * pinch, r, 0)
  ctx.quadraticCurveTo(r * pinch, r * pinch, 0, r)
  ctx.quadraticCurveTo(-r * pinch, r * pinch, -r, 0)
  ctx.quadraticCurveTo(-r * pinch, -r * pinch, 0, -r)
  ctx.closePath()
}

export function starPath(ctx: Ctx, r: number, inner = 0.5, pts = 5): void {
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts
    const rr = i % 2 ? r * inner : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ShadedOptions {
  readonly base: string
  readonly shade: string
  readonly line: string
  readonly w?: number
  readonly off?: readonly [number, number]
  readonly rule?: CanvasFillRule
  /** Highlights, drawn clipped to the shape between the fills and the outline. */
  readonly hi?: (ctx: Ctx) => void
}

/** Shade fill, then the base colour shifted up-left (clipped), highlights, then the outline. */
export function shadedInk(ctx: Ctx, build: Build, o: ShadedOptions): void {
  const { base, shade, line, w = 6, off = [-6, -8], rule = 'nonzero', hi } = o
  ink(ctx, build, { fill: shade, fillOnly: true, rule })
  ctx.save(); ctx.beginPath(); build(ctx); ctx.clip(rule)
  ctx.translate(off[0], off[1]); ctx.fillStyle = base; ctx.beginPath(); build(ctx); ctx.fill(rule)
  ctx.translate(-off[0], -off[1])
  if (hi) hi(ctx)
  ctx.restore()
  ink(ctx, build, { line, w })
}
