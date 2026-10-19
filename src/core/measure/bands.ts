/**
 * Body/band helpers. Ported from build.py (body_mask, anchor_box 'shoulders', head_width,
 * lower_band) and screen.py -- page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import { alphaMask, labelComponents, largestComponent, maskBounds } from '../raster'
import type { Box, Mask, RawImage } from '../types'

/**
 * The character itself: largest 8-connected blob of alpha > threshold (symbols excluded).
 * Deliberate difference: 8-connectivity here, whereas the python (scipy.ndimage.label default)
 * used 4-connectivity; 8 keeps diagonal-only antialiased joins from splitting the body.
 */
export function bodyMask(img: RawImage, alphaThreshold: number): Mask {
  return largestComponent(labelComponents(alphaMask(img, alphaThreshold), 8))
}

/** Copy of `mask` with only rows y0 <= y < y1 kept. */
export function keepRows(mask: Mask, y0: number, y1: number): Mask {
  const data = new Uint8Array(mask.data.length)
  const from = Math.max(0, y0)
  const to = Math.min(mask.height, y1)
  if (to > from) data.set(mask.data.subarray(from * mask.width, to * mask.width), from * mask.width)
  return { width: mask.width, height: mask.height, data }
}

/**
 * Body pixels within a fixed-height sliver (`bandPx`, truncated) above the body's bottom row.
 * A fixed height, not a fraction of the character, so a tilting head cannot wobble the box.
 */
export function shoulderBox(body: Mask, bandPx: number): Box | null {
  const bounds = maskBounds(body)
  if (!bounds) return null
  const floor = bounds.y1 - 1
  const start = Math.max(0, floor - Math.trunc(bandPx))
  return maskBounds(keepRows(body, start, floor + 1))
}

/** Horizontal extent of the body within its top `headBand` fraction (0 when empty). */
export function headWidth(body: Mask, headBand: number): number {
  const bounds = maskBounds(body)
  if (!bounds) return 0
  const top = bounds.y0
  const span = bounds.y1 - 1 - top
  const end = top + Math.max(1, Math.trunc(span * headBand))
  const head = maskBounds(keepRows(body, top, end))
  return head ? head.x1 - head.x0 : 0
}

/** Body rows from `fromFraction` of the way down the body to its bottom row. */
export function lowerBand(body: Mask, fromFraction: number): Mask {
  const bounds = maskBounds(body)
  if (!bounds) return keepRows(body, 0, 0)
  const bottom = bounds.y1 - 1
  const start = bounds.y0 + Math.trunc((bottom - bounds.y0) * fromFraction)
  return keepRows(body, start, bottom + 1)
}

/** The silhouette used by the cross-sheet fit: rows from `fromFraction` down (FIT_BAND). */
export function fitBand(body: Mask, fromFraction: number): Mask {
  return lowerBand(body, fromFraction)
}

const ROBUST_BAND = 0.12
const ROBUST_SKIP_ROWS = 2

/**
 * Shoulder/torso width as the MEDIAN horizontal extent of the body rows in its lower
 * `fraction` (default 12%), ignoring the last `skipRows` rows next to the cut. A single
 * bottom row of a sloped, flat-cut bust depends on exactly where the cut falls; the median
 * does not. Falls back to the bottom-row extent for very small bodies.
 */
export function robustShoulderWidth(
  body: Mask,
  fraction: number = ROBUST_BAND,
  skipRows: number = ROBUST_SKIP_ROWS,
): number {
  const bounds = maskBounds(body)
  if (!bounds) return 0
  const bottom = bounds.y1 - 1
  const height = bottom - bounds.y0 + 1
  const last = Math.max(bounds.y0, bottom - skipRows)
  const first = Math.max(bounds.y0, bottom - Math.round(height * fraction))
  const widths: number[] = []
  for (let y = first; y <= last; y++) {
    const w = rowExtent(body, y)
    if (w > 0) widths.push(w)
  }
  if (widths.length === 0) return rowExtent(body, bottom)
  widths.sort((a, b) => a - b)
  const mid = widths.length >> 1
  return widths.length % 2 === 1 ? widths[mid]! : (widths[mid - 1]! + widths[mid]!) / 2
}

function rowExtent(mask: Mask, y: number): number {
  let lo = -1
  let hi = -1
  for (let x = 0; x < mask.width; x++) {
    if (mask.data[y * mask.width + x] === 0) continue
    if (lo === -1) lo = x
    hi = x
  }
  return lo === -1 ? 0 : hi - lo + 1
}
