// Sheet / cell rendering on an injected canvas factory. DOM-free.
import type { RawImage } from '../core/types'
import { drawCharacter } from './character'
import { DESIGN, CELL_DEFAULT, DIRECTIONS, REACTIONS, makePalette } from './rig'
import { normaliseConfig } from './config'
import type { CanvasLike, Ctx, Pose, RenderOptions, SheetKind, StudioConfig } from './types'
import { BODY_TOP, drawBody } from './parts/body'

const GREEN_KEY = '#00ff00'
const MIN_CELL = 64
const MAX_CELL = 2048

export function poseList(kind: SheetKind): readonly Pose[] {
  return kind === 'directions' ? DIRECTIONS : REACTIONS
}

function resolveCell(opts: RenderOptions): number {
  const cell = opts.cell ?? CELL_DEFAULT
  if (!Number.isInteger(cell) || cell < MIN_CELL || cell > MAX_CELL) {
    throw new RangeError(`cell must be an integer in ${MIN_CELL}..${MAX_CELL}, got ${cell}`)
  }
  return cell
}

function context2d(canvas: CanvasLike): Ctx {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('createCanvas returned a canvas without a 2D context')
  return ctx
}

function toRawImage(ctx: Ctx, size: number): RawImage {
  const img = ctx.getImageData(0, 0, size, size)
  return { width: size, height: size, data: new Uint8ClampedArray(img.data) }
}

/** The pose-free body, rasterised once and blitted into every cell. */
function bodyLayer(cfg: StudioConfig, cell: number, opts: RenderOptions): CanvasLike {
  const layer = opts.createCanvas(cell, cell)
  const ctx = context2d(layer)
  ctx.scale(cell / DESIGN, cell / DESIGN)
  drawBody(ctx, makePalette(cfg), cfg)
  return layer
}

function paintCell(ctx: Ctx, cfg: StudioConfig, pose: Pose, layer: CanvasLike, at: { col: number; row: number; cell: number }): void {
  ctx.save()
  ctx.beginPath(); ctx.rect(at.col * at.cell, at.row * at.cell, at.cell, at.cell); ctx.clip()
  ctx.translate(at.col * at.cell, at.row * at.cell); ctx.scale(at.cell / DESIGN, at.cell / DESIGN)
  drawCharacter(ctx, cfg, pose, layer)
  ctx.restore()
}

function fillBackground(ctx: Ctx, opts: RenderOptions, size: number): void {
  if (opts.background === 'green') { ctx.fillStyle = GREEN_KEY; ctx.fillRect(0, 0, size, size) }
}

/** Render a 3x3 sheet (3 * cell square, RGBA). */
export function renderSheet(config: Partial<StudioConfig>, kind: SheetKind, opts: RenderOptions): RawImage {
  const cfg = normaliseConfig(config)
  const cell = resolveCell(opts)
  const size = cell * 3
  const ctx = context2d(opts.createCanvas(size, size))
  fillBackground(ctx, opts, size)
  const layer = bodyLayer(cfg, cell, opts)
  poseList(kind).forEach((pose, i) => paintCell(ctx, cfg, pose, layer, { col: i % 3, row: Math.floor(i / 3), cell }))
  return toRawImage(ctx, size)
}

/** Render one cell (index 0..8, row-major) for fast thumbnails; equals the same cell of `renderSheet`. */
export function renderCell(config: Partial<StudioConfig>, kind: SheetKind, index: number, opts: RenderOptions): RawImage {
  if (!Number.isInteger(index) || index < 0 || index > 8) throw new RangeError(`cell index must be 0..8, got ${index}`)
  const cfg = normaliseConfig(config)
  const cell = resolveCell(opts)
  const ctx = context2d(opts.createCanvas(cell, cell))
  fillBackground(ctx, opts, cell)
  const pose = poseList(kind)[index] as Pose
  paintCell(ctx, cfg, pose, bodyLayer(cfg, cell, opts), { col: 0, row: 0, cell })
  return toRawImage(ctx, cell)
}

/** Geometry the tests and the UI need without rendering: where the body band starts at a cell size. */
export function bodyTopRow(cell: number): number {
  return Math.ceil((BODY_TOP / DESIGN) * cell)
}
