// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarPrompt } from './StarPrompt'
import { StarLink } from './StarLink'
import { STAR_KEY, STAR_MARK, STAR_URL, type StarStorage } from './starAsk'

afterEach(() => {
  cleanup()
})

function store(seed: Readonly<Record<string, string>> = {}): StarStorage & { read: () => string | null } {
  const held = new Map(Object.entries(seed))
  return {
    read: () => held.get(STAR_KEY) ?? null,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value)
    },
  }
}

describe('StarLink', () => {
  it('is a link with a name that says what it does and where it goes', () => {
    render(<StarLink />)
    const link = screen.getByRole('link', { name: 'Star on GitHub' })
    expect(link.getAttribute('href')).toBe(STAR_URL)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('draws its star inline, so nothing is fetched for it', () => {
    const { container } = render(<StarLink />)
    const svg = container.querySelector('svg.star-glyph')
    expect(svg).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })
})

describe('StarPrompt', () => {
  it('says nothing before the export is ready', () => {
    render(<StarPrompt ready={false} storage={store()} />)
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
  })

  it('appears once the export is ready, with a link and a dismissal', () => {
    render(<StarPrompt ready storage={store()} />)
    const link = screen.getByRole('link', { name: 'Star Mascot Maker on GitHub' })
    expect(link.getAttribute('href')).toBe(STAR_URL)
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('button', { name: 'No thanks, do not ask again' })).toBeTruthy()
  })

  it('marks the visitor as asked the moment it is shown, so a second mascot is not a second ask', () => {
    const storage = store()
    render(<StarPrompt ready storage={storage} />)
    expect(storage.read()).toBe(STAR_MARK)

    cleanup()
    render(<StarPrompt ready storage={storage} />)
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
  })

  it('stays away for a visitor who has already answered', () => {
    render(<StarPrompt ready storage={store({ [STAR_KEY]: 'dismissed' })} />)
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
  })

  it('hides and remembers when dismissed', async () => {
    const storage = store()
    render(<StarPrompt ready storage={storage} />)
    await userEvent.click(screen.getByRole('button', { name: 'No thanks, do not ask again' }))
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
    expect(storage.read()).toBe(STAR_MARK)
  })

  it('treats following the link as an answer and remembers that too', async () => {
    const storage = store()
    render(<StarPrompt ready storage={storage} />)
    await userEvent.click(screen.getByRole('link', { name: 'Star Mascot Maker on GitHub' }))
    expect(storage.read()).toBe(STAR_MARK)
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
  })

  it('does not ask at all when storage is unavailable', () => {
    render(<StarPrompt ready storage={null} />)
    expect(screen.queryByRole('link', { name: /Star Mascot Maker/ })).toBeNull()
  })

  it('reads real localStorage when no storage is injected', () => {
    localStorage.clear()
    render(<StarPrompt ready />)
    expect(screen.getByRole('link', { name: 'Star Mascot Maker on GitHub' })).toBeTruthy()
    expect(localStorage.getItem(STAR_KEY)).toBe(STAR_MARK)
    localStorage.clear()
  })
})
