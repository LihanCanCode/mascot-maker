/**
 * The way out. A saved gallery lives in one browser, and browsers get wiped, so the
 * whole thing can be written to a single file and read back -- plain JSON with the
 * sheets as base64, which needs no dependency and can be inspected by hand.
 */
import { STYLE_PRESETS, type CharacterBrief } from '../core/types'
import { base64ToBlob, blobToBase64 } from './base64'
import { SavedStoreError } from './errors'
import { displayName } from './record'
import type { SavedStore, SaveInput, SheetMimeType } from './types'

export const ENVELOPE_FORMAT = 'mascot-maker.gallery'
export const ENVELOPE_VERSION = 1
export const EXPORT_FILE_NAME = 'my-mascots.mascotgallery.json'

const MIME_TYPES: readonly string[] = ['image/webp', 'image/png']

interface TransferMascot {
  readonly name: string
  readonly created: number
  readonly updated: number
  readonly cellSize: number
  readonly mimeType: SheetMimeType
  readonly brief: CharacterBrief
  readonly directions: string
  readonly reactions: string
}

export interface GalleryFile {
  readonly format: typeof ENVELOPE_FORMAT
  readonly version: number
  readonly exported: number
  readonly mascots: readonly TransferMascot[]
}

export async function exportGallery(store: SavedStore, now: number = Date.now()): Promise<string> {
  const metas = await store.list()
  const mascots: TransferMascot[] = []
  for (const meta of metas) {
    const full = await store.get(meta.id)
    if (full === null) continue
    mascots.push({
      name: full.name,
      created: full.created,
      updated: full.updated,
      cellSize: full.cellSize,
      mimeType: full.mimeType,
      brief: full.brief,
      directions: await blobToBase64(full.sheets.directions),
      reactions: await blobToBase64(full.sheets.reactions),
    })
  }
  const file: GalleryFile = { format: ENVELOPE_FORMAT, version: ENVELOPE_VERSION, exported: now, mascots }
  return `${JSON.stringify(file, null, 2)}\n`
}

type Row = Record<string, unknown>

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function briefFrom(value: unknown): CharacterBrief | null {
  if (!isRow(value)) return null
  const { name, describe, style, usePhoto, key } = value
  if (typeof name !== 'string' || typeof describe !== 'string' || typeof usePhoto !== 'boolean') return null
  if (typeof style !== 'string' || !(STYLE_PRESETS as readonly string[]).includes(style)) return null
  if (key !== null && typeof key !== 'string') return null
  return { name, describe, style: style as CharacterBrief['style'], usePhoto, key: key as CharacterBrief['key'] }
}

function inputFrom(value: unknown): SaveInput | null {
  if (!isRow(value)) return null
  const { name, cellSize, mimeType, directions, reactions, created, updated } = value
  if (typeof name !== 'string' || typeof cellSize !== 'number' || !Number.isFinite(cellSize)) return null
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return null
  if (typeof mimeType !== 'string' || !MIME_TYPES.includes(mimeType)) return null
  if (typeof directions !== 'string' || typeof reactions !== 'string') return null
  const brief = briefFrom(value.brief)
  if (brief === null) return null
  const mime = mimeType as SheetMimeType
  const d = base64ToBlob(directions, mime)
  const r = base64ToBlob(reactions, mime)
  if (d === null || r === null || d.size === 0 || r.size === 0) return null
  return {
    name: displayName(name),
    brief,
    cellSize: Math.round(cellSize),
    mimeType: mime,
    directions: d,
    reactions: r,
    created: Number(created),
    updated: Number(updated),
  }
}

export type ParseResult =
  | { readonly ok: true; readonly mascots: readonly SaveInput[] }
  | { readonly ok: false; readonly message: string }

const NOT_OURS = 'That file is not a Mascot Maker gallery export. Pick the .json file you downloaded from here.'

/** Never throws: every bad file comes back as a message the interface can show. */
export function parseGalleryFile(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, message: 'That file is not readable JSON, so it may have been cut short or edited.' }
  }
  if (!isRow(parsed) || parsed.format !== ENVELOPE_FORMAT) return { ok: false, message: NOT_OURS }
  if (parsed.version !== ENVELOPE_VERSION) {
    return {
      ok: false,
      message: `That file was written by another version of Mascot Maker (version ${String(parsed.version)}, this one reads ${ENVELOPE_VERSION}).`,
    }
  }
  if (!Array.isArray(parsed.mascots)) return { ok: false, message: NOT_OURS }
  const mascots = parsed.mascots.map(inputFrom)
  const broken = mascots.findIndex((m) => m === null)
  if (broken !== -1) {
    return { ok: false, message: `Mascot ${broken + 1} in that file is incomplete or damaged, so nothing was imported.` }
  }
  return { ok: true, mascots: mascots.filter((m): m is SaveInput => m !== null) }
}

export interface ImportCount {
  readonly added: number
  readonly updated: number
}

/**
 * All or nothing on validation: a malformed file imports no mascots at all, so a bad
 * file can never half-fill someone's gallery. Each mascot then goes through `save`, so
 * importing a file twice updates instead of duplicating.
 */
export async function importGallery(store: SavedStore, text: string): Promise<ImportCount> {
  const parsed = parseGalleryFile(text)
  if (!parsed.ok) throw new SavedStoreError('invalid', parsed.message)
  const before = new Set((await store.list()).map((m) => m.id))
  let added = 0
  let updated = 0
  for (const input of parsed.mascots) {
    const saved = await store.save(input)
    if (before.has(saved.id)) updated += 1
    else added += 1
  }
  return { added, updated }
}
