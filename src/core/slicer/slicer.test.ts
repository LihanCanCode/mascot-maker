import { describe, expect, it } from 'vitest'
import {
  bleedSheet, greenSheet, marginSheet, ruleLineSheet, twelveSheet, wideSheet,
} from '../__fixtures__/opaqueSheets'
import type { Fixture } from '../__fixtures__/opaqueSheets'
import { keySheet } from '../keyer'
import { createImage } from '../raster'
import { DEFAULT_KEY_OPTIONS, DEFAULT_SLICE_OPTIONS } from '../types'
import type { RawImage } from '../types'
import { expectUnchanged } from '../../test/draw'
import { dropBleed } from './bleed'
import { detectGrid } from './grid'
import { swapOuterColumns } from './reorder'
import { eraseRuleLines, findRuleLines } from './ruleLines'
import { sliceSheet } from './slice'

function keyed(f: Fixture): RawImage {
  const r = keySheet(f.image, { ...DEFAULT_KEY_OPTIONS, spillRadius: 0 })
  if (!r.ok) throw new Error(r.reason)
  return r.image
}

const alphaAt = (img: RawImage, x: number, y: number): number => img.data[(y * img.width + x) * 4 + 3]!

describe('findRuleLines / eraseRuleLines', () => {
  it('finds 2 + 2 two-pixel lines and erases them', () => {
    const img = keyed(ruleLineSheet())
    const lines = expectUnchanged(img, () => findRuleLines(img, DEFAULT_SLICE_OPTIONS))
    expect(lines.columns).toEqual([119, 120, 239, 240])
    expect(lines.rows).toEqual([119, 120, 239, 240])
    const erased = expectUnchanged(img, () => eraseRuleLines(img, lines))
    for (const x of lines.columns) expect(alphaAt(erased, x, 5)).toBe(0)
    for (const y of lines.rows) expect(alphaAt(erased, 5, y)).toBe(0)
  })

  it('finds nothing on a plain sheet and returns an equal copy when erasing nothing', () => {
    const img = keyed(greenSheet())
    const lines = findRuleLines(img, DEFAULT_SLICE_OPTIONS)
    expect(lines).toEqual({ columns: [], rows: [] })
    const out = eraseRuleLines(img, lines)
    expect(out.data).not.toBe(img.data)
    expect(Array.from(out.data)).toEqual(Array.from(img.data))
  })

  it('ignores thick fully-opaque bands (art, not lines)', () => {
    const img = createImage(100, 100, { r: 0, g: 0, b: 0, a: 255 })
    expect(findRuleLines(img, DEFAULT_SLICE_OPTIONS)).toEqual({ columns: [], rows: [] })
  })
})

describe('detectGrid', () => {
  it('lands within 3 px of the gutter centres on an offset margin sheet', () => {
    const f = marginSheet()
    const img = keyed(f)
    const grid = expectUnchanged(img, () => detectGrid(img, DEFAULT_SLICE_OPTIONS))
    expect(grid.method).toBe('gutters')
    expect(grid.confidence).toBe(1)
    expect(grid.xCuts[0]).toBe(0)
    expect(grid.xCuts[3]).toBe(img.width)
    f.cutsX.forEach((c, i) => expect(Math.abs(grid.xCuts[i + 1]! - c)).toBeLessThanOrEqual(3))
    f.cutsY.forEach((c, i) => expect(Math.abs(grid.yCuts[i + 1]! - c)).toBeLessThanOrEqual(3))
  })

  it('falls back to equal thirds when grid detection is off', () => {
    const img = keyed(greenSheet())
    const grid = detectGrid(img, { ...DEFAULT_SLICE_OPTIONS, detectGrid: false })
    expect(grid.method).toBe('equal')
    expect(Array.from(grid.xCuts)).toEqual([0, 120, 240, 360])
    expect(Array.from(grid.yCuts)).toEqual([0, 120, 240, 360])
  })

  it('falls back to equal thirds when the content spans under half the sheet', () => {
    const img = createImage(300, 300)
    const data = new Uint8ClampedArray(img.data)
    for (let y = 100; y < 110; y++) for (let x = 100; x < 110; x++) data[(y * 300 + x) * 4 + 3] = 255
    const grid = detectGrid({ ...img, data }, DEFAULT_SLICE_OPTIONS)
    expect(grid.method).toBe('equal')
    expect(grid.confidence).toBe(0)
    expect(Array.from(grid.xCuts)).toEqual([0, 100, 200, 300])
  })

  it('gives wide sheets 180x120 cells', () => {
    const img = keyed(wideSheet())
    const grid = detectGrid(img, DEFAULT_SLICE_OPTIONS)
    expect(grid.xCuts[2]! - grid.xCuts[1]!).toBe(180)
    expect(grid.yCuts[2]! - grid.yCuts[1]!).toBe(120)
  })

  it('reports reduced confidence when a limb blocks the gutter', () => {
    const img = keyed(bleedSheet())
    const grid = detectGrid(img, DEFAULT_SLICE_OPTIONS)
    expect(grid.confidence).toBeLessThan(1)
    expect(grid.xCuts[2]).toBeGreaterThanOrEqual(209)
    expect(grid.xCuts[2]).toBeLessThanOrEqual(257)
  })
})

describe('dropBleed', () => {
  it('erases fragments touching the edge and keeps the main body', () => {
    const cell = createImage(120, 120)
    const data = new Uint8ClampedArray(cell.data)
    for (let y = 40; y < 90; y++) for (let x = 40; x < 80; x++) data[(y * 120 + x) * 4 + 3] = 255
    for (let y = 20; y < 26; y++) for (let x = 100; x < 120; x++) data[(y * 120 + x) * 4 + 3] = 255
    const src = { ...cell, data }
    const out = expectUnchanged(src, () => dropBleed(src, 2, 40))
    expect(out.removed).toBe(1)
    expect(alphaAt(out.image, 110, 22)).toBe(0)
    expect(alphaAt(out.image, 60, 60)).toBe(255)
  })

  it('is a no-op copy when nothing touches the edge', () => {
    const cell = createImage(50, 50)
    const data = new Uint8ClampedArray(cell.data)
    data[(25 * 50 + 25) * 4 + 3] = 255
    const out = dropBleed({ ...cell, data }, 2, 40)
    expect(out.removed).toBe(0)
    expect(Array.from(out.image.data)).toEqual(Array.from(data))
  })

  it('keeps the largest blob even when it touches the edge', () => {
    const cell = createImage(50, 50)
    const data = new Uint8ClampedArray(cell.data)
    for (let y = 20; y < 50; y++) for (let x = 10; x < 40; x++) data[(y * 50 + x) * 4 + 3] = 255
    const out = dropBleed({ ...cell, data }, 2, 40)
    expect(out.removed).toBe(0)
  })

  it('handles an empty cell', () => {
    expect(dropBleed(createImage(10, 10), 2, 40).removed).toBe(0)
  })
})

describe('swapOuterColumns', () => {
  it('reorders to [2,1,0,5,4,3,8,7,6]', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    expect(swapOuterColumns(input)).toEqual([2, 1, 0, 5, 4, 3, 8, 7, 6])
    expect(input).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('rejects arrays that are not length 9', () => {
    expect(() => swapOuterColumns([1, 2, 3])).toThrow(RangeError)
  })
})

describe('sliceSheet', () => {
  it('produces 9 indexed cells with matching source boxes', () => {
    const img = keyed(greenSheet())
    const r = expectUnchanged(img, () => sliceSheet(img, 'directions', DEFAULT_SLICE_OPTIONS, false))
    expect(r.cells).toHaveLength(9)
    r.cells.forEach((c, i) => {
      expect(c.index).toBe(i)
      expect(c.sheet).toBe('directions')
      expect(c.image.width).toBe(c.sourceBox.x1 - c.sourceBox.x0)
      expect(c.image.height).toBe(c.sourceBox.y1 - c.sourceBox.y0)
    })
    expect(r.cells[4]!.sourceBox).toEqual({ x0: 120, y0: 120, x1: 240, y1: 240 })
    expect(r.significantBlobCount).toBe(9)
    expect(r.ruleLinesRemoved).toBe(0)
  })

  it('swaps outer columns of directions only, rewriting indices', () => {
    const img = keyed(greenSheet())
    const plain = sliceSheet(img, 'directions', DEFAULT_SLICE_OPTIONS, false)
    const swapped = sliceSheet(img, 'directions', DEFAULT_SLICE_OPTIONS, true)
    expect(swapped.cells.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(swapped.cells[0]!.sourceBox).toEqual(plain.cells[2]!.sourceBox)
    expect(swapped.cells[2]!.sourceBox).toEqual(plain.cells[0]!.sourceBox)
    const reactions = sliceSheet(img, 'reactions', DEFAULT_SLICE_OPTIONS, true)
    expect(reactions.cells[0]!.sourceBox).toEqual(plain.cells[0]!.sourceBox)
  })

  it('removes rule lines and leaves cells without edge contact', () => {
    const img = keyed(ruleLineSheet())
    const r = sliceSheet(img, 'reactions', DEFAULT_SLICE_OPTIONS, false)
    expect(r.ruleLinesRemoved).toBe(4)
    expect(r.significantBlobCount).toBe(9)
    for (const c of r.cells) {
      expect(c.fragmentsRemoved).toBe(0)
      for (let i = 0; i < c.image.width; i++) {
        expect(alphaAt(c.image, i, 0)).toBeLessThan(40)
        expect(alphaAt(c.image, i, c.image.height - 1)).toBeLessThan(40)
      }
    }
  })

  it('removes bleed fragments from cell 1 and keeps cell 2 body', () => {
    const img = keyed(bleedSheet())
    const r = sliceSheet(img, 'directions', DEFAULT_SLICE_OPTIONS, false)
    expect(r.cells[1]!.fragmentsRemoved).toBe(1)
    expect(r.cells[2]!.fragmentsRemoved).toBe(1)
    expect(alphaAt(r.cells[2]!.image, 60, 60)).toBe(255)
  })

  it('counts twelve blobs on a 4x3 sheet', () => {
    const img = keyed(twelveSheet())
    expect(sliceSheet(img, 'directions', DEFAULT_SLICE_OPTIONS, false).significantBlobCount).toBe(12)
  })

  it('rejects images too small to cut into thirds', () => {
    expect(() => sliceSheet(createImage(2, 2), 'directions', DEFAULT_SLICE_OPTIONS, false)).toThrow(RangeError)
  })
})
