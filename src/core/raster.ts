/**
 * Raster primitives shared by every core module. Pure and DOM-free.
 * Functions never mutate their inputs; they allocate and fill new buffers.
 */
import type { Box, Labels, Mask, RawImage, Rgba } from './types'

const TRANSPARENT_BLACK: Rgba = { r: 0, g: 0, b: 0, a: 0 }

function assertDimension(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`)
  }
}

export function createImage(width: number, height: number, fill: Rgba = TRANSPARENT_BLACK): RawImage {
  assertDimension('width', width)
  assertDimension('height', height)
  const data = new Uint8ClampedArray(width * height * 4)
  if (fill.r !== 0 || fill.g !== 0 || fill.b !== 0 || fill.a !== 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill.r
      data[i + 1] = fill.g
      data[i + 2] = fill.b
      data[i + 3] = fill.a
    }
  }
  return { width, height, data }
}

export function assertImage(img: RawImage): void {
  if (img.data.length !== img.width * img.height * 4) {
    throw new RangeError(
      `image data length ${img.data.length} does not match ${img.width}x${img.height} RGBA`,
    )
  }
}

export function cropImage(img: RawImage, box: Box): RawImage {
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(img.width, Math.ceil(box.x1))
  const y1 = Math.min(img.height, Math.ceil(box.y1))
  if (x1 <= x0 || y1 <= y0) throw new RangeError('crop box is empty after clamping to the image')
  const width = x1 - x0
  const height = y1 - y0
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = ((y0 + y) * img.width + x0) * 4
    data.set(img.data.subarray(from, from + width * 4), y * width * 4)
  }
  return { width, height, data }
}

export function withAlpha(img: RawImage, alpha: Uint8Array | Uint8ClampedArray): RawImage {
  if (alpha.length !== img.width * img.height) {
    throw new RangeError(`alpha plane length ${alpha.length} does not match ${img.width}x${img.height}`)
  }
  const data = new Uint8ClampedArray(img.data)
  for (let p = 0; p < alpha.length; p++) data[p * 4 + 3] = alpha[p]!
  return { width: img.width, height: img.height, data }
}

/** Pixels whose alpha is strictly greater than `threshold`. */
export function alphaMask(img: RawImage, threshold: number): Mask {
  const data = new Uint8Array(img.width * img.height)
  for (let p = 0; p < data.length; p++) data[p] = img.data[p * 4 + 3]! > threshold ? 1 : 0
  return { width: img.width, height: img.height, data }
}

const NEIGHBOURS_4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const NEIGHBOURS_8: ReadonlyArray<readonly [number, number]> = [
  ...NEIGHBOURS_4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Iterative flood-fill labelling (explicit stack, safe for megapixel masks). */
export function labelComponents(mask: Mask, connectivity: 4 | 8): Labels {
  const { width, height } = mask
  const labels = new Int32Array(width * height)
  const areas: number[] = [0]
  const offsets = connectivity === 4 ? NEIGHBOURS_4 : NEIGHBOURS_8
  const stack = new Int32Array(width * height)
  let count = 0

  for (let start = 0; start < labels.length; start++) {
    if (mask.data[start] === 0 || labels[start] !== 0) continue
    count++
    let area = 0
    let top = 0
    stack[top++] = start
    labels[start] = count
    while (top > 0) {
      const p = stack[--top]!
      area++
      const px = p % width
      const py = (p - px) / width
      for (const [dx, dy] of offsets) {
        const nx = px + dx
        const ny = py + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const n = ny * width + nx
        if (mask.data[n] === 0 || labels[n] !== 0) continue
        labels[n] = count
        stack[top++] = n
      }
    }
    areas.push(area)
  }
  return { width, height, data: labels, count, areas }
}

function emptyMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) }
}

export function componentMask(labels: Labels, ids: ReadonlySet<number>): Mask {
  const data = new Uint8Array(labels.width * labels.height)
  for (let p = 0; p < data.length; p++) data[p] = ids.has(labels.data[p]!) ? 1 : 0
  return { width: labels.width, height: labels.height, data }
}

/** The biggest component as a mask; ties go to the lowest id. Empty mask when none. */
export function largestComponent(labels: Labels): Mask {
  if (labels.count === 0) return emptyMask(labels.width, labels.height)
  let best = 1
  for (let id = 2; id <= labels.count; id++) {
    if (labels.areas[id]! > labels.areas[best]!) best = id
  }
  return componentMask(labels, new Set([best]))
}

/** Half-open bounding box of set pixels, or null when the mask is empty. */
export function maskBounds(mask: Mask): Box | null {
  let x0 = mask.width
  let y0 = mask.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] === 0) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

export function maskArea(mask: Mask): number {
  let area = 0
  for (let p = 0; p < mask.data.length; p++) area += mask.data[p]!
  return area
}

/** Ids of components with any pixel within `band` pixels of the image border. */
export function borderTouchingIds(labels: Labels, band: number): ReadonlySet<number> {
  const ids = new Set<number>()
  const { width, height } = labels
  for (let y = 0; y < height; y++) {
    const inBandY = y < band || y >= height - band
    for (let x = 0; x < width; x++) {
      if (!inBandY && x >= band && x < width - band) continue
      const id = labels.data[y * width + x]!
      if (id !== 0) ids.add(id)
    }
  }
  return ids
}
