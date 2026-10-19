import { beforeEach, describe, expect, it, vi } from 'vitest'
import { greenSheet, checkerSheet } from './__fixtures__/opaqueSheets'
import { createImage } from './raster'
import { optionsForStyle } from './pipelineOptions'
import { DEFAULT_PIPELINE_OPTIONS } from './types'
import type {
  AlignResult, CellMetrics, ComposedMascot, Issue, PipelineInput, PipelineProgress, SheetInput,
  ValidationReport,
} from './types'

vi.mock('./measure', () => ({ measureCell: vi.fn() }))
vi.mock('./aligner', () => ({ alignSheets: vi.fn() }))
vi.mock('./composer', () => ({ composeMascot: vi.fn() }))
vi.mock('./validator', () => ({
  validateSheet: vi.fn(),
  validatePair: vi.fn(),
  buildReport: vi.fn(),
}))

import { alignSheets } from './aligner'
import { composeMascot } from './composer'
import { measureCell } from './measure'
import { runPipeline } from './pipeline'
import { buildReport, validatePair, validateSheet } from './validator'

const metrics = { width: 120, height: 120 } as CellMetrics
const alignment = { cropSide: 100 } as AlignResult
const output = { cellSize: 360 } as ComposedMascot
const issue = (id: string, code = 'check-mirrored'): Issue =>
  ({ id, code, severity: 'info', blocking: false, sheet: null, cellIndex: null, message: '', fix: '', redo: 'none', metric: null }) as Issue
const report = { issues: [], metrics: {}, verdict: 'ready', canExport: true } as unknown as ValidationReport

function sheet(kind: 'directions' | 'reactions', image: SheetInput['image']): SheetInput {
  return {
    kind,
    image,
    meta: { fileName: `${kind}.png`, mimeType: 'image/png', originalWidth: image.width, originalHeight: image.height, downscaled: false },
  }
}
const goodInput = (): PipelineInput => ({
  directions: sheet('directions', greenSheet().image),
  reactions: sheet('reactions', greenSheet().image),
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(measureCell).mockReturnValue(metrics)
  vi.mocked(alignSheets).mockReturnValue({ ok: true, value: alignment })
  vi.mocked(composeMascot).mockReturnValue(output)
  vi.mocked(validateSheet).mockReturnValue([issue('sheet:a')])
  vi.mocked(validatePair).mockReturnValue({ issues: [issue('pair:a'), issue('sheet:a')], metrics: report.metrics })
  vi.mocked(buildReport).mockReturnValue(report)
})

describe('runPipeline success path', () => {
  it('runs every stage in order with monotonic progress ending at done/1', () => {
    const seen: PipelineProgress[] = []
    const result = runPipeline(goodInput(), DEFAULT_PIPELINE_OPTIONS, (p) => seen.push(p))
    expect(result.ok).toBe(true)
    const stages = seen.map((p) => p.stage)
    const order = ['keying', 'slicing', 'measuring', 'aligning', 'composing', 'validating', 'done']
    expect([...new Set(stages)]).toEqual(order)
    seen.forEach((p, i) => {
      if (i > 0) expect(p.fraction).toBeGreaterThanOrEqual(seen[i - 1]!.fraction)
    })
    expect(seen[seen.length - 1]).toEqual({ stage: 'done', sheet: null, fraction: 1 })
    expect(vi.mocked(measureCell)).toHaveBeenCalledTimes(18)
  })

  it('merges sheet and pair issues without duplicates and builds the report', () => {
    runPipeline(goodInput(), DEFAULT_PIPELINE_OPTIONS)
    const ids = vi.mocked(buildReport).mock.calls[0]![0].map((i) => i.id)
    expect(ids).toEqual(['sheet:a', 'pair:a'])
  })

  it('swaps direction columns only when asked', () => {
    const swapped = runPipeline(goodInput(), { ...DEFAULT_PIPELINE_OPTIONS, swapDirectionColumns: true })
    if (!swapped.ok) throw new Error('expected success')
    expect(swapped.directions.slice?.cells[0]?.sourceBox.x0).toBe(240)
    expect(swapped.reactions.slice?.cells[0]?.sourceBox.x0).toBe(0)
  })

  it('works without a progress callback', () => {
    expect(runPipeline(goodInput(), DEFAULT_PIPELINE_OPTIONS).ok).toBe(true)
  })
})

describe('runPipeline failure paths', () => {
  it('stops after keying when a sheet fails and never aligns', () => {
    const input: PipelineInput = {
      directions: sheet('directions', checkerSheet(16, { cell: 160 }).image),
      reactions: sheet('reactions', greenSheet().image),
    }
    const seen: string[] = []
    const result = runPipeline(input, DEFAULT_PIPELINE_OPTIONS, (p) => seen.push(p.stage))
    expect(result.ok).toBe(false)
    expect(result.directions.key.ok).toBe(false)
    expect(result.directions.slice).toBeNull()
    expect(result.reactions.slice).not.toBeNull()
    expect(vi.mocked(alignSheets)).not.toHaveBeenCalled()
    expect(vi.mocked(composeMascot)).not.toHaveBeenCalled()
    expect(seen).not.toContain('aligning')
    expect(seen[seen.length - 1]).toBe('done')
    expect(vi.mocked(validateSheet)).toHaveBeenCalledTimes(2)
    const metricsArg = vi.mocked(buildReport).mock.calls[0]![1]
    expect(Object.values(metricsArg).every((v) => v === null)).toBe(true)
  })

  it('returns a failure when alignment finds too few anchors', () => {
    vi.mocked(alignSheets).mockReturnValue({ ok: false, reason: 'too-few-anchors', anchoredCells: 2 })
    const result = runPipeline(goodInput(), DEFAULT_PIPELINE_OPTIONS)
    expect(result.ok).toBe(false)
    expect(vi.mocked(composeMascot)).not.toHaveBeenCalled()
    expect(vi.mocked(validatePair).mock.calls[0]![2]).toBeNull()
    expect(result.report.canExport).toBe(false) // the mocked report said true; ok:false forces it off
    expect(result.report.verdict).toBe('redo')
    expect(vi.mocked(buildReport)).toHaveBeenCalledTimes(1)
  })

  it('forces canExport false on every failure path', () => {
    const input: PipelineInput = {
      directions: sheet('directions', checkerSheet(16, { cell: 160 }).image),
      reactions: sheet('reactions', greenSheet().image),
    }
    const result = runPipeline(input, DEFAULT_PIPELINE_OPTIONS)
    expect(result.ok).toBe(false)
    expect(result.report.canExport).toBe(false)
  })

  it('fails cleanly instead of throwing for sheets under 3 px', () => {
    const tiny = createImage(2, 2, { r: 0, g: 255, b: 0, a: 255 })
    const result = runPipeline({ directions: sheet('directions', tiny), reactions: sheet('reactions', greenSheet().image) }, DEFAULT_PIPELINE_OPTIONS)
    expect(result.ok).toBe(false)
    expect(result.directions.key.ok).toBe(false)
    expect(result.directions.slice).toBeNull()
    expect(result.report.canExport).toBe(false)
    expect(vi.mocked(alignSheets)).not.toHaveBeenCalled()
  })
})

describe('optionsForStyle', () => {
  it('sets expected key, cell size and swap flag on top of defaults', () => {
    const o = optionsForStyle('colour', 'magenta', 512, true)
    expect(o.key.expected).toBe('magenta')
    expect(o.compose.cellSize).toBe(512)
    expect(o.compose.sampling).toBe('smooth')
    expect(o.key.featherRadius).toBe(DEFAULT_PIPELINE_OPTIONS.key.featherRadius)
    expect(o.swapDirectionColumns).toBe(true)
    expect(o.thresholds).toBe(DEFAULT_PIPELINE_OPTIONS.thresholds)
  })

  it('uses nearest sampling and no feather for pixel style', () => {
    const o = optionsForStyle('pixel', null, 360, false)
    expect(o.compose.sampling).toBe('nearest')
    expect(o.key.featherRadius).toBe(0)
    expect(o.key.expected).toBeNull()
  })

  it.each(['ink', 'sketch', 'pixel'] as const)('does not feather thin-stroke style %s', (style) => {
    expect(optionsForStyle(style, null, 360, false).key.featherRadius).toBe(0)
  })

  it('rejects cell sizes outside 128..1024 or non-integers', () => {
    expect(() => optionsForStyle('ink', null, 64, false)).toThrow(RangeError)
    expect(() => optionsForStyle('ink', null, 2048, false)).toThrow(RangeError)
    expect(() => optionsForStyle('ink', null, 300.5, false)).toThrow(RangeError)
  })
})
