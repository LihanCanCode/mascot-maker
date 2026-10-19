import { describe, expect, it } from 'vitest'
import { expectUnchanged, fillImage } from '../../test/draw'
import { createImage } from '../raster'
import type { RawImage } from '../types'
import { featherAlpha, suppressSpill } from './spill'

const GREEN = { r: 0, g: 255, b: 0 }
const MAGENTA = { r: 255, g: 0, b: 255 }

type Colour = { r: number; g: number; b: number }

/** Columns 0-4 transparent, column 5 a half-transparent edge pixel, columns 6+ opaque body. */
function strip(edge: Colour, body: Colour, size = 12): RawImage {
  const img = createImage(size, size)
  const data = new Uint8ClampedArray(img.data)
  for (let y = 0; y < size; y++) {
    for (let x = 5; x < size; x++) {
      const c = x === 5 ? edge : body
      const i = (y * size + x) * 4
      data[i] = c.r
      data[i + 1] = c.g
      data[i + 2] = c.b
      data[i + 3] = x === 5 ? 128 : 255
    }
  }
  return { width: size, height: size, data }
}

const px = (img: RawImage, x: number, y: number): number[] => {
  const i = (y * img.width + x) * 4
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!]
}

const DARK = { r: 20, g: 20, b: 20 }

describe('suppressSpill', () => {
  it('cleans a green fringe next to a dark outline and never touches opaque pixels', () => {
    const img = strip({ r: 10, g: 230, b: 10 }, DARK)
    const out = expectUnchanged(img, () => suppressSpill(img, GREEN, 2))
    expect(px(out, 5, 6)).toEqual([20, 20, 20, 128])
    expect(px(out, 6, 6)).toEqual([20, 20, 20, 255])
    expect(px(out, 11, 6)).toEqual([20, 20, 20, 255])
  })

  it('cleans a magenta fringe on both key channels', () => {
    const img = strip({ r: 240, g: 10, b: 240 }, DARK)
    expect(px(suppressSpill(img, MAGENTA, 2), 5, 6)).toEqual([20, 20, 20, 128])
  })

  it('keeps a genuinely green body on a green key (no desaturation)', () => {
    const body = { r: 100, g: 200, b: 100 }
    const img = strip(body, body)
    const out = suppressSpill(img, GREEN, 2)
    expect(px(out, 5, 6)).toEqual([100, 200, 100, 128])
    expect(px(out, 6, 6)).toEqual([100, 200, 100, 255])
  })

  it('keeps a purple body on a magenta key (no dark rim)', () => {
    const body = { r: 150, g: 50, b: 200 }
    const out = suppressSpill(strip(body, body), MAGENTA, 2)
    expect(px(out, 5, 6)).toEqual([150, 50, 200, 128])
  })

  it('leaves edge pixels with no opaque neighbour alone', () => {
    const img = createImage(6, 6)
    const data = new Uint8ClampedArray(img.data)
    data.set([10, 230, 10, 128], (3 * 6 + 3) * 4)
    expect(px(suppressSpill({ ...img, data }, GREEN, 2), 3, 3)).toEqual([10, 230, 10, 128])
  })

  it('radius 0 returns an equal but distinct copy', () => {
    const img = strip({ r: 10, g: 230, b: 10 }, DARK)
    const out = suppressSpill(img, GREEN, 0)
    expect(out.data).not.toBe(img.data)
    expect(Array.from(out.data)).toEqual(Array.from(img.data))
  })

  it('leaves edge pixels alone when the nearby body is itself key-coloured', () => {
    const body = { r: 10, g: 250, b: 10 }
    const img = strip({ r: 5, g: 252, b: 5 }, body)
    expect(Array.from(suppressSpill(img, GREEN, 2).data)).toEqual(Array.from(img.data))
  })
})

/** Left half transparent, right half opaque. */
function halfSheet(c: Colour, size = 12): RawImage {
  const img = createImage(size, size)
  const data = new Uint8ClampedArray(img.data)
  for (let y = 0; y < size; y++) {
    for (let x = size / 2; x < size; x++) data.set([c.r, c.g, c.b, 255], (y * size + x) * 4)
  }
  return { width: size, height: size, data }
}

describe('featherAlpha', () => {
  it('never raises alpha and softens only the edge', () => {
    const img = halfSheet({ r: 10, g: 10, b: 10 })
    const out = expectUnchanged(img, () => featherAlpha(img, 1))
    for (let p = 0; p < img.width * img.height; p++) {
      expect(out.data[p * 4 + 3]!).toBeLessThanOrEqual(img.data[p * 4 + 3]!)
    }
    expect(px(out, 6, 6)[3]).toBeLessThan(255)
    expect(px(out, 11, 6)[3]).toBe(255)
  })

  it('radius 0 is an identity copy with a new buffer', () => {
    const img = fillImage(4, 4, { r: 1, g: 2, b: 3, a: 77 })
    const out = featherAlpha(img, 0)
    expect(out.data).not.toBe(img.data)
    expect(Array.from(out.data)).toEqual(Array.from(img.data))
  })
})
