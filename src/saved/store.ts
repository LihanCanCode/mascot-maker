import { isSavedStoreError } from './errors'
import { indexedDbStore } from './indexedDbStore'
import { inMemoryStore } from './inMemoryStore'
import type { SavedStoreHandle } from './types'

const FALLBACK_REASON =
  'This browser would not open its own storage, so nothing you save will last beyond this visit. ' +
  'Private windows and strict privacy settings do this. Download the files, or export your gallery, to keep anything.'

function reasonFor(error: unknown): string {
  if (isSavedStoreError(error)) return `${error.message} Nothing you save will last beyond this visit.`
  return FALLBACK_REASON
}

/**
 * Open the real store, and fall back to the in-memory one when the browser refuses.
 * The handle says which happened, because an interface that silently forgets is worse
 * than one that admits it cannot remember.
 */
export async function createSavedStore(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<SavedStoreHandle> {
  const store = indexedDbStore(factory)
  try {
    await store.usage()
    return { store, persistent: true, reason: null }
  } catch (error: unknown) {
    return { store: inMemoryStore(), persistent: false, reason: reasonFor(error) }
  }
}

let shared: Promise<SavedStoreHandle> | null = null

/** One store per page, opened the first time something asks for it. */
export function sharedSavedStore(): Promise<SavedStoreHandle> {
  return (shared ??= createSavedStore())
}
