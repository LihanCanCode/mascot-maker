import { describe, expect, it } from 'vitest'
import {
  checkerSheet, gradientSheet, greenSheet, magentaSheet, noisySheet, watermarkSheet, whiteSheet,
} from '../__fixtures__/opaqueSheets'
import { createImage } from '../raster'
import { expectUnchanged, fillImage } from '../../test/draw'
import { DEFAULT_KEY_OPTIONS } from '../types'
import type { KeyOptions, KeyResult, KeySuccess, RawImage } from '../types'
import { keySheet } from './keySheet'

const opts = (patch: Partial<KeyOptions> = {}): KeyOptions => ({ ...DEFAULT_KEY_OPTIONS, ...patch })

function expectOk(r: KeyResult): KeySuccess {
  if (!r.ok) throw new Error(`keying failed: ${r.reason}`)
  return r
}

describe('keySheet', () => {
  it('keys a green sheet and reports stats', () => {
    const { image } = greenSheet()
    const r = expectOk(expectUnchanged(image, () => keySheet(image, opts({ expected: 'green' }))))
    expect(r.mode).toBe('keyed')
    expect(r.hex).toBe('#00FF00')
    expect(r.expectedDeltaE).toBeLessThan(2)
    expect(r.stats.keyedFraction).toBeGreaterThan(0.5)
    expect(r.stats.uniformity).toBeGreaterThan(0.95)
    expect(r.image.data[3]).toBe(0)
  })

  it('leaves no key-coloured cast on partially transparent pixels', () => {
    const r = expectOk(keySheet(greenSheet().image, opts()))
    let checked = 0
    for (let p = 0; p < r.image.width * r.image.height; p++) {
      const a = r.image.data[p * 4 + 3]!
      if (a === 0 || a === 255) continue
      checked++
      const [R, G, B] = [r.image.data[p * 4]!, r.image.data[p * 4 + 1]!, r.image.data[p * 4 + 2]!]
      expect(G).toBeLessThanOrEqual(Math.max(R, B) + 8)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('passes through existing alpha as an equal but distinct buffer', () => {
    const img = createImage(10, 10, { r: 5, g: 6, b: 7, a: 0 })
    const r = expectOk(keySheet(img, opts()))
    expect(r.mode).toBe('existing-alpha')
    expect(r.colour).toBeNull()
    expect(r.image.data).not.toBe(img.data)
    expect(Array.from(r.image.data)).toEqual(Array.from(img.data))
  })

  it('fails on a checkerboard', () => {
    const r = keySheet(checkerSheet(16, { cell: 160 }).image, opts())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('checkerboard')
      expect(r.stats.checkerboardConfidence).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('fails on a white background as neutral', () => {
    const r = keySheet(whiteSheet().image, opts())
    expect(!r.ok && r.reason).toBe('neutral-background')
  })

  it('fails on a gradient as non-uniform', () => {
    const r = keySheet(gradientSheet().image, opts())
    expect(!r.ok && r.reason).toBe('non-uniform-background')
  })

  it('fails when too little of the sheet is background', () => {
    const r = keySheet(fillImage(100, 100, { r: 0, g: 255, b: 0, a: 255 }), opts({ minKeyedFraction: 1.01 }))
    expect(!r.ok && r.reason).toBe('too-little-keyed')
  })

  it('flags a magenta sheet when green was expected but still keys it', () => {
    const r = expectOk(keySheet(magentaSheet().image, opts({ expected: 'green' })))
    expect(r.hex).toBe('#FF00FF')
    expect(r.expectedDeltaE).toBeGreaterThan(25)
  })

  it('removes a corner watermark and counts it', () => {
    const r = expectOk(keySheet(watermarkSheet().image, opts()))
    expect(r.stats.cornerMarksRemoved).toBe(1)
  })

  it('adapts to a noisy background', () => {
    const r = expectOk(keySheet(noisySheet().image, opts()))
    expect(r.image.data[3]).toBe(0)
    expect(r.stats.tolLowUsed).toBeGreaterThanOrEqual(6)
  })

  it('skips spill and feather when disabled', () => {
    const { image } = greenSheet()
    const on = expectOk(keySheet(image, opts()))
    const off = expectOk(keySheet(image, opts({ spillRadius: 0, featherRadius: 0 })))
    expect(Array.from(off.image.data)).not.toEqual(Array.from(on.image.data))
    const cast = (img: RawImage): number => {
      let n = 0
      for (let p = 0; p < img.width * img.height; p++) {
        const a = img.data[p * 4 + 3]!
        const [r, g, b] = [img.data[p * 4]!, img.data[p * 4 + 1]!, img.data[p * 4 + 2]!]
        if (a > 0 && a < 255 && g > Math.max(r, b) + 8) n++
      }
      return n
    }
    expect(cast(off.image)).toBeGreaterThan(0)
    expect(cast(on.image)).toBe(0)
    let alphaUp = 0
    for (let p = 0; p < on.image.width * on.image.height; p++) {
      if (on.image.data[p * 4 + 3]! > off.image.data[p * 4 + 3]!) alphaUp++
    }
    expect(alphaUp).toBe(0)
  })

  it('keeps a green-bodied and a purple-bodied character intact on their key colours', () => {
    const cases = [
      { sheet: greenSheet({ fill: { r: 40, g: 200, b: 40, a: 255 } }), body: [40, 200, 40] },
      { sheet: magentaSheet({ fill: { r: 150, g: 50, b: 200, a: 255 } }), body: [150, 50, 200] },
    ]
    for (const { sheet, body } of cases) {
      const r = expectOk(keySheet(sheet.image, opts()))
      const c = sheet.cells[4]!
      const x = Math.round((c.x0 + c.x1) / 2)
      const y = Math.round((c.y0 + c.y1) / 2)
      const i = (y * r.image.width + x) * 4
      expect([r.image.data[i], r.image.data[i + 1], r.image.data[i + 2], r.image.data[i + 3]]).toEqual([...body, 255])
    }
  })

  it('keys a 1024x1024 sheet within a sane budget', { timeout: 60000 }, () => {
    const { image } = greenSheet({ cell: 342 })
    const start = performance.now()
    expectOk(keySheet(image, opts()))
    expect(performance.now() - start).toBeLessThan(20000) // sanity guard only: ~0.4-0.6s idle, but v8 coverage + parallel workers slow it a lot
  })
})
