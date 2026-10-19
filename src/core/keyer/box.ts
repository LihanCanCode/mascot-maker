/**
 * Separable box filters over single-channel planes. Pure; each call allocates its output.
 */

/**
 * Sum over the (2r+1)^2 window around every pixel, with the window truncated at the image
 * border. Returns the sums and (when requested) is paired with `windowCount` for averages.
 */
export function windowSum(src: ArrayLike<number>, width: number, height: number, r: number): Float64Array {
  const horizontal = new Float64Array(width * height)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let acc = 0
    for (let x = 0; x < Math.min(r, width); x++) acc += src[row + x]!
    for (let x = 0; x < width; x++) {
      if (x + r < width) acc += src[row + x + r]!
      if (x - r - 1 >= 0) acc -= src[row + x - r - 1]!
      horizontal[row + x] = acc
    }
  }
  const out = new Float64Array(width * height)
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let y = 0; y < Math.min(r, height); y++) acc += horizontal[y * width + x]!
    for (let y = 0; y < height; y++) {
      if (y + r < height) acc += horizontal[(y + r) * width + x]!
      if (y - r - 1 >= 0) acc -= horizontal[(y - r - 1) * width + x]!
      out[y * width + x] = acc
    }
  }
  return out
}

/** Number of in-bounds pixels in the truncated (2r+1)^2 window at (x, y). */
export function windowCount(width: number, height: number, r: number, x: number, y: number): number {
  const w = Math.min(width - 1, x + r) - Math.max(0, x - r) + 1
  const h = Math.min(height - 1, y + r) - Math.max(0, y - r) + 1
  return w * h
}

function reflect(i: number, n: number): number {
  if (i < 0) return -i - 1
  if (i >= n) return 2 * n - i - 1
  return i
}

/** Mean filter of odd `size` with scipy's default 'reflect' border (half-sample symmetric). */
export function reflectMean(src: Float64Array, width: number, height: number, size: number): Float64Array {
  const r = (size - 1) / 2
  const tmp = new Float64Array(width * height)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let acc = 0
    for (let k = -r; k <= r; k++) acc += src[row + reflect(k, width)]!
    for (let x = 0; x < width; x++) {
      tmp[row + x] = acc / size
      acc += src[row + reflect(x + r + 1, width)]! - src[row + reflect(x - r, width)]!
    }
  }
  const out = new Float64Array(width * height)
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let k = -r; k <= r; k++) acc += tmp[reflect(k, height) * width + x]!
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / size
      acc += tmp[reflect(y + r + 1, height) * width + x]! - tmp[reflect(y - r, height) * width + x]!
    }
  }
  return out
}
