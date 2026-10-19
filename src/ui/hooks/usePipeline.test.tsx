// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { useReducer } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PipelineOptions, PipelineResult } from '../../core/types'
import { appReducer, initialState, type AppState } from '../state/appReducer'

const runInWorker = vi.fn()
vi.mock('../../worker/client', () => ({ runInWorker: (...a: unknown[]): unknown => runInWorker(...a) }))
const optionsForStyle = vi.fn(() => ({ marker: 'opts' }) as unknown as PipelineOptions)
vi.mock('../../core/pipelineOptions', () => ({ optionsForStyle: (...a: unknown[]): unknown => (optionsForStyle as (...x: unknown[]) => unknown)(...a) }))
vi.mock('../../prompts', () => ({ buildPrompts: () => ({ key: 'magenta' }) }))

import { usePipeline } from './usePipeline'

const readyState = (): AppState => ({
  ...initialState,
  step: 'upload',
  files: {
    directions: { status: 'ready', file: new File(['d'], 'd.png'), previewUrl: 'u1' },
    reactions: { status: 'ready', file: new File(['r'], 'r.png'), previewUrl: 'u2' },
  },
})

function useHarness(): { state: AppState; start: () => void } {
  const [state, dispatch] = useReducer(appReducer, undefined, readyState)
  const { start } = usePipeline(state, dispatch)
  return { state, start }
}

describe('usePipeline', () => {
  beforeEach(() => {
    runInWorker.mockReset()
    optionsForStyle.mockClear()
  })

  it('runs the pipeline on start and lands in review with the result', async () => {
    const result = { ok: true, report: { canExport: true } } as unknown as PipelineResult
    runInWorker.mockImplementation(async (_d, _r, _o, onProgress: (p: unknown) => void) => {
      onProgress({ stage: 'aligning', sheet: null, fraction: 0.5 })
      return result
    })
    const { result: hook } = renderHook(useHarness)
    act(() => hook.current.start())
    await waitFor(() => expect(hook.current.state.step).toBe('review'))
    expect(optionsForStyle).toHaveBeenCalledWith('colour', 'magenta', 360, false)
  })

  it('uses the key the user chose over the automatic one', async () => {
    runInWorker.mockResolvedValue({ ok: false } as unknown as PipelineResult)
    const { result: hook } = renderHook(() => {
      const [state, dispatch] = useReducer(appReducer, undefined, () => {
        const s = readyState()
        return { ...s, brief: { ...s.brief, key: 'blue' as const } }
      })
      return { state, ...usePipeline(state, dispatch) }
    })
    act(() => hook.current.start())
    await waitFor(() => expect(hook.current.state.step).toBe('review'))
    expect(optionsForStyle).toHaveBeenCalledWith('colour', 'blue', 360, false)
  })

  it('returns to upload with the failure message', async () => {
    runInWorker.mockRejectedValue(new Error('Could not open it'))
    const { result: hook } = renderHook(useHarness)
    act(() => hook.current.start())
    await waitFor(() => expect(hook.current.state.step).toBe('upload'))
    const s = hook.current.state
    expect(s.step === 'upload' && s.error).toBe('Could not open it')
  })

  it('aborts the run when the user leaves processing, and ignores the abort', async () => {
    let signal: AbortSignal | undefined
    runInWorker.mockImplementation(
      (_d, _r, _o, _p, s: AbortSignal) =>
        new Promise((_res, rej) => {
          signal = s
          s.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))
        }),
    )
    const { result: hook } = renderHook(() => {
      const [state, dispatch] = useReducer(appReducer, undefined, readyState)
      return { state, dispatch, ...usePipeline(state, dispatch) }
    })
    act(() => hook.current.start())
    await waitFor(() => expect(signal).toBeDefined())
    act(() => hook.current.dispatch({ type: 'nav/goto', step: 'upload' }))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(hook.current.state.step).toBe('upload')
    expect((hook.current.state as { error?: string }).error).toBeUndefined()
  })
})
