/**
 * Step 1 of alignment: pin every cell's shoulders to the directions sheet's mean shoulder
 * box (build.py align, anchor 'shoulders'), as ONE scale+translate per cell.
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import type { AlignOptions, Box, Cell, CellMetrics, ScaleTranslate } from '../types'

export interface WithinSheetResult {
  readonly transforms: readonly ScaleTranslate[]
  readonly clamped: readonly boolean[]
  readonly anchored: readonly boolean[]
  readonly anchorNoise: number
  readonly scaleClamp: number
  readonly canvas: { readonly width: number; readonly height: number }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function centre(box: Box): { x: number; y: number } {
  return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }
}

interface Target {
  readonly cx: number
  readonly cy: number
  readonly width: number
  readonly noise: number
}

/*
 * Scale anchor = width of the bottom-sliver shoulder box. Tried the robust median-band width
 * (CellMetrics.shoulderWidth) on a real Gemini pair: the validator's spread dropped, but boop
 * shift got worse (2.7 -> 3.1 px), so alignment keeps the sliver. Blending head width in made
 * it worse still (up to 6.6 px).
 */
const boxWidth = (b: Box): number => b.x1 - b.x0

function targetFrom(dirMetrics: readonly CellMetrics[]): Target {
  const anchored = dirMetrics.filter((m) => m.shoulderBox !== null)
  if (anchored.length === 0) throw new RangeError('no directions cell has a shoulder box')
  const boxes = anchored.map((m) => m.shoulderBox!)
  const widths = boxes.map(boxWidth)
  const width = mean(widths)
  return {
    cx: mean(boxes.map((b) => centre(b).x)),
    cy: mean(boxes.map((b) => centre(b).y)),
    width,
    noise: (Math.max(...widths) - Math.min(...widths)) / width,
  }
}

interface Frame {
  readonly pad: number
  readonly cellW: number
  readonly cellH: number
  readonly sheetScale: number
  readonly clamp: number
}

function transformFor(m: CellMetrics, target: Target, f: Frame): { t: ScaleTranslate; clamped: boolean; anchored: boolean } {
  const box = m.shoulderBox
  if (!box) {
    const t = {
      scale: f.sheetScale,
      tx: f.pad + (f.cellW - m.width * f.sheetScale) / 2,
      ty: f.pad + (f.cellH - m.height * f.sheetScale) / 2,
    }
    return { t, clamped: false, anchored: false }
  }
  const raw = target.width / (boxWidth(box) * f.sheetScale)
  const k = Math.min(1 + f.clamp, Math.max(1 - f.clamp, raw))
  const scale = f.sheetScale * k
  const c = centre(box)
  const t = {
    scale,
    tx: f.pad + target.cx - c.x * scale,
    ty: f.pad + target.cy - c.y * scale,
  }
  return { t, clamped: k !== raw, anchored: true }
}

/**
 * `dirs`/`dirMetrics` define the targets; `cells`/`metrics` are the cells to transform
 * (pass the directions again for the directions sheet, with sheetScale 1).
 */
export function withinSheetTransforms(
  dirs: readonly Cell[],
  dirMetrics: readonly CellMetrics[],
  cells: readonly Cell[],
  metrics: readonly CellMetrics[],
  sheetScale: number,
  o: AlignOptions,
): WithinSheetResult {
  if (dirs.length !== dirMetrics.length || cells.length !== metrics.length) {
    throw new RangeError('cells and metrics must have the same length')
  }
  const target = targetFrom(dirMetrics)
  const cellW = median(dirs.map((c) => c.image.width))
  const cellH = median(dirs.map((c) => c.image.height))
  const pad = Math.round(cellW / 2)
  const clamp = target.noise > o.noiseThreshold ? o.scaleClampNoisy : o.scaleClampSteady
  const frame: Frame = { pad, cellW, cellH, sheetScale, clamp }
  const results = metrics.map((m) => transformFor(m, target, frame))
  return {
    transforms: results.map((r) => r.t),
    clamped: results.map((r) => r.clamped),
    anchored: results.map((r) => r.anchored),
    anchorNoise: target.noise,
    scaleClamp: clamp,
    canvas: { width: cellW + 2 * pad, height: 2 * cellH + 2 * pad },
  }
}
