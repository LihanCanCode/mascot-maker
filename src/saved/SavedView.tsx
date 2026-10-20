import { useEffect, useRef, useState } from 'react'
import type { UiOptions } from '../ui/state/appReducer'
import { SavedCard } from './SavedCard'
import { SavedDetail } from './SavedDetail'
import { SavedTools } from './SavedTools'
import { useSavedGallery } from './useSavedGallery'

type Preview = Pick<UiOptions, 'previewSize' | 'previewBg'>

interface Props {
  onMakeOwn: () => void
}

function EmptyState({ onMakeOwn }: Props) {
  return (
    <div className="sticker-note saved-empty">
      <p>
        Nothing saved yet. When you finish a mascot, press <strong>Save to my gallery</strong> on the last step and it
        will wait for you here, in this browser.
      </p>
      <button type="button" className="btn btn-primary" onClick={onMakeOwn}>
        Make a mascot
      </button>
    </div>
  )
}

/** The visitor's own gallery: the third mode, beside "Make my own" and the built-in gallery. */
export function SavedView({ onMakeOwn }: Props) {
  const gallery = useSavedGallery()
  const [openId, setOpenId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview>({ previewSize: 160, previewBg: 'light' })
  const root = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    root.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [openId])

  const open = gallery.items.find((m) => m.id === openId) ?? null
  // A mascot deleted from its own detail view has no detail left to show.
  useEffect(() => {
    if (openId !== null && gallery.status === 'ready' && open === null) setOpenId(null)
  }, [gallery.status, open, openId])

  if (open !== null) {
    return (
      <div ref={root}>
        <SavedDetail
          mascot={open}
          preview={preview}
          onPreview={(patch) => setPreview((p) => ({ ...p, ...patch }))}
          onBack={() => setOpenId(null)}
          onRename={(id, name) => void gallery.rename(id, name)}
          onDelete={(id, name) => void gallery.remove(id, name)}
        />
        <Notice gallery={gallery} />
      </div>
    )
  }

  return (
    <div className="step saved" ref={root}>
      <h2 tabIndex={-1}>My gallery</h2>
      <p className="lede">
        The mascots you saved, kept in this browser. Nothing here was ever uploaded, and nothing here costs anything.
      </p>
      {!gallery.persistent && gallery.reason !== null && (
        <p className="banner" data-tone="bad" role="alert">
          {gallery.reason}
        </p>
      )}
      <Notice gallery={gallery} />
      {gallery.status === 'loading' ? (
        <p role="status" className="muted">
          Opening your gallery.
        </p>
      ) : gallery.items.length === 0 ? (
        <EmptyState onMakeOwn={onMakeOwn} />
      ) : (
        <ul className="sgrid">
          {gallery.items.map((m) => (
            <li key={m.id}>
              <SavedCard mascot={m} onOpen={setOpenId} />
            </li>
          ))}
        </ul>
      )}
      <SavedTools
        usage={gallery.usage}
        onExport={gallery.exportAll}
        onImport={(text) => void gallery.importFrom(text)}
        onClearAll={() => void gallery.clearAll()}
      />
    </div>
  )
}

function Notice({ gallery }: { gallery: ReturnType<typeof useSavedGallery> }) {
  const { notice } = gallery
  return (
    <p className="banner saved-notice" data-tone={notice?.tone === 'bad' ? 'bad' : 'ok'} role="status" aria-live="polite">
      {notice?.text ?? ''}
    </p>
  )
}
