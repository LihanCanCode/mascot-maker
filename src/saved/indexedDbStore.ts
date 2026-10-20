import { DB_VERSION, META_STORE, SHEET_STORE, openDatabase, requestToPromise, toStoreError, transactionDone } from './idb'
import { buildRecord, byNewest, displayName, mergeInto, notFound, type StoredRecord } from './record'
import { signatureWithName } from './signature'
import type { SavedMascot, SavedMascotWithSheets, SavedSheets, SavedStore, SaveInput, StorageUsage } from './types'

interface SheetRow {
  readonly id: string
  readonly directions: Blob
  readonly reactions: Blob
}

/** Records written by a newer version of the app are skipped rather than mangled. */
function readable(meta: SavedMascot): boolean {
  return typeof meta.id === 'string' && meta.schema <= DB_VERSION
}

function sumBytes(rows: readonly SavedMascot[]): number {
  return rows.reduce((sum, r) => sum + r.bytes, 0)
}

/** The real store: one IndexedDB database, metadata and sheets kept apart so the grid loads cheaply. */
export function indexedDbStore(factory: IDBFactory | undefined = globalThis.indexedDB): SavedStore {
  let opened: Promise<IDBDatabase> | null = null
  /** Last known total, used only to put a number in the "storage is full" message. */
  let knownBytes = 0
  const bytesNow = (): number => knownBytes

  const db = (): Promise<IDBDatabase> => (opened ??= openDatabase(factory))

  const allMeta = async (): Promise<readonly SavedMascot[]> => {
    const tx = (await db()).transaction([META_STORE], 'readonly')
    const rows = await requestToPromise<SavedMascot[]>(tx.objectStore(META_STORE).getAll())
    const usable = rows.filter(readable)
    knownBytes = sumBytes(usable)
    return usable
  }

  const getOne = async (id: string): Promise<SavedMascotWithSheets | null> => {
    const tx = (await db()).transaction([META_STORE, SHEET_STORE], 'readonly')
    // Both reads are issued before either is awaited: a transaction may commit between awaits.
    const metaRequest = requestToPromise<SavedMascot | undefined>(tx.objectStore(META_STORE).get(id))
    const rowRequest = requestToPromise<SheetRow | undefined>(tx.objectStore(SHEET_STORE).get(id))
    const [meta, row] = await Promise.all([metaRequest, rowRequest])
    if (meta === undefined || row === undefined || !readable(meta)) return null
    const sheets: SavedSheets = { directions: row.directions, reactions: row.reactions }
    return { ...meta, sheets }
  }

  const writeRecord = async (record: StoredRecord): Promise<void> => {
    const tx = (await db()).transaction([META_STORE, SHEET_STORE], 'readwrite')
    const done = transactionDone(tx, bytesNow)
    const row: SheetRow = { id: record.meta.id, ...record.sheets }
    try {
      tx.objectStore(META_STORE).put(record.meta)
      tx.objectStore(SHEET_STORE).put(row)
    } catch (error: unknown) {
      throw toStoreError(error, bytesNow)
    }
    await done
  }

  const inBoth = async (act: (meta: IDBObjectStore, sheets: IDBObjectStore) => void): Promise<void> => {
    const tx = (await db()).transaction([META_STORE, SHEET_STORE], 'readwrite')
    const done = transactionDone(tx, bytesNow)
    act(tx.objectStore(META_STORE), tx.objectStore(SHEET_STORE))
    await done
  }

  return {
    async list(): Promise<readonly SavedMascot[]> {
      return [...(await allMeta())].sort(byNewest)
    },
    get: getOne,
    async save(input: SaveInput): Promise<SavedMascot> {
      const stored = await allMeta()
      const draft = await buildRecord(input, Date.now())
      const existing = stored.find((m) => m.signature === draft.meta.signature) ?? null
      const record = existing === null ? draft : mergeInto(draft, existing)
      await writeRecord(record)
      return record.meta
    },
    async rename(id: string, name: string): Promise<void> {
      const current = await getOne(id)
      if (current === null) throw notFound(id)
      const next = displayName(name)
      const { sheets: _sheets, ...meta } = current
      const tx = (await db()).transaction([META_STORE], 'readwrite')
      const done = transactionDone(tx, bytesNow)
      tx.objectStore(META_STORE).put({ ...meta, name: next, signature: signatureWithName(meta.signature, next) })
      await done
    },
    async remove(id: string): Promise<void> {
      await inBoth((meta, sheets) => {
        meta.delete(id)
        sheets.delete(id)
      })
    },
    async clear(): Promise<void> {
      await inBoth((meta, sheets) => {
        meta.clear()
        sheets.clear()
      })
      knownBytes = 0
    },
    async usage(): Promise<StorageUsage> {
      const rows = await allMeta()
      return { bytes: sumBytes(rows), count: rows.length }
    },
  }
}
