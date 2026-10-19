// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Mascot, sectorFor } from './Mascot'
import source from './Mascot.tsx?raw'

const SECTOR = (Math.PI * 2) / 8

let reducedMotion = false
let hoverCapable = true
const animate = vi.fn()

function layers(): HTMLElement[] {
  return Array.from(screen.getByRole('button').querySelectorAll<HTMLElement>('span span'))
}

function position(layer: number): string {
  return layers()[layer]?.style.backgroundPosition ?? ''
}

function pointerTo(x: number, y: number): void {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
  })
}

function click(times = 1): void {
  for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByRole('button'))
}

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion = false
  hoverCapable = true
  animate.mockReset()
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? reducedMotion : hoverCapable,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('sectorFor', () => {
  it('returns -1 inside the dead zone', () => {
    expect(sectorFor(10, 10, 3)).toBe(-1)
    expect(sectorFor(69, 0, -1)).toBe(-1)
  })

  it('maps the eight compass points clockwise from the right', () => {
    const points: Array<[number, number]> = [[200, 0], [200, 200], [0, 200], [-200, 200], [-200, 0], [-200, -200], [0, -200], [200, -200]]
    expect(points.map(([dx, dy]) => sectorFor(dx, dy, -1))).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps the current sector slightly past its boundary and switches well past it', () => {
    const at = (angle: number) => sectorFor(Math.cos(angle) * 200, Math.sin(angle) * 200, 0)
    expect(at(SECTOR / 2 + 0.1)).toBe(0)
    expect(at(SECTOR / 2 + 0.2)).toBe(1)
  })

  it('wraps around the left edge', () => {
    expect(sectorFor(-200, -1, 4)).toBe(4)
    expect(sectorFor(-200, 1, -1)).toBe(4)
  })
})

describe('Mascot', () => {
  it('labels the button and starts centred with the reactions layer hidden', () => {
    render(<Mascot directions="/d.webp" reactions="/r.webp" label="fox" />)
    expect(screen.getByRole('button', { name: 'Boop the fox' })).toBeTruthy()
    expect(position(0)).toBe('50% 50%')
    expect(layers()[0]?.style.opacity).toBe('1')
    expect(layers()[1]?.style.opacity).toBe('0')
  })

  it('defaults to size 140 and the label "mascot", and applies className and size', () => {
    const { rerender } = render(<Mascot directions="/d" reactions="/r" />)
    const button = screen.getByRole('button', { name: 'Boop the mascot' })
    expect(button.style.width).toBe('140px')
    rerender(<Mascot directions="/d" reactions="/r" size={80} className="x" />)
    expect(button.style.width).toBe('80px')
    expect(button.className).toBe('x')
  })

  it('quotes and escapes the css url', () => {
    // jsdom's CSS parser discards exotic urls, so record what React assigns instead.
    const proto = CSSStyleDeclaration.prototype
    const original = Object.getOwnPropertyDescriptor(proto, 'backgroundImage')
    const assigned: string[] = []
    Object.defineProperty(proto, 'backgroundImage', {
      configurable: true,
      get: original?.get,
      set(value: string) {
        assigned.push(value)
        original?.set?.call(this, value)
      },
    })
    try {
      render(<Mascot directions={'/a"b\\c).webp'} reactions="/r (1).webp" />)
    } finally {
      if (original) Object.defineProperty(proto, 'backgroundImage', original)
    }
    expect(assigned).toContain('url("/a\\"b\\\\c).webp")')
    expect(assigned).toContain('url("/r (1).webp")')
  })

  it('always mounts the reactions layer with its image', () => {
    render(<Mascot directions="/d.webp" reactions="/r.webp" />)
    expect(layers()[1]?.style.backgroundImage).toContain('/r.webp')
  })

  it('looks toward the pointer and returns to centre inside the dead zone', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    pointerTo(200, 0)
    expect(position(0)).toBe('100% 50%')
    pointerTo(0, -200)
    expect(position(0)).toBe('50% 0%')
    pointerTo(30, 30)
    expect(position(0)).toBe('50% 50%')
  })

  it('re-aims on scroll', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    pointerTo(-200, 0)
    expect(position(0)).toBe('0% 50%')
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(position(0)).toBe('0% 50%')
  })

  it('ignores the pointer on touch-only devices', () => {
    hoverCapable = false
    render(<Mascot directions="/d" reactions="/r" />)
    pointerTo(200, 0)
    expect(position(0)).toBe('50% 50%')
  })

  it('boops: blink, then heart at 120 ms, then back at 560 ms', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    click()
    expect(position(1)).toBe('0% 0%')
    expect(layers()[1]?.style.opacity).toBe('1')
    expect(layers()[0]?.style.opacity).toBe('0')
    act(() => void vi.advanceTimersByTime(120))
    expect(position(1)).toBe('50% 0%')
    act(() => void vi.advanceTimersByTime(440))
    expect(layers()[1]?.style.opacity).toBe('0')
    expect(layers()[0]?.style.opacity).toBe('1')
  })

  it('cycles heart, sparkle, delighted over consecutive boops', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    const seen: string[] = []
    for (let i = 0; i < 3; i += 1) {
      click()
      act(() => void vi.advanceTimersByTime(120))
      seen.push(position(1))
      act(() => void vi.advanceTimersByTime(500))
    }
    expect(seen).toEqual(['50% 0%', '100% 0%', '100% 100%'])
  })

  it('goes dizzy after four quick boops, then recovers', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    click(4)
    expect(position(1)).toBe('50% 100%')
    act(() => void vi.advanceTimersByTime(1100))
    expect(layers()[1]?.style.opacity).toBe('0')
  })

  it('squashes unless reduced motion is requested', () => {
    render(<Mascot directions="/d" reactions="/r" />)
    click()
    expect(animate).toHaveBeenCalledTimes(1)
    cleanup()
    animate.mockReset()
    reducedMotion = true
    render(<Mascot directions="/d" reactions="/r" />)
    click()
    expect(animate).not.toHaveBeenCalled()
    expect(position(1)).toBe('0% 0%')
  })

  it('still works when matchMedia and animate are unavailable', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true })
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: undefined, configurable: true, writable: true })
    render(<Mascot directions="/d" reactions="/r" />)
    click()
    expect(position(1)).toBe('0% 0%')
  })

  it('removes listeners and clears timers on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Mascot directions="/d" reactions="/r" />)
    click()
    unmount()
    const removed = remove.mock.calls.map((c) => c[0])
    expect(removed).toContain('pointermove')
    expect(removed).toContain('scroll')
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Mascot.tsx source', () => {
  it('imports only from react', () => {
    const specs = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.every((s) => s === 'react')).toBe(true)
    expect(source).not.toMatch(/import\s+['"]/)
  })
})
