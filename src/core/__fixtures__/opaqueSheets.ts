/**
 * Opaque (alpha-less) 3x3 sheet fixtures: busts on key-colour, checkerboard, gradient and
 * white backgrounds. Generated in code from src/test/draw.ts so tests need no binary assets.
 * Every function returns a NEW fixture; nothing is shared between calls.
 */
import { drawBust, drawCheckerboard, drawCircle, drawRect, fillImage, mulberry32 } from '../../test/draw'
import type { Box, RawImage, Rgba } from '../types'

export const KEY_GREEN: Rgba = { r: 0, g: 255, b: 0, a: 255 }
export const KEY_MAGENTA: Rgba = { r: 255, g: 0, b: 255, a: 255 }
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 255 }
const FOX_ORANGE: Rgba = { r: 230, g: 120, b: 40, a: 255 }
const INK: Rgba = { r: 20, g: 20, b: 20, a: 255 }

export interface Fixture {
  readonly image: RawImage
  /** Cell rectangles, row-major. */
  readonly cells: readonly Box[]
  /** True gutter centres between neighbouring columns / rows. */
  readonly cutsX: readonly number[]
  readonly cutsY: readonly number[]
  /** Fixture specific rectangles (frog patches, bleed arm, ...). */
  readonly extras: readonly Box[]
}

export interface SheetOptions {
  /** Cell side in px for a square cell. Default 120. */
  readonly cell?: number
  readonly seed?: number
  /** Max random per-cell bust offset in px; 0 (default) keeps busts exactly centred. */
  readonly jitter?: number
  /** Bust fill colour; default fox orange. */
  readonly fill?: Rgba
}

interface Layout {
  readonly cols: number
  readonly rows: number
  readonly cellW: number
  readonly cellH: number
  readonly margin: number
  readonly gapsX: readonly number[]
  readonly gapsY: readonly number[]
}

function axisStarts(count: number, size: number, margin: number, gaps: readonly number[]): number[] {
  const starts: number[] = []
  let at = margin
  for (let i = 0; i < count; i++) {
    starts.push(at)
    at += size + (gaps[i] ?? 0)
  }
  return starts
}

function totalSpan(count: number, size: number, margin: number, gaps: readonly number[]): number {
  const gapSum = gaps.slice(0, count - 1).reduce((a, b) => a + b, 0)
  return margin * 2 + count * size + gapSum
}

function layoutCells(l: Layout): { cells: Box[]; width: number; height: number } {
  const xs = axisStarts(l.cols, l.cellW, l.margin, l.gapsX)
  const ys = axisStarts(l.rows, l.cellH, l.margin, l.gapsY)
  const cells: Box[] = []
  for (const y0 of ys) {
    for (const x0 of xs) cells.push({ x0, y0, x1: x0 + l.cellW, y1: y0 + l.cellH })
  }
  return {
    cells,
    width: totalSpan(l.cols, l.cellW, l.margin, l.gapsX),
    height: totalSpan(l.rows, l.cellH, l.margin, l.gapsY),
  }
}

function centres(cells: readonly Box[], cols: number, rows: number): { x: number[]; y: number[] } {
  const x: number[] = []
  const y: number[] = []
  for (let c = 0; c < cols - 1; c++) x.push((cells[c]!.x1 + cells[c + 1]!.x0) / 2)
  for (let r = 0; r < rows - 1; r++) y.push((cells[r * cols]!.y1 + cells[(r + 1) * cols]!.y0) / 2)
  return { x, y }
}

/** Paints one bust centred in `box` (vertically symmetric, so gutter runs are centred too). */
function paintBust(img: RawImage, box: Box, jx: number, jy: number, fill: Rgba): RawImage {
  const s = Math.min(box.x1 - box.x0, box.y1 - box.y0) / 120
  const cx = (box.x0 + box.x1) / 2 + jx
  const cy = (box.y0 + box.y1) / 2 + jy
  const top = cy - 35 * s
  const headR = 26 * s
  const headCy = top + headR
  const shoulderTop = headCy + headR * 0.85
  return drawBust(img, {
    cx,
    headCy,
    headR,
    shoulderW: headR * 2 * 0.66,
    shoulderH: cy + 35 * s - shoulderTop,
    fill,
    outline: INK,
    outlinePx: 2,
  })
}

function paintAll(base: RawImage, cells: readonly Box[], o: SheetOptions, fill: Rgba = o.fill ?? FOX_ORANGE): RawImage {
  const rand = mulberry32(o.seed ?? 1)
  const jitter = o.jitter ?? 0
  let img = base
  cells.forEach((box) => {
    const jx = jitter === 0 ? 0 : (rand() * 2 - 1) * jitter
    const jy = jitter === 0 ? 0 : (rand() * 2 - 1) * jitter
    img = paintBust(img, box, jx, jy, fill)
  })
  return img
}

function standardLayout(o: SheetOptions): Layout {
  const cell = o.cell ?? 120
  return { cols: 3, rows: 3, cellW: cell, cellH: cell, margin: 0, gapsX: [0, 0], gapsY: [0, 0] }
}

function build(l: Layout, o: SheetOptions, background: (w: number, h: number) => RawImage, extras: Box[] = []): Fixture {
  const { cells, width, height } = layoutCells(l)
  const image = paintAll(background(width, height), cells, o)
  const c = centres(cells, l.cols, l.rows)
  return { image, cells, cutsX: c.x, cutsY: c.y, extras }
}

function solid(colour: Rgba): (w: number, h: number) => RawImage {
  return (w, h) => fillImage(w, h, colour)
}

/** 9 busts on #00FF00 with antialiased black outlines. */
export function greenSheet(o: SheetOptions = {}): Fixture {
  return build(standardLayout(o), o, solid(KEY_GREEN))
}

export function magentaSheet(o: SheetOptions = {}): Fixture {
  return build(standardLayout(o), o, solid(KEY_MAGENTA))
}

/** Painted transparency checkerboard (default #CCCCCC / #FFFFFF, 16 px squares) with busts. */
export function checkerSheet(square = 16, o: SheetOptions = {}): Fixture {
  const c1: Rgba = { r: 204, g: 204, b: 204, a: 255 }
  return build(standardLayout(o), o, (w, h) => drawCheckerboard(w, h, square, c1, WHITE))
}

export function whiteSheet(o: SheetOptions = {}): Fixture {
  return build(standardLayout(o), o, solid(WHITE))
}

/** Horizontal gradient from key green to yellow: the corners disagree. */
export function gradientSheet(o: SheetOptions = {}): Fixture {
  const background = (w: number, h: number): RawImage => {
    const img = fillImage(w, h, KEY_GREEN)
    const data = new Uint8ClampedArray(img.data)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = x / (w - 1)
        const i = (y * w + x) * 4
        data[i] = Math.round(255 * t)
        data[i + 1] = 255
        data[i + 2] = 0
      }
    }
    return { width: w, height: h, data }
  }
  return build(standardLayout(o), o, background)
}

/** Key-colour background with +-amount noise per channel (JPEG-like haze). */
export function noisySheet(o: SheetOptions = {}, amount = 6): Fixture {
  const rand = mulberry32((o.seed ?? 1) + 1000)
  const background = (w: number, h: number): RawImage => {
    const img = fillImage(w, h, KEY_GREEN)
    const data = new Uint8ClampedArray(img.data)
    for (let i = 0; i < data.length; i += 4) {
      for (let k = 0; k < 3; k++) data[i + k] = data[i + k]! + Math.round((rand() * 2 - 1) * amount)
    }
    return { width: w, height: h, data }
  }
  return build(standardLayout(o), o, background)
}

/** Every bust has a patch of pure key colour fully enclosed by its body (green frog on green). */
export function frogSheet(o: SheetOptions = {}): Fixture {
  const base = greenSheet(o)
  const patchHalf = Math.max(2, Math.round(((o.cell ?? 120) / 120) * 6))
  const extras: Box[] = base.cells.map((box) => {
    const cx = (box.x0 + box.x1) / 2
    const cy = (box.y0 + box.y1) / 2 - ((o.cell ?? 120) / 120) * 12
    return { x0: cx - patchHalf, y0: cy - patchHalf, x1: cx + patchHalf, y1: cy + patchHalf }
  })
  let image = base.image
  for (const patch of extras) image = drawRect(image, patch, KEY_GREEN)
  return { ...base, image, extras }
}

/**
 * A dark arm crosses the boundary between cells 1 and 2 above both busts, so it is a separate
 * blob in each cell and blocks every gutter column. Cell 5 also has its bust touching the bottom.
 */
export function bleedSheet(o: SheetOptions = {}): Fixture {
  const base = greenSheet(o)
  const s = (o.cell ?? 120) / 120
  const x = base.cutsX[1]!
  const arm: Box = { x0: x - 40 * s, y0: 20 * s, x1: x + 40 * s, y1: 26 * s }
  const cell5 = base.cells[5]!
  const floor: Box = { x0: cell5.x0 + 40 * s, y0: cell5.y1 - 12 * s, x1: cell5.x1 - 40 * s, y1: cell5.y1 }
  let image = drawRect(base.image, arm, INK)
  image = drawRect(image, floor, FOX_ORANGE)
  return { ...base, image, extras: [arm, floor] }
}

/** 30 px outer margin and unequal 14 / 26 px gutters. */
export function marginSheet(o: SheetOptions = {}): Fixture {
  const cell = o.cell ?? 110
  const layout: Layout = { cols: 3, rows: 3, cellW: cell, cellH: cell, margin: 30, gapsX: [14, 26], gapsY: [26, 14] }
  return build(layout, o, solid(KEY_GREEN))
}

/** 2 px dark grid lines on the cell boundaries. */
export function ruleLineSheet(o: SheetOptions = {}): Fixture {
  const base = greenSheet(o)
  const extras: Box[] = []
  const size = base.image.width
  for (const x of base.cutsX) extras.push({ x0: x - 1, y0: 0, x1: x + 1, y1: size })
  for (const y of base.cutsY) extras.push({ x0: 0, y0: y - 1, x1: size, y1: y + 1 })
  let image = base.image
  for (const line of extras) image = drawRect(image, line, INK)
  return { ...base, image, extras }
}

/** Non-square sheet: 3 cells of 180x120 (540x360). */
export function wideSheet(o: SheetOptions = {}): Fixture {
  const layout: Layout = { cols: 3, rows: 3, cellW: 180, cellH: 120, margin: 0, gapsX: [0, 0], gapsY: [0, 0] }
  return build(layout, o, solid(KEY_GREEN))
}

/** A small white star in the bottom-right corner (inside the 6% corner), like an image-model watermark. */
export function watermarkSheet(o: SheetOptions = {}): Fixture {
  const base = greenSheet(o)
  const { width, height } = base.image
  const half = Math.max(3, Math.round(width * 0.02))
  const cx = width - Math.round(width * 0.035)
  const cy = height - Math.round(height * 0.035)
  const star: Box = { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half }
  let image = drawRect(base.image, { x0: cx - half, y0: cy - 1, x1: cx + half, y1: cy + 1 }, WHITE)
  image = drawRect(image, { x0: cx - 1, y0: cy - half, x1: cx + 1, y1: cy + half }, WHITE)
  image = drawCircle(image, cx, cy, half / 2, WHITE)
  return { ...base, image, extras: [star] }
}

/** A 4x3 grid (360x360, cells 90x120): twelve blobs instead of nine. */
export function twelveSheet(o: SheetOptions = {}): Fixture {
  const layout: Layout = { cols: 4, rows: 3, cellW: 90, cellH: 120, margin: 0, gapsX: [0, 0, 0], gapsY: [0, 0] }
  return build(layout, o, solid(KEY_GREEN))
}
