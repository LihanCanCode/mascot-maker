import { SavedStoreError } from './errors'
import { hashBlob, newId, normalizeName, signatureOf } from './signature'
import { SCHEMA_VERSION, type SavedMascot, type SavedSheets, type SaveInput } from './types'

export const MAX_NAME_LENGTH = 60
export const FALLBACK_NAME = 'My mascot'

/** Never store an empty name: the grid and the file names both need something to show. */
export function displayName(name: string): string {
  const trimmed = normalizeName(name)
  return trimmed === '' ? FALLBACK_NAME : trimmed.slice(0, MAX_NAME_LENGTH)
}

export interface StoredRecord {
  readonly meta: SavedMascot
  readonly sheets: SavedSheets
}

/** Newest first; ties broken by id so the order never flickers. */
export function byNewest(a: SavedMascot, b: SavedMascot): number {
  return b.updated - a.updated || a.id.localeCompare(b.id)
}

/** Turn a save request into a fresh record: a new id, and  for any date the input omits. */
export async function buildRecord(input: SaveInput, now: number): Promise<StoredRecord> {
  const name = displayName(input.name)
  const [directions, reactions] = await Promise.all([hashBlob(input.directions), hashBlob(input.reactions)])
  const meta: SavedMascot = {
    id: newId(),
    name,
    created: input.created ?? now,
    updated: input.updated ?? now,
    cellSize: input.cellSize,
    mimeType: input.mimeType,
    bytes: input.directions.size + input.reactions.size,
    brief: input.brief,
    signature: signatureOf({ name, mimeType: input.mimeType, directions, reactions }),
    schema: SCHEMA_VERSION,
  }
  return { meta, sheets: { directions: input.directions, reactions: input.reactions } }
}

/**
 * Fold a fresh record onto the stored one it matches: the id and the creation time stay,
 * everything else comes from this save, and `updated` moves forward.
 */
export function mergeInto(draft: StoredRecord, existing: SavedMascot): StoredRecord {
  return { ...draft, meta: { ...draft.meta, id: existing.id, created: existing.created } }
}

export function notFound(id: string): SavedStoreError {
  return new SavedStoreError('not-found', `That mascot is no longer in your gallery (${id}).`)
}
