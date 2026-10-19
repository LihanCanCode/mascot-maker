// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { modeFromHash, useMode } from './useMode'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useMode', () => {
  it('reads the mode from the hash', () => {
    expect(modeFromHash('#gallery')).toBe('gallery')
    expect(modeFromHash('')).toBe('make')
    expect(modeFromHash('#other')).toBe('make')
    window.history.replaceState(null, '', '/#gallery')
    expect(renderHook(() => useMode()).result.current.mode).toBe('gallery')
  })

  it('updates the hash when the mode changes, and back', () => {
    const { result } = renderHook(() => useMode())
    expect(result.current.mode).toBe('make')
    act(() => result.current.setMode('gallery'))
    expect(result.current.mode).toBe('gallery')
    expect(window.location.hash).toBe('#gallery')
    act(() => result.current.setMode('make'))
    expect(window.location.hash).toBe('')
  })

  it('ignores unrelated in-page hashes such as the skip link', async () => {
    window.history.replaceState(null, '', '/#gallery')
    const { result } = renderHook(() => useMode())
    await act(async () => {
      window.location.hash = '#main'
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(result.current.mode).toBe('gallery')
  })

  it('follows hashchange events from links', async () => {
    const { result } = renderHook(() => useMode())
    await act(async () => {
      window.location.hash = '#gallery'
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(result.current.mode).toBe('gallery')
  })
})
