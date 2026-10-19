/**
 * Erases a small watermark-like blob that sits entirely inside the bottom-right sheet corner
 * (where image-model watermarks such as the Gemini sparkle are placed). Other corners are left
 * alone: floating symbols (hearts, sparkles, zzz) legitimately drift toward the outer cells'
 * corners. A blob that reaches past the corner region is never touched.
 */
import { labelComponents } from '../raster'
import type { RawImage } from '../types'

const CORNER_FRACTION = 0.06
const MAX_AREA_FRACTION = 0.0025
const MIN_COUNTED_AREA = 8

export function removeCornerMarks(img: RawImage): { image: RawImage; removed: number } {
  const w = Math.max(1, Math.ceil(img.width * CORNER_FRACTION))
  const h = Math.max(1, Math.ceil(img.height * CORNER_FRACTION))
  const x0 = img.width - w
  const y0 = img.height - h
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = img.data[((y0 + y) * img.width + x0 + x) * 4 + 3]! > 0 ? 1 : 0
    }
  }
  const labels = labelComponents({ width: w, height: h, data: mask }, 8)
  const escaping = new Set<number>() // touches the crop sides that face the sheet interior
  for (let y = 0; y < h; y++) escaping.add(labels.data[y * w]!)
  for (let x = 0; x < w; x++) escaping.add(labels.data[x]!)
  const maxArea = img.width * img.height * MAX_AREA_FRACTION
  const erase = new Set<number>()
  let removed = 0
  for (let id = 1; id <= labels.count; id++) {
    if (escaping.has(id) || labels.areas[id]! >= maxArea) continue
    erase.add(id)
    if (labels.areas[id]! >= MIN_COUNTED_AREA) removed++
  }
  const data = new Uint8ClampedArray(img.data)
  if (erase.size > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (erase.has(labels.data[y * w + x]!)) data[((y0 + y) * img.width + x0 + x) * 4 + 3] = 0
      }
    }
  }
  return { image: { width: img.width, height: img.height, data }, removed }
}
