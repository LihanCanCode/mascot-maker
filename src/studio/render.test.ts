import { describe, expect, it } from 'vitest'
import type { RawImage } from '../core/types'
import { STUDIO_PRESETS, renderCell, renderSheet } from './index'
import { bodyTopRow } from './render'
import { nodeCanvasFactory as createCanvas } from './testCanvas'
import type { SheetKind } from './types'

const CELL = 512
const KINDS: readonly SheetKind[] = ['directions', 'reactions']
const MIN_MARGIN = 16

const cache = new Map<string, RawImage>()
function sheet(id: string, kind: SheetKind, background: 'transparent' | 'green' = 'transparent'): RawImage {
  const key = `${id}/${kind}/${background}`
  const hit = cache.get(key)
  if (hit) return hit
  const preset = STUDIO_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`no preset ${id}`)
  const img = renderSheet(preset.config, kind, { cell: CELL, background, createCanvas })
  cache.set(key, img)
  return img
}

function cellRows(img: RawImage, index: number, y0: number, y1: number): Uint8ClampedArray {
  const ox = (index % 3) * CELL, oy = Math.floor(index / 3) * CELL
  const out = new Uint8ClampedArray((y1 - y0) * CELL * 4)
  for (let y = y0; y < y1; y++) {
    const start = ((oy + y) * img.width + ox) * 4
    out.set(img.data.subarray(start, start + CELL * 4), (y - y0) * CELL * 4)
  }
  return out
}

function countDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
  }
  return n
}

/** Pixels whose channels differ by more than `tol`. */
function countOver(a: Uint8ClampedArray, b: Uint8ClampedArray, tol: number): number {
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(...[0, 1, 2, 3].map((k) => Math.abs((a[i + k] ?? 0) - (b[i + k] ?? 0)))) > tol) n++
  }
  return n
}

function cellMargins(img: RawImage, index: number): number {
  const rows = cellRows(img, index, 0, CELL)
  let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if ((rows[(y * CELL + x) * 4 + 3] ?? 0) > 0) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
    }
  }
  return Math.min(x0, y0, CELL - 1 - x1, CELL - 1 - y1)
}

describe.each(STUDIO_PRESETS.map((p) => p.id))('preset %s', (id) => {
  it('renders both sheets at 3 x cell square', () => {
    for (const kind of KINDS) {
      const img = sheet(id, kind)
      expect(img.width).toBe(CELL * 3)
      expect(img.height).toBe(CELL * 3)
      expect(img.data.length).toBe(img.width * img.height * 4)
    }
  })

  it('has pixel-identical body rows in all 18 cells', () => {
    const top = bodyTopRow(CELL)
    const ref = cellRows(sheet(id, 'directions'), 0, top, CELL)
    for (const kind of KINDS) {
      for (let i = 0; i < 9; i++) {
        expect(countDiff(cellRows(sheet(id, kind), i, top, CELL), ref)).toBe(0)
      }
    }
  })

  it('keeps transparent margins of at least 16 px in every cell', () => {
    for (const kind of KINDS) {
      for (let i = 0; i < 9; i++) expect(cellMargins(sheet(id, kind), i)).toBeGreaterThanOrEqual(MIN_MARGIN)
    }
  })

  it('makes every non-centre direction differ from the centre', () => {
    const img = sheet(id, 'directions')
    const centre = cellRows(img, 4, 0, CELL)
    for (let i = 0; i < 9; i++) {
      if (i !== 4) expect(countDiff(cellRows(img, i, 0, CELL), centre)).toBeGreaterThan(500)
    }
  })

  it('renderCell equals the matching cell of renderSheet', () => {
    const preset = STUDIO_PRESETS.find((p) => p.id === id)!
    for (const [kind, index] of [['directions', 2], ['reactions', 5]] as const) {
      const one = renderCell(preset.config, kind, index, { cell: CELL, createCanvas })
      // Sub-pixel AA rounding differs slightly between a lone cell and a sheet cell: allow a handful of edge pixels.
      expect(countOver(one.data, cellRows(sheet(id, kind), index, 0, CELL), 16)).toBeLessThanOrEqual(300)
    }
  })

  it('is deterministic', () => {
    const preset = STUDIO_PRESETS.find((p) => p.id === id)!
    const again = renderSheet(preset.config, 'reactions', { cell: CELL, createCanvas })
    expect(Buffer.compare(Buffer.from(again.data), Buffer.from(sheet(id, 'reactions').data))).toBe(0)
  })

  it('green variant is keyable: pure key outside the character, identical inside', () => {
    for (const kind of KINDS) {
      const clear = sheet(id, kind), green = sheet(id, kind, 'green')
      let bad = 0
      for (let i = 0; i < clear.data.length; i += 4) {
        const a = clear.data[i + 3] ?? 0
        const key = green.data[i] === 0 && green.data[i + 1] === 255 && green.data[i + 2] === 0 && green.data[i + 3] === 255
        if (a === 0 && !key) bad++
        if (a === 255 && (green.data[i] !== clear.data[i] || green.data[i + 1] !== clear.data[i + 1])) bad++
      }
      expect(bad).toBe(0)
    }
  })
})

const SYMMETRIC = STUDIO_PRESETS.filter((p) => p.config.hairStyle !== 'ponytail').map((p) => p.id)
describe.each(SYMMETRIC)('centre symmetry %s', (id) => {
  it('silhouette of the head is left/right symmetric within tolerance', () => {
    const rows = cellRows(sheet(id, 'directions'), 4, 0, bodyTopRow(CELL) - 40)
    const h = rows.length / (CELL * 4)
    let opaque = 0, mismatch = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < CELL; x++) {
        const a = (rows[(y * CELL + x) * 4 + 3] ?? 0) > 127
        const b = (rows[(y * CELL + (CELL - 1 - x)) * 4 + 3] ?? 0) > 127
        if (a) opaque++
        if (a !== b) mismatch++
      }
    }
    expect(mismatch / opaque).toBeLessThan(0.04)
  })
})

describe('render validation', () => {
  const cfg = STUDIO_PRESETS[0]!.config
  it('rejects bad cell sizes and indices', () => {
    expect(() => renderSheet(cfg, 'directions', { cell: 10, createCanvas })).toThrow(RangeError)
    expect(() => renderSheet(cfg, 'directions', { cell: 100.5, createCanvas })).toThrow(RangeError)
    expect(() => renderCell(cfg, 'reactions', 9, { cell: 64, createCanvas })).toThrow(RangeError)
  })
  it('throws when the factory has no 2D context', () => {
    const broken = () => ({ width: 1, height: 1, getContext: () => null })
    expect(() => renderSheet(cfg, 'directions', { cell: 64, createCanvas: broken })).toThrow(/2D context/)
  })
  it('scales: a 128 cell sheet is 384 square', () => {
    expect(renderSheet(cfg, 'directions', { cell: 128, createCanvas }).width).toBe(384)
  })
  it('accepts partial configs (normalised)', () => {
    expect(renderCell({ ears: 'cat' }, 'directions', 4, { cell: 64, createCanvas }).width).toBe(64)
  })
})
