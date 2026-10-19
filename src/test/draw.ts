/**
 * Test-only drawing helpers. Every function returns a NEW image; none mutate their inputs.
 * Fixtures are generated in code so tests need no binary assets.
 */
import type { Box, RawImage, Rgba } from '../core/types'

export const OPAQUE_BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 }
export const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 }

/** Small deterministic PRNG so fixtures are reproducible. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function fillImage(width: number, height: number, rgba: Rgba): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba.r
    data[i + 1] = rgba.g
    data[i + 2] = rgba.b
    data[i + 3] = rgba.a
  }
  return { width, height, data }
}

function cloneImage(img: RawImage): RawImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }
}

/** Source-over blend of `src` (with coverage 0..1) onto the pixel at index `i` of `data`. */
function blendPixel(data: Uint8ClampedArray, i: number, src: Rgba, coverage: number): void {
  const a = (src.a / 255) * coverage
  if (a <= 0) return
  const dstA = data[i + 3]! / 255
  const outA = a + dstA * (1 - a)
  if (outA <= 0) return
  data[i] = (src.r * a + data[i]! * dstA * (1 - a)) / outA
  data[i + 1] = (src.g * a + data[i + 1]! * dstA * (1 - a)) / outA
  data[i + 2] = (src.b * a + data[i + 2]! * dstA * (1 - a)) / outA
  data[i + 3] = outA * 255
}

export interface CircleOptions {
  /** One-pixel coverage ramp at the edge. Default true. */
  readonly antialias?: boolean
}

export function drawCircle(
  img: RawImage,
  cx: number,
  cy: number,
  r: number,
  rgba: Rgba,
  options: CircleOptions = {},
): RawImage {
  const out = cloneImage(img)
  const antialias = options.antialias ?? true
  const x0 = Math.max(0, Math.floor(cx - r - 1))
  const x1 = Math.min(img.width - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1))
  const y1 = Math.min(img.height - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const coverage = antialias ? Math.min(1, Math.max(0, r - d + 0.5)) : d <= r ? 1 : 0
      if (coverage > 0) blendPixel(out.data, (y * img.width + x) * 4, rgba, coverage)
    }
  }
  return out
}

export function drawRect(img: RawImage, box: Box, rgba: Rgba): RawImage {
  const out = cloneImage(img)
  const x0 = Math.max(0, Math.floor(box.x0))
  const x1 = Math.min(img.width, Math.ceil(box.x1))
  const y0 = Math.max(0, Math.floor(box.y0))
  const y1 = Math.min(img.height, Math.ceil(box.y1))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) blendPixel(out.data, (y * img.width + x) * 4, rgba, 1)
  }
  return out
}

export interface BustOptions {
  readonly cx: number
  /** Vertical centre of the head circle. */
  readonly headCy: number
  readonly headR: number
  /** Total shoulder width; about 0.66 of the head width (2 * headR) for real characters. */
  readonly shoulderW: number
  readonly shoulderH: number
  readonly fill: Rgba
  readonly outline?: Rgba
  readonly outlinePx?: number
}

/**
 * A head circle sitting on a rounded shoulder block: ONE connected body whose bottom row
 * is the shoulder block's bottom edge. Optional outline is drawn first, slightly larger.
 */
export function drawBust(img: RawImage, o: BustOptions): RawImage {
  const outline = o.outline
  const px = o.outlinePx ?? 0
  const shoulderTop = o.headCy + o.headR * 0.85
  let out = img
  const paint = (grow: number, colour: Rgba): void => {
    out = drawCircle(out, o.cx, o.headCy, o.headR + grow, colour)
    out = drawRect(
      out,
      {
        x0: o.cx - o.shoulderW / 2 - grow,
        y0: shoulderTop - grow,
        x1: o.cx + o.shoulderW / 2 + grow,
        y1: shoulderTop + o.shoulderH + grow,
      },
      colour,
    )
  }
  if (outline && px > 0) paint(px, outline)
  paint(0, o.fill)
  return out
}

export function drawCheckerboard(
  width: number,
  height: number,
  square: number,
  c1: Rgba,
  c2: Rgba,
): RawImage {
  const img = fillImage(width, height, c1)
  const data = new Uint8ClampedArray(img.data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const odd = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 1
      if (!odd) continue
      const i = (y * width + x) * 4
      data[i] = c2.r
      data[i + 1] = c2.g
      data[i + 2] = c2.b
      data[i + 3] = c2.a
    }
  }
  return { width, height, data }
}

/** Cheap content hash (FNV-1a over dimensions and bytes) for immutability assertions. */
export function imageHash(img: RawImage): string {
  let h = 0x811c9dc5
  const mix = (v: number): void => {
    h ^= v & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
  }
  mix(img.width)
  mix(img.width >>> 8)
  mix(img.height)
  mix(img.height >>> 8)
  for (let i = 0; i < img.data.length; i++) mix(img.data[i]!)
  return h.toString(16)
}

/**
 * Runs `fn` and asserts the image was not mutated. Returns whatever `fn` returned.
 * Use in core tests: `expectUnchanged(input, () => keyOut(input, ...))`.
 */
export function expectUnchanged<T>(img: RawImage, fn: () => T): T {
  const before = imageHash(img)
  const copy = new Uint8ClampedArray(img.data)
  const result = fn()
  if (imageHash(img) !== before || !copy.every((v, i) => v === img.data[i])) {
    throw new Error('input RawImage was mutated')
  }
  return result
}
