// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../ui/testMatchers'

vi.mock('../mascot/Mascot', () => ({
  Mascot: (p: { directions: string; label?: string }) => <div data-testid="mascot" data-src={p.directions}>{p.label}</div>,
}))

import { GalleryView } from './GalleryView'

type Callback = (entries: { isIntersecting: boolean }[]) => void
let observers: { cb: Callback; target: Element | null }[] = []

beforeEach(() => {
  observers = []
  class FakeObserver {
    cb: Callback
    constructor(cb: Callback) {
      this.cb = cb
    }
    observe(target: Element): void {
      observers.push({ cb: this.cb, target })
    }
    disconnect(): void {}
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GalleryView grid', () => {
  it('lists characters as named buttons, with a live count', () => {
    render(<GalleryView onMakeOwn={() => {}} />)
    const grid = screen.getByRole('list')
    const buttons = within(grid).getAllByRole('button')
    expect(buttons).toHaveLength(53)
    for (const b of buttons) expect(b.getAttribute('aria-label')).toMatch(/\S, (animal|person|robot|object)$/)
    expect(screen.getByRole('button', { name: 'Fox, animal' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('53 characters')
  })

  it('loads a card picture only after the card nears the viewport', () => {
    render(<GalleryView onMakeOwn={() => {}} />)
    const poses = document.querySelectorAll<HTMLElement>('.gcard-pose')
    expect(poses[0]?.style.backgroundImage).toBe('')
    const first = observers[0]
    expect(first).toBeDefined()
    // simulate the first card scrolling into range
    act(() => first?.cb([{ isIntersecting: true }]))
    expect(poses[0]?.style.backgroundImage).toContain('/mascots/bear-directions.webp')
    expect(poses[1]?.style.backgroundImage).toBe('')
  })

  it('filters with the search box and the chips', async () => {
    const user = userEvent.setup()
    render(<GalleryView onMakeOwn={() => {}} />)
    await user.type(screen.getByLabelText('Search'), 'panda')
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(2)
    await user.clear(screen.getByLabelText('Search'))
    await user.click(screen.getByRole('button', { name: 'Robots' }))
    expect(screen.getByRole('button', { name: 'Robots' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'Art styles' }))
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(6)
  })

  it('shows a helpful empty state and clears filters', async () => {
    const user = userEvent.setup()
    render(<GalleryView onMakeOwn={() => {}} />)
    await user.type(screen.getByLabelText('Search'), 'zzzz')
    expect(screen.getByText(/No character matches that/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(53)
  })
})

describe('GalleryView detail and use', () => {
  it('opens the detail panel with a live preview, then the export-style panel', async () => {
    const user = userEvent.setup()
    const onMakeOwn = vi.fn()
    render(<GalleryView onMakeOwn={onMakeOwn} />)
    await user.click(screen.getByRole('button', { name: 'Owl, animal' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Owl' })).toHaveFocus()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-src', '/mascots/owl-directions.webp')
    expect(screen.getByLabelText(/Preview size/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use this mascot' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Use Owl on your site' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'owl-directions.webp' })).toHaveAttribute('href', '/mascots/owl-directions.webp')
    expect(screen.getByRole('link', { name: 'owl-reactions.webp' })).toHaveAttribute('download', 'owl-reactions.webp')
    expect(screen.getByRole('button', { name: 'page-mascot.js' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mascot.tsx' })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('owl-directions.webp')
    expect(screen.getByText(/Gallery art by Kamran Ahmed/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Make one that looks like you' }))
    expect(onMakeOwn).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back to Owl' }))
    await user.click(screen.getByRole('button', { name: 'Back to gallery' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pick a ready-made mascot' })).toBeInTheDocument()
  })

  it('lets you switch between the fox art styles in the detail panel', async () => {
    const user = userEvent.setup()
    render(<GalleryView onMakeOwn={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Fox, animal' }))
    const style = screen.getByRole('group', { name: 'Art style' })
    expect(within(style).getAllByRole('radio')).toHaveLength(6)
    await user.click(within(style).getByRole('radio', { name: 'pixel' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Fox, pixel' })).toBeInTheDocument()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-src', '/mascots/fox-pixel-directions.webp')
  })

  it('offers the gallery-wide make-your-own jump from the detail panel', async () => {
    const user = userEvent.setup()
    const onMakeOwn = vi.fn()
    render(<GalleryView onMakeOwn={onMakeOwn} />)
    await user.click(screen.getByRole('button', { name: 'Bear, animal' }))
    await user.click(screen.getByRole('button', { name: 'Make one that looks like you' }))
    expect(onMakeOwn).toHaveBeenCalledTimes(1)
  })
})
