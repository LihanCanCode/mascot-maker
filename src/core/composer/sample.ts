import type { RawImage } from '../types'

/**
 * Accumulates the premultiplied bilinear sample at source position (sx, sy) -- pixel i
 * covers [i, i+1) -- into acc = [r*a/255, g*a/255, b*a/255, a]. Outside the image is
 * transparent.
 */
export function addBilinear(src: RawImage, sx: number, sy: number, acc: Float64Array): void {
  const fx = sx - 0.5
  const fy = sy - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  for (let j = 0; j < 2; j++) {
    const y = y0 + j
    if (y < 0 || y >= src.height) continue
    const wy = j === 0 ? 1 - ty : ty
    for (let i = 0; i < 2; i++) {
      const x = x0 + i
      if (x < 0 || x >= src.width) continue
      const w = wy * (i === 0 ? 1 - tx : tx)
      if (w === 0) continue
      const p = (y * src.width + x) * 4
      const a = src.data[p + 3]!
      const k = (w * a) / 255
      acc[0] = acc[0]! + src.data[p]! * k
      acc[1] = acc[1]! + src.data[p + 1]! * k
      acc[2] = acc[2]! + src.data[p + 2]! * k
      acc[3] = acc[3]! + w * a
    }
  }
}

/** Writes the averaged premultiplied accumulator (over `count` samples) as straight RGBA. */
export function writeUnpremultiplied(acc: Float64Array, count: number, out: Uint8ClampedArray, p: number): void {
  const a = acc[3]! / count
  if (a <= 0) return
  const scale = 255 / acc[3]!
  out[p] = acc[0]! * scale
  out[p + 1] = acc[1]! * scale
  out[p + 2] = acc[2]! * scale
  out[p + 3] = a
}

/** Copies the nearest source pixel; transparent outside. */
export function copyNearest(src: RawImage, sx: number, sy: number, out: Uint8ClampedArray, p: number): void {
  const x = Math.floor(sx)
  const y = Math.floor(sy)
  if (x < 0 || y < 0 || x >= src.width || y >= src.height) return
  const q = (y * src.width + x) * 4
  out[p] = src.data[q]!
  out[p + 1] = src.data[q + 1]!
  out[p + 2] = src.data[q + 2]!
  out[p + 3] = src.data[q + 3]!
}
