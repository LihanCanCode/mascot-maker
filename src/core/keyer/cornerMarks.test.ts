import { describe, expect, it } from 'vitest'
import { greenSheet, watermarkSheet } from '../__fixtures__/opaqueSheets'
import { expectUnchanged } from '../../test/draw'
import { createImage } from '../raster'
import type { RawImage } from '../types'
import { keyOut } from './keyOut'
import { removeCornerMarks } from './cornerMarks'

const GREEN = { r: 0, g: 255, b: 0 }

/** Transparent sheet with an opaque square blob. */
function sheetWithBlob(size: number, x0: number, y0: number, side: number): RawImage {
  const img = createImage(size, size)
  const data = new Uint8ClampedArray(img.data)
  for (let y = y0; y < y0 + side; y++) for (let x = x0; x < x0 + side; x++) data[(y * size + x) * 4 + 3] = 255
  return { ...img, data }
}

const alpha = (img: RawImage, x: number, y: number): number => img.data[(y * img.width + x) * 4 + 3]!

describe('removeCornerMarks', () => {
  it('erases a watermark star in the bottom-right corner (removed = 1)', () => {
    const { image, extras } = watermarkSheet()
    const keyed = keyOut(image, GREEN, 6, 26).image
    const out = expectUnchanged(keyed, () => removeCornerMarks(keyed))
    const star = extras[0]!
    const cx = Math.round((star.x0 + star.x1) / 2)
    const cy = Math.round((star.y0 + star.y1) / 2)
    expect(alpha(keyed, cx, cy)).toBe(255)
    expect(alpha(out.image, cx, cy)).toBe(0)
    expect(out.removed).toBe(1)
  })

  it('keeps characters', () => {
    const keyed = keyOut(greenSheet().image, GREEN, 6, 26).image
    const out = removeCornerMarks(keyed)
    expect(out.removed).toBe(0)
    expect(Array.from(out.image.data)).toEqual(Array.from(keyed.data))
  })

  it('keeps a symbol drifting into the top-left, top-right and bottom-left corners', () => {
    for (const [x, y] of [[8, 8], [330, 8], [8, 330]] as const) {
      const img = sheetWithBlob(360, x, y, 14)
      const out = removeCornerMarks(img)
      expect(out.removed).toBe(0)
      expect(alpha(out.image, x + 5, y + 5)).toBe(255)
    }
  })

  it('keeps a symbol deeper inside the bottom-right outer cell', () => {
    const img = sheetWithBlob(360, 300, 300, 14) // outside the 6% (22 px) corner
    const out = removeCornerMarks(img)
    expect(out.removed).toBe(0)
    expect(alpha(out.image, 305, 305)).toBe(255)
  })

  it('keeps a bottom-right blob that is too large to be a watermark', () => {
    const img = sheetWithBlob(360, 340, 340, 20) // 400 px > 0.25% of the sheet, touches the inner edge
    expect(removeCornerMarks(img).removed).toBe(0)
  })

  it('keeps a bottom-right blob that reaches out of the corner region', () => {
    const img = sheetWithBlob(360, 330, 335, 12)
    expect(removeCornerMarks(img).removed).toBe(0)
  })
})
