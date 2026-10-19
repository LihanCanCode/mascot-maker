import { describe, expect, it } from 'vitest'
import { checkerSheet, greenSheet, whiteSheet } from '../__fixtures__/opaqueSheets'
import { expectUnchanged, fillImage } from '../../test/draw'
import { detectCheckerboard } from './checkerboard'

describe('detectCheckerboard', () => {
  it('detects a 16 px checkerboard with busts', () => {
    const { image } = checkerSheet(16, { cell: 160 })
    const r = expectUnchanged(image, () => detectCheckerboard(image))
    expect(r.confidence).toBeGreaterThanOrEqual(0.5)
    expect(Math.abs(r.square - 16)).toBeLessThanOrEqual(1)
  })

  it.each([[8, 160], [32, 320]])('detects %i px squares', (square, cell) => {
    const { image } = checkerSheet(square, { cell })
    expect(detectCheckerboard(image).confidence).toBeGreaterThanOrEqual(0.5)
  })

  it('scores uniform green and white as zero', () => {
    expect(detectCheckerboard(fillImage(300, 300, { r: 0, g: 255, b: 0, a: 255 })).confidence).toBe(0)
    expect(detectCheckerboard(whiteSheet().image).confidence).toBe(0)
  })

  it('scores a green sheet with busts low', () => {
    expect(detectCheckerboard(greenSheet({ cell: 160 }).image).confidence).toBeLessThan(0.2)
  })

  it('returns zero for images too small to analyse', () => {
    expect(detectCheckerboard(fillImage(20, 20, { r: 1, g: 1, b: 1, a: 255 }))).toEqual({
      confidence: 0,
      square: 0,
    })
  })
})
