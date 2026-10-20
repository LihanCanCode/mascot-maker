import { quotaError } from './errors'
import { buildRecord, byNewest, displayName, mergeInto, notFound, type StoredRecord } from './record'
import { signatureWithName } from './signature'
import type { SavedMascot, SavedMascotWithSheets, SavedStore, SaveInput, StorageUsage } from './types'

export interface InMemoryOptions {
  /** Pretend the browser is full once the gallery would pass this many bytes. */
  readonly quotaBytes?: number
  readonly now?: () => number
}

function renamed(record: StoredRecord, name: string): StoredRecord {
  const next = displayName(name)
  return { ...record, meta: { ...record.meta, name: next, signature: signatureWithName(record.meta.signature, next) } }
}

/**
 * The reference implementation. The unit tests run against this, and it is also what
 * stands in when IndexedDB cannot be opened -- browsing works for the session, and the
 * interface says plainly that nothing will survive a reload.
 */
export function inMemoryStore(options: InMemoryOptions = {}): SavedStore {
  const clock = options.now ?? ((): number => Date.now())
  let records: readonly StoredRecord[] = []

  const total = (skipId: string | null): number =>
    records.reduce((sum, r) => (r.meta.id === skipId ? sum : sum + r.meta.bytes), 0)

  const guardQuota = (record: StoredRecord, replacing: string | null): void => {
    const { quotaBytes } = options
    if (quotaBytes !== undefined && total(replacing) + record.meta.bytes > quotaBytes) throw quotaError(total(null))
  }

  return {
    async list(): Promise<readonly SavedMascot[]> {
      return records.map((r) => r.meta).sort(byNewest)
    },
    async get(id: string): Promise<SavedMascotWithSheets | null> {
      const found = records.find((r) => r.meta.id === id)
      return found === undefined ? null : { ...found.meta, sheets: found.sheets }
    },
    async save(input: SaveInput): Promise<SavedMascot> {
      const draft = await buildRecord(input, clock())
      const existing = records.find((r) => r.meta.signature === draft.meta.signature)?.meta ?? null
      const record = existing === null ? draft : mergeInto(draft, existing)
      guardQuota(record, existing?.id ?? null)
      records = [...records.filter((r) => r.meta.id !== record.meta.id), record]
      return record.meta
    },
    async rename(id: string, name: string): Promise<void> {
      if (!records.some((r) => r.meta.id === id)) throw notFound(id)
      records = records.map((r) => (r.meta.id === id ? renamed(r, name) : r))
    },
    async remove(id: string): Promise<void> {
      records = records.filter((r) => r.meta.id !== id)
    },
    async clear(): Promise<void> {
      records = []
    },
    async usage(): Promise<StorageUsage> {
      return { bytes: total(null), count: records.length }
    },
  }
}
