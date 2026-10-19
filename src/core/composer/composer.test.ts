import { describe, expect, it } from 'vitest'
import { createImage } from '../raster'
import { drawRect, expectUnchanged, fillImage } from '../../test/draw'
import { DEFAULT_COMPOSE_OPTIONS } from '../types'
import type { ComposeOptions, RawImage, ScaleTranslate } from '../types'
import { alignedCells, bustImage, measureAll } from '../__fixtures__/alphaCells'
import { alignSheets } from '../aligner'
import { DEFAULT_ALIGN_OPTIONS } from '../types'
import { applyBottomFade, composeMascot, composeSheet, renderTile } from './index'

const smooth: ComposeOptions = { ...DEFAULT_COMPOSE_OPTIONS, cellSize: 120, fade: false }
const identity = (src: RawImage, size: number): ScaleTranslate => ({ scale: 1 / size, tx: 0, ty: 0 })

describe('renderTile', () => {
  it('reproduces the source under an identity mapping', () => {
    const src = bustImage(120)
    const out = expectUnchanged(src, () => renderTile(src, identity(src, 120), smooth))
    let worst = 0
    for (let i = 0; i < src.data.length; i++) worst = Math.max(worst, Math.abs(src.data[i]! - out.data[i]!))
    expect(worst).toBeLessThanOrEqual(2)
  })

  it('nearest sampling introduces no new colours', () => {
    const red = { r: 255, g: 0, b: 0, a: 255 }
    const blue = { r: 0, g: 0, b: 255, a: 255 }
    const src = drawRect(fillImage(10, 10, red), { x0: 5, y0: 0, x1: 10, y1: 10 }, blue)
    const out = renderTile(src, { scale: 1 / 10, tx: 0, ty: 0 }, { ...smooth, cellSize: 33, sampling: 'nearest' })
    const colours = new Set<string>()
    for (let i = 0; i < out.data.length; i += 4) colours.add(`${out.data[i]},${out.data[i + 1]},${out.data[i + 2]},${out.data[i + 3]}`)
    expect([...colours].sort()).toEqual(['0,0,255,255', '255,0,0,255'])
  })

  it('treats outside the source as transparent and supersamples when downscaling', () => {
    const src = fillImage(400, 400, { r: 10, g: 200, b: 30, a: 255 })
    const out = renderTile(src, { scale: 1 / 800, tx: 0, ty: 0 }, { ...smooth, cellSize: 100 })
    expect(out.data[3]).toBe(255)
    expect(out.data[(99 * 100 + 99) * 4 + 3]).toBe(0)
    expect(Array.from(out.data.subarray(0, 3))).toEqual([10, 200, 30])
  })

  it('blends colours without dark fringes next to transparency', () => {
    const src = drawRect(createImage(10, 10), { x0: 0, y0: 0, x1: 5, y1: 10 }, { r: 255, g: 255, b: 255, a: 255 })
    const out = renderTile(src, { scale: 1 / 10, tx: 0.025, ty: 0 }, { ...smooth, cellSize: 10 })
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3]! > 0) expect(out.data[i]).toBeGreaterThanOrEqual(250)
    }
  })
})

describe('applyBottomFade', () => {
  it('zeroes the last row and leaves rows above the ramp unchanged', () => {
    const tile = fillImage(20, 100, { r: 5, g: 6, b: 7, a: 255 })
    const out = expectUnchanged(tile, () => applyBottomFade(tile, 0.12))
    expect(out.data[(99 * 20) * 4 + 3]).toBe(0)
    expect(out.data[(87 * 20) * 4 + 3]).toBe(255)
    expect(out.data[(87 * 20) * 4]).toBe(5)
    expect(out.data[(95 * 20) * 4 + 3]).toBeGreaterThan(0)
    expect(out.data[(95 * 20) * 4 + 3]).toBeLessThan(255)
  })

  it('follows each frame to where its own body ends', () => {
    const tile = drawRect(createImage(20, 100), { x0: 0, y0: 0, x1: 20, y1: 50 }, { r: 1, g: 1, b: 1, a: 255 })
    const out = applyBottomFade(tile, 0.12)
    expect(out.data[(49 * 20) * 4 + 3]).toBe(0)
    expect(out.data[(30 * 20) * 4 + 3]).toBe(255)
  })

  it('copes with an empty tile', () => {
    const out = applyBottomFade(createImage(8, 8), 0.12)
    expect(out.data.every((v) => v === 0)).toBe(true)
  })
})

describe('composeSheet / composeMascot', () => {
  it('places tile k at ((k%3)S, floor(k/3)S)', () => {
    const tiles = Array.from({ length: 9 }, (_, k) => fillImage(4, 4, { r: k * 20, g: 0, b: 0, a: 255 }))
    const sheet = composeSheet(tiles, 4)
    expect(sheet.width).toBe(12)
    for (let k = 0; k < 9; k++) {
      const x = (k % 3) * 4 + 1
      const y = Math.floor(k / 3) * 4 + 1
      expect(sheet.data[(y * 12 + x) * 4]).toBe(k * 20)
    }
  })

  it('validates tile count and size', () => {
    expect(() => composeSheet([], 4)).toThrow(RangeError)
    const bad = Array.from({ length: 9 }, () => fillImage(3, 3, { r: 0, g: 0, b: 0, a: 255 }))
    expect(() => composeSheet(bad, 4)).toThrow(RangeError)
  })

  it('composes a full mascot with fading and rejects wrong cell counts', () => {
    const dirs = alignedCells()
    const reacts = alignedCells('reactions')
    const al = alignSheets(dirs, reacts, measureAll(dirs), measureAll(reacts), DEFAULT_ALIGN_OPTIONS)
    if (!al.ok) throw new Error('align failed')
    const out = composeMascot(dirs, reacts, al.value, { ...DEFAULT_COMPOSE_OPTIONS, cellSize: 90 })
    expect(out.cellSize).toBe(90)
    expect(out.directions.width).toBe(270)
    expect(out.reactionTiles).toHaveLength(9)
    expect(out.directionTiles[4]!.data[(89 * 90) * 4 + 3]).toBe(0)
    expect(() => composeMascot(dirs.slice(1), reacts, al.value, smooth)).toThrow(RangeError)
  })
})
