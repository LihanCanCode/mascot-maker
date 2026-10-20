import { bytesToBase64 } from './base64'
import type { SheetMimeType } from './types'

/**
 * FNV-1a, 32 bits, over every byte of a sheet. Not a security hash -- it only has to
 * tell "this is the same picture I already saved" from "this is a different one", and
 * it has to give the same answer in a browser and in a test, without a dependency.
 */
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export function hashBytes(bytes: Uint8Array): string {
  let hash = FNV_OFFSET
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0
  }
  return `${hash.toString(16).padStart(8, '0')}-${bytes.length.toString(16)}`
}

export async function hashBlob(blob: Blob): Promise<string> {
  return hashBytes(new Uint8Array(await blob.arrayBuffer()))
}

/** Trimmed, case-folded name: two saves that differ only in capitalisation are the same mascot. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export interface SignatureParts {
  readonly name: string
  readonly mimeType: SheetMimeType
  readonly directions: string
  readonly reactions: string
}

/**
 * The save-or-update key: the mascot's name together with the content of both sheets.
 * Same name and same pixels means the visitor pressed Save twice on one mascot, so the
 * existing record is updated. A different name, or sheets rebuilt at another size, is a
 * different mascot and gets its own record -- nothing the visitor saved is ever replaced
 * by something that merely shares its name.
 */
export function signatureOf(parts: SignatureParts): string {
  return [normalizeName(parts.name).toLowerCase(), parts.mimeType, parts.directions, parts.reactions].join('|')
}

/** Short, stable id. Random enough for one browser's own gallery. */
export function newId(): string {
  const bytes = new Uint8Array(12)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Re-key a signature after a rename, without re-reading the sheets. */
export function signatureWithName(signature: string, name: string): string {
  const rest = signature.split('|').slice(1)
  return [normalizeName(name).toLowerCase(), ...rest].join('|')
}
