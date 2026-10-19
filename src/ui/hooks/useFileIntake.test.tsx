// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InspectResult } from '../../adapters/fileCheck'
import type { AppAction } from '../state/appReducer'

const inspectImageFile = vi.fn()
vi.mock('../../adapters/fileCheck', () => ({
  inspectImageFile: (...a: unknown[]): unknown => inspectImageFile(...a),
}))

import { useFileIntake } from './useFileIntake'

const good: InspectResult = { ok: true, mimeType: 'image/png', width: 800, height: 800 }
const file = (n: string): File => new File(['x'], n)

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  inspectImageFile.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:new')
  URL.revokeObjectURL = vi.fn()
})

describe('useFileIntake', () => {
  it('accepts a valid file and only then creates the preview url', async () => {
    inspectImageFile.mockResolvedValue(good)
    const dispatch = vi.fn<(a: AppAction) => void>()
    const { result } = renderHook(() => useFileIntake(dispatch))
    const f = file('a.png')
    await act(() => result.current('directions', f))
    expect(dispatch).toHaveBeenCalledWith({ type: 'file/accepted', sheet: 'directions', file: f, previewUrl: 'blob:new' })
  })

  it('rejects invalid files without creating a url', async () => {
    inspectImageFile.mockResolvedValue({ ok: false, message: 'Too big' })
    const dispatch = vi.fn<(a: AppAction) => void>()
    const { result } = renderHook(() => useFileIntake(dispatch))
    await act(() => result.current('reactions', file('a.png')))
    expect(dispatch).toHaveBeenCalledWith({ type: 'file/rejected', sheet: 'reactions', message: 'Too big' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('turns unexpected errors into a friendly rejection', async () => {
    inspectImageFile.mockRejectedValue(new Error('disk'))
    const dispatch = vi.fn<(a: AppAction) => void>()
    const { result } = renderHook(() => useFileIntake(dispatch))
    await act(() => result.current('directions', file('a.png')))
    const action = dispatch.mock.calls[0]?.[0]
    expect(action?.type).toBe('file/rejected')
    expect(action?.type === 'file/rejected' && action.message).toMatch(/could not read/i)
  })

  it('ignores a slower, older result for the same sheet', async () => {
    const slow = deferred<InspectResult>()
    inspectImageFile.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(good)
    const dispatch = vi.fn<(a: AppAction) => void>()
    const { result } = renderHook(() => useFileIntake(dispatch))
    const first = file('first.png')
    const second = file('second.png')
    let p1!: Promise<void>
    act(() => {
      p1 = result.current('directions', first)
    })
    await act(() => result.current('directions', second))
    await act(async () => {
      slow.resolve({ ok: false, message: 'late' })
      await p1
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: 'file/accepted', file: second })
  })

  it('does nothing after unmount', async () => {
    const pending = deferred<InspectResult>()
    inspectImageFile.mockReturnValue(pending.promise)
    const dispatch = vi.fn<(a: AppAction) => void>()
    const { result, unmount } = renderHook(() => useFileIntake(dispatch))
    let p!: Promise<void>
    act(() => {
      p = result.current('directions', file('a.png'))
    })
    unmount()
    pending.resolve(good)
    await p
    expect(dispatch).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
