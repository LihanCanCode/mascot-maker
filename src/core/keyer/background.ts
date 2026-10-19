/**
 * Background detection from the four sheet corners (port of key.py `background`/`keyable`).
 * Ported from page-mascot (MIT, Kamran Ahmed).
 */
import { deltaE, srgbToLab } from '../color/lab'
import type { Lab, RawImage, Rgb } from '../types'

const MAX_PATCH = 40
const ALPHA_GONE = 10
const EXISTING_ALPHA_SHARE = 0.05
const P95 = 0.95
const NOISE_MARGIN = 2

export function hasExistingAlpha(img: RawImage): boolean {
  const count = img.width * img.height
  let transparent = 0
  for (let p = 0; p < count; p++) if (img.data[p * 4 + 3]! < ALPHA_GONE) transparent++
  return transparent / count > EXISTING_ALPHA_SHARE
}

function patchSize(img: RawImage): number {
  return Math.max(1, Math.min(MAX_PATCH, Math.floor(img.height / 4), Math.floor(img.width / 4)))
}

/** RGB triples (flat) of the four corner patches: TL, TR, BL, BR. */
function cornerPatches(img: RawImage): Uint8ClampedArray[] {
  const p = Math.min(patchSize(img), img.width, img.height)
  const origins: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [img.width - p, 0],
    [0, img.height - p],
    [img.width - p, img.height - p],
  ]
  return origins.map(([x0, y0]) => {
    const out = new Uint8ClampedArray(p * p * 3)
    let k = 0
    for (let y = y0; y < y0 + p; y++) {
      for (let x = x0; x < x0 + p; x++) {
        const i = (y * img.width + x) * 4
        out[k++] = img.data[i]!
        out[k++] = img.data[i + 1]!
        out[k++] = img.data[i + 2]!
      }
    }
    return out
  })
}

function channelMedian(patches: readonly Uint8ClampedArray[], channel: number): number {
  const hist = new Uint32Array(256)
  let n = 0
  for (const patch of patches) {
    for (let i = channel; i < patch.length; i += 3) {
      hist[patch[i]!]!++
      n++
    }
  }
  const valueAt = (rank: number): number => {
    let seen = 0
    for (let v = 0; v < 256; v++) {
      seen += hist[v]!
      if (seen > rank) return v
    }
    return 255
  }
  return n % 2 === 1 ? valueAt((n - 1) / 2) : (valueAt(n / 2 - 1) + valueAt(n / 2)) / 2
}

function cornerDeltas(patch: Uint8ClampedArray, key: Lab): Float32Array {
  const out = new Float32Array(patch.length / 3)
  for (let p = 0; p < out.length; p++) {
    const lab = srgbToLab({ r: patch[p * 3]!, g: patch[p * 3 + 1]!, b: patch[p * 3 + 2]! })
    out[p] = deltaE(lab, key)
  }
  return out
}

/**
 * TODO(limitation): only the four corners are sampled. A vignetted or gradient-lit background
 * whose centre gutters differ strongly from the corner colour is keyed against the corner
 * colour and may leave haze in the middle. Flagging it needs a new IssueCode (types.ts is
 * lead-owned), so it is not reported yet.
 *
 * Median corner colour plus the mean agreement (dE < tolHigh) of the best 3 of 4 corners. */
export function detectBackground(img: RawImage, tolHigh: number): { colour: Rgb; uniformity: number } {
  const patches = cornerPatches(img)
  const colour: Rgb = {
    r: channelMedian(patches, 0),
    g: channelMedian(patches, 1),
    b: channelMedian(patches, 2),
  }
  const key = srgbToLab(colour)
  const agreements = patches
    .map((patch) => {
      const d = cornerDeltas(patch, key)
      let agree = 0
      for (let i = 0; i < d.length; i++) if (d[i]! < tolHigh) agree++
      return agree / d.length
    })
    .sort((a, b) => b - a)
  const best = agreements.slice(0, 3)
  return { colour, uniformity: best.reduce((a, b) => a + b, 0) / best.length }
}

export function isKeyable(colour: Rgb, minSaturation: number): boolean {
  return Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b) >= minSaturation
}

function percentile(values: Float32Array, q: number): number {
  const sorted = Float32Array.from(values).sort()
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
}

/**
 * Effective tolLow: max(base, p95 of the corner dE + 2), measured on the three cleanest
 * corners so a watermark in one corner cannot inflate it. Absorbs JPEG / webp noise.
 */
export function noiseTolerance(img: RawImage, colour: Rgb, base: number): number {
  const key = srgbToLab(colour)
  const perCorner = cornerPatches(img).map((patch) => cornerDeltas(patch, key))
  const mean = (d: Float32Array): number => d.reduce((a, b) => a + b, 0) / d.length
  const clean = [...perCorner].sort((a, b) => mean(a) - mean(b)).slice(0, 3)
  const pooled = new Float32Array(clean.reduce((n, d) => n + d.length, 0))
  let at = 0
  for (const d of clean) {
    pooled.set(d, at)
    at += d.length
  }
  return Math.max(base, percentile(pooled, P95) + NOISE_MARGIN)
}
