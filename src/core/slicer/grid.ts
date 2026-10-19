/**
 * Grid detection from alpha projections: cuts fall in the empty gutters near 1/3 and 2/3 of
 * the content span; otherwise equal thirds. Outer cuts are the image edges so margins stay
 * inside the outer cells and alignment absorbs them.
 */
import type { GridSpec, RawImage, SliceOptions } from '../types'

const MIN_SPAN_FRACTION = 0.5
const BLOCKED_COVERAGE = 0.05
const TIE_EPSILON = 1e-9

interface AxisCuts {
  readonly cuts: readonly [number, number]
  readonly confidences: readonly [number, number]
  readonly detected: boolean
}

interface Run {
  readonly start: number
  readonly end: number
}

interface Pick {
  readonly cut: number
  readonly confidence: number
}

function projection(img: RawImage, byColumn: boolean, alphaMin: number): number[] {
  const outer = byColumn ? img.width : img.height
  const inner = byColumn ? img.height : img.width
  const out: number[] = []
  for (let a = 0; a < outer; a++) {
    let opaque = 0
    for (let b = 0; b < inner; b++) {
      const i = byColumn ? (b * img.width + a) * 4 : (a * img.width + b) * 4
      if (img.data[i + 3]! > alphaMin) opaque++
    }
    out.push(opaque / inner)
  }
  return out
}

function equalAxis(size: number): AxisCuts {
  return { cuts: [Math.round(size / 3), Math.round((2 * size) / 3)], confidences: [0, 0], detected: false }
}

function emptyRuns(cov: readonly number[], from: number, to: number, limit: number): Run[] {
  const runs: Run[] = []
  let start = -1
  for (let i = from; i < to; i++) {
    const empty = cov[i]! <= limit
    if (empty && start < 0) start = i
    if (!empty && start >= 0) {
      runs.push({ start, end: i - 1 })
      start = -1
    }
  }
  if (start >= 0) runs.push({ start, end: to - 1 })
  return runs
}

/** Least-covered column in [lo, hi], ties going to the one nearest `expected`. */
function argminNear(cov: readonly number[], lo: number, hi: number, expected: number): Pick {
  let minCov = Infinity
  for (let i = lo; i <= hi; i++) minCov = Math.min(minCov, cov[i]!)
  let cut = lo
  let gap = Infinity
  for (let i = lo; i <= hi; i++) {
    const d = Math.abs(i - expected)
    if (cov[i]! <= minCov + TIE_EPSILON && d < gap) {
      gap = d
      cut = i
    }
  }
  return { cut, confidence: 1 - Math.min(1, Math.max(0, minCov / BLOCKED_COVERAGE)) }
}

function pickCut(cov: readonly number[], first: number, last: number, expected: number, o: SliceOptions): Pick {
  const reach = o.gutterSearch * (last - first + 1)
  const lo = Math.max(first, Math.floor(expected - reach))
  const hi = Math.min(last, Math.ceil(expected + reach))
  const centre = (r: Run): number => Math.round((r.start + r.end + 1) / 2)
  const candidates = emptyRuns(cov, first, last + 1, o.gutterCoverage).filter((r) => r.end >= lo && r.start <= hi)
  const best = candidates.sort(
    (a, b) => b.end - b.start - (a.end - a.start) || Math.abs(centre(a) - expected) - Math.abs(centre(b) - expected),
  )[0]
  return best ? { cut: centre(best), confidence: 1 } : argminNear(cov, lo, hi, expected)
}

function detectAxis(cov: readonly number[], o: SliceOptions): AxisCuts {
  const size = cov.length
  const first = cov.findIndex((c) => c > o.gutterCoverage)
  const last = size - 1 - [...cov].reverse().findIndex((c) => c > o.gutterCoverage)
  if (first < 0 || last - first + 1 < MIN_SPAN_FRACTION * size) return equalAxis(size)
  const span = last - first + 1
  const a = pickCut(cov, first, last, first + span / 3, o)
  const b = pickCut(cov, first, last, first + (2 * span) / 3, o)
  if (!(a.cut > 0 && a.cut < b.cut && b.cut < size)) return equalAxis(size)
  return { cuts: [a.cut, b.cut], confidences: [a.confidence, b.confidence], detected: true }
}

export function detectGrid(img: RawImage, options: SliceOptions): GridSpec {
  const w = img.width
  const h = img.height
  if (!options.detectGrid) {
    const x = equalAxis(w)
    const y = equalAxis(h)
    return { xCuts: [0, ...x.cuts, w], yCuts: [0, ...y.cuts, h], method: 'equal', confidence: 1 }
  }
  const x = detectAxis(projection(img, true, options.bleedAlpha), options)
  const y = detectAxis(projection(img, false, options.bleedAlpha), options)
  const all = [...x.confidences, ...y.confidences]
  return {
    xCuts: [0, ...x.cuts, w],
    yCuts: [0, ...y.cuts, h],
    method: x.detected && y.detected ? 'gutters' : 'equal',
    confidence: all.reduce((s, c) => s + c, 0) / all.length,
  }
}
