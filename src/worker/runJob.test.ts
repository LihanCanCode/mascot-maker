import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PipelineOptions, PipelineResult, RawImage } from '../core/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

const runPipeline = vi.fn()
vi.mock('../core/pipeline', () => ({ runPipeline: (...a: unknown[]): unknown => runPipeline(...a) }))
const decodeImageFile = vi.fn()
vi.mock('../adapters/decode', () => ({
  decodeImageFile: (...a: unknown[]): unknown => decodeImageFile(...a),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))

import { ImageDecodeError } from '../adapters/decode'
import { collectTransferables, friendlyMessage, handleRequest, runJob } from './runJob'

const img = (n = 4): RawImage => ({ width: 1, height: 1, data: new Uint8ClampedArray(n) })
const meta = {}
const OPTIONS = {} as PipelineOptions
const file = (n: string): File => new File(['x'], n)

beforeEach(() => {
  runPipeline.mockReset()
  decodeImageFile.mockReset()
  decodeImageFile.mockImplementation(async () => ({ image: img(), meta }))
})

describe('collectTransferables', () => {
  it('collects each distinct pixel buffer once, from analyses and outputs', () => {
    const shared = img()
    const other = img()
    const result = {
      ok: true,
      directions: { key: { ok: true, image: shared }, slice: { cells: [{ image: shared }, { image: other }] } },
      reactions: { key: { ok: false }, slice: null },
      output: { directions: img(), reactions: img(), directionTiles: [img()], reactionTiles: [img(), img()] },
    } as unknown as PipelineResult
    const buffers = collectTransferables(result)
    expect(buffers).toHaveLength(2 + 2 + 1 + 2)
    expect(new Set(buffers).size).toBe(buffers.length)
  })

  it('works for failures without output', () => {
    const result = {
      ok: false,
      directions: { key: { ok: false }, slice: null },
      reactions: { key: { ok: false }, slice: null },
    } as unknown as PipelineResult
    expect(collectTransferables(result)).toEqual([])
  })
})

describe('runJob', () => {
  it('decodes both sheets and runs the pipeline with progress', async () => {
    const result = { ok: true } as unknown as PipelineResult
    runPipeline.mockImplementation((_i, _o, onProgress: (p: unknown) => void) => {
      onProgress({ stage: 'keying' })
      return result
    })
    const seen: unknown[] = []
    await expect(runJob(file('d'), file('r'), OPTIONS, (p) => seen.push(p))).resolves.toBe(result)
    expect(decodeImageFile).toHaveBeenCalledTimes(2)
    expect(seen).toHaveLength(1)
  })

  it('stops with AbortError between stages when the signal is aborted', async () => {
    const ctl = new AbortController()
    decodeImageFile.mockImplementation(async () => {
      ctl.abort()
      return { image: img(), meta }
    })
    await expect(runJob(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(runPipeline).not.toHaveBeenCalled()
  })

  it('aborts from inside a progress callback too', async () => {
    const ctl = new AbortController()
    runPipeline.mockImplementation((_i, _o, onProgress: (p: unknown) => void) => {
      ctl.abort()
      onProgress({ stage: 'keying' })
      return {}
    })
    await expect(runJob(file('d'), file('r'), OPTIONS, () => {}, ctl.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('handleRequest and friendlyMessage', () => {
  const request = (): WorkerRequest => ({ type: 'run', id: 4, directions: file('d'), reactions: file('r'), options: OPTIONS })

  it('posts progress then done with a transfer list', async () => {
    const result = {
      ok: false,
      directions: { key: { ok: false }, slice: null },
      reactions: { key: { ok: false }, slice: null },
    } as unknown as PipelineResult
    runPipeline.mockImplementation((_i, _o, onProgress: (p: unknown) => void) => {
      onProgress({ stage: 'keying' })
      return result
    })
    const posted: { r: WorkerResponse; t?: ArrayBuffer[] }[] = []
    await handleRequest(request(), (r, t) => posted.push({ r, t }))
    expect(posted.map((p) => p.r.type)).toEqual(['progress', 'done'])
    expect(posted[1]?.t).toEqual([])
  })

  it('posts friendly errors, keeping decode messages as they are', async () => {
    decodeImageFile.mockRejectedValue(new ImageDecodeError('Bad file'))
    const posted: WorkerResponse[] = []
    await handleRequest(request(), (r) => posted.push(r))
    expect(posted).toEqual([{ type: 'error', id: 4, message: 'Bad file' }])
    expect(friendlyMessage(new Error('boom'))).toMatch(/Something went wrong.*boom/)
    expect(friendlyMessage('x')).toMatch(/unknown error/)
  })
})
