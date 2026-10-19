import { describe, expect, it } from 'vitest'
import { frogSheet, greenSheet, noisySheet } from '../__fixtures__/opaqueSheets'
import { expectUnchanged } from '../../test/draw'
import { keyOut } from './keyOut'

const GREEN = { r: 0, g: 255, b: 0 }

function alphaAt(img: { width: number; data: Uint8ClampedArray }, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!
}

describe('keyOut', () => {
  it('removes the background, keeps the bust, and reports the keyed share', () => {
    const { image, cells } = greenSheet()
    const out = expectUnchanged(image, () => keyOut(image, GREEN, 6, 26))
    expect(alphaAt(out.image, 1, 1)).toBe(0)
    const c = cells[4]!
    expect(alphaAt(out.image, Math.round((c.x0 + c.x1) / 2), Math.round((c.y0 + c.y1) / 2))).toBe(255)
    let background = 0
    for (let p = 0; p < image.width * image.height; p++) {
      const g = image.data[p * 4 + 1]!
      if (image.data[p * 4] === 0 && g === 255 && image.data[p * 4 + 2] === 0) background++
    }
    const expected = background / (image.width * image.height)
    expect(Math.abs(out.keyedFraction - expected)).toBeLessThan(0.02)
  })

  it('keeps a key-coloured patch enclosed by the character', () => {
    const { image, extras } = frogSheet()
    const out = keyOut(image, GREEN, 6, 26)
    const patch = extras[4]!
    expect(alphaAt(out.image, Math.round((patch.x0 + patch.x1) / 2), Math.round((patch.y0 + patch.y1) / 2))).toBe(255)
    expect(out.protectedFraction).toBeGreaterThan(0)
    expect(keyOut(greenSheet().image, GREEN, 6, 26).protectedFraction).toBeLessThan(out.protectedFraction)
  })

  it('leaves no haze on a noisy background once tolerance is adapted', () => {
    const { image } = noisySheet({}, 6)
    const { image: out } = keyOut(image, GREEN, 6, 26)
    let haze = 0
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (alphaAt(out, x, y) > 10) haze++
    expect(haze).toBe(0)
  })

  it('rejects mismatched dimensions via RangeError', () => {
    const bad = { width: 2, height: 2, data: new Uint8ClampedArray(4) }
    expect(() => keyOut(bad, GREEN, 6, 26)).toThrow(RangeError)
  })
})
