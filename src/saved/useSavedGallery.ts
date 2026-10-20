import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSavedStoreHandle } from './context'
import { isSavedStoreError } from './errors'
import { exportGallery, importGallery } from './transfer'
import type { SavedMascot, SavedStore, StorageUsage } from './types'

export interface Notice {
  readonly tone: 'ok' | 'bad'
  readonly text: string
}

export interface SavedGallery {
  readonly status: 'loading' | 'ready'
  readonly items: readonly SavedMascot[]
  readonly usage: StorageUsage
  /** False when nothing saved here will outlive the page. */
  readonly persistent: boolean
  readonly reason: string | null
  readonly notice: Notice | null
  readonly refresh: () => void
  readonly rename: (id: string, name: string) => Promise<void>
  readonly remove: (id: string, name: string) => Promise<void>
  readonly clearAll: () => Promise<void>
  readonly exportAll: () => Promise<string | null>
  readonly importFrom: (text: string) => Promise<void>
}

const EMPTY_USAGE: StorageUsage = { bytes: 0, count: 0 }

export function messageFor(error: unknown): string {
  if (isSavedStoreError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong while reading your gallery.'
}

interface Loaded {
  readonly status: 'loading' | 'ready'
  readonly items: readonly SavedMascot[]
  readonly usage: StorageUsage
  readonly persistent: boolean
  readonly reason: string | null
}

const INITIAL: Loaded = { status: 'loading', items: [], usage: EMPTY_USAGE, persistent: true, reason: null }

/** The saved gallery's data and the actions that change it. Every failure becomes a notice. */
export function useSavedGallery(): SavedGallery {
  const handle = useSavedStoreHandle()
  const [loaded, setLoaded] = useState<Loaded>(INITIAL)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tick, setTick] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { store, persistent, reason } = await handle
        const [items, usage] = await Promise.all([store.list(), store.usage()])
        if (!cancelled) setLoaded({ status: 'ready', items, usage, persistent, reason })
      } catch (error: unknown) {
        if (!cancelled) {
          setLoaded({ ...INITIAL, status: 'ready', persistent: false, reason: messageFor(error) })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [handle, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  const run = useCallback(
    async (act: (store: SavedStore) => Promise<string | null>): Promise<void> => {
      try {
        const { store } = await handle
        const text = await act(store)
        if (!alive.current) return
        if (text !== null) setNotice({ tone: 'ok', text })
        refresh()
      } catch (error: unknown) {
        if (alive.current) setNotice({ tone: 'bad', text: messageFor(error) })
      }
    },
    [handle, refresh],
  )

  const actions = useMemo(
    () => ({
      rename: (id: string, name: string): Promise<void> =>
        run(async (store) => {
          await store.rename(id, name)
          return `Renamed to ${name.trim()}.`
        }),
      remove: (id: string, name: string): Promise<void> =>
        run(async (store) => {
          await store.remove(id)
          return `${name} is no longer in your gallery.`
        }),
      clearAll: (): Promise<void> =>
        run(async (store) => {
          await store.clear()
          return 'Your gallery is empty again.'
        }),
      importFrom: (text: string): Promise<void> =>
        run(async (store) => {
          const { added, updated } = await importGallery(store, text)
          return `Imported ${added} new and updated ${updated} already here.`
        }),
    }),
    [run],
  )

  const exportAll = useCallback(async (): Promise<string | null> => {
    try {
      const { store } = await handle
      return await exportGallery(store)
    } catch (error: unknown) {
      if (alive.current) setNotice({ tone: 'bad', text: messageFor(error) })
      return null
    }
  }, [handle])

  return { ...loaded, notice, refresh, exportAll, ...actions }
}
