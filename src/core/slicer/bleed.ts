/**
 * Port of build.py `drop_bleed`: erase opaque blobs that touch the cell's edge band,
 * except the largest one. Ported from page-mascot (MIT, Kamran Ahmed).
 */
import { borderTouchingIds, labelComponents } from '../raster'
import type { RawImage } from '../types'

function largestId(areas: readonly number[], count: number): number {
  let best = 1
  for (let id = 2; id <= count; id++) if (areas[id]! > areas[best]!) best = id
  return best
}

export function dropBleed(
  cell: RawImage,
  band: number,
  alphaThreshold: number,
): { image: RawImage; removed: number } {
  const copy = (): RawImage => ({ width: cell.width, height: cell.height, data: new Uint8ClampedArray(cell.data) })
  const count = cell.width * cell.height
  const opaque = new Uint8Array(count)
  for (let p = 0; p < count; p++) opaque[p] = cell.data[p * 4 + 3]! > alphaThreshold ? 1 : 0
  const labels = labelComponents({ width: cell.width, height: cell.height, data: opaque }, 4)
  if (labels.count === 0) return { image: copy(), removed: 0 }
  const keep = largestId(labels.areas, labels.count)
  const touching = new Set(borderTouchingIds(labels, band))
  touching.delete(keep)
  if (touching.size === 0) return { image: copy(), removed: 0 }
  const image = copy()
  for (let p = 0; p < count; p++) if (touching.has(labels.data[p]!)) image.data[p * 4 + 3] = 0
  return { image, removed: touching.size }
}
