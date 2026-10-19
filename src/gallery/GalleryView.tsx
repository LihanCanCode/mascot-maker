import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import type { UiOptions } from '../ui/state/appReducer'
import { filterMascots, FILTER_CHIPS, type TagFilter } from './filter'
import { galleryReducer, initialGallery } from './galleryState'
import { MascotCard } from './MascotCard'
import { MascotDetail } from './MascotDetail'
import { MascotUse } from './MascotUse'
import { ART_CREDIT, findMascot, MASCOTS } from './mascots'

type Preview = Pick<UiOptions, 'previewSize' | 'previewBg'>

interface Props {
  onMakeOwn: () => void
}

function Credit() {
  return (
    <p className="credit">
      {ART_CREDIT.text}{' '}
      <a href={ART_CREDIT.url} target="_blank" rel="noopener noreferrer">
        page-mascot on GitHub
      </a>
    </p>
  )
}

export function GalleryView({ onMakeOwn }: Props) {
  const [gallery, dispatch] = useReducer(galleryReducer, initialGallery)
  const [tag, setTag] = useState<TagFilter>('all')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Preview>({ previewSize: 160, previewBg: 'light' })
  const searchId = useId()
  const root = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const visible = useMemo(() => filterMascots(MASCOTS, { tag, query }), [tag, query])
  const slug = gallery.view === 'grid' ? null : gallery.slug
  const mascot = slug ? findMascot(slug) : undefined

  // Move focus to the new view's heading, like the main flow does.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    root.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [gallery.view])

  if (gallery.view === 'detail' && mascot) {
    return (
      <div ref={root}>
        <MascotDetail
          mascot={mascot}
          preview={preview}
          onPreview={(patch) => setPreview((p) => ({ ...p, ...patch }))}
          onOpen={(s) => dispatch({ type: 'open', slug: s })}
          onUse={() => dispatch({ type: 'use' })}
          onBack={() => dispatch({ type: 'back' })}
          onMakeOwn={onMakeOwn}
        />
        <Credit />
      </div>
    )
  }
  if (gallery.view === 'use' && mascot) {
    return (
      <div ref={root}>
        <MascotUse mascot={mascot} size={preview.previewSize} onBack={() => dispatch({ type: 'back' })} onMakeOwn={onMakeOwn} />
      </div>
    )
  }

  const clear = (): void => {
    setTag('all')
    setQuery('')
  }

  return (
    <div className="step gallery" ref={root}>
      <h2 tabIndex={-1}>Pick a ready-made mascot</h2>
      <p className="lede">Fifty-odd friendly characters you can use right now. Click one to boop it, then grab the files.</p>

      <div className="gallery-tools">
        <div className="field gallery-search">
          <label htmlFor={searchId}>Search</label>
          <input
            id={searchId}
            type="search"
            value={query}
            autoComplete="off"
            placeholder="Try fox, robot or pixel"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter by type" className="chips">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="chip"
              aria-pressed={tag === chip.id}
              onClick={() => setTag(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="muted gallery-count">
        {visible.length === 1 ? '1 character' : `${visible.length} characters`}
      </p>

      {visible.length === 0 ? (
        <div className="sticker-note">
          <p>No character matches that. Try a shorter word, or clear the filters.</p>
          <button type="button" className="btn btn-small" onClick={clear}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="ggrid">
          {visible.map((m) => (
            <li key={m.slug}>
              <MascotCard mascot={m} onOpen={(s) => dispatch({ type: 'open', slug: s })} />
            </li>
          ))}
        </ul>
      )}

      <Credit />
    </div>
  )
}
