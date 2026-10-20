import { looksLikeQuota, quotaError, unavailableError } from './errors'

export const DB_NAME = 'mascot-maker-gallery'
export const META_STORE = 'mascots'
export const SHEET_STORE = 'sheets'

/**
 * The database version equals the record schema version, so a future record change
 * arrives as an `upgradeneeded` with both numbers in hand and can migrate in place.
 */
export const DB_VERSION = 1

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'no reason given'
}

/** Create the stores this version needs. Older versions get them added, never dropped. */
function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' })
  if (!db.objectStoreNames.contains(SHEET_STORE)) db.createObjectStore(SHEET_STORE, { keyPath: 'id' })
}

export function openDatabase(factory: IDBFactory | undefined): Promise<IDBDatabase> {
  if (factory === undefined) return Promise.reject(unavailableError('it has no IndexedDB'))
  let request: IDBOpenDBRequest
  try {
    request = factory.open(DB_NAME, DB_VERSION)
  } catch (error: unknown) {
    return Promise.reject(unavailableError(describe(error)))
  }
  return new Promise((resolve, reject) => {
    request.onupgradeneeded = (): void => upgrade(request.result)
    request.onsuccess = (): void => resolve(request.result)
    request.onblocked = (): void => reject(unavailableError('another tab is holding an older version open'))
    request.onerror = (): void => reject(unavailableError(describe(request.error)))
  })
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result)
    request.onerror = (): void => reject(request.error ?? new Error('The browser could not read your gallery.'))
  })
}

/** Resolves when the transaction commits, so a write is only reported once it is durable. */
export function transactionDone(tx: IDBTransaction, usedBytes: () => number): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = (): void => resolve()
    tx.onabort = (): void => reject(toStoreError(tx.error, usedBytes))
    tx.onerror = (): void => reject(toStoreError(tx.error, usedBytes))
  })
}

export function toStoreError(error: unknown, usedBytes: () => number): Error {
  if (looksLikeQuota(error)) return quotaError(usedBytes())
  return error instanceof Error ? error : new Error('The browser could not write to your gallery.')
}
