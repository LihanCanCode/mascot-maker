import { invertTransform } from '../aligner/transform'
import { createImage } from '../raster'
import type { ComposeOptions, RawImage, ScaleTranslate } from '../types'
import { addBilinear, copyNearest, writeUnpremultiplied } from './sample'

const MAX_SUPERSAMPLE = 4

/**
 * The single resample: one source cell + its source->unit-tile transform -> a square tile.
 * `smooth` = premultiplied bilinear with n x n supersampling; `nearest` keeps hard edges.
 */
export function renderTile(cell: RawImage, toTile: ScaleTranslate, o: ComposeOptions): RawImage {
  const size = o.cellSize
  const out = createImage(size, size)
  const inv = invertTransform(toTile)
  const ratio = inv.scale / size
  const n = o.sampling === 'nearest' ? 1 : Math.min(MAX_SUPERSAMPLE, Math.max(1, Math.ceil(ratio)))
  const acc = new Float64Array(4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = ((x + 0.5) / size) * inv.scale + inv.tx
      const cy = ((y + 0.5) / size) * inv.scale + inv.ty
      const p = (y * size + x) * 4
      if (o.sampling === 'nearest') {
        copyNearest(cell, cx, cy, out.data, p)
        continue
      }
      acc.fill(0)
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          addBilinear(cell, cx + ((i + 0.5) / n - 0.5) * ratio, cy + ((j + 0.5) / n - 0.5) * ratio, acc)
        }
      }
      writeUnpremultiplied(acc, n * n, out.data, p)
    }
  }
  return out
}
