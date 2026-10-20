/**
 * Drawing the mascot the pipeline just produced.
 *
 * The eighteen tiles blitted here are `output.directionTiles` and
 * `output.reactionTiles` straight out of `runPipeline` -- the same pixels a
 * visitor downloads. Nothing is re-drawn for the camera.
 */
import type { Canvas } from '@napi-rs/canvas'
import type { ComposedMascot } from '../../src/core/types'
import { toCanvas } from './surface'
import type { Ctx2D } from './surface'

export interface MascotTiles {
  readonly directions: readonly Canvas[]
  readonly reactions: readonly Canvas[]
  /** The side the tiles are drawn at, in frame pixels. */
  readonly size: number
}

export function tilesOf(output: ComposedMascot, size: number): MascotTiles {
  return {
    directions: output.directionTiles.map(toCanvas),
    reactions: output.reactionTiles.map(toCanvas),
    size,
  }
}

/**
 * The squash curve, mirroring the `SQUASH` keyframes in `src/mascot/Mascot.tsx`.
 *
 * The keyframes are DOM `Keyframe` objects holding transform strings, so they
 * are restated here as numbers rather than parsed. `BOOP_TIMING.squashMs` --
 * which decides how long this takes, and is the part that would actually be
 * noticed if it drifted -- comes from the component itself.
 */
const SQUASH: readonly { readonly at: number; readonly sx: number; readonly sy: number }[] = [
  { at: 0, sx: 1, sy: 1 },
  { at: 0.18, sx: 1.1, sy: 0.86 },
  { at: 0.45, sx: 0.95, sy: 1.08 },
  { at: 0.72, sx: 1.03, sy: 0.97 },
  { at: 1, sx: 1, sy: 1 },
]

/** `transform-origin: 50% 78%` on the squashed span. */
const ORIGIN_Y = 0.78

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}

/** The scale pair at `progress` (0..1) through the squash, or 1:1 outside it. */
export function squashAt(progress: number | null): { sx: number; sy: number } {
  if (progress === null || progress <= 0 || progress >= 1) return { sx: 1, sy: 1 }
  for (let i = 1; i < SQUASH.length; i += 1) {
    const from = SQUASH[i - 1]
    const to = SQUASH[i]
    if (!from || !to) break
    if (progress <= to.at) {
      const span = to.at - from.at
      const f = span === 0 ? 1 : ease((progress - from.at) / span)
      return { sx: from.sx + (to.sx - from.sx) * f, sy: from.sy + (to.sy - from.sy) * f }
    }
  }
  return { sx: 1, sy: 1 }
}

export interface MascotDraw {
  /** Centre of the element, in frame coordinates: the point `sectorFor` measures from. */
  readonly cx: number
  readonly cy: number
  readonly cell: number
  /** Reaction cell to show instead of the pose, or null for the pose. */
  readonly reaction: number | null
  /** 0..1 from `Frame.squash`, or null. */
  readonly squash: number | null
}

export function drawMascot(ctx: Ctx2D, tiles: MascotTiles, at: MascotDraw): void {
  const index = at.reaction ?? at.cell
  const bank = at.reaction === null ? tiles.directions : tiles.reactions
  const tile = bank[Math.min(Math.max(index, 0), 8)]
  if (!tile) throw new Error(`no tile ${index}`)
  const { sx, sy } = squashAt(at.squash)
  const half = tiles.size / 2
  // The element's own transform origin, so a squash plants the feet instead of
  // pumping the whole sprite about its middle.
  const originY = at.cy - half + tiles.size * ORIGIN_Y
  ctx.save()
  ctx.translate(at.cx, originY)
  ctx.scale(sx, sy)
  ctx.translate(-at.cx, -originY)
  ctx.drawImage(tile, at.cx - half, at.cy - half, tiles.size, tiles.size)
  ctx.restore()
}
