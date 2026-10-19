import { ALPHA } from '../types'
import type { RawImage } from '../types'

/**
 * Fades the bottom of a tile to transparent, anchored to where THIS frame's body ends
 * (last row with alpha > 40) so every frame keeps its body and ends softly.
 * smoothstep ramp, build.py bottom_fade (alpha-only; blur stages are deferred).
 */
export function applyBottomFade(tile: RawImage, depth: number): RawImage {
  const { width, height } = tile
  const data = new Uint8ClampedArray(tile.data)
  let end = height
  for (let y = height - 1; y >= 0; y--) {
    let found = false
    for (let x = 0; x < width && !found; x++) found = data[(y * width + x) * 4 + 3]! > ALPHA.fade
    if (found) {
      end = y
      break
    }
  }
  const span = depth * height
  for (let y = 0; y < height; y++) {
    const linear = Math.min(1, Math.max(0, (y - (end - span)) / span))
    const keep = 1 - linear * linear * (3 - 2 * linear)
    if (keep >= 1) continue
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4 + 3
      data[p] = data[p]! * keep
    }
  }
  return { width, height, data }
}
