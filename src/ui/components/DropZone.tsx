import { useId, useState, type DragEvent } from 'react'
import type { SheetKind } from '../../core/types'
import type { FileSlot } from '../state/appReducer'

interface Props {
  sheet: SheetKind
  title: string
  hint: string
  slot: FileSlot
  onSelect: (file: File) => void
  onClear: () => void
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function DropZone({ sheet, title, hint, slot, onSelect, onClear }: Props) {
  const id = useId()
  const [isOver, setIsOver] = useState(false)
  const [measured, setMeasured] = useState<{ url: string; text: string } | null>(null)

  const dims = slot.status === 'ready' && measured?.url === slot.previewUrl ? measured.text : null
  const announcement =
    slot.status === 'ready' && dims
      ? `${sheet === 'directions' ? 'Directions' : 'Reactions'} image added: ${slot.file.name}, ${dims}, ${formatSize(slot.file.size)}`
      : ''

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setIsOver(false)
    const file = event.dataTransfer.files[0]
    if (file) onSelect(file)
  }

  return (
    <div className="dropzone-wrap">
      <h3 id={`${id}-title`}>{title}</h3>
      <label
        className="dropzone"
        data-over={isOver}
        data-status={slot.status}
        onDragOver={(e) => {
          e.preventDefault()
          setIsOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false)
        }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only-input"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onSelect(file)
            e.target.value = ''
          }}
        />
        {slot.status === 'ready' ? (
          <>
            <img
              src={slot.previewUrl}
              alt={`Preview of your ${sheet} image`}
              className="dropzone-thumb"
              onLoad={(e) =>
                setMeasured({ url: slot.previewUrl, text: `${e.currentTarget.naturalWidth} x ${e.currentTarget.naturalHeight} px` })
              }
            />
            <span className="dropzone-name">{slot.file.name}</span>
            <span className="muted">
              {dims ? `${dims}, ` : ''}
              {formatSize(slot.file.size)}. Choose another file to replace it.
            </span>
          </>
        ) : (
          <>
            <span className="dropzone-icon" aria-hidden="true" />
            <span className="dropzone-cta">Choose an image or drop it here</span>
          </>
        )}
      </label>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <p id={`${id}-hint`} className="muted">
        {hint}
      </p>
      {slot.status === 'rejected' && (
        <p role="alert" className="field-error">
          {slot.message}
        </p>
      )}
      {slot.status !== 'empty' && (
        <button type="button" className="btn btn-small" onClick={onClear}>
          Remove {sheet} image
        </button>
      )}
    </div>
  )
}
