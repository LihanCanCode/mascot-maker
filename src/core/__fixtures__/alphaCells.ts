/**
 * Already-keyed 3x3 cells for measure/aligner/composer/validator tests. Built only from
 * src/test/draw.ts. Geometry is authored for 120-px cells and scaled for other sizes.
 */
import { measureCell } from '../measure/cellMetrics'
import { createImage } from '../raster'
import { drawCircle, drawRect, mulberry32 } from '../../test/draw'
import type { Cell, CellIndex, CellMetrics, RawImage, Rgba, SheetAnalysis, SheetKind } from '../types'
import { CELL_INDICES, DEFAULT_ALIGN_OPTIONS } from '../types'

const BASE = 120
const SKIN: Rgba = { r: 230, g: 140, b: 60, a: 255 }
const INK: Rgba = { r: 30, g: 20, b: 20, a: 255 }
const LOOK: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
]

export interface BustSpec {
  /** Horizontal centre of the shoulders (px at BASE size). */
  readonly cx: number
  /** Bottom row of the shoulder block. */
  readonly bottom: number
  /** Uniform size factor applied to the whole bust. */
  readonly size: number
  /** Extra shoulder width factor. */
  readonly shoulderScale: number
  /** Shoulder block height factor (bottom stays put, so the head moves up when > 1). */
  readonly shoulderHeight: number
  readonly fill: Rgba
  readonly lookDx: number
  readonly lookDy: number
  /** Opaque dark outline around the bust (off for translucent fills). */
  readonly outlined: boolean
}

const DEFAULT_SPEC: BustSpec = {
  cx: 60, bottom: 100, size: 1, shoulderScale: 1, shoulderHeight: 1, fill: SKIN, lookDx: 0, lookDy: 0, outlined: true,
}

export function makeCell(sheet: SheetKind, index: number, image: RawImage): Cell {
  return {
    sheet,
    index: index as CellIndex,
    image,
    sourceBox: { x0: 0, y0: 0, x1: image.width, y1: image.height },
    fragmentsRemoved: 0,
  }
}

const STRIPS = 12
const NECK_FRACTION = 0.6

interface Body {
  readonly cx: number
  readonly headCy: number
  readonly headR: number
  readonly shoulderTop: number
  readonly shoulderW: number
  readonly shoulderH: number
}

/** Head circle on sloping shoulders (a staircase of strips, widest at the bottom). */
function paintBody(img: RawImage, b: Body, grow: number, colour: Rgba): RawImage {
  let out = drawCircle(img, b.cx, b.headCy, b.headR + grow, colour)
  const stripH = b.shoulderH / STRIPS
  for (let j = 0; j < STRIPS; j++) {
    const w = b.shoulderW * (NECK_FRACTION + (1 - NECK_FRACTION) * (j / (STRIPS - 1)))
    out = drawRect(out, {
      x0: b.cx - w / 2 - grow, x1: b.cx + w / 2 + grow,
      y0: b.shoulderTop + j * stripH - (j === 0 ? grow : 0),
      y1: b.shoulderTop + (j + 1) * stripH + (j === STRIPS - 1 ? grow : 0),
    }, colour)
  }
  return out
}

/** One bust image at `px` pixels square; geometry given at BASE size is scaled by px/BASE. */
export function bustImage(px: number, spec: Partial<BustSpec> = {}): RawImage {
  const s = { ...DEFAULT_SPEC, ...spec }
  const k = px / BASE
  const headR = 24 * s.size * k
  const shoulderH = 36 * s.size * s.shoulderHeight * k
  const shoulderTop = s.bottom * k - shoulderH
  const body: Body = {
    cx: s.cx * k, headCy: shoulderTop - 0.85 * headR, headR, shoulderTop, shoulderH,
    shoulderW: 32 * s.size * s.shoulderScale * k,
  }
  let img = createImage(px, px)
  if (s.outlined) img = paintBody(img, body, 2 * k, INK)
  img = paintBody(img, body, 0, s.fill)
  return drawCircle(img, body.cx + s.lookDx * 3 * k, body.headCy + s.lookDy * 2 * k, headR * 0.9, s.fill)
}

function cellsFrom(sheet: SheetKind, px: number, specFor: (i: number) => Partial<BustSpec>): Cell[] {
  return CELL_INDICES.map((i) => {
    const [dx, dy] = LOOK[i]!
    return makeCell(sheet, i, bustImage(px, { lookDx: dx, lookDy: dy, ...specFor(i) }))
  })
}

/** Nine identical-shoulder busts whose heads look in nine directions. */
export function alignedCells(sheet: SheetKind = 'directions', px = BASE): Cell[] {
  return cellsFrom(sheet, px, () => ({}))
}

/** Per-cell offsets up to +-10px and scale +-8% (seeded). */
export function misalignedCells(seed: number, sheet: SheetKind = 'directions', px = BASE): Cell[] {
  const rnd = mulberry32(seed)
  return cellsFrom(sheet, px, () => ({
    cx: 60 + (rnd() * 2 - 1) * 10,
    bottom: 100 + (rnd() * 2 - 1) * 10,
    size: 1 + (rnd() * 2 - 1) * 0.08,
  }))
}

/** Reactions drawn `factor` times larger and `shiftPx` lower than the directions. */
export function scaledReactions(factor = 1.15, shiftPx = 6, px = BASE): Cell[] {
  return cellsFrom('reactions', px, () => ({ size: factor, bottom: 100 + shiftPx }))
}

/** Aligned reactions with a separate heart blob above the head. */
export function heartReactions(px = BASE): Cell[] {
  return alignedCells('reactions', px).map((cell) => {
    const k = px / BASE
    return makeCell('reactions', cell.index, drawCircle(cell.image, 60 * k, 9 * k, 5 * k, { r: 230, g: 40, b: 80, a: 255 }))
  })
}

/** Shoulder width varying about 25% across cells. */
export function noisyBodyCells(sheet: SheetKind = 'directions', px = BASE): Cell[] {
  return cellsFrom(sheet, px, (i) => ({ shoulderScale: 0.85 + (i % 3) * 0.125 }))
}

/** Busts too wide for the cell: clipped at the left, right and bottom edges. */
export function clippedCells(sheet: SheetKind = 'directions', px = BASE): Cell[] {
  return cellsFrom(sheet, px, () => ({ shoulderScale: 4, bottom: 125 }))
}

export function emptyCell(sheet: SheetKind = 'directions', index = 0, px = BASE): Cell {
  return makeCell(sheet, index, createImage(px, px))
}

/** Character whose interior is only 150/255 opaque (colour close to the key). */
export function nearKeyCells(sheet: SheetKind = 'directions', px = BASE): Cell[] {
  return cellsFrom(sheet, px, () => ({ fill: { ...SKIN, a: 150 }, outlined: false }))
}

/** 120-px directions cells with 180-px reactions cells of the same character. */
export function mixedResolutionPair(): { dirs: Cell[]; reacts: Cell[] } {
  return { dirs: alignedCells('directions', 120), reacts: alignedCells('reactions', 180) }
}

export function measureAll(cells: readonly Cell[], edgePixels = 6): CellMetrics[] {
  return cells.map((c) => measureCell(c.image, DEFAULT_ALIGN_OPTIONS, edgePixels))
}

/** A keyed, sliced SheetAnalysis around fixture cells, for validator tests. */
export function analysisFor(kind: SheetKind, cells: readonly Cell[], mimeType = 'image/png'): SheetAnalysis {
  const stats = {
    checkerboardConfidence: 0, checkerboardSquare: 0, uniformity: 1, keyedFraction: 0.6,
    protectedFraction: 0, tolLowUsed: 6, cornerMarksRemoved: 0,
  }
  const px = cells[0]?.image.width ?? BASE
  const side = px * 3
  return {
    kind,
    meta: { fileName: `${kind}.png`, mimeType, originalWidth: side, originalHeight: side, downscaled: false },
    key: {
      ok: true, mode: 'keyed', image: createImage(side, side), colour: { r: 0, g: 255, b: 0 },
      hex: '#00FF00', expectedDeltaE: 0, stats,
    },
    slice: {
      grid: { xCuts: [0, px, 2 * px, side], yCuts: [0, px, 2 * px, side], method: 'gutters', confidence: 1 },
      cells, ruleLinesRemoved: 0, significantBlobCount: 9,
    },
    metrics: measureAll(cells),
  }
}

/** Reactions whose shoulders are `factor` times taller: same bottom/anchor, different lower body. */
export function tallShoulderReactions(factor = 1.5, px = BASE): Cell[] {
  return cellsFrom('reactions', px, () => ({ shoulderHeight: factor }))
}
