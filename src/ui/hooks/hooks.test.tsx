// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from './useClipboard'
import { useObjectUrls, useRevokeOnRemoval } from './useObjectUrls'
import { useTheme } from './useTheme'

describe('useObjectUrls', () => {
  let n = 0
  const revoke = vi.fn()
  beforeEach(() => {
    n = 0
    revoke.mockReset()
    URL.createObjectURL = vi.fn(() => `blob:${(n += 1)}`)
    URL.revokeObjectURL = revoke
  })

  it('creates urls for blobs, revokes on change and on unmount', async () => {
    const a = new Blob(['a'])
    const b = new Blob(['b'])
    const { result, rerender, unmount } = renderHook(({ blobs }) => useObjectUrls(blobs), {
      initialProps: { blobs: [a, null] as readonly (Blob | null)[] },
    })
    await waitFor(() => expect(result.current[0]).toBe('blob:1'))
    expect(result.current[1]).toBeNull()
    rerender({ blobs: [b, null] })
    await waitFor(() => expect(result.current[0]).toBe('blob:2'))
    expect(revoke).toHaveBeenCalledWith('blob:1')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:2')
  })

  it('useRevokeOnRemoval revokes urls that disappear and all on unmount', () => {
    const { rerender, unmount } = renderHook(({ urls }) => useRevokeOnRemoval(urls), {
      initialProps: { urls: ['u1', 'u2'] },
    })
    rerender({ urls: ['u2'] })
    expect(revoke).toHaveBeenCalledWith('u1')
    expect(revoke).not.toHaveBeenCalledWith('u2')
    unmount()
    expect(revoke).toHaveBeenCalledWith('u2')
  })
})

describe('useClipboard', () => {
  afterEach(() => vi.useRealTimers())

  it('copies text and resets the copied flag', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('hello')
    })
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(result.current.copied).toBe(false)
  })

  it('reports failure instead of throwing', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    document.execCommand = vi.fn(() => false)
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('x')
    })
    expect(result.current.copied).toBe(false)
    expect(result.current.failed).toBe(true)
  })
})

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  })

  it('follows the system until toggled, then stores the choice', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('mascot-maker-theme')).toBe('dark')
  })

  it('restores a stored choice and survives broken storage', () => {
    localStorage.setItem('mascot-maker-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
    spy.mockRestore()
  })
})
