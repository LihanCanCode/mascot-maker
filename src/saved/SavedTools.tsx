import { useId, useRef, useState } from 'react'
import { textBlob, triggerDownload } from '../adapters/download'
import { formatUsage } from './format'
import { EXPORT_FILE_NAME } from './transfer'
import type { StorageUsage } from './types'

interface Props {
  usage: StorageUsage
  onExport: () => Promise<string | null>
  onImport: (text: string) => void
  onClearAll: () => void
}

/**
 * The honest part. A gallery held in one browser is a trap unless you can get it out
 * again, so this is where the caveat is stated, the space is shown, and the whole thing
 * can be written to a file, read back, or thrown away.
 */
export function SavedTools({ usage, onExport, onImport, onClearAll }: Props) {
  const fileId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setBusy(true)
    const text = await onExport()
    setBusy(false)
    if (text !== null) triggerDownload(textBlob(text, 'application/json'), EXPORT_FILE_NAME)
  }

  const read = async (file: File | undefined): Promise<void> => {
    if (fileRef.current !== null) fileRef.current.value = ''
    if (file === undefined) return
    onImport(await file.text())
  }

  return (
    <section aria-labelledby="saved-keep-heading" className="sticker saved-tools">
      <h3 id="saved-keep-heading">Keeping these safe</h3>
      <p>
        These mascots are saved in this browser on this device only. Nothing is uploaded anywhere. If you clear your
        site data, use a different browser, or open a private window, they will not be here. They are not synced.
      </p>
      <p className="muted" role="status">
        {formatUsage(usage.bytes, usage.count)}
      </p>
      <div className="saved-tool-row">
        <button type="button" className="btn" disabled={busy || usage.count === 0} onClick={() => void save()}>
          Export my gallery to a file
        </button>
        <div className="field">
          <label htmlFor={fileId}>Import a gallery file</label>
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void read(event.target.files?.[0])}
          />
        </div>
      </div>
      {confirming ? (
        <div className="confirm" role="group" aria-label="Delete everything">
          <p>Delete all {usage.count} saved {usage.count === 1 ? 'mascot' : 'mascots'}? This cannot be undone.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setConfirming(false)
              onClearAll()
            }}
          >
            Yes, delete everything
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Keep them
          </button>
        </div>
      ) : (
        <button type="button" className="btn" disabled={usage.count === 0} onClick={() => setConfirming(true)}>
          Delete everything
        </button>
      )}
    </section>
  )
}
