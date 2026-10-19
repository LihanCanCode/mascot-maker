import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIGN_OPTIONS, DEFAULT_COMPOSE_OPTIONS, DEFAULT_THRESHOLDS,
} from '../types'
import type {
  AlignResult, Cell, ComposedMascot, Issue, IssueCode, KeyFailure, SheetAnalysis, ValidationThresholds,
} from '../types'
import {
  alignedCells, analysisFor, clippedCells, emptyCell, nearKeyCells, noisyBodyCells, scaledReactions,
} from '../__fixtures__/alphaCells'
import { alignSheets } from '../aligner'
import { composeMascot } from '../composer'
import { measureAll } from '../__fixtures__/alphaCells'
import { CALIBRATED_THRESHOLDS, ISSUE_CODES, adviceFor, buildReport, computeVerifyMetrics, makeIssue, validatePair, validateSheet } from './index'

const T: ValidationThresholds = { ...DEFAULT_THRESHOLDS, minCellSide: 50 }
const codes = (issues: readonly Issue[]): IssueCode[] => issues.map((i) => i.code)

function build(dirs: Cell[], reacts: Cell[]): { al: AlignResult; out: ComposedMascot } {
  const r = alignSheets(dirs, reacts, measureAll(dirs), measureAll(reacts), DEFAULT_ALIGN_OPTIONS)
  if (!r.ok) throw new Error('align failed')
  const out = composeMascot(dirs, reacts, r.value, { ...DEFAULT_COMPOSE_OPTIONS, cellSize: 180 })
  return { al: r.value, out }
}

function withKeyFailure(a: SheetAnalysis, reason: KeyFailure['reason']): SheetAnalysis {
  const stats = a.key.stats
  return { ...a, slice: null, metrics: [], key: { ok: false, reason, colour: null, hex: null, stats } }
}

describe('advice', () => {
  it('has non-empty fix text and a redo target for every issue code', () => {
    for (const code of ISSUE_CODES) {
      for (const sheet of ['directions', 'reactions', null] as const) {
        const a = adviceFor(code, sheet)
        expect(a.fix.length).toBeGreaterThan(10)
        expect(['directions', 'reactions', 'both', 'none']).toContain(a.redo)
      }
    }
    expect(ISSUE_CODES).toHaveLength(31)
  })

  it('maps redo targets per the plan', () => {
    expect(adviceFor('checkerboard', 'directions').redo).toBe('both')
    expect(adviceFor('checkerboard', 'reactions').redo).toBe('reactions')
    expect(adviceFor('checkerboard', 'reactions').fix).toContain('attach your directions image')
    expect(adviceFor('lossy-source', 'reactions').redo).toBe('none')
    expect(adviceFor('lossy-source', 'reactions').fix).toContain('fine')
    expect(adviceFor('touches-bottom', 'directions').redo).toBe('none')
    expect(adviceFor('wide-feature', 'directions').redo).toBe('both')
    expect(adviceFor('boop-shift', null).redo).toBe('reactions')
    expect(adviceFor('check-mirrored', 'directions').redo).toBe('none')
  })

  it('makeIssue builds a stable id', () => {
    const i = makeIssue('empty-cell', 'error', true, 'reactions', 3, 'msg', 0.1)
    expect(i.id).toBe('empty-cell:reactions:3')
    expect(makeIssue('boop-shift', 'error', false, null, null, 'm', null).id).toBe('boop-shift:pair:all')
  })
})

describe('validateSheet', () => {
  const clean = analysisFor('reactions', alignedCells('reactions'))

  it('is quiet for a clean reactions sheet', () => {
    expect(validateSheet(clean, T)).toEqual([])
  })

  it.each([
    ['checkerboard', 'checkerboard'],
    ['neutral-background', 'neutral-background'],
    ['non-uniform-background', 'non-uniform-background'],
    ['too-little-keyed', 'too-little-keyed'],
  ] as const)('reports key failure %s as blocking', (reason, code) => {
    const issues = validateSheet(withKeyFailure(clean, reason), T)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code, severity: 'error', blocking: true, sheet: 'reactions' })
  })

  it('reports key-stage notices', () => {
    const a = analysisFor('directions', alignedCells())
    if (!a.key.ok) throw new Error('fixture')
    const noisy: SheetAnalysis = {
      ...a,
      key: { ...a.key, mode: 'existing-alpha', expectedDeltaE: 40, stats: { ...a.key.stats, cornerMarksRemoved: 1 } },
      meta: { ...a.meta, mimeType: 'image/jpeg', downscaled: true },
    }
    expect(codes(validateSheet(noisy, T))).toEqual(
      expect.arrayContaining(['existing-alpha', 'key-colour-mismatch', 'corner-marks-removed', 'lossy-source', 'downscaled', 'check-mirrored']),
    )
  })

  it('reports slice problems', () => {
    const a = analysisFor('reactions', alignedCells('reactions'))
    if (!a.slice) throw new Error('fixture')
    const bad: SheetAnalysis = {
      ...a,
      slice: {
        ...a.slice, ruleLinesRemoved: 2, significantBlobCount: 12,
        grid: { ...a.slice.grid, confidence: 0.2 },
        cells: a.slice.cells.map((c, i) => (i === 0 ? { ...c, fragmentsRemoved: 2, image: { ...c.image, width: 300 } } : c)),
      },
    }
    expect(codes(validateSheet(bad, T))).toEqual(
      expect.arrayContaining(['grid-mismatch', 'grid-uncertain', 'rule-lines-removed', 'fragments-removed', 'odd-aspect']),
    )
    const lowRes = validateSheet(clean, { ...T, minCellSide: 200 })
    expect(codes(lowRes)).toContain('low-resolution')
  })

  it('reports an empty cell as blocking with its index', () => {
    const cells = alignedCells('reactions')
    cells[2] = emptyCell('reactions', 2)
    const issue = validateSheet(analysisFor('reactions', cells), T).find((i) => i.code === 'empty-cell')!
    expect(issue).toMatchObject({ blocking: true, severity: 'error', cellIndex: 2 })
  })

  it('reports clipped cells, wide features and bottom contact', () => {
    const issues = validateSheet(analysisFor('reactions', clippedCells('reactions')), T)
    expect(codes(issues)).toEqual(expect.arrayContaining(['touches-edge', 'touches-bottom', 'wide-feature']))
    expect(issues.find((i) => i.code === 'wide-feature')).toMatchObject({ severity: 'error', blocking: false })
  })

  it('reports near-key translucency and low coverage', () => {
    expect(codes(validateSheet(analysisFor('reactions', nearKeyCells('reactions')), T))).toContain('character-near-key')
    expect(codes(validateSheet(clean, { ...T, lowCoverage: 0.9 }))).toContain('low-coverage')
    expect(codes(validateSheet(clean, { ...T, highCoverage: 0.01 }))).toContain('high-coverage')
  })

  it('reports size outliers', () => {
    const cells = alignedCells('reactions')
    cells[1] = { ...cells[1]!, image: scaledReactions(1.6, 0)[1]!.image }
    const issue = validateSheet(analysisFor('reactions', cells), T).find((i) => i.code === 'size-outlier')
    expect(issue?.cellIndex).toBe(1)
  })
})

describe('validatePair', () => {
  const dirs = alignedCells()
  const reacts = alignedCells('reactions')
  const dA = analysisFor('directions', dirs)
  const rA = analysisFor('reactions', reacts)

  it('gives good verify metrics for an aligned pair', () => {
    const { al, out } = build(dirs, reacts)
    const { issues, metrics } = validatePair(dA, rA, al, out, T)
    expect(metrics.boopShiftPx).toBeLessThanOrEqual(1)
    expect(metrics.paletteMatch).toBeGreaterThan(0.9)
    expect(metrics.widthChange).toBeLessThan(0.02)
    expect(metrics.shoulderSpreadPct).toBeLessThan(3)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('flags a deliberately shifted reactions sheet with a reactions redo', () => {
    const { al, out } = build(dirs, reacts)
    const shifted: AlignResult = {
      ...al,
      reactions: al.reactions.map((f) => ({ ...f, toTile: { ...f.toTile, ty: f.toTile.ty + 8 / 180 } })),
    }
    const moved = composeMascot(dirs, reacts, shifted, { ...DEFAULT_COMPOSE_OPTIONS, cellSize: 180 })
    expect(computeVerifyMetrics(moved, T).boopShiftPx).toBeGreaterThan(2)
    const issue = validatePair(dA, rA, shifted, moved, T).issues.find((i) => i.code === 'boop-shift')!
    expect(issue).toMatchObject({ severity: 'error', redo: 'reactions', sheet: 'reactions' })
    expect(out.cellSize).toBe(180)
  })

  it('flags inconsistent bodies, wide shoulders and alignment problems without output', () => {
    const noisy = analysisFor('directions', noisyBodyCells())
    const al = build(dirs, reacts).al
    const frames = { ...al, directions: al.directions.map((f, i) => (i === 0 ? { ...f, anchored: false } : f)), reactions: al.reactions.map((f, i) => (i === 1 ? { ...f, scaleClamped: true } : f)) }
    // Pin the error tier explicitly: the calibrated defaults only escalate to 'error' at 20% spread.
    const { issues, metrics } = validatePair(noisy, rA, frames, null, { ...T, shoulderSpreadErrorPct: 8, headShoulderMarginal: 0.1, headShoulderTooWide: 0.2 })
    expect(codes(issues)).toEqual(expect.arrayContaining(['body-inconsistent', 'shoulders-too-wide', 'unanchored-cell', 'scale-clamped']))
    expect(issues.find((i) => i.code === 'body-inconsistent')).toMatchObject({ severity: 'error', redo: 'both' })
    expect(metrics.boopShiftPx).toBeNull()
  })

  it('grades verify metrics into warnings and errors', () => {
    const base = build(dirs, reacts).out
    const quiet = { ...base }
    expect(validatePair(dA, rA, null, quiet, T).issues.some((i) => i.code === 'palette-mismatch')).toBe(false)
    const strict = validatePair(dA, rA, null, quiet, { ...T, paletteWarnBelow: 2, paletteErrorBelow: 1.5, widthChangeWarn: -1, widthChangeError: -2, boopWarnPx: -1, boopErrorPx: -0.5 })
    const sev = Object.fromEntries(strict.issues.map((i) => [i.code, i.severity]))
    expect(sev['palette-mismatch']).toBe('error')
    expect(sev['width-change']).toBe('error')
    expect(sev['boop-shift']).toBe('error')
    const mild = validatePair(dA, rA, null, quiet, { ...T, paletteWarnBelow: 2, paletteErrorBelow: 0.1 })
    expect(mild.issues.find((i) => i.code === 'palette-mismatch')?.severity).toBe('warning')
  })

  it('handles a failed key on the directions sheet with no spread metric', () => {
    const failed = withKeyFailure(dA, 'checkerboard')
    const { issues, metrics } = validatePair(failed, rA, null, null, T)
    expect(codes(issues)).toContain('checkerboard')
    expect(metrics.shoulderSpreadPct).toBeNull()
    expect(metrics.headShoulderRatio).toBeNull()
  })

  it('computeVerifyMetrics rejects outputs without a centre tile', () => {
    const { out } = build(dirs, reacts)
    expect(() => computeVerifyMetrics({ ...out, directionTiles: [] }, T)).toThrow(RangeError)
  })
})

describe('calibrated tiers (free-chat output)', () => {
  const dirs = alignedCells()
  const reacts = alignedCells('reactions')
  const dA = analysisFor('directions', dirs)
  const rA = analysisFor('reactions', reacts)
  const out = build(dirs, reacts).out
  const sevOf = (issues: readonly Issue[], code: IssueCode): string | undefined => issues.find((i) => i.code === code)?.severity
  const T2 = { ...CALIBRATED_THRESHOLDS, minCellSide: 50 }

  it('uses 8/20 percent and 2/4 px as the warning/error bands', () => {
    expect(T2).toMatchObject({ shoulderSpreadWarnPct: 8, shoulderSpreadErrorPct: 20, boopWarnPx: 2, boopErrorPx: 4 })
  })

  it('grades body spread: quiet, info, warning (usable wording), error', () => {
    const spreadAt = (pct: number): SheetAnalysis => {
      const m = dA.metrics.map((x, i) => ({ ...x, shoulderWidth: i === 0 ? 100 + pct : 100 }))
      return { ...dA, metrics: m }
    }
    const sev = (pct: number): string | undefined => sevOf(validatePair(spreadAt(pct), rA, null, null, T2).issues, 'body-inconsistent')
    expect(sev(1)).toBeUndefined()
    expect(sev(5)).toBe('info')
    expect(sev(14)).toBe('warning')
    expect(sev(30)).toBe('error')
    const warn = validatePair(spreadAt(14), rA, null, null, T2).issues.find((i) => i.code === 'body-inconsistent')!
    expect(warn.message).toContain('usable')
    expect(warn.blocking).toBe(false)
  })

  it('grades boop shift: quiet, info, warning, error (rows of a 180-px tile x 140/180)', () => {
    const { al } = build(dirs, reacts)
    const sevAfter = (rows: number): string | undefined => {
      const shifted: AlignResult = {
        ...al,
        reactions: al.reactions.map((f) => ({ ...f, toTile: { ...f.toTile, ty: f.toTile.ty + rows / 180 } })),
      }
      const moved = composeMascot(dirs, reacts, shifted, { ...DEFAULT_COMPOSE_OPTIONS, cellSize: 180 })
      return sevOf(validatePair(dA, rA, null, moved, T2).issues, 'boop-shift')
    }
    expect(sevAfter(0)).toBeUndefined()
    expect(sevAfter(2)).toBe('info') // 1.6 px
    expect(sevAfter(3.5)).toBe('warning') // 2.7 px
    expect(sevAfter(7)).toBe('error') // 5.4 px
  })

  it('keeps JPEG and bottom-contact as quiet notes so the verdict is not redo', () => {
    const j: SheetAnalysis = { ...rA, meta: { ...rA.meta, mimeType: 'image/jpeg' } }
    const issues = validateSheet({ ...j, metrics: j.metrics.map((m) => ({ ...m, edgeContact: { ...m.edgeContact, bottom: true } })) }, T2)
    expect(sevOf(issues, 'lossy-source')).toBe('info')
    expect(sevOf(issues, 'touches-bottom')).toBe('info')
    expect(buildReport(issues, { shoulderSpreadPct: null, headShoulderRatio: null, boopShiftPx: null, minBandOverlap: null, paletteMatch: null, widthChange: null }).verdict).toBe('ready')
  })
})

describe('buildReport', () => {
  const metrics = { shoulderSpreadPct: null, headShoulderRatio: null, boopShiftPx: null, minBandOverlap: null, paletteMatch: null, widthChange: null }
  const mk = (code: IssueCode, sev: 'error' | 'warning' | 'info', blocking: boolean, sheet: 'directions' | 'reactions' | null, cell: 0 | 1 | null): Issue =>
    makeIssue(code, sev, blocking, sheet, cell, 'm', null)

  it('sorts blocking, error, warning, info then sheet then cell', () => {
    const input = [
      mk('check-mirrored', 'info', false, 'directions', null),
      mk('touches-edge', 'warning', false, 'reactions', 1),
      mk('touches-edge', 'warning', false, 'directions', 1),
      mk('touches-edge', 'warning', false, 'directions', 0),
      mk('grid-mismatch', 'error', false, 'directions', null),
      mk('empty-cell', 'error', true, 'reactions', 0),
    ]
    const copy = [...input]
    const r = buildReport(input, metrics)
    expect(input).toEqual(copy)
    expect(r.issues.map((i) => i.id)).toEqual([
      'empty-cell:reactions:0', 'grid-mismatch:directions:all', 'touches-edge:directions:0',
      'touches-edge:directions:1', 'touches-edge:reactions:1', 'check-mirrored:directions:all',
    ])
  })

  it('derives verdict and canExport', () => {
    expect(buildReport([], metrics)).toMatchObject({ verdict: 'ready', canExport: true })
    expect(buildReport([mk('check-mirrored', 'info', false, 'directions', null)], metrics).verdict).toBe('ready')
    expect(buildReport([mk('touches-edge', 'warning', false, 'directions', 0)], metrics)).toMatchObject({ verdict: 'usable-with-warnings', canExport: true })
    expect(buildReport([mk('wide-feature', 'error', false, null, null)], metrics)).toMatchObject({ verdict: 'redo', canExport: true })
    expect(buildReport([mk('empty-cell', 'error', true, 'directions', 0)], metrics)).toMatchObject({ verdict: 'redo', canExport: false })
  })
})
