import { describe, expect, it } from 'vitest'
import {
  gradientSheet, greenSheet, noisySheet, watermarkSheet, whiteSheet,
} from '../__fixtures__/opaqueSheets'
import { createImage } from '../raster'
import { deltaE, srgbToLab } from '../color/lab'
import { expectUnchanged, fillImage } from '../../test/draw'
import { detectBackground, hasExistingAlpha, isKeyable, noiseTolerance } from './background'

const GREEN = { r: 0, g: 255, b: 0 }

describe('hasExistingAlpha', () => {
  it('is false for an opaque sheet and true when over 5% is transparent', () => {
    const { image } = greenSheet()
    expect(expectUnchanged(image, () => hasExistingAlpha(image))).toBe(false)
    expect(hasExistingAlpha(createImage(10, 10))).toBe(true)
  })

  it('respects the 5% boundary', () => {
    const img = fillImage(10, 10, { r: 1, g: 2, b: 3, a: 255 })
    const data = new Uint8ClampedArray(img.data)
    for (let p = 0; p < 5; p++) data[p * 4 + 3] = 0 // exactly 5%
    expect(hasExistingAlpha({ ...img, data })).toBe(false)
    data[5 * 4 + 3] = 9
    expect(hasExistingAlpha({ ...img, data })).toBe(true)
  })
})

describe('detectBackground', () => {
  it('finds the key colour with high uniformity on a green sheet', () => {
    const { image } = greenSheet()
    const bg = expectUnchanged(image, () => detectBackground(image, 26))
    expect(deltaE(srgbToLab(bg.colour), srgbToLab(GREEN))).toBeLessThan(2)
    expect(bg.uniformity).toBeGreaterThan(0.95)
  })

  it('survives a watermark in one corner', () => {
    const bg = detectBackground(watermarkSheet().image, 26)
    expect(bg.uniformity).toBeGreaterThanOrEqual(0.9)
    expect(bg.colour.g).toBe(255)
  })

  it('reports low uniformity for a gradient', () => {
    expect(detectBackground(gradientSheet().image, 26).uniformity).toBeLessThan(0.9)
  })

  it('handles tiny images', () => {
    const bg = detectBackground(fillImage(2, 2, { r: 9, g: 8, b: 7, a: 255 }), 26)
    expect(bg.colour).toEqual({ r: 9, g: 8, b: 7 })
    expect(bg.uniformity).toBe(1)
  })

  it('averages the two middle values for the median of an even count', () => {
    const img = fillImage(4, 4, { r: 10, g: 0, b: 0, a: 255 })
    const data = new Uint8ClampedArray(img.data)
    // p = 1: corners are pixels 0, 3, 12, 15; make two of them 20.
    data[0] = 20
    data[3 * 4] = 20
    expect(detectBackground({ ...img, data }, 26).colour.r).toBe(15)
  })
})

describe('isKeyable', () => {
  it('requires channel spread of at least minSaturation (99/100 boundary)', () => {
    expect(isKeyable({ r: 0, g: 99, b: 0 }, 100)).toBe(false)
    expect(isKeyable({ r: 0, g: 100, b: 0 }, 100)).toBe(true)
    expect(isKeyable({ r: 255, g: 255, b: 255 }, 100)).toBe(false)
    expect(isKeyable(GREEN, 100)).toBe(true)
  })

  it('rejects the background of a white sheet', () => {
    const bg = detectBackground(whiteSheet().image, 26)
    expect(isKeyable(bg.colour, 100)).toBe(false)
  })
})

describe('noiseTolerance', () => {
  it('returns the base for a clean background', () => {
    const { image } = greenSheet()
    expect(noiseTolerance(image, GREEN, 6)).toBe(6)
  })

  it('rises above the base for a noisy background and stays below tolHigh', () => {
    const { image } = noisySheet({}, 14)
    const tol = expectUnchanged(image, () => noiseTolerance(image, GREEN, 6))
    expect(tol).toBeGreaterThan(6)
    expect(tol).toBeLessThan(26)
  })

  it('ignores a corner watermark', () => {
    expect(noiseTolerance(watermarkSheet().image, GREEN, 6)).toBe(6)
  })
})
