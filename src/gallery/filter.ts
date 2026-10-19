import { MASCOT_TAGS, TAG_LABELS, type MascotEntry, type MascotTag } from './mascots'

export type TagFilter = 'all' | 'styles' | MascotTag

export interface FilterChip {
  readonly id: TagFilter
  readonly label: string
}

export const FILTER_CHIPS: readonly FilterChip[] = [
  { id: 'all', label: 'All' },
  ...MASCOT_TAGS.map((tag) => ({ id: tag, label: TAG_LABELS[tag] })),
  { id: 'styles', label: 'Art styles' },
]

export interface GalleryFilter {
  readonly tag: TagFilter
  readonly query: string
}

function haystack(m: MascotEntry): string {
  return [m.slug, m.name, m.tag, TAG_LABELS[m.tag], m.style ?? '', m.variantOf ? 'style variant' : '']
    .join(' ')
    .toLowerCase()
}

function matchesTag(m: MascotEntry, tag: TagFilter, all: readonly MascotEntry[]): boolean {
  if (tag === 'all') return true
  if (tag === 'styles') return m.variantOf !== undefined || all.some((o) => o.variantOf === m.slug)
  return m.tag === tag
}

/**
 * Chips narrow by tag. With no search, style variants stay tucked behind their base character
 * (except under the "Art styles" chip). Searching looks at every entry, variants included.
 */
export function filterMascots(all: readonly MascotEntry[], filter: GalleryFilter): readonly MascotEntry[] {
  const tokens = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  const searching = tokens.length > 0
  return all.filter((m) => {
    if (!matchesTag(m, filter.tag, all)) return false
    if (!searching) return filter.tag === 'styles' || m.variantOf === undefined
    const text = haystack(m)
    return tokens.every((t) => text.includes(t))
  })
}
