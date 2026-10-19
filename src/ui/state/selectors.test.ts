import { describe, expect, it } from 'vitest'
import type { Issue, PipelineResult, ValidationReport } from '../../core/types'
import { initialState, type AppState, type Files } from './appReducer'
import {
  canContinueAnyway,
  canProcess,
  previewUrls,
  cellLabel,
  cellSeverities,
  issuesForCell,
  reachableSteps,
  sortSeverity,
  stageLabel,
  stepIndex,
  stepTitle,
  verdictCopy,
} from './selectors'

const issue = (over: Partial<Issue>): Issue => ({
  id: 'x',
  code: 'touches-edge',
  severity: 'warning',
  blocking: false,
  sheet: 'directions',
  cellIndex: 2,
  message: 'm',
  fix: 'f',
  redo: 'none',
  metric: null,
  ...over,
})

const report = (issues: Issue[], verdict: ValidationReport['verdict'], canExport: boolean): ValidationReport => ({
  issues,
  verdict,
  canExport,
  metrics: {
    shoulderSpreadPct: null, headShoulderRatio: null, boopShiftPx: null,
    minBandOverlap: null, paletteMatch: null, widthChange: null,
  },
})

const result = (ok: boolean, r: ValidationReport): PipelineResult => ({ ok, report: r }) as unknown as PipelineResult

describe('cellLabel', () => {
  it('describes direction and reaction cells with 1-based numbers', () => {
    expect(cellLabel('directions', 2)).toBe('Directions cell 3, up-right')
    expect(cellLabel('reactions', 0)).toBe('Reactions cell 1, blink')
  })
})

describe('stepIndex and reachableSteps', () => {
  it('maps states to nav positions; processing counts as review', () => {
    expect(stepIndex(initialState)).toBe(0)
    const processing = { ...initialState, step: 'processing', runId: 1 } as unknown as AppState
    expect(stepIndex(processing)).toBe(2)
  })

  it('allows setup and upload always, review and export only with results', () => {
    expect([...reachableSteps(initialState)]).toEqual(['setup', 'upload'])
    const rev = { ...initialState, step: 'review', result: result(true, report([], 'ready', true)) } as unknown as AppState
    expect([...reachableSteps(rev)]).toEqual(['setup', 'upload', 'review', 'export'])
    const revBlocked = { ...initialState, step: 'review', result: result(false, report([], 'redo', false)) } as unknown as AppState
    expect([...reachableSteps(revBlocked)]).toEqual(['setup', 'upload', 'review'])
    const exp = { ...initialState, step: 'export', result: result(true, report([], 'ready', true)) } as unknown as AppState
    expect(reachableSteps(exp).has('export')).toBe(true)
  })
})

describe('canProcess', () => {
  const f = new File(['x'], 'a.png')
  const slot = { status: 'ready', file: f, previewUrl: 'u' } as const
  it('needs both slots ready', () => {
    const files: Files = { directions: slot, reactions: { status: 'empty' } }
    expect(canProcess(files)).toBe(false)
    expect(canProcess({ directions: slot, reactions: slot })).toBe(true)
  })
})

describe('stepTitle', () => {
  it('names each step in the document title', () => {
    expect(stepTitle(initialState)).toBe('Describe your mascot - Mascot Maker')
    const titles = (['upload', 'processing', 'review', 'export'] as const).map((step) =>
      stepTitle({ ...initialState, step } as unknown as AppState),
    )
    expect(new Set(titles).size).toBe(4)
  })
})

describe('previewUrls', () => {
  it('lists urls of ready slots only', () => {
    const slot = { status: 'ready', file: new File(['x'], 'a.png'), previewUrl: 'blob:a' } as const
    expect(previewUrls({ directions: slot, reactions: { status: 'rejected', message: 'x' } })).toEqual(['blob:a'])
    expect(previewUrls(initialState.files)).toEqual([])
  })
})

describe('issue helpers', () => {
  const issues = [
    issue({ id: 'a', cellIndex: 2, severity: 'warning' }),
    issue({ id: 'b', cellIndex: 2, severity: 'error' }),
    issue({ id: 'c', cellIndex: null, severity: 'info' }),
    issue({ id: 'd', sheet: 'reactions', cellIndex: 2, severity: 'info' }),
  ]
  const r = report(issues, 'redo', true)

  it('filters by cell, or returns all when nothing is selected', () => {
    expect(issuesForCell(r, null).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(issuesForCell(r, { sheet: 'directions', index: 2 }).map((i) => i.id)).toEqual(['a', 'b'])
    expect(issuesForCell(r, { sheet: 'reactions', index: 5 })).toEqual([])
  })

  it('computes the worst severity per cell for a sheet', () => {
    const sev = cellSeverities(r, 'directions')
    expect(sev).toHaveLength(9)
    expect(sev[2]).toBe('error')
    expect(sev[0]).toBeNull()
    expect(cellSeverities(r, 'reactions')[2]).toBe('info')
  })

  it('ranks severities', () => {
    expect(sortSeverity('error')).toBeLessThan(sortSeverity('warning'))
    expect(sortSeverity('warning')).toBeLessThan(sortSeverity('info'))
  })
})

describe('verdict and continue', () => {
  it('offers continue-anyway only for exportable results with errors', () => {
    expect(canContinueAnyway(result(true, report([], 'redo', true)))).toBe(true)
    expect(canContinueAnyway(result(true, report([], 'ready', true)))).toBe(false)
    expect(canContinueAnyway(result(false, report([], 'redo', false)))).toBe(false)
    expect(canContinueAnyway(result(true, report([], 'redo', false)))).toBe(false)
  })

  it('has distinct friendly copy for each verdict', () => {
    const copies = (['ready', 'usable-with-warnings', 'redo'] as const).map((v) =>
      verdictCopy(report([], v, v !== 'redo')).title,
    )
    expect(new Set(copies).size).toBe(3)
    expect(verdictCopy(report([issue({ blocking: true })], 'redo', false)).tone).toBe('bad')
    expect(verdictCopy(report([], 'ready', true)).tone).toBe('good')
    expect(verdictCopy(report([], 'usable-with-warnings', true)).tone).toBe('ok')
  })
})

describe('stageLabel', () => {
  it('names each stage in plain words, including the sheet', () => {
    expect(stageLabel({ stage: 'keying', sheet: 'directions', fraction: 0.1 })).toMatch(/directions/i)
    expect(stageLabel({ stage: 'keying', sheet: null, fraction: 0 })).toMatch(/background/i)
    for (const stage of ['slicing', 'measuring', 'aligning', 'composing', 'validating', 'done'] as const) {
      expect(stageLabel({ stage, sheet: null, fraction: 0.5 }).length).toBeGreaterThan(3)
    }
  })
})
