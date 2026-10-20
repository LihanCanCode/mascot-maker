/**
 * "My gallery" -- mascots the visitor saved, in their own browser.
 *
 * Nothing here talks to a network. The whole feature is one IndexedDB database on the
 * visitor's device, with an in-memory stand-in for tests and for browsers that refuse
 * to open a database at all.
 */
import type { CharacterBrief } from '../core/types'

/** Bumped when the record shape changes, so a future version can migrate instead of losing work. */
export const SCHEMA_VERSION = 1

export type SheetMimeType = 'image/webp' | 'image/png'

/** A saved mascot's metadata: everything the grid needs, and none of the pixels. */
export interface SavedMascot {
  readonly id: string
  readonly name: string
  /** Epoch milliseconds. */
  readonly created: number
  readonly updated: number
  readonly cellSize: number
  readonly mimeType: SheetMimeType
  /** Both sheets together, in bytes. */
  readonly bytes: number
  /** The brief that produced it, so it can be re-described later. */
  readonly brief: CharacterBrief
  /** Name plus sheet content, used to decide save-or-update. See `signatureOf`. */
  readonly signature: string
  readonly schema: number
}

export interface SavedSheets {
  readonly directions: Blob
  readonly reactions: Blob
}

export type SavedMascotWithSheets = SavedMascot & { readonly sheets: SavedSheets }

export interface SaveInput {
  readonly name: string
  readonly brief: CharacterBrief
  readonly cellSize: number
  readonly mimeType: SheetMimeType
  readonly directions: Blob
  readonly reactions: Blob
  /** Set only by an import, so a round trip through a file does not reset the dates. */
  readonly created?: number
  readonly updated?: number
}

export interface StorageUsage {
  readonly bytes: number
  readonly count: number
}

export interface SavedStore {
  /** Newest first, without the blobs. */
  list(): Promise<readonly SavedMascot[]>
  get(id: string): Promise<SavedMascotWithSheets | null>
  /** Creates a new record, or updates the one with the same name and the same sheets. */
  save(input: SaveInput): Promise<SavedMascot>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
  usage(): Promise<StorageUsage>
}

/** A store plus whether anything it holds will survive a reload. */
export interface SavedStoreHandle {
  readonly store: SavedStore
  /** False when IndexedDB could not be opened and the in-memory stand-in is standing in. */
  readonly persistent: boolean
  /** Set when `persistent` is false: what went wrong, in plain words. */
  readonly reason: string | null
}
