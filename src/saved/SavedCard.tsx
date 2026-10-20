import { Mascot } from '../mascot/Mascot'
import { formatDate } from './format'
import type { SavedMascot } from './types'
import { useSavedPreview } from './useSavedRecord'

interface Props {
  mascot: SavedMascot
  size?: number
  onOpen: (id: string) => void
}

const PREVIEW_SIZE = 96

/** One card in "My gallery": a live mascot from the saved sheets, its name and its date. */
export function SavedCard({ mascot, size = PREVIEW_SIZE, onOpen }: Props) {
  const { directionsUrl, reactionsUrl, failed } = useSavedPreview(mascot.id)
  const ready = directionsUrl !== null && reactionsUrl !== null
  return (
    <div className="scard">
      <div className="scard-stage" style={{ minHeight: size }}>
        {ready ? (
          <Mascot directions={directionsUrl} reactions={reactionsUrl} size={size} label={mascot.name} />
        ) : failed !== null ? (
          <p className="muted scard-missing">{failed}</p>
        ) : (
          <div className="skeleton" style={{ width: size, height: size }}>
            <span className="spinner" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="scard-name">{mascot.name}</p>
      <p className="scard-date muted">Saved {formatDate(mascot.updated)}</p>
      <button type="button" className="btn btn-small" onClick={() => onOpen(mascot.id)}>
        Open {mascot.name}
      </button>
    </div>
  )
}
