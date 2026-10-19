/**
 * Edge-ring spill suppression and alpha feathering. Both only touch pixels near the
 * silhouette edge; interior pixels are copied unchanged.
 */
import type { RawImage, Rgb } from '../types'
import { windowCount, windowSum } from './box'

const LOW_ALPHA = 128
const OPAQUE_ALPHA = 250
/** Reference colours closer than this to the key cannot be told apart from it. */
const MIN_KEY_SEPARATION = 40
/** Max distance (RGB) of an edge pixel from the key-to-body blend line to count as a blend. */
const MAX_BLEND_RESIDUAL = 24
/** An edge pixel this close to a nearby interior (non-edge) colour IS a body colour (not a blend). */
const SAME_COLOUR = 6
/** Below this the un-mix would amplify error; snap to the body colour instead. */
const MIN_MIX = 0.2
const REFERENCE_REACH_EXTRA = 3

type Triple = readonly [number, number, number]

function cloneImage(img: RawImage): RawImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }
}

/** Non-zero where the pixel is within `radius` (Chebyshev) of a pixel with alpha < 128. */
function nearEdge(img: RawImage, radius: number): Float64Array {
  const low = new Uint8Array(img.width * img.height)
  for (let p = 0; p < low.length; p++) low[p] = img.data[p * 4 + 3]! < LOW_ALPHA ? 1 : 0
  return windowSum(low, img.width, img.height, radius)
}

function rgbAt(img: RawImage, p: number): Triple {
  return [img.data[p * 4]!, img.data[p * 4 + 1]!, img.data[p * 4 + 2]!]
}

function dist(a: Triple, b: Triple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Colour `p` expressed as K + c (F - K): mix amount c and distance off that line. */
function blendOf(p: Triple, key: Triple, ref: Triple): { c: number; off: number } {
  const span: Triple = [ref[0] - key[0], ref[1] - key[1], ref[2] - key[2]]
  const rel: Triple = [p[0] - key[0], p[1] - key[1], p[2] - key[2]]
  const len2 = span[0] ** 2 + span[1] ** 2 + span[2] ** 2
  const c = (rel[0] * span[0] + rel[1] * span[1] + rel[2] * span[2]) / len2
  return { c, off: Math.hypot(rel[0] - c * span[0], rel[1] - c * span[1], rel[2] - c * span[2]) }
}

interface Unmix {
  readonly ref: Triple
  readonly c: number
}

/**
 * Looks at the opaque colours around (x, y). Returns null when the pixel is itself one
 * of them (a genuine body colour) or no interior colour explains it as a key blend; otherwise
 * the opaque colour that explains it as the largest share of key (smallest mix c).
 */
function explainAsBlend(img: RawImage, ring: Float64Array, x: number, y: number, reach: number, key: Triple): Unmix | null {
  const here = rgbAt(img, y * img.width + x)
  let best: Unmix | null = null
  for (let ny = Math.max(0, y - reach); ny <= Math.min(img.height - 1, y + reach); ny++) {
    for (let nx = Math.max(0, x - reach); nx <= Math.min(img.width - 1, x + reach); nx++) {
      const q = ny * img.width + nx
      if (q === y * img.width + x || img.data[q * 4 + 3]! < OPAQUE_ALPHA) continue
      const ref = rgbAt(img, q)
      if (ring[q]! === 0 && dist(here, ref) < SAME_COLOUR) return null
      if (dist(ref, key) < MIN_KEY_SEPARATION) continue
      const { c, off } = blendOf(here, key, ref)
      if (c > 0 && c < 1 && off < MAX_BLEND_RESIDUAL && (!best || c < best.c)) {
        best = { ref, c }
      }
    }
  }
  return best
}

/**
 * Removes key-coloured fringe on edge pixels. An edge pixel that lies on the blend line between
 * the key colour and a nearby body colour is un-mixed back toward that body colour. A pixel that
 * already matches a nearby body colour (a green frog on a green key, a purple body on magenta)
 * is left alone, as is anything not on a blend line or with no opaque interior nearby.
 */
export function suppressSpill(img: RawImage, colour: Rgb, radius: number): RawImage {
  const out = cloneImage(img)
  if (radius <= 0) return out
  const key: Triple = [colour.r, colour.g, colour.b]
  const ring = nearEdge(img, radius)
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const p = y * img.width + x
      if (ring[p]! === 0 || img.data[p * 4 + 3]! === 0) continue
      const blend = explainAsBlend(img, ring, x, y, radius + REFERENCE_REACH_EXTRA, key)
      if (!blend) continue
      for (let k = 0; k < 3; k++) {
        const unmixed =
          blend.c < MIN_MIX ? blend.ref[k]! : (img.data[p * 4 + k]! - (1 - blend.c) * key[k]!) / blend.c
        out.data[p * 4 + k] = Math.min(255, Math.max(0, unmixed))
      }
    }
  }
  return out
}

/** alpha' = min(alpha, local mean) on edge pixels only: never raises alpha. */
export function featherAlpha(img: RawImage, radius: number): RawImage {
  const out = cloneImage(img)
  if (radius <= 0) return out
  const { width, height } = img
  const alpha = new Uint8Array(width * height)
  for (let p = 0; p < alpha.length; p++) alpha[p] = img.data[p * 4 + 3]!
  const sums = windowSum(alpha, width, height, radius)
  const ring = nearEdge(img, radius)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (ring[p]! === 0) continue
      const mean = sums[p]! / windowCount(width, height, radius, x, y)
      out.data[p * 4 + 3] = Math.min(alpha[p]!, Math.round(mean))
    }
  }
  return out
}
