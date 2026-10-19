import { describe, expect, it } from 'vitest'
import type { PipelineFailure, PipelineResult, PipelineSuccess, ValidationReport } from '../../core/types'
import { appReducer, initialState, type AppAction, type AppState, type FileSlot } from './appReducer'

const file = (name: string): File => new File(['x'], name, { type: 'image/png' })
const ready = (name: string): FileSlot => ({ status: 'ready', file: file(name), previewUrl: `blob:${name}` })

const report = (canExport: boolean): ValidationReport => ({
  issues: [],
  metrics: {
    shoulderSpreadPct: null, headShoulderRatio: null, boopShiftPx: null,
    minBandOverlap: null, paletteMatch: null, widthChange: null,
  },
  verdict: canExport ? 'ready' : 'redo',
  canExport,
})
const failure = (): PipelineFailure =>
  ({ ok: false, report: report(false) }) as unknown as PipelineFailure
const success = (canExport = true): PipelineSuccess =>
  ({ ok: true, report: report(canExport) }) as unknown as PipelineSuccess

const upload = (): AppState => ({ ...initialState, step: 'upload' })
const uploadReady = (): AppState => ({
  ...initialState,
  step: 'upload',
  files: { directions: ready('d.png'), reactions: ready('r.png') },
})
const processing = (runId = 1): AppState => {
  const s = uploadReady()
  return { ...s, step: 'processing', progress: { stage: 'keying', sheet: null, fraction: 0 }, runId, from: 'upload', previous: null } as AppState
}
const review = (result: PipelineResult = failure()): AppState => ({ ...uploadReady(), step: 'review', result }) as AppState
const exported = (): AppState => ({ ...uploadReady(), step: 'export', result: success() }) as AppState

const send = (s: AppState, a: AppAction): AppState => appReducer(s, a)

describe('initialState', () => {
  it('starts on setup with empty slots and sensible defaults', () => {
    expect(initialState.step).toBe('setup')
    expect(initialState.files.directions.status).toBe('empty')
    expect(initialState.brief.usePhoto).toBe(true)
    expect(initialState.options.cellSize).toBe(360)
  })
})

describe('brief/update', () => {
  it('merges a patch without mutating the previous state', () => {
    const next = send(initialState, { type: 'brief/update', patch: { name: 'Mochi' } })
    expect(next.brief.name).toBe('Mochi')
    expect(initialState.brief.name).toBe('')
    expect(next.brief).not.toBe(initialState.brief)
  })

  it('is ignored outside setup', () => {
    for (const s of [upload(), processing(), review(), exported()]) {
      expect(send(s, { type: 'brief/update', patch: { name: 'x' } })).toBe(s)
    }
  })
})

describe('nav/goto', () => {
  it('moves between setup and upload', () => {
    expect(send(initialState, { type: 'nav/goto', step: 'upload' }).step).toBe('upload')
    expect(send(upload(), { type: 'nav/goto', step: 'setup' }).step).toBe('setup')
  })

  it('returns the same reference when already on the step', () => {
    expect(send(initialState, { type: 'nav/goto', step: 'setup' })).toBe(initialState)
    const r = review()
    expect(send(r, { type: 'nav/goto', step: 'review' })).toBe(r)
  })

  it('refuses review and export without a result', () => {
    const s = upload()
    expect(send(s, { type: 'nav/goto', step: 'review' })).toBe(s)
    expect(send(s, { type: 'nav/goto', step: 'export' })).toBe(s)
    expect(send(initialState, { type: 'nav/goto', step: 'export' })).toBe(initialState)
  })

  it('goes from review to export only for an exportable success', () => {
    expect(send(review(success(true)), { type: 'nav/goto', step: 'export' }).step).toBe('export')
    const blocked = review(success(false))
    expect(send(blocked, { type: 'nav/goto', step: 'export' })).toBe(blocked)
    const failed = review(failure())
    expect(send(failed, { type: 'nav/goto', step: 'export' })).toBe(failed)
  })

  it('goes back from export to review keeping the result', () => {
    const next = send(exported(), { type: 'nav/goto', step: 'review' })
    expect(next.step).toBe('review')
    if (next.step === 'review') expect(next.result.ok).toBe(true)
  })

  it('restores the previous result when a rebuild is cancelled', () => {
    const fromReview = send(review(), { type: 'run/started', runId: 2 })
    expect(fromReview.step === 'processing' && fromReview.from).toBe('review')
    const back = send(fromReview, { type: 'nav/goto', step: 'review' })
    expect(back.step).toBe('review')
    const fromExport = send(exported(), { type: 'run/started', runId: 2 })
    expect(send(fromExport, { type: 'nav/goto', step: 'export' }).step).toBe('export')
    expect(send(fromExport, { type: 'nav/goto', step: 'review' })).toBe(fromExport)
    expect(send(processing(), { type: 'nav/goto', step: 'export' }).step).toBe('processing')
  })

  it('lets the user leave processing for setup or upload, and keeps files', () => {
    const next = send(processing(), { type: 'nav/goto', step: 'upload' })
    expect(next.step).toBe('upload')
    expect(next.files.directions.status).toBe('ready')
    expect(send(processing(), { type: 'nav/goto', step: 'review' }).step).toBe('processing')
  })
})

describe('file actions', () => {
  it('accepts a file into the matching slot on the upload step', () => {
    const f = file('d.png')
    const next = send(upload(), { type: 'file/accepted', sheet: 'directions', file: f, previewUrl: 'blob:1' })
    expect(next.files.directions).toEqual({ status: 'ready', file: f, previewUrl: 'blob:1' })
    expect(next.files.reactions.status).toBe('empty')
  })

  it('records a rejection message and clears a slot', () => {
    const rejected = send(upload(), { type: 'file/rejected', sheet: 'reactions', message: 'nope' })
    expect(rejected.files.reactions).toEqual({ status: 'rejected', message: 'nope' })
    const cleared = send(uploadReady(), { type: 'file/cleared', sheet: 'directions' })
    expect(cleared.files.directions.status).toBe('empty')
    expect(cleared.files.reactions.status).toBe('ready')
  })

  it('keeps an already accepted file when a replacement is rejected, and shows the message', () => {
    const next = send(uploadReady(), { type: 'file/rejected', sheet: 'directions', message: 'Nope' })
    expect(next.files.directions.status).toBe('ready')
    expect(next.step === 'upload' && next.error).toBe('Nope')
    const cleared = send(next, { type: 'file/cleared', sheet: 'reactions' })
    expect(cleared.step === 'upload' && cleared.error).toBeFalsy()
  })

  it('ignores file actions on other steps', () => {
    const s = review()
    expect(send(s, { type: 'file/cleared', sheet: 'directions' })).toBe(s)
    expect(send(initialState, { type: 'file/rejected', sheet: 'directions', message: 'x' })).toBe(initialState)
    expect(send(processing(), { type: 'file/accepted', sheet: 'directions', file: file('a'), previewUrl: 'u' }).step).toBe('processing')
  })

  it('clears an earlier run error when files change', () => {
    const failed = send(processing(2), { type: 'run/failed', runId: 2, message: 'boom' })
    const next = send(failed, { type: 'file/cleared', sheet: 'directions' })
    expect(next.step === 'upload' && next.error).toBeFalsy()
  })
})

describe('run lifecycle', () => {
  it('starts a run when both files are ready', () => {
    const next = send(uploadReady(), { type: 'run/started', runId: 7 })
    expect(next.step).toBe('processing')
    if (next.step === 'processing') {
      expect(next.runId).toBe(7)
      expect(next.progress.fraction).toBe(0)
    }
  })

  it('can restart from review and export (swap columns, new cell size)', () => {
    expect(send(review(), { type: 'run/started', runId: 3 }).step).toBe('processing')
    expect(send(exported(), { type: 'run/started', runId: 3 }).step).toBe('processing')
  })

  it('refuses to start without both files, from setup, or while processing', () => {
    const half: AppState = { ...upload(), files: { directions: ready('d'), reactions: { status: 'empty' } } }
    expect(send(half, { type: 'run/started', runId: 1 })).toBe(half)
    expect(send(initialState, { type: 'run/started', runId: 1 })).toBe(initialState)
    const p = processing()
    expect(send(p, { type: 'run/started', runId: 2 })).toBe(p)
  })

  it('applies progress for the current run only', () => {
    const p = processing(5)
    const next = send(p, { type: 'run/progress', runId: 5, progress: { stage: 'aligning', sheet: null, fraction: 0.6 } })
    expect(next.step === 'processing' && next.progress.stage).toBe('aligning')
    expect(send(p, { type: 'run/progress', runId: 4, progress: { stage: 'done', sheet: null, fraction: 1 } })).toBe(p)
    const u = uploadReady()
    expect(send(u, { type: 'run/progress', runId: 5, progress: { stage: 'done', sheet: null, fraction: 1 } })).toBe(u)
  })

  it('finishes into review for matching run ids, with success or failure', () => {
    const done = send(processing(5), { type: 'run/finished', runId: 5, result: success() })
    expect(done.step).toBe('review')
    const bad = send(processing(5), { type: 'run/finished', runId: 5, result: failure() })
    expect(bad.step === 'review' && bad.result.ok).toBe(false)
  })

  it('returns to export after a rebuild started there, if still exportable', () => {
    const p = send(exported(), { type: 'run/started', runId: 9 })
    expect(send(p, { type: 'run/finished', runId: 9, result: success(true) }).step).toBe('export')
    expect(send(p, { type: 'run/finished', runId: 9, result: success(false) }).step).toBe('review')
    expect(send(p, { type: 'run/finished', runId: 9, result: failure() }).step).toBe('review')
    const fromReview = send(review(), { type: 'run/started', runId: 9 })
    expect(send(fromReview, { type: 'run/finished', runId: 9, result: success(true) }).step).toBe('review')
  })

  it('ignores a stale finish and any finish outside processing', () => {
    const p = processing(5)
    expect(send(p, { type: 'run/finished', runId: 4, result: success() })).toBe(p)
    const u = uploadReady()
    expect(send(u, { type: 'run/finished', runId: 5, result: success() })).toBe(u)
  })

  it('returns to upload with an error message on failure', () => {
    const next = send(processing(5), { type: 'run/failed', runId: 5, message: 'Could not read it' })
    expect(next.step).toBe('upload')
    if (next.step === 'upload') expect(next.error).toBe('Could not read it')
    const p = processing(5)
    expect(send(p, { type: 'run/failed', runId: 1, message: 'old' })).toBe(p)
    expect(send(review(), { type: 'run/failed', runId: 5, message: 'x' }).step).toBe('review')
  })
})

describe('options/update', () => {
  it('merges and clamps values', () => {
    const next = send(initialState, { type: 'options/update', patch: { previewSize: 9999, cellSize: 10 } })
    expect(next.options.previewSize).toBe(240)
    expect(next.options.cellSize).toBe(128)
    expect(send(initialState, { type: 'options/update', patch: { previewSize: 1 } }).options.previewSize).toBe(80)
    expect(send(initialState, { type: 'options/update', patch: { cellSize: 99999 } }).options.cellSize).toBe(1024)
  })

  it('returns the same reference when nothing changes', () => {
    expect(send(initialState, { type: 'options/update', patch: { cellSize: 360 } })).toBe(initialState)
    expect(send(initialState, { type: 'options/update', patch: {} })).toBe(initialState)
  })

  it('works on every step except processing', () => {
    expect(send(exported(), { type: 'options/update', patch: { previewBg: 'dark' } }).options.previewBg).toBe('dark')
    const p = processing()
    expect(send(p, { type: 'options/update', patch: { previewBg: 'dark' } })).toBe(p)
  })
})

describe('reset', () => {
  it('returns to the initial state from anywhere', () => {
    for (const s of [upload(), processing(), review(), exported()]) {
      expect(send(s, { type: 'reset' })).toBe(initialState)
    }
  })

  it('is a no-op on a fresh state', () => {
    expect(send(initialState, { type: 'reset' })).toBe(initialState)
  })
})
