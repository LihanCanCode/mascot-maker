import { describe, expect, it, vi } from 'vitest'
import { STAR_KEY, STAR_URL, remember, shouldAsk, type StarStorage } from './starAsk'

/** A storage that behaves, backed by a plain map. */
function working(seed: Readonly<Record<string, string>> = {}): StarStorage & { readonly written: Map<string, string> } {
  const written = new Map(Object.entries(seed))
  return {
    written,
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => {
      written.set(key, value)
    },
  }
}

/** A storage that throws on every access, the way a locked-down browser does. */
function throwing(): StarStorage {
  return {
    getItem: () => {
      throw new Error('access denied')
    },
    setItem: () => {
      throw new Error('access denied')
    },
  }
}

describe('shouldAsk', () => {
  it('asks a visitor who has never been asked', () => {
    expect(shouldAsk(working())).toBe(true)
  })

  it('does not ask again once the ask has been shown', () => {
    expect(shouldAsk(working({ [STAR_KEY]: 'asked' }))).toBe(false)
  })

  it('does not ask again once it has been dismissed', () => {
    expect(shouldAsk(working({ [STAR_KEY]: 'dismissed' }))).toBe(false)
  })

  it('does not ask again once the link has been followed', () => {
    expect(shouldAsk(working({ [STAR_KEY]: 'starred' }))).toBe(false)
  })

  it('treats junk in the slot as a mark, because something put it there', () => {
    expect(shouldAsk(working({ [STAR_KEY]: '{"what":1}' }))).toBe(false)
  })

  it('still asks when the slot holds only whitespace', () => {
    expect(shouldAsk(working({ [STAR_KEY]: '   ' }))).toBe(true)
  })

  it('does not ask when reading throws, rather than throwing itself', () => {
    expect(() => shouldAsk(throwing())).not.toThrow()
    expect(shouldAsk(throwing())).toBe(false)
  })

  it('does not ask when there is no storage at all', () => {
    expect(shouldAsk(null)).toBe(false)
  })

  it('ignores a mark left under some other key', () => {
    expect(shouldAsk(working({ 'mascot-maker-theme': 'dark' }))).toBe(true)
  })
})

describe('remember', () => {
  it('writes the mark under the one key', () => {
    const store = working()
    remember(store, 'dismissed')
    expect(store.written.get(STAR_KEY)).toBe('dismissed')
    expect(shouldAsk(store)).toBe(false)
  })

  it('lets a later mark replace an earlier one', () => {
    const store = working()
    remember(store, 'asked')
    remember(store, 'starred')
    expect(store.written.get(STAR_KEY)).toBe('starred')
  })

  it('swallows a storage that refuses to write', () => {
    expect(() => remember(throwing(), 'starred')).not.toThrow()
  })

  it('does nothing, quietly, when there is no storage', () => {
    const setItem = vi.fn()
    expect(() => remember(null, 'starred')).not.toThrow()
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('STAR_URL', () => {
  it('points at this repository over https and nowhere else', () => {
    expect(STAR_URL).toBe('https://github.com/LihanCanCode/mascot-maker')
  })
})
