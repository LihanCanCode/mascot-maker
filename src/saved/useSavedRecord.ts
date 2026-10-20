import { useEffect, useMemo, useState } from 'react'
import { useObjectUrls } from '../ui/hooks/useObjectUrls'
import { useSavedStoreHandle } from './context'
import { messageFor } from './useSavedGallery'
import type { SavedSheets } from './types'

export interface SavedPreview {
  readonly sheets: SavedSheets | null
  readonly directionsUrl: string | null
  readonly reactionsUrl: string | null
  readonly failed: string | null
}

/**
 * Load one saved mascot's sheets and hand back object URLs for them. `useObjectUrls`
 * revokes the previous pair whenever the blobs change, and both on unmount.
 */
export function useSavedPreview(id: string | null): SavedPreview {
  const handle = useSavedStoreHandle()
  const [sheets, setSheets] = useState<SavedSheets | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setFailed(null)
    if (id === null) return undefined
    void (async () => {
      try {
        const { store } = await handle
        const record = await store.get(id)
        if (cancelled) return
        if (record === null) setFailed('That mascot is no longer in your gallery.')
        else setSheets(record.sheets)
      } catch (error: unknown) {
        if (!cancelled) setFailed(messageFor(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [handle, id])

  const blobs = useMemo(() => [sheets?.directions ?? null, sheets?.reactions ?? null], [sheets])
  const [directionsUrl, reactionsUrl] = useObjectUrls(blobs)
  return { sheets, directionsUrl: directionsUrl ?? null, reactionsUrl: reactionsUrl ?? null, failed }
}
