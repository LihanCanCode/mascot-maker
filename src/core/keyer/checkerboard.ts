/**
 * Painted-transparency checkerboard detector: port of key.py `_corr`, `_period_score`,
 * `_region_score` and `checkerboard`. Ported from page-mascot (MIT, Kamran Ahmed).
 * Correlations are computed on a sampling grid (step chosen from the region size) to keep
 * large sheets fast; the statistic is unchanged apart from sampling noise.
 */
import type { RawImage } from '../types'
import { reflectMean } from './box'

const MIN_SIDE = 32
const MIN_STD = 1.5
const MIN_PERIOD = 6
const MAX_PERIOD = 64
const CONF_DIVISOR = 1.6
const HIST_BINS = 32
const HIST_MIN_SHARE = 0.4
const SAMPLE_BUDGET = 30000

interface View {
  readonly data: Float64Array
  readonly stride: number
  readonly x0: number
  readonly y0: number
  readonly w: number
  readonly h: number
}

function sub(v: View, x0: number, y0: number, w: number, h: number): View {
  return { data: v.data, stride: v.stride, x0: v.x0 + x0, y0: v.y0 + y0, w, h }
}

/** Pearson correlation of view `a` against `b` (same size), sampled every `step` px. */
function corr(a: View, b: View, step: number): number {
  let n = 0
  let sa = 0
  let sb = 0
  let saa = 0
  let sbb = 0
  let sab = 0
  for (let y = 0; y < a.h; y += step) {
    const ra = (a.y0 + y) * a.stride + a.x0
    const rb = (b.y0 + y) * b.stride + b.x0
    for (let x = 0; x < a.w; x += step) {
      const va = a.data[ra + x]!
      const vb = b.data[rb + x]!
      n++
      sa += va
      sb += vb
      saa += va * va
      sbb += vb * vb
      sab += va * vb
    }
  }
  if (n === 0) return 0
  const ma = sa / n
  const mb = sb / n
  const stdA = Math.sqrt(Math.max(0, saa / n - ma * ma))
  const stdB = Math.sqrt(Math.max(0, sbb / n - mb * mb))
  if (stdA < 1e-6 || stdB < 1e-6) return 0
  return (sab / n - ma * mb) / (stdA * stdB)
}

function periodScore(v: View, p: number): number {
  const { w, h } = v
  if (h <= p || w <= p) return 0
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / SAMPLE_BUDGET)))
  const diag = corr(sub(v, 0, 0, w - p, h - p), sub(v, p, p, w - p, h - p), step)
  const xax = corr(sub(v, 0, 0, w - p, h), sub(v, p, 0, w - p, h), step)
  const yax = corr(sub(v, 0, 0, w, h - p), sub(v, 0, p, w, h - p), step)
  return diag - (xax + yax) / 2
}

function greyPlane(img: RawImage, x0: number, y0: number, w: number, h: number): Float64Array {
  const g = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * img.width + x0 + x) * 4
      g[y * w + x] = (img.data[i]! + img.data[i + 1]! + img.data[i + 2]!) / 3
    }
  }
  return g
}

function stdDev(g: Float64Array): number {
  let s = 0
  let ss = 0
  for (let i = 0; i < g.length; i++) {
    s += g[i]!
    ss += g[i]! * g[i]!
  }
  const m = s / g.length
  return Math.sqrt(Math.max(0, ss / g.length - m * m))
}

function topTwoShare(g: Float64Array): number {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < g.length; i++) {
    lo = Math.min(lo, g[i]!)
    hi = Math.max(hi, g[i]!)
  }
  const hist = new Array<number>(HIST_BINS).fill(0)
  const span = hi - lo
  for (let i = 0; i < g.length; i++) {
    const bin = Math.min(HIST_BINS - 1, Math.floor(((g[i]! - lo) / span) * HIST_BINS))
    hist[bin]!++
  }
  hist.sort((a, b) => a - b)
  return (hist[HIST_BINS - 1]! + hist[HIST_BINS - 2]!) / (g.length + 1e-9)
}

function bestPeriod(hp: View): { best: number; p: number } {
  let best = 0
  let bestP = 0
  const limit = Math.min(MAX_PERIOD + 1, Math.min(hp.w, hp.h) - 1)
  for (let p = MIN_PERIOD; p < limit; p++) {
    const score = periodScore(hp, p)
    if (score > best) {
      best = score
      bestP = p
    }
  }
  return { best, p: bestP }
}

function regionScore(img: RawImage, x0: number, y0: number, w: number, h: number): { conf: number; p: number } {
  const none = { conf: 0, p: 0 }
  if (Math.min(w, h) < MIN_SIDE) return none
  const g = greyPlane(img, x0, y0, w, h)
  if (stdDev(g) < MIN_STD) return none
  const size = Math.max(3, Math.floor(Math.min(w, h) / 8)) | 1
  const blur = reflectMean(g, w, h, size)
  const hpData = new Float64Array(g.length)
  for (let i = 0; i < g.length; i++) hpData[i] = g[i]! - blur[i]!
  const hp: View = { data: hpData, stride: w, x0: 0, y0: 0, w, h }
  const { p } = bestPeriod(hp)
  if (p === 0) return none
  const hh = Math.floor(h / 2)
  const hw = Math.floor(w / 2)
  const quads = [
    sub(hp, 0, 0, hw, hh), sub(hp, hw, 0, w - hw, hh),
    sub(hp, 0, hh, hw, h - hh), sub(hp, hw, hh, w - hw, h - hh),
  ]
  const scores = quads.map((q) => periodScore(q, p)).sort((a, b) => a - b)
  let conf = Math.min(1, Math.max(0, scores[1]! / CONF_DIVISOR))
  if (topTwoShare(g) < HIST_MIN_SHARE) conf *= 0.5
  return { conf, p }
}

interface Region {
  readonly x0: number
  readonly y0: number
  readonly w: number
  readonly h: number
}

function regionsFor(width: number, height: number): Region[] {
  const m = Math.floor(Math.min(height, width) / 8)
  const th = Math.floor(height / 3)
  const tw = Math.floor(width / 3)
  const half = Math.floor(m / 2)
  const regions: Region[] = [
    { x0: 0, y0: 0, w: m, h: m },
    { x0: width - m, y0: 0, w: m, h: m },
    { x0: 0, y0: height - m, w: m, h: m },
    { x0: width - m, y0: height - m, w: m, h: m },
    { x0: 0, y0: th - half, w: width, h: 2 * half },
    { x0: 0, y0: 2 * th - half, w: width, h: 2 * half },
    { x0: tw - half, y0: 0, w: 2 * half, h: height },
    { x0: 2 * tw - half, y0: 0, w: 2 * half, h: height },
  ]
  return regions.filter((r) => r.w > 0 && r.h > 0)
}

/** Confidence 0..1 that the sheet has a painted checkerboard, and its square size in px. */
export function detectCheckerboard(img: RawImage): { confidence: number; square: number } {
  const scores = regionsFor(img.width, img.height)
    .map((r) => regionScore(img, r.x0, r.y0, r.w, r.h))
    .sort((a, b) => b.conf - a.conf)
  const top = scores.slice(0, 2).filter((s) => s.conf > 0)
  if (top.length < 2) return { confidence: 0, square: 0 }
  return {
    confidence: (top[0]!.conf + top[1]!.conf) / 2,
    square: Math.round((top[0]!.p + top[1]!.p) / 2),
  }
}
