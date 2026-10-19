import { describe, expect, it } from 'vitest'
import { findMascot } from '../gallery/mascots'
import { brewAmounts, brewSentence, DEMO_PICKS, clampMascotSize } from './demoLogic'

describe('brewAmounts', () => {
  it('uses a 1:16 ratio with 250 ml cups', () => {
    expect(brewAmounts(1)).toEqual({ coffeeGrams: 16, waterGrams: 250 })
    expect(brewAmounts(2)).toEqual({ coffeeGrams: 31, waterGrams: 500 })
    expect(brewAmounts(8)).toEqual({ coffeeGrams: 125, waterGrams: 2000 })
  })

  it('clamps to 1..8 cups and survives junk', () => {
    expect(brewAmounts(0).waterGrams).toBe(250)
    expect(brewAmounts(99).waterGrams).toBe(2000)
    expect(brewAmounts(Number.NaN).waterGrams).toBe(500)
  })

  it('words the result for a status region', () => {
    expect(brewSentence(2)).toBe('Use 31 g of coffee and 500 g of water.')
  })
})

describe('DEMO_PICKS', () => {
  it('offers eight real gallery characters, fox first', () => {
    expect(DEMO_PICKS).toHaveLength(8)
    expect(DEMO_PICKS[0]).toBe('fox')
    for (const slug of DEMO_PICKS) expect(findMascot(slug), slug).toBeDefined()
    expect(new Set(DEMO_PICKS).size).toBe(8)
  })
})

describe('clampMascotSize', () => {
  it('keeps the mascot between 80 and 280px', () => {
    expect(clampMascotSize(10)).toBe(80)
    expect(clampMascotSize(500)).toBe(280)
    expect(clampMascotSize(200)).toBe(200)
    expect(clampMascotSize(Number.NaN)).toBe(200)
  })
})
