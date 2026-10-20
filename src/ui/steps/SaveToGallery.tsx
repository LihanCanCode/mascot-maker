import { useState } from 'react'
import { useSavedStoreHandle } from '../../saved/context'
import { displayName } from '../../saved/record'
import { messageFor } from '../../saved/useSavedGallery'
import type { CharacterBrief } from '../../core/types'
import type { SheetMimeType } from '../../saved/types'

export interface SaveSheets {
  readonly directions: Blob
  readonly reactions: Blob
  readonly mimeType: SheetMimeType
}

interface Props {
  brief: CharacterBrief
  cellSize: number
  /** Null until both sheets have finished encoding. */
  sheets: SaveSheets | null
  onViewGallery: () => void
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly name: string; readonly warning: string | null }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * Save to my gallery, beside the downloads. Saving again after a change updates the same
 * record when the name and both sheets match, so pressing it twice never duplicates.
 */
export function SaveToGallery({ brief, cellSize, sheets, onViewGallery }: Props) {
  const handle = useSavedStoreHandle()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const name = displayName(brief.name)

  const save = async (): Promise<void> => {
    if (sheets === null) return
    setStatus({ kind: 'saving' })
    try {
      const { store, persistent, reason } = await handle
      await store.save({ name, brief, cellSize, mimeType: sheets.mimeType, directions: sheets.directions, reactions: sheets.reactions })
      setStatus({ kind: 'saved', name, warning: persistent ? null : reason })
    } catch (error: unknown) {
      setStatus({ kind: 'failed', message: messageFor(error) })
    }
  }

  return (
    <div className="save-mine">
      <button
        type="button"
        className="btn btn-primary"
        disabled={sheets === null || status.kind === 'saving'}
        onClick={() => void save()}
      >
        {status.kind === 'saving' ? 'Saving...' : 'Save to my gallery'}
      </button>
      <p className="muted">Kept in this browser only. Nothing is uploaded, and you can export it to a file later.</p>
      <p className="save-mine-status" role="status" aria-live="polite">
        {status.kind === 'saved' ? `${status.name} is in your gallery.` : status.kind === 'failed' ? status.message : ''}
      </p>
      {status.kind === 'saved' && status.warning !== null && (
        <p className="banner" data-tone="bad" role="alert">
          {status.warning}
        </p>
      )}
      {(status.kind === 'saved' || status.kind === 'failed') && (
        <button type="button" className="btn btn-small" onClick={onViewGallery}>
          View my gallery
        </button>
      )}
    </div>
  )
}
