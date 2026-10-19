// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sectorFor as reactSectorFor } from '../mascot/Mascot'
import { definePageMascot, sectorFor } from './page-mascot.js'
import script from './page-mascot.js?raw'

const CLOCKWISE_CELLS = ['100% 50%', '100% 100%', '50% 100%', '0% 100%', '0% 50%', '0% 0%', '50% 0%', '100% 0%']

let reduced = false
let hover = true
const animate = vi.fn()

function make(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('page-mascot')
  const all = { directions: '/d.webp', reactions: '/r.webp', ...attrs }
  for (const [k, v] of Object.entries(all)) el.setAttribute(k, v)
  document.body.appendChild(el)
  return el
}

function layers(el: HTMLElement): HTMLElement[] {
  return Array.from(el.shadowRoot?.querySelectorAll<HTMLElement>('button span span') ?? [])
}

function button(el: HTMLElement): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector('button')
  if (!b) throw new Error('no button')
  return b
}

function pointer(x: number, y: number): void {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
}

beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  hover = true
  animate.mockReset()
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') ? reduced : hover })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('registration', () => {
  it('defines <page-mascot> once and is idempotent', async () => {
    const ctor = customElements.get('page-mascot')
    expect(ctor).toBeDefined()
    definePageMascot()
    vi.resetModules()
    await import('./page-mascot.js')
    expect(customElements.get('page-mascot')).toBe(ctor)
  })

  it('is framework-free ES2019 source', () => {
    expect(script).not.toMatch(/\?\.|\?\?|^\s*import\s/m)
    expect(script).not.toMatch(/\bimport\b.*from/)
  })
})

describe('rendering', () => {
  it('reflects attributes into the shadow DOM', () => {
    const el = make({ size: '90', label: 'fox' })
    const b = button(el)
    expect(b.getAttribute('aria-label')).toBe('Boop the fox')
    expect(b.style.width).toBe('90px')
    expect(layers(el)[0]?.style.backgroundImage).toContain('/d.webp')
    expect(layers(el)[1]?.style.backgroundImage).toContain('/r.webp')
    expect(layers(el)[0]?.style.backgroundPosition).toBe('50% 50%')
  })

  it('defaults size and label and reacts to attribute changes', () => {
    const el = make()
    expect(button(el).style.width).toBe('140px')
    expect(button(el).getAttribute('aria-label')).toBe('Boop the mascot')
    el.setAttribute('size', 'nonsense')
    expect(button(el).style.width).toBe('140px')
    el.setAttribute('size', '64')
    el.setAttribute('label', 'cat')
    el.setAttribute('directions', '/other.webp')
    expect(button(el).style.width).toBe('64px')
    expect(button(el).getAttribute('aria-label')).toBe('Boop the cat')
    expect(layers(el)[0]?.style.backgroundImage).toContain('/other.webp')
  })

  it('keeps the reactions layer mounted but hidden', () => {
    const el = make()
    expect(layers(el)[1]?.style.opacity).toBe('0')
    expect(layers(el)[0]?.style.opacity).toBe('1')
  })

  it('does not throw when image attributes are missing', () => {
    const el = document.createElement('page-mascot')
    expect(() => document.body.appendChild(el)).not.toThrow()
  })
})

describe('pointer tracking', () => {
  it('looks toward the pointer, re-centres in the dead zone and ignores touch devices', () => {
    const el = make()
    pointer(200, 0)
    expect(layers(el)[0]?.style.backgroundPosition).toBe('100% 50%')
    pointer(10, 10)
    expect(layers(el)[0]?.style.backgroundPosition).toBe('50% 50%')
    window.dispatchEvent(new Event('scroll'))
    el.remove()
    hover = false
    const touch = make()
    pointer(200, 0)
    expect(layers(touch)[0]?.style.backgroundPosition).toBe('50% 50%')
  })

  it('matches the React component sector table over 72 angles (parity)', () => {
    const el = make()
    let current = -1
    for (let i = 0; i < 72; i += 1) {
      const angle = (i / 72) * Math.PI * 2
      const dx = Math.cos(angle) * 200
      const dy = Math.sin(angle) * 200
      current = reactSectorFor(dx, dy, current)
      pointer(dx, dy)
      expect(layers(el)[0]?.style.backgroundPosition).toBe(CLOCKWISE_CELLS[current])
    }
  })

  it('exports a sectorFor identical to the component one', () => {
    for (let dx = -150; dx <= 150; dx += 30) {
      for (let dy = -150; dy <= 150; dy += 30) {
        for (let current = -1; current < 8; current += 1) {
          expect(sectorFor(dx, dy, current)).toBe(reactSectorFor(dx, dy, current))
        }
      }
    }
  })
})

describe('boop', () => {
  it('blinks, shows the payoff at 120 ms and ends at 560 ms', () => {
    const el = make()
    button(el).click()
    expect(layers(el)[1]?.style.backgroundPosition).toBe('0% 0%')
    expect(layers(el)[1]?.style.opacity).toBe('1')
    expect(layers(el)[0]?.style.opacity).toBe('0')
    vi.advanceTimersByTime(120)
    expect(layers(el)[1]?.style.backgroundPosition).toBe('50% 0%')
    vi.advanceTimersByTime(440)
    expect(layers(el)[1]?.style.opacity).toBe('0')
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('goes dizzy after four quick boops', () => {
    const el = make()
    for (let i = 0; i < 4; i += 1) button(el).click()
    expect(layers(el)[1]?.style.backgroundPosition).toBe('50% 100%')
    vi.advanceTimersByTime(1100)
    expect(layers(el)[1]?.style.opacity).toBe('0')
  })

  it('cycles payoffs and skips the squash under reduced motion', () => {
    reduced = true
    const el = make()
    const seen: Array<string | undefined> = []
    for (let i = 0; i < 3; i += 1) {
      button(el).click()
      vi.advanceTimersByTime(120)
      seen.push(layers(el)[1]?.style.backgroundPosition)
      vi.advanceTimersByTime(500)
    }
    expect(seen).toEqual(['50% 0%', '100% 0%', '100% 100%'])
    expect(animate).not.toHaveBeenCalled()
  })
})

describe('disconnect', () => {
  it('removes window listeners and clears pending timers', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const el = make()
    button(el).click()
    el.remove()
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointermove', 'scroll']))
    expect(vi.getTimerCount()).toBe(0)
    pointer(200, 0)
    expect(layers(el)[0]?.style.backgroundPosition).toBe('50% 50%')
  })

  it('can be re-attached', () => {
    const el = make()
    el.remove()
    document.body.appendChild(el)
    pointer(0, 200)
    expect(layers(el)[0]?.style.backgroundPosition).toBe('50% 100%')
  })
})

describe('without optional browser APIs', () => {
  it('works with no matchMedia and no animate', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true })
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: undefined, configurable: true, writable: true })
    const el = make()
    button(el).click()
    expect(layers(el)[1]?.style.backgroundPosition).toBe('0% 0%')
  })
})
