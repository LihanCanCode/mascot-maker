import { describe, expect, it } from 'vitest'
import { createImage } from '../raster'
import { drawBust, drawCircle, expectUnchanged } from '../../test/draw'
import { DEFAULT_ALIGN_OPTIONS } from '../types'
import type { Mask } from '../types'
import {
  alignedCells, clippedCells, emptyCell, heartReactions, nearKeyCells, bustImage,
} from '../__fixtures__/alphaCells'
import { bestRowShift, bodyMask, fitBand, headWidth, lowerBand, measureCell, robustShoulderWidth, shoulderBox } from './index'

const blank = (w: number, h: number): Mask => ({ width: w, height: h, data: new Uint8Array(w * h) })
const rectMask = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask => {
  const m = blank(w, h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * w + x] = 1
  return m
}

describe('bands', () => {
  it('bodyMask keeps only the largest component', () => {
    const img = bustImage(120)
    const withSpeck = drawCircle(img, 5, 5, 2, { r: 1, g: 1, b: 1, a: 255 })
    const body = expectUnchanged(withSpeck, () => bodyMask(withSpeck, 128))
    expect(body.data[5 * 120 + 5]).toBe(0)
    expect(body.data[60 * 120 + 60]).toBe(1)
  })

  it('shoulderBox is the fixed-height sliver above the bottom row', () => {
    const m = rectMask(20, 20, 4, 2, 16, 18)
    expect(shoulderBox(m, 3)).toEqual({ x0: 4, y0: 14, x1: 16, y1: 18 })
    expect(shoulderBox(blank(5, 5), 3)).toBeNull()
  })

  it('shoulder width matches the drawn width within 1px', () => {
    const img = drawBust(createImage(120, 120), {
      cx: 60, headCy: 40, headR: 24, shoulderW: 32, shoulderH: 40, fill: { r: 9, g: 9, b: 9, a: 255 },
    })
    const box = shoulderBox(bodyMask(img, 128), 6)
    expect(Math.abs(box!.x1 - box!.x0 - 32)).toBeLessThanOrEqual(1)
  })

  it('headWidth measures the top band and is 0 when empty', () => {
    const m = rectMask(20, 20, 4, 0, 16, 20)
    expect(headWidth(m, 0.55)).toBe(12)
    expect(headWidth(blank(5, 5), 0.55)).toBe(0)
  })

  it('lowerBand and fitBand keep rows from the fraction down', () => {
    const m = rectMask(10, 20, 0, 0, 10, 20)
    const band = lowerBand(m, 0.5)
    expect(band.data[8 * 10]).toBe(0)
    expect(band.data[9 * 10]).toBe(1)
    expect(fitBand(m, 0.86).data.reduce((a, b) => a + b, 0)).toBe(40)
    expect(lowerBand(blank(4, 4), 0.5).data.some((v) => v === 1)).toBe(false)
  })
})

describe('robustShoulderWidth', () => {
  /** A bust whose rows widen towards the bottom; `cut` rows are kept (flat cut position). */
  const sloped = (rows: number): Mask => {
    const m = blank(100, 100)
    for (let y = 0; y < rows; y++) {
      const half = 10 + Math.min(30, y * 0.5)
      for (let x = Math.round(50 - half); x < Math.round(50 + half); x++) m.data[y * 100 + x] = 1
    }
    return m
  }

  it('is the median row extent of the lower band and ignores the last rows', () => {
    const a = robustShoulderWidth(sloped(80))
    expect(a).toBeGreaterThan(40)
    // A one-row spike at the very bottom (cut artefact) does not move it.
    const spiky = sloped(80)
    for (let x = 0; x < 100; x++) spiky.data[79 * 100 + x] = 1
    expect(robustShoulderWidth(spiky)).toBe(a)
  })

  it('does not follow ragged rows right at the cut, unlike the bottom-row box', () => {
    const ragged = (extra: number): Mask => {
      const m = sloped(80)
      for (const y of [78, 79]) for (let x = 50 - 40 - extra; x < 50 + 40 + extra; x++) m.data[y * 100 + x] = 1
      return m
    }
    const bottom = (extra: number): number => {
      const b = shoulderBox(ragged(extra), 1)!
      return b.x1 - b.x0
    }
    expect(bottom(10) - bottom(0)).toBeGreaterThan(10)
    expect(robustShoulderWidth(ragged(10))).toBe(robustShoulderWidth(ragged(0)))
  })

  it('handles empty and tiny bodies', () => {
    expect(robustShoulderWidth(blank(5, 5))).toBe(0)
    expect(robustShoulderWidth(rectMask(10, 10, 2, 4, 8, 5))).toBe(6)
  })
})

describe('bestRowShift', () => {
  it('finds a vertical offset and prefers 0 on ties', () => {
    const ref = rectMask(20, 40, 5, 10, 15, 20)
    const other = rectMask(20, 40, 5, 13, 15, 23)
    expect(bestRowShift(ref, other, 6)).toEqual({ dy: -3, iou: 1 })
    expect(bestRowShift(ref, ref, 6).dy).toBe(0)
    expect(bestRowShift(blank(5, 5), blank(5, 5), 2)).toEqual({ dy: 0, iou: 0 })
  })

  it('rejects masks of different size', () => {
    expect(() => bestRowShift(blank(5, 5), blank(6, 5), 1)).toThrow(RangeError)
  })
})

describe('measureCell', () => {
  const edge = 6
  it('measures a normal bust', () => {
    const cell = alignedCells()[4]!
    const m = expectUnchanged(cell.image, () => measureCell(cell.image, DEFAULT_ALIGN_OPTIONS, edge))
    expect(m.isEmpty).toBe(false)
    expect(m.shoulderBox).not.toBeNull()
    expect(m.shoulderWidth).toBeGreaterThan(30)
    expect(m.headWidth).toBeGreaterThan(m.shoulderWidth * 0.9)
    expect(m.bodyCoverage).toBeGreaterThan(0.1)
    expect(m.componentCount).toBe(1)
    expect(m.edgeContact).toEqual({ top: false, bottom: false, left: false, right: false })
    expect(m.translucentFraction).toBeLessThan(0.08)
  })

  it('excludes a floating heart from the body but keeps it in contentBox', () => {
    const m = measureCell(heartReactions()[0]!.image, DEFAULT_ALIGN_OPTIONS, edge)
    expect(m.contentBox!.y0).toBeLessThan(m.bodyBox!.y0)
    expect(m.componentCount).toBe(2)
  })

  it('reports edge contact for clipped cells', () => {
    const m = measureCell(clippedCells()[0]!.image, DEFAULT_ALIGN_OPTIONS, edge)
    expect(m.edgeContact.left).toBe(true)
    expect(m.edgeContact.right).toBe(true)
    expect(m.edgeContact.bottom).toBe(true)
  })

  it('reports empty cells', () => {
    const c = emptyCell()
    const m = measureCell(c.image, DEFAULT_ALIGN_OPTIONS, edge)
    expect(m.isEmpty).toBe(true)
    expect(m.shoulderBox).toBeNull()
    expect(m.shoulderWidth).toBe(0)
    expect(m.translucentFraction).toBe(0)
  })

  it('flags translucent interiors', () => {
    const m = measureCell(nearKeyCells()[4]!.image, DEFAULT_ALIGN_OPTIONS, edge)
    expect(m.translucentFraction).toBeGreaterThan(0.08)
  })
})
