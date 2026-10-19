/**
 * Best vertical alignment of two masks by IoU. Shared by the aligner's per-frame settle
 * (build.py settle) and the validator's boop shift (verify.py best_shift).
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import type { Mask } from '../types'

export interface RowShift {
  /** Rows to move `other` down (negative = up) to best cover `ref`. */
  readonly dy: number
  readonly iou: number
}

/** Half-open row range [from, to) in which masks are compared. */
export interface RowWindow {
  readonly from: number
  readonly to: number
}

const SCORE_EPSILON = 1e-12

/** Per row: [minX, maxX] of set pixels, or [-1, -1] when the row is empty. */
function rowSpans(mask: Mask): Int32Array {
  const spans = new Int32Array(mask.height * 2).fill(-1)
  for (let y = 0; y < mask.height; y++) {
    const base = y * mask.width
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[base + x] === 0) continue
      if (spans[y * 2] === -1) spans[y * 2] = x
      spans[y * 2 + 1] = x
    }
  }
  return spans
}

function iouAt(ref: Mask, other: Mask, rs: Int32Array, os: Int32Array, dy: number, rows: RowWindow): number {
  const w = ref.width
  let inter = 0
  let union = 0
  for (let y = rows.from; y < rows.to; y++) {
    const oy = y - dy
    const oInside = oy >= 0 && oy < other.height
    const a0 = rs[y * 2]!
    const b0 = oInside ? os[oy * 2]! : -1
    if (a0 === -1 && b0 === -1) continue
    const lo = Math.min(a0 === -1 ? w : a0, b0 === -1 ? w : b0)
    const hi = Math.max(rs[y * 2 + 1]!, oInside ? os[oy * 2 + 1]! : -1)
    for (let x = lo; x <= hi; x++) {
      const a = ref.data[y * w + x]!
      const b = oInside ? other.data[oy * w + x]! : 0
      inter += a & b
      union += a | b
    }
  }
  return union > 0 ? inter / union : 0
}

/** Offsets 0, -1, 1, -2, 2 ... so that ties resolve to the smallest |dy|. */
function offsetsByMagnitude(range: number): number[] {
  const out = [0]
  for (let d = 1; d <= range; d++) out.push(-d, d)
  return out
}

/**
 * Slide `other` vertically by up to `range` rows and return the offset with the best IoU
 * against `ref`. With `window`, only those rows are compared but `other` slides whole, so
 * content outside the window can move in (a window-clipped `other` would under-report shifts).
 */
export function bestRowShift(ref: Mask, other: Mask, range: number, window?: RowWindow): RowShift {
  if (ref.width !== other.width || ref.height !== other.height) {
    throw new RangeError('bestRowShift needs masks of identical size')
  }
  const rows = window ?? { from: 0, to: ref.height }
  const rs = rowSpans(ref)
  const os = rowSpans(other)
  let best: RowShift = { dy: 0, iou: -1 }
  for (const dy of offsetsByMagnitude(Math.max(0, Math.round(range)))) {
    const iou = iouAt(ref, other, rs, os, dy, rows)
    if (iou > best.iou + SCORE_EPSILON) best = { dy, iou }
  }
  return best
}
