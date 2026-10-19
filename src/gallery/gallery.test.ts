import { describe, expect, it } from 'vitest'
import { filterMascots, FILTER_CHIPS } from './filter'
import { galleryReducer, initialGallery, type GalleryState } from './galleryState'
import { MASCOTS } from './mascots'

const slugs = (list: readonly { slug: string }[]): string[] => list.map((m) => m.slug)

describe('filterMascots', () => {
  it('shows base characters only by default, hiding style variants', () => {
    const all = filterMascots(MASCOTS, { tag: 'all', query: '' })
    expect(all).toHaveLength(53)
    expect(slugs(all)).toContain('fox')
    expect(slugs(all)).not.toContain('fox-ink')
  })

  it('filters by tag', () => {
    const robots = filterMascots(MASCOTS, { tag: 'robot', query: '' })
    expect(robots.length).toBeGreaterThan(3)
    expect(robots.every((m) => m.tag === 'robot')).toBe(true)
    const animals = filterMascots(MASCOTS, { tag: 'animal', query: '' })
    expect(slugs(animals)).not.toContain('fox-pixel')
  })

  it('has a styles chip showing the fox and all its variants', () => {
    const styles = filterMascots(MASCOTS, { tag: 'styles', query: '' })
    expect(slugs(styles).sort()).toEqual(['fox', 'fox-ink', 'fox-paper', 'fox-pixel', 'fox-riso', 'fox-sketch'])
  })

  it('searches names, slugs and tags case-insensitively, including variants', () => {
    expect(slugs(filterMascots(MASCOTS, { tag: 'all', query: '  PANDA ' })).sort()).toEqual(['panda', 'redpanda'])
    expect(slugs(filterMascots(MASCOTS, { tag: 'all', query: 'fox ink' }))).toEqual(['fox-ink'])
    expect(slugs(filterMascots(MASCOTS, { tag: 'all', query: 'robot' })).length).toBeGreaterThan(3)
    expect(slugs(filterMascots(MASCOTS, { tag: 'all', query: 'pixel' }))).toContain('fox-pixel')
  })

  it('combines search with a tag chip', () => {
    expect(slugs(filterMascots(MASCOTS, { tag: 'robot', query: 'panda' }))).toEqual([])
    expect(slugs(filterMascots(MASCOTS, { tag: 'animal', query: 'panda' })).sort()).toEqual(['panda', 'redpanda'])
  })

  it('returns an empty list for nonsense and never mutates the input', () => {
    const copy = [...MASCOTS]
    expect(filterMascots(MASCOTS, { tag: 'all', query: 'zzzz' })).toEqual([])
    expect(MASCOTS).toEqual(copy)
  })

  it('offers an All chip first and one chip per tag plus styles', () => {
    expect(FILTER_CHIPS[0]).toMatchObject({ id: 'all', label: 'All' })
    expect(FILTER_CHIPS.map((c) => c.id)).toEqual(['all', 'animal', 'person', 'robot', 'object', 'styles'])
  })
})

describe('galleryReducer', () => {
  const detail = (slug: string): GalleryState => ({ view: 'detail', slug })

  it('opens a character from the grid, and switches variants from the detail', () => {
    expect(galleryReducer(initialGallery, { type: 'open', slug: 'fox' })).toEqual(detail('fox'))
    expect(galleryReducer(detail('fox'), { type: 'open', slug: 'fox-ink' })).toEqual(detail('fox-ink'))
  })

  it('ignores unknown slugs', () => {
    expect(galleryReducer(initialGallery, { type: 'open', slug: 'dragon' })).toBe(initialGallery)
  })

  it('goes detail -> use -> detail -> grid', () => {
    const used = galleryReducer(detail('cat'), { type: 'use' })
    expect(used).toEqual({ view: 'use', slug: 'cat' })
    expect(galleryReducer(used, { type: 'back' })).toEqual(detail('cat'))
    expect(galleryReducer(detail('cat'), { type: 'back' })).toEqual(initialGallery)
  })

  it('refuses invalid transitions with the same reference', () => {
    expect(galleryReducer(initialGallery, { type: 'use' })).toBe(initialGallery)
    expect(galleryReducer(initialGallery, { type: 'back' })).toBe(initialGallery)
    const used: GalleryState = { view: 'use', slug: 'cat' }
    expect(galleryReducer(used, { type: 'use' })).toBe(used)
    expect(galleryReducer(used, { type: 'open', slug: 'dog' })).toBe(used)
  })

  it('resets to the grid', () => {
    expect(galleryReducer({ view: 'use', slug: 'cat' }, { type: 'close' })).toBe(initialGallery)
    expect(galleryReducer(initialGallery, { type: 'close' })).toBe(initialGallery)
  })
})
