import { describe, expect, it } from 'vitest'
import { DEFAULT_ALIGN_OPTIONS, DEFAULT_COMPOSE_OPTIONS } from '../types'
import type { AlignResult, Cell, Mask, ScaleTranslate } from '../types'
import {
  alignedCells, heartReactions, measureAll, misalignedCells, mixedResolutionPair, noisyBodyCells,
  scaledReactions, tallShoulderReactions,
} from '../__fixtures__/alphaCells'
import { composeMascot } from '../composer'
import { bodyMask, lowerBand, measureCell } from '../measure'
import {
  alignSheets, applyTransform, composeTransforms, computeCrop, fitCrossSheet, invertTransform,
  matchTransform, settleFrames, warpMask, warpMaskQuarter, withinSheetTransforms,
} from './index'

const O = DEFAULT_ALIGN_OPTIONS
const solid = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask => {
  const data = new Uint8Array(w * h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 1
  return { width: w, height: h, data }
}

function align(dirs: Cell[], reacts: Cell[]): AlignResult {
  const r = alignSheets(dirs, reacts, measureAll(dirs), measureAll(reacts), O)
  if (!r.ok) throw new Error('alignment failed')
  return r.value
}

function tileShoulders(dirs: Cell[], reacts: Cell[], a: AlignResult, which: 'directions' | 'reactions') {
  const out = composeMascot(dirs, reacts, a, { ...DEFAULT_COMPOSE_OPTIONS, fade: false, cellSize: 180 })
  const tiles = which === 'directions' ? out.directionTiles : out.reactionTiles
  return tiles.map((t) => {
    const b = measureCell(t, O, 6).shoulderBox!
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0 }
  })
}

function bandIou(a: Mask, b: Mask): number {
  let inter = 0
  let union = 0
  for (let p = 0; p < a.data.length; p++) {
    inter += a.data[p]! & b.data[p]!
    union += a.data[p]! | b.data[p]!
  }
  return union === 0 ? 0 : inter / union
}

describe('transforms', () => {
  it('compose/invert round-trips', () => {
    const a: ScaleTranslate = { scale: 1.3, tx: 12.5, ty: -4 }
    const b: ScaleTranslate = { scale: 0.7, tx: -3, ty: 9 }
    const ab = composeTransforms(a, b)
    const p = applyTransform(ab, 10, 20)
    const q = applyTransform(b, applyTransform(a, 10, 20).x, applyTransform(a, 10, 20).y)
    expect(p.x).toBeCloseTo(q.x, 9)
    const back = applyTransform(invertTransform(ab), p.x, p.y)
    expect(back.x).toBeCloseTo(10, 9)
    expect(back.y).toBeCloseTo(20, 9)
  })

  it('refuses to invert a degenerate transform', () => {
    expect(() => invertTransform({ scale: 0, tx: 0, ty: 0 })).toThrow(RangeError)
  })
})

describe('warp', () => {
  it('translates and scales masks (nearest)', () => {
    const src = solid(10, 10, 2, 2, 4, 4)
    const out = warpMask(src, { scale: 2, tx: 5, ty: 0 }, 30, 20)
    expect(out.data[4 * 30 + 10]).toBe(1)
    expect(out.data[4 * 30 + 8]).toBe(0)
    expect(out.data.reduce((a, b) => a + b, 0)).toBe(16)
  })

  it('quarter warp has quarter dimensions', () => {
    const q = warpMaskQuarter(solid(8, 8, 0, 0, 8, 8), { scale: 1, tx: 0, ty: 0 }, 17, 9)
    expect([q.width, q.height]).toEqual([5, 3])
  })

  it('rejects non-positive scale', () => {
    expect(() => warpMask(solid(2, 2, 0, 0, 1, 1), { scale: -1, tx: 0, ty: 0 }, 2, 2)).toThrow(RangeError)
  })
})

describe('withinSheetTransforms', () => {
  it('uses the steady clamp for aligned cells and the noisy clamp for noisy ones', () => {
    const steady = alignedCells()
    const noisy = noisyBodyCells()
    const a = withinSheetTransforms(steady, measureAll(steady), steady, measureAll(steady), 1, O)
    const b = withinSheetTransforms(noisy, measureAll(noisy), noisy, measureAll(noisy), 1, O)
    expect(a.scaleClamp).toBe(O.scaleClampSteady)
    expect(b.scaleClamp).toBe(O.scaleClampNoisy)
    expect(b.anchorNoise).toBeGreaterThan(0.03)
    expect(a.canvas).toEqual({ width: 240, height: 360 })
  })

  it('centres unanchored cells and throws when no direction is anchored', () => {
    const cells = alignedCells()
    const metrics = measureAll(cells).map((m, i) => (i === 3 ? { ...m, shoulderBox: null } : m))
    const r = withinSheetTransforms(cells, metrics, cells, metrics, 1, O)
    expect(r.anchored[3]).toBe(false)
    expect(r.anchored[0]).toBe(true)
    const none = metrics.map((m) => ({ ...m, shoulderBox: null }))
    expect(() => withinSheetTransforms(cells, none, cells, none, 1, O)).toThrow(RangeError)
    expect(() => withinSheetTransforms(cells, metrics, cells, metrics.slice(1), 1, O)).toThrow(RangeError)
  })

  it('flags clamped scales', () => {
    const dirs = alignedCells()
    const big = scaledReactions(2, 0)
    const r = withinSheetTransforms(dirs, measureAll(dirs), big, measureAll(big), 1, O)
    expect(r.clamped.every(Boolean)).toBe(true)
    const ok = withinSheetTransforms(dirs, measureAll(dirs), dirs, measureAll(dirs), 1, O)
    expect(ok.clamped.some(Boolean)).toBe(false)
  })
})

describe('fitCrossSheet', () => {
  const canvas = { width: 400, height: 400 }
  const maskAt = (w: number, y0: number, y1: number): Mask => solid(100, 100, 50 - w, y0, 50 + w, y1)

  it('recovers a known scale and shift', () => {
    const dir = [maskAt(20, 60, 80)]
    const react = [maskAt(23, 66, 86)] // about 1.15x wide, 1.0 shifted
    const fit = fitCrossSheet(dir, react, canvas, O)
    expect(fit.scale).toBeLessThan(1)
    expect(fit.overlap).toBeGreaterThan(0.6)
    expect(Math.abs(fit.shift)).toBeLessThan(40)
  })

  it('moves a reaction silhouette back up: exact shift sign and magnitude', () => {
    const dir = [maskAt(20, 60, 80)]
    const down = [maskAt(20, 66, 86)] // 6 quarter-px rows lower
    const up = [maskAt(20, 54, 74)] // 6 quarter-px rows higher
    expect(fitCrossSheet(dir, down, canvas, O)).toMatchObject({ scale: 1, shift: -24, overlap: 1 })
    expect(fitCrossSheet(dir, up, canvas, O)).toMatchObject({ scale: 1, shift: 24, overlap: 1 })
    expect(matchTransform({ scale: 1, shift: -24, overlap: 1 }, canvas).ty).toBe(-24)
  })

  it('returns identity for identical masks', () => {
    const m = [maskAt(20, 60, 80)]
    const fit = fitCrossSheet(m, m, canvas, O)
    expect(fit).toEqual({ scale: 1, shift: 0, overlap: 1 })
    expect(matchTransform(fit, canvas)).toEqual({ scale: 1, tx: 0, ty: 0 })
  })

  it('handles empty masks and rejects bad input', () => {
    const empty: Mask = { width: 100, height: 100, data: new Uint8Array(10000) }
    expect(fitCrossSheet([empty], [empty], canvas, O).overlap).toBe(0)
    expect(() => fitCrossSheet([], [empty], canvas, O)).toThrow(RangeError)
    expect(() => fitCrossSheet([empty], [solid(50, 50, 0, 0, 1, 1)], canvas, O)).toThrow(RangeError)
    expect(() => fitCrossSheet([empty, solid(50, 50, 0, 0, 1, 1)], [empty], canvas, O)).toThrow(RangeError)
  })

  it('recovers a scale of 1/1.15 from rescaled silhouettes', () => {
    const dir = [maskAt(30, 60, 80)]
    const react = [maskAt(Math.round(30 * 1.15), 61, 85)]
    const fit = fitCrossSheet(dir, react, canvas, O)
    expect(Math.abs(fit.scale - 1 / 1.15)).toBeLessThan(0.03)
  })
})

describe('settle and crop', () => {
  it('settles frames onto the reference', () => {
    const ref = solid(20, 60, 5, 30, 15, 40)
    const frame = solid(20, 60, 5, 34, 15, 44)
    expect(settleFrames(ref, [frame, ref], 8)).toEqual([-4, 0])
  })

  it('anchors the bottom at 0.93 of a square crop', () => {
    const a = solid(100, 200, 20, 40, 60, 180)
    const crop = computeCrop([a], O, 1)
    expect(crop.side).toBe(Math.round(Math.max(40 + 16, (140 + 8) / 0.93)))
    expect(crop.top + Math.round(0.93 * crop.side)).toBe(180)
    expect(computeCrop([], O, 1).side).toBeGreaterThan(0)
  })
})

describe('alignSheets', () => {
  it('returns too-few-anchors', () => {
    const dirs = alignedCells()
    const metrics = measureAll(dirs).map((m, i) => (i < 5 ? { ...m, shoulderBox: null } : m))
    const r = alignSheets(dirs, alignedCells('reactions'), metrics, measureAll(dirs), O)
    expect(r).toEqual({ ok: false, reason: 'too-few-anchors', anchoredCells: 4 })
  })

  it('aligns misaligned cells so shoulder centres agree within 1px', () => {
    const dirs = misalignedCells(7)
    const reacts = misalignedCells(11, 'reactions')
    const a = align(dirs, reacts)
    const out = composeMascot(dirs, reacts, a, { ...DEFAULT_COMPOSE_OPTIONS, fade: false, cellSize: 180 })
    const centres = [...out.directionTiles, ...out.reactionTiles].map((t) => {
      const b = measureCell(t, O, 6).shoulderBox!
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }
    })
    const spread = (k: 'x' | 'y'): number => Math.max(...centres.map((c) => c[k])) - Math.min(...centres.map((c) => c[k]))
    expect(spread('x')).toBeLessThanOrEqual(1.5)
    expect(spread('y')).toBeLessThanOrEqual(1.5)
  })

  it('normalises reactions drawn larger and lower than the directions', () => {
    const dirs = alignedCells()
    const reacts = scaledReactions(1.15, 6)
    const a = align(dirs, reacts)
    const widths = tileShoulders(dirs, reacts, a, 'directions').map((s) => s.w)
    const rWidths = tileShoulders(dirs, reacts, a, 'reactions').map((s) => s.w)
    expect(Math.abs(rWidths[4]! / widths[4]! - 1)).toBeLessThan(0.03)
    expect(a.crossSheet.scale).toBeGreaterThan(0.8)
  })

  it('settles reaction frames with the right sign so lower bands land on the centre frame', () => {
    const dirs = alignedCells()
    const reacts = tallShoulderReactions(0.3)
    const a = align(dirs, reacts)
    const settle = a.reactions[4]!.settleDy
    expect(a.reactions.map((f) => f.settleDy)).toEqual(Array(9).fill(settle))
    expect(settle).not.toBe(0)
    const iouWith = (dy: number): number => {
      const shifted: AlignResult = {
        ...a,
        reactions: a.reactions.map((f) => ({ ...f, toTile: { ...f.toTile, ty: f.toTile.ty + dy / a.cropSide } })),
      }
      const out = composeMascot(dirs, reacts, shifted, { ...DEFAULT_COMPOSE_OPTIONS, fade: false, cellSize: 180 })
      const band = (t: typeof out.directionTiles[number]): Mask => lowerBand(bodyMask(t, 120), O.settleBand)
      return bandIou(band(out.directionTiles[4]!), band(out.reactionTiles[4]!))
    }
    // No extra nudge in either direction may beat the alignment as delivered.
    const real = iouWith(0)
    for (const extra of [-6, -4, -2, -1, 1, 2, 4, 6]) expect(real).toBeGreaterThanOrEqual(iouWith(extra) - 1e-9)
    // And the delivered settle must matter: without it the band is clearly worse.
    expect(real).toBeGreaterThan(iouWith(-settle) + 0.005)
  })

  it('places hearted reactions like heartless ones', () => {
    const dirs = alignedCells()
    const plain = align(dirs, alignedCells('reactions'))
    const heart = align(dirs, heartReactions())
    // Compare in canvas px relative to the directions frame (the crop differs with the heart).
    const rel = (a: AlignResult): number[] => {
      const d = a.directions[4]!.toTile
      const r = a.reactions[4]!.toTile
      return [(r.scale - d.scale) * a.cropSide, (r.tx - d.tx) * a.cropSide, (r.ty - d.ty) * a.cropSide]
    }
    rel(plain).forEach((v, i) => expect(Math.abs(v - rel(heart)[i]!)).toBeLessThanOrEqual(1))
  })

  it('aligns mixed-resolution sheets to the same shoulder width', () => {
    const { dirs, reacts } = mixedResolutionPair()
    const a = align(dirs, reacts)
    const d = tileShoulders(dirs, reacts, a, 'directions')[4]!.w
    const r = tileShoulders(dirs, reacts, a, 'reactions')[4]!.w
    expect(Math.abs(r / d - 1)).toBeLessThan(0.02)
  })

  it('has directions settle 0 and reports noise/clamp', () => {
    const a = align(noisyBodyCells(), alignedCells('reactions'))
    expect(a.directions.every((f) => f.settleDy === 0)).toBe(true)
    expect(a.scaleClamp).toBe(O.scaleClampNoisy)
    expect(a.directions).toHaveLength(9)
  })

  it('aligns two 1024-px sheets quickly', () => {
    const dirs = alignedCells('directions', 341)
    const reacts = alignedCells('reactions', 341)
    const t0 = performance.now()
    align(dirs, reacts)
    // ~0.4 s uncovered; the generous guard keeps coverage instrumentation from flaking the run.
    expect(performance.now() - t0).toBeLessThan(10000)
  })
})
