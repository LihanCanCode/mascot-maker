import type { Mask, ScaleTranslate } from '../types'

/**
 * Nearest-neighbour inverse warp. Output pixel (x, y) has its centre at canvas position
 * `step * (x + 0.5)`; `t` maps source px to canvas px.
 */
function warpSampled(src: Mask, t: ScaleTranslate, outW: number, outH: number, step: number): Mask {
  if (!(t.scale > 0)) throw new RangeError(`warp needs a positive scale, got ${t.scale}`)
  const data = new Uint8Array(outW * outH)
  const inv = 1 / t.scale
  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((step * (y + 0.5) - t.ty) * inv)
    if (sy < 0 || sy >= src.height) continue
    for (let x = 0; x < outW; x++) {
      const sx = Math.floor((step * (x + 0.5) - t.tx) * inv)
      if (sx >= 0 && sx < src.width) data[y * outW + x] = src.data[sy * src.width + sx]!
    }
  }
  return { width: outW, height: outH, data }
}

export function warpMask(src: Mask, t: ScaleTranslate, outW: number, outH: number): Mask {
  return warpSampled(src, t, outW, outH, 1)
}

/** Warp onto a canvas of canvasW x canvasH, sampled at quarter resolution. */
export function warpMaskQuarter(src: Mask, t: ScaleTranslate, canvasW: number, canvasH: number): Mask {
  return warpSampled(src, t, Math.ceil(canvasW / 4), Math.ceil(canvasH / 4), 4)
}
