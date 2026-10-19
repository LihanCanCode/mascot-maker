/**
 * Lab-distance chroma key with un-premultiply despill and border-connected protection.
 * Port of key.py `key_out`. Ported from page-mascot (MIT, Kamran Ahmed).
 */
import { labPlanes, srgbToLab } from '../color/lab'
import { assertImage, borderTouchingIds, labelComponents } from '../raster'
import type { Mask, RawImage, Rgb } from '../types'

const MIN_DIVISOR = 0.04
const CANDIDATE_BELOW = 0.999

function rampAlpha(img: RawImage, colour: Rgb, tolLow: number, tolHigh: number): Float32Array {
  const planes = labPlanes(img)
  const key = srgbToLab(colour)
  const count = img.width * img.height
  const alpha = new Float32Array(count)
  const span = tolHigh - tolLow
  for (let p = 0; p < count; p++) {
    const d = Math.hypot(planes[p * 3]! - key.l, planes[p * 3 + 1]! - key.a, planes[p * 3 + 2]! - key.b)
    alpha[p] = Math.min(1, Math.max(0, (d - tolLow) / span))
  }
  return alpha
}

function candidateMask(alpha: Float32Array, width: number, height: number): Mask {
  const data = new Uint8Array(alpha.length)
  for (let p = 0; p < alpha.length; p++) data[p] = alpha[p]! < CANDIDATE_BELOW ? 1 : 0
  return { width, height, data }
}

export function keyOut(
  img: RawImage,
  colour: Rgb,
  tolLow: number,
  tolHigh: number,
): { image: RawImage; keyedFraction: number; protectedFraction: number } {
  assertImage(img)
  const { width, height } = img
  const count = width * height
  const alpha = rampAlpha(img, colour, tolLow, tolHigh)
  const candidates = candidateMask(alpha, width, height)
  const labels = labelComponents(candidates, 8)
  const touching = borderTouchingIds(labels, 1)
  const key = [colour.r, colour.g, colour.b]
  const out = new Uint8ClampedArray(img.data.length)
  let keyed = 0
  let candidateCount = 0
  let enclosed = 0
  for (let p = 0; p < count; p++) {
    const isCandidate = candidates.data[p] === 1
    if (isCandidate) candidateCount++
    const isEnclosed = isCandidate && !touching.has(labels.data[p]!)
    const a = isEnclosed ? 1 : alpha[p]!
    if (isEnclosed) enclosed++
    const divisor = Math.max(a, MIN_DIVISOR)
    for (let k = 0; k < 3; k++) {
      const v = img.data[p * 4 + k]!
      out[p * 4 + k] = a < 1 ? (v - (1 - divisor) * key[k]!) / divisor : v
    }
    out[p * 4 + 3] = a * 255
    if (out[p * 4 + 3]! < 5) keyed++
  }
  return {
    image: { width, height, data: out },
    keyedFraction: keyed / count,
    protectedFraction: enclosed / Math.max(candidateCount, 1),
  }
}
