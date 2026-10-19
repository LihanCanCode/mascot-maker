/**
 * verify.py port, run on the composed tiles (boop shift, palette, width).
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import { bodyMask } from '../measure/bands'
import { bestRowShift } from '../measure/shift'
import type { RowWindow } from '../measure/shift'
import { maskBounds } from '../raster'
import { ALPHA } from '../types'
import type { ComposedMascot, QualityMetrics, RawImage, ValidationThresholds } from '../types'

const PALETTE_BINS = 4096
const WIDTH_BAND_FROM = 0.85
const NO_WIDTH = 9
const CENTRE = 4

type VerifyMetrics = Pick<QualityMetrics, 'boopShiftPx' | 'minBandOverlap' | 'paletteMatch' | 'widthChange'>

/** Chest/shoulders at FIXED rows of the tile (above where the fade begins). */
function fixedWindow(height: number, t: ValidationThresholds): RowWindow {
  return { from: Math.trunc(height * t.boopBandTop), to: Math.trunc(height * t.boopBandBottom) }
}

function palette(tiles: readonly RawImage[]): Float64Array {
  const counts = new Float64Array(PALETTE_BINS)
  for (const tile of tiles) {
    const body = bodyMask(tile, ALPHA.band)
    for (let p = 0; p < body.data.length; p++) {
      if (body.data[p] === 0 || tile.data[p * 4 + 3]! <= ALPHA.solid) continue
      const bin = (tile.data[p * 4]! >> 4) * 256 + (tile.data[p * 4 + 1]! >> 4) * 16 + (tile.data[p * 4 + 2]! >> 4)
      counts[bin] = counts[bin]! + 1
    }
  }
  const total = counts.reduce((a, b) => a + b, 0)
  return total > 0 ? counts.map((c) => c / total) : counts
}

function histogramIntersection(a: Float64Array, b: Float64Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.min(a[i]!, b[i]!)
  return sum
}

/** Mean over tiles of the widest row in the bottom 15% of the body. */
function shoulderWidth(tiles: readonly RawImage[]): number {
  const widths: number[] = []
  for (const tile of tiles) {
    const body = bodyMask(tile, ALPHA.band)
    const box = maskBounds(body)
    if (!box) continue
    const bottom = box.y1 - 1
    const start = box.y0 + Math.trunc((bottom - box.y0) * WIDTH_BAND_FROM)
    let widest = 0
    for (let y = start; y <= bottom; y++) {
      let row = 0
      for (let x = 0; x < body.width; x++) row += body.data[y * body.width + x]!
      widest = Math.max(widest, row)
    }
    widths.push(widest)
  }
  return widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : 0
}

/**
 * NOTE: unlike verify.py, which crops the reaction band to the window BEFORE sliding it, the
 * whole reaction body slides and only the window rows are scored (a pre-cropped band
 * under-reports real shifts). boopShiftPx and minBandOverlap are therefore not numerically
 * comparable with verify.py's output; the pass/fail thresholds are the same.
 */
export function computeVerifyMetrics(output: ComposedMascot, t: ValidationThresholds): VerifyMetrics {
  const size = output.cellSize
  const centre = output.directionTiles[CENTRE]
  if (!centre) throw new RangeError('composed mascot has no centre direction tile')
  const ref = bodyMask(centre, ALPHA.band)
  const window = fixedWindow(ref.height, t)
  const range = Math.round((t.boopSearchAt360 * size) / 360)
  const results = output.reactionTiles.map((tile) => bestRowShift(ref, bodyMask(tile, ALPHA.band), range, window))
  const worst = Math.max(0, ...results.map((r) => Math.abs(r.dy)))
  const dw = shoulderWidth(output.directionTiles)
  const rw = shoulderWidth(output.reactionTiles)
  return {
    boopShiftPx: (worst * t.boopDisplayPx) / size,
    minBandOverlap: results.length > 0 ? Math.min(...results.map((r) => r.iou)) : 0,
    paletteMatch: histogramIntersection(palette(output.directionTiles), palette(output.reactionTiles)),
    widthChange: dw > 0 ? Math.abs(rw - dw) / dw : NO_WIDTH,
  }
}
