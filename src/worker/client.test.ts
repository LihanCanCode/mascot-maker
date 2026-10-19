import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PipelineOptions, PipelineProgress, PipelineResult } from '../core/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

const runJob = vi.fn()
vi.mock('./runJob', () => ({ runJob: (...args: unknown[]): unknown => runJob(...args) }))

import { runInWorker } from './client'

const OPTIONS = {} as PipelineOptions
const RESULT = { ok: true } as unknown as PipelineResult
const file = (n: string): File => new File(['x'], n)

class FakeWorker {
  static last: FakeWorker | null = null
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  onmessageerror: ((e: MessageEvent) => void) | null = null
  posted: WorkerRequest[] = []
  terminated = false
  constructor() {
    FakeWorker.last = this
  }
  postMessage(m: WorkerRequest): void {
    this.posted.push(m)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(r: WorkerResponse): void {
    this.onmessage?.({ data: r } as MessageEvent<WorkerResponse>)
  }
}

describe('runInWorker with a worker', () => {
  beforeEach(() => {
    FakeWorker.last = null
    vi.stubGlobal('Worker', FakeWorker)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    runJob.mockReset()
  })

  it('posts the request, forwards progress for its id and resolves with the result', async () => {
    const seen: PipelineProgress[] = []
    const p = runInWorker(file('d'), file('r'), OPTIONS, (x) => seen.push(x), new AbortController().signal)
    const w = FakeWorker.last as FakeWorker
    const req = w.posted[0] as Extract<WorkerRequest, { type: 'run' }>
    expect(req.type).toBe('run')
    const progress = { stage: 'aligning', sheet: null, fraction: 0.5 } as const
    w.emit({ type: 'progress', id: req.id + 100, progress })
    w.emit({ type: 'progress', id: req.id, progress })
    w.emit({ type: 'done', id: req.id, result: RESULT })
    await expect(p).resolves.toBe(RESULT)
    expect(seen).toEqual([progress])
    expect(w.terminated).toBe(true)
  })

  it('rejects with the worker message on error', async () => {
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, new AbortController().signal)
    const w = FakeWorker.last as FakeWorker
    const req = w.posted[0] as Extract<WorkerRequest, { type: 'run' }>
    w.emit({ type: 'error', id: req.id, message: 'bad image' })
    await expect(p).rejects.toThrow('bad image')
    expect(w.terminated).toBe(true)
  })

  it('terminates the worker and rejects with AbortError on abort', async () => {
    const ctl = new AbortController()
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)
    const w = FakeWorker.last as FakeWorker
    ctl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(w.terminated).toBe(true)
  })

  it('rejects immediately when already aborted', async () => {
    const ctl = new AbortController()
    ctl.abort()
    await expect(runInWorker(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(FakeWorker.last).toBeNull()
  })

  it('rejects when the result cannot be deserialised', async () => {
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, new AbortController().signal)
    const w = FakeWorker.last as FakeWorker
    w.onmessageerror?.({} as MessageEvent)
    await expect(p).rejects.toThrow(/could not be received/)
    expect(w.terminated).toBe(true)
  })

  it('does not silently rerun on the main thread once the worker has started', async () => {
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, new AbortController().signal)
    const w = FakeWorker.last as FakeWorker
    const req = w.posted[0] as Extract<WorkerRequest, { type: 'run' }>
    w.emit({ type: 'progress', id: req.id, progress: { stage: 'keying', sheet: null, fraction: 0.1 } })
    w.onerror?.({} as ErrorEvent)
    await expect(p).rejects.toThrow(/stopped unexpectedly/)
    expect(runJob).not.toHaveBeenCalled()
  })

  it('falls back to the main thread when the worker fails to load', async () => {
    runJob.mockResolvedValue(RESULT)
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, new AbortController().signal)
    const w = FakeWorker.last as FakeWorker
    w.onerror?.({} as ErrorEvent)
    await expect(p).resolves.toBe(RESULT)
    expect(runJob).toHaveBeenCalledTimes(1)
    expect(w.terminated).toBe(true)
  })
})

describe('runInWorker without Worker support', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    runJob.mockReset()
  })

  it('runs on the main thread and passes progress through', async () => {
    vi.stubGlobal('Worker', undefined)
    runJob.mockImplementation(
      (_d: File, _r: File, _o: PipelineOptions, onProgress: (p: PipelineProgress) => void): PipelineResult => {
        onProgress({ stage: 'keying', sheet: null, fraction: 0.1 })
        return RESULT
      },
    )
    const seen: PipelineProgress[] = []
    await expect(
      runInWorker(file('d'), file('r'), OPTIONS, (x) => seen.push(x), new AbortController().signal),
    ).resolves.toBe(RESULT)
    expect(seen).toHaveLength(1)
  })

  it('hands the abort signal to the main-thread job so it can stop between stages', async () => {
    vi.stubGlobal('Worker', undefined)
    const ctl = new AbortController()
    runJob.mockResolvedValue(RESULT)
    await runInWorker(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)
    expect(runJob.mock.calls[0]?.[4]).toBe(ctl.signal)
  })

  it('rejects an abort that happens while the module is loading', async () => {
    vi.stubGlobal('Worker', undefined)
    const ctl = new AbortController()
    runJob.mockResolvedValue(RESULT)
    const p = runInWorker(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)
    ctl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
