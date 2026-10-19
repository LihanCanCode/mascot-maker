import { describe, expect, it } from 'vitest'
import {
  alphaMask,
  assertImage,
  borderTouchingIds,
  componentMask,
  createImage,
  cropImage,
  labelComponents,
  largestComponent,
  maskArea,
  maskBounds,
  withAlpha,
} from './raster'
import type { Mask } from './types'
import { drawRect, expectUnchanged, fillImage, TRANSPARENT } from '../test/draw'

function maskFrom(rows: readonly string[]): Mask {
  const height = rows.length
  const width = rows[0]!.length
  const data = new Uint8Array(width * height)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (data[y * width + x] = ch === '#' ? 1 : 0)))
  return { width, height, data }
}

describe('createImage', () => {
  it('creates a transparent black image by default', () => {
    const img = createImage(3, 2)
    expect(img.width).toBe(3)
    expect(img.height).toBe(2)
    expect(img.data.length).toBe(24)
    expect([...img.data].every((v) => v === 0)).toBe(true)
  })

  it('fills with the given colour', () => {
    const img = createImage(2, 2, { r: 10, g: 20, b: 30, a: 255 })
    expect([...img.data.slice(0, 4)]).toEqual([10, 20, 30, 255])
  })

  it.each([
    [0, 5],
    [5, 0],
    [1.5, 2],
    [-1, 2],
  ])('throws RangeError for %s x %s', (w, h) => {
    expect(() => createImage(w, h)).toThrow(RangeError)
  })
})

describe('assertImage', () => {
  it('accepts a consistent image and rejects a mismatched buffer', () => {
    expect(() => assertImage(createImage(2, 2))).not.toThrow()
    expect(() => assertImage({ width: 2, height: 2, data: new Uint8ClampedArray(3) })).toThrow()
  })
})

describe('cropImage', () => {
  const base = drawRect(fillImage(10, 10, TRANSPARENT), { x0: 2, y0: 3, x1: 6, y1: 7 }, { r: 255, g: 0, b: 0, a: 255 })

  it('crops without mutating the source', () => {
    const out = expectUnchanged(base, () => cropImage(base, { x0: 2, y0: 3, x1: 6, y1: 7 }))
    expect(out.width).toBe(4)
    expect(out.height).toBe(4)
    expect(out.data[3]).toBe(255)
  })

  it('clamps the box to the image bounds', () => {
    const out = cropImage(base, { x0: -5, y0: -5, x1: 4, y1: 4 })
    expect(out.width).toBe(4)
    expect(out.height).toBe(4)
  })

  it('throws RangeError for an empty box', () => {
    expect(() => cropImage(base, { x0: 5, y0: 5, x1: 5, y1: 9 })).toThrow(RangeError)
    expect(() => cropImage(base, { x0: 20, y0: 0, x1: 30, y1: 5 })).toThrow(RangeError)
  })
})

describe('withAlpha', () => {
  it('replaces alpha in a new image', () => {
    const img = fillImage(2, 1, { r: 9, g: 9, b: 9, a: 255 })
    const out = expectUnchanged(img, () => withAlpha(img, new Uint8Array([0, 128])))
    expect(out.data[3]).toBe(0)
    expect(out.data[7]).toBe(128)
    expect(out.data[0]).toBe(9)
  })

  it('throws when the alpha plane has the wrong length', () => {
    expect(() => withAlpha(createImage(2, 2), new Uint8Array(3))).toThrow(RangeError)
  })
})

describe('alphaMask', () => {
  it('marks pixels strictly above the threshold', () => {
    const img = createImage(3, 1)
    const data = new Uint8ClampedArray(img.data)
    data[3] = 100
    data[7] = 101
    data[11] = 255
    const mask = alphaMask({ ...img, data }, 100)
    expect([...mask.data]).toEqual([0, 1, 1])
  })
})

describe('labelComponents', () => {
  it('uses 4- vs 8-connectivity for a diagonal pair', () => {
    const mask = maskFrom(['#.', '.#'])
    expect(labelComponents(mask, 4).count).toBe(2)
    expect(labelComponents(mask, 8).count).toBe(1)
  })

  it('reports areas indexed by id with areas[0] === 0', () => {
    const mask = maskFrom(['##..#', '##..#', '.....'])
    const labels = labelComponents(mask, 8)
    expect(labels.count).toBe(2)
    expect(labels.areas.length).toBe(3)
    expect(labels.areas[0]).toBe(0)
    expect([...labels.areas.slice(1)].sort()).toEqual([2, 4])
  })

  it('labels a full 1000x1000 mask without a stack overflow', () => {
    const data = new Uint8Array(1000 * 1000).fill(1)
    const labels = labelComponents({ width: 1000, height: 1000, data }, 8)
    expect(labels.count).toBe(1)
    expect(labels.areas[1]).toBe(1_000_000)
  })

  it('returns count 0 for an empty mask', () => {
    const labels = labelComponents(maskFrom(['...', '...']), 8)
    expect(labels.count).toBe(0)
    expect(labels.areas).toEqual([0])
  })
})

describe('largestComponent / componentMask', () => {
  it('picks the largest component', () => {
    const labels = labelComponents(maskFrom(['##..#', '##..#', '....#']), 8)
    expect(maskArea(largestComponent(labels))).toBe(4)
  })

  it('breaks ties toward the lowest id', () => {
    const labels = labelComponents(maskFrom(['#.#']), 8)
    const largest = largestComponent(labels)
    expect([...largest.data]).toEqual([1, 0, 0])
  })

  it('returns an empty mask when there are no components', () => {
    const labels = labelComponents(maskFrom(['...']), 8)
    expect(maskArea(largestComponent(labels))).toBe(0)
  })

  it('componentMask keeps only requested ids', () => {
    const labels = labelComponents(maskFrom(['#.#.#']), 8)
    const picked = componentMask(labels, new Set([1, 3]))
    expect([...picked.data]).toEqual([1, 0, 0, 0, 1])
  })
})

describe('maskBounds / maskArea', () => {
  it('returns a half-open bounding box', () => {
    const mask = maskFrom(['.....', '.##..', '.##..', '.....'])
    expect(maskBounds(mask)).toEqual({ x0: 1, y0: 1, x1: 3, y1: 3 })
    expect(maskArea(mask)).toBe(4)
  })

  it('returns null for an empty mask', () => {
    expect(maskBounds(maskFrom(['..', '..']))).toBeNull()
  })
})

describe('borderTouchingIds', () => {
  it('finds components that touch the border band', () => {
    const mask = maskFrom(['#.....', '......', '..##..', '..##..', '......'])
    const labels = labelComponents(mask, 8)
    const ids = borderTouchingIds(labels, 1)
    expect(ids.size).toBe(1)
    const touching = componentMask(labels, ids)
    expect(touching.data[0]).toBe(1)
  })

  it('treats a wider band as reaching further in', () => {
    const mask = maskFrom(['......', '.#....', '......', '......', '......'])
    const labels = labelComponents(mask, 8)
    expect(borderTouchingIds(labels, 1).size).toBe(0)
    expect(borderTouchingIds(labels, 2).size).toBe(1)
  })
})
