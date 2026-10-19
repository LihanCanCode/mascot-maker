import { describe, expect, it } from 'vitest'
import { expectUnchanged, fillImage } from '../../test/draw'
import { deltaE, labPlanes, rgbToHex, srgbToLab } from './lab'

describe('srgbToLab', () => {
  it('maps white to (100, 0, 0)', () => {
    const lab = srgbToLab({ r: 255, g: 255, b: 255 })
    expect(lab.l).toBeCloseTo(100, 1)
    expect(Math.abs(lab.a)).toBeLessThan(0.01)
    expect(Math.abs(lab.b)).toBeLessThan(0.01)
  })

  it('maps #00FF00 to the known Lab value', () => {
    const lab = srgbToLab({ r: 0, g: 255, b: 0 })
    expect(lab.l).toBeCloseTo(87.73, 1)
    expect(lab.a).toBeCloseTo(-86.18, 1)
    expect(lab.b).toBeCloseTo(83.18, 1)
  })

  it('maps black to zero lightness', () => {
    expect(srgbToLab({ r: 0, g: 0, b: 0 }).l).toBeCloseTo(0, 5)
  })
})

describe('deltaE', () => {
  it('is zero for identical colours and symmetric', () => {
    const a = srgbToLab({ r: 10, g: 200, b: 30 })
    const b = srgbToLab({ r: 200, g: 20, b: 90 })
    expect(deltaE(a, a)).toBe(0)
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 10)
    expect(deltaE(a, b)).toBeGreaterThan(50)
  })
})

describe('labPlanes', () => {
  it('returns interleaved L,a,b per pixel without mutating the image', () => {
    const img = fillImage(3, 2, { r: 0, g: 255, b: 0, a: 255 })
    const planes = expectUnchanged(img, () => labPlanes(img))
    expect(planes).toHaveLength(3 * 2 * 3)
    expect(planes[0]).toBeCloseTo(87.73, 1)
    expect(planes[17]).toBeCloseTo(83.18, 1)
  })
})

describe('rgbToHex', () => {
  it('formats upper-case #RRGGBB and rounds/clamps', () => {
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00')
    expect(rgbToHex({ r: 1.4, g: 16, b: 300 })).toBe('#0110FF')
    expect(rgbToHex({ r: -5, g: 0.6, b: 171 })).toBe('#0001AB')
  })
})
