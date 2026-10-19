/**
 * sRGB -> CIE Lab (D65) conversion, same maths as key.py `lab`.
 * Ported from page-mascot (MIT, Kamran Ahmed).
 */
import type { Lab, RawImage, Rgb } from '../types'

const DELTA = 6 / 29
const DELTA_CUBED = DELTA ** 3
const WHITE_X = 0.95047
const WHITE_Z = 1.08883

/** sRGB byte -> linear light, 256 entries. */
const LINEAR_LUT: Float64Array = (() => {
  const lut = new Float64Array(256)
  for (let i = 0; i < 256; i++) {
    const c = i / 255
    lut[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return lut
})()

function linear(channel: number): number {
  const c = Math.min(255, Math.max(0, channel))
  const lo = Math.floor(c)
  if (lo === c) return LINEAR_LUT[lo]!
  const hi = Math.min(255, lo + 1)
  return LINEAR_LUT[lo]! + (LINEAR_LUT[hi]! - LINEAR_LUT[lo]!) * (c - lo)
}

function f(t: number): number {
  return t > DELTA_CUBED ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29
}

export function srgbToLab(c: Rgb): Lab {
  const r = linear(c.r)
  const g = linear(c.g)
  const b = linear(c.b)
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_X)
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b)
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE_Z)
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

/** Interleaved L,a,b for every pixel (alpha ignored). */
export function labPlanes(img: RawImage): Float32Array {
  const count = img.width * img.height
  const out = new Float32Array(count * 3)
  const src = img.data
  let lastKey = -1
  let lab: Lab = { l: 0, a: 0, b: 0 }
  for (let p = 0; p < count; p++) {
    const key = (src[p * 4]! << 16) | (src[p * 4 + 1]! << 8) | src[p * 4 + 2]!
    // Flat regions repeat the same colour; skip the conversion for runs of equal pixels.
    if (key !== lastKey) {
      lab = srgbToLab({ r: src[p * 4]!, g: src[p * 4 + 1]!, b: src[p * 4 + 2]! })
      lastKey = key
    }
    out[p * 3] = lab.l
    out[p * 3 + 1] = lab.a
    out[p * 3 + 2] = lab.b
  }
  return out
}

/** CIE76 colour difference. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b)
}

export function rgbToHex(c: Rgb): string {
  const hex = (v: number): string =>
    Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0').toUpperCase()
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`
}
