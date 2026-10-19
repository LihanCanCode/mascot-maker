/**
 * Step 2 of alignment: one scale + vertical shift for the whole reactions sheet, found by
 * coarse-to-fine search on quarter-resolution shoulder silhouettes (build.py overlap/best).
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import type { AlignOptions, CrossSheetFit, Mask, ScaleTranslate } from '../types'

interface Plane {
  readonly width: number
  readonly height: number
  readonly data: Float32Array
}

interface Candidate {
  readonly score: number
  readonly scale: number
  readonly dy: number
}

const COARSE_SCALE_STEP = 0.02
const COARSE_SHIFT_STEP = 2
const FINE_SCALE_STEP = 0.005
const FINE_SHIFT_RANGE = 3
const TIE = 1e-12

function averageMasks(masks: readonly Mask[]): Plane {
  const first = masks[0]
  if (!first) throw new RangeError('fitCrossSheet needs at least one mask per sheet')
  const data = new Float32Array(first.width * first.height)
  for (const m of masks) {
    if (m.width !== first.width || m.height !== first.height) throw new RangeError('mask sizes differ')
    for (let p = 0; p < data.length; p++) data[p] = data[p]! + m.data[p]!
  }
  for (let p = 0; p < data.length; p++) data[p] = data[p]! / masks.length
  return { width: first.width, height: first.height, data }
}

function sample(plane: Plane, sx: number, sy: number): number {
  const fx = sx - 0.5
  const fy = sy - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= plane.width || y >= plane.height ? 0 : plane.data[y * plane.width + x]!
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

interface Rect { x0: number; y0: number; x1: number; y1: number }

function nonZeroRect(p: Plane): Rect | null {
  let r: Rect = { x0: p.width, y0: p.height, x1: -1, y1: -1 }
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (p.data[y * p.width + x] === 0) continue
      r = { x0: Math.min(r.x0, x), y0: Math.min(r.y0, y), x1: Math.max(r.x1, x + 1), y1: Math.max(r.y1, y + 1) }
    }
  }
  return r.x1 < 0 ? null : r
}

interface Search {
  readonly dir: Plane
  readonly react: Plane
  readonly dirRect: Rect | null
  readonly reactRect: Rect | null
  readonly cx: number
  readonly cy: number
}

/** Soft IoU of the directions plane and the reactions plane zoomed by `c` about the centre. */
function overlap(s: Search, c: number, dy: number): number {
  if (!s.dirRect && !s.reactRect) return 0
  const mapped = s.reactRect && {
    x0: Math.floor((s.reactRect.x0 - s.cx) * c + s.cx) - 1,
    x1: Math.ceil((s.reactRect.x1 - s.cx) * c + s.cx) + 1,
    y0: Math.floor((s.reactRect.y0 - s.cy) * c + s.cy + dy) - 1,
    y1: Math.ceil((s.reactRect.y1 - s.cy) * c + s.cy + dy) + 1,
  }
  const rects = [s.dirRect, mapped].filter((r): r is Rect => r !== null)
  const x0 = Math.max(0, Math.min(...rects.map((r) => r.x0)))
  const y0 = Math.max(0, Math.min(...rects.map((r) => r.y0)))
  const x1 = Math.min(s.dir.width, Math.max(...rects.map((r) => r.x1)))
  const y1 = Math.min(s.dir.height, Math.max(...rects.map((r) => r.y1)))
  let inter = 0
  let union = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = s.dir.data[y * s.dir.width + x]!
      const r = sample(s.react, (x + 0.5 - s.cx) / c + s.cx, (y + 0.5 - dy - s.cy) / c + s.cy)
      inter += Math.min(d, r)
      union += Math.max(d, r)
    }
  }
  return union > 0 ? inter / union : 0
}

function isBetter(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true
  if (a.score > b.score + TIE) return true
  if (a.score < b.score - TIE) return false
  const da = Math.abs(a.scale - 1)
  const db = Math.abs(b.scale - 1)
  if (da !== db) return da < db
  return Math.abs(a.dy) < Math.abs(b.dy)
}

function bestOf(s: Search, scales: readonly number[], shifts: readonly number[]): Candidate {
  let best: Candidate | null = null
  for (const scale of scales) {
    for (const dy of shifts) {
      const cand = { score: overlap(s, scale, dy), scale, dy }
      if (isBetter(cand, best)) best = cand
    }
  }
  if (!best) throw new RangeError('empty search grid')
  return best
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  const n = Math.round((to - from) / step)
  for (let i = 0; i <= n; i++) out.push(from + i * step)
  return out
}

/**
 * `dirMasks`/`reactMasks` are quarter-resolution shoulder silhouettes of the nine frames
 * (see warpMaskQuarter); `canvas` is the full-resolution canvas they came from.
 */
export function fitCrossSheet(
  dirMasks: readonly Mask[],
  reactMasks: readonly Mask[],
  canvas: { width: number; height: number },
  o: AlignOptions,
): CrossSheetFit {
  const dir = averageMasks(dirMasks)
  const react = averageMasks(reactMasks)
  if (dir.width !== react.width || dir.height !== react.height) throw new RangeError('sheet masks differ in size')
  const s: Search = {
    dir, react, dirRect: nonZeroRect(dir), reactRect: nonZeroRect(react),
    cx: canvas.width / 8, cy: canvas.height / 8,
  }
  const steps = Math.round(o.matchClamp / COARSE_SCALE_STEP)
  const coarse = bestOf(
    s,
    range(1 - steps * COARSE_SCALE_STEP, 1 + steps * COARSE_SCALE_STEP, COARSE_SCALE_STEP),
    range(-o.fitShiftQuarterPx, o.fitShiftQuarterPx, COARSE_SHIFT_STEP),
  )
  const lo = 1 - o.matchClamp
  const hi = 1 + o.matchClamp
  const fine = bestOf(
    s,
    range(coarse.scale - COARSE_SCALE_STEP, coarse.scale + COARSE_SCALE_STEP, FINE_SCALE_STEP).filter(
      (c) => c >= lo - TIE && c <= hi + TIE,
    ),
    range(coarse.dy - FINE_SHIFT_RANGE, coarse.dy + FINE_SHIFT_RANGE, 1),
  )
  // The fine grid is centred on (and includes) the coarse winner, so it can only improve on it.
  const best = fine
  return { scale: best.scale, shift: best.dy * 4, overlap: best.score }
}

/** The matching transform p' = (p - C) * c + C + (0, shift) about the canvas centre. */
export function matchTransform(fit: CrossSheetFit, canvas: { width: number; height: number }): ScaleTranslate {
  return {
    scale: fit.scale,
    tx: (canvas.width / 2) * (1 - fit.scale),
    ty: (canvas.height / 2) * (1 - fit.scale) + fit.shift,
  }
}
