/**
 * Step 4: one square crop for all 18 frames, bottom edge anchored at `bottomAnchor`
 * of the tile (build.py crop block).
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import { maskBounds } from '../raster'
import type { AlignOptions, Box, Mask, ScaleTranslate } from '../types'
import { composeTransforms } from './transform'

export interface CropBox {
  readonly left: number
  readonly top: number
  readonly side: number
}

/** `bounds` are content boxes (null = empty frame) in canvas px; `canvas` is the fallback. */
export function cropFromBounds(
  bounds: readonly (Box | null)[],
  o: AlignOptions,
  unit: number,
  canvas: { width: number; height: number },
): CropBox {
  const boxes = bounds.filter((b): b is Box => b !== null)
  const all = boxes.length > 0 ? boxes : [{ x0: 0, y0: 0, x1: canvas.width, y1: canvas.height }]
  const top = Math.min(...all.map((b) => b.y0)) - o.cropPadTopAt341 * unit
  const left = Math.min(...all.map((b) => b.x0))
  const right = Math.max(...all.map((b) => b.x1))
  const bottom = Math.max(...all.map((b) => b.y1))
  const side = Math.max(
    1,
    Math.round(Math.max(right - left + o.cropPadSideAt341 * unit, (bottom - top) / o.bottomAnchor)),
  )
  return {
    left: Math.round((left + right) / 2 - side / 2),
    top: bottom - Math.round(o.bottomAnchor * side),
    side,
  }
}

export function computeCrop(
  contentMasks: readonly Mask[],
  o: AlignOptions,
  unit: number,
): CropBox {
  const first = contentMasks[0]
  const canvas = first ? { width: first.width, height: first.height } : { width: 1, height: 1 }
  return cropFromBounds(contentMasks.map(maskBounds), o, unit, canvas)
}

/** Source-cell px -> unit tile square, given a cell's canvas transform and the crop. */
export function tileTransform(canvasTransform: ScaleTranslate, crop: CropBox): ScaleTranslate {
  return composeTransforms(canvasTransform, {
    scale: 1 / crop.side,
    tx: -crop.left / crop.side,
    ty: -crop.top / crop.side,
  })
}

/** Content box of a cell mapped to canvas px (axis-aligned, so exact), pixel-snapped outward. */
export function mapBox(box: Box, t: ScaleTranslate): Box {
  return {
    x0: Math.floor(box.x0 * t.scale + t.tx),
    y0: Math.floor(box.y0 * t.scale + t.ty),
    x1: Math.ceil(box.x1 * t.scale + t.tx),
    y1: Math.ceil(box.y1 * t.scale + t.ty),
  }
}
