/**
 * Base64 over bytes, written out rather than borrowed, so the export file needs no
 * dependency and behaves the same in a browser, in jsdom and in Node.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const REVERSE: ReadonlyMap<string, number> = new Map(Array.from(ALPHABET, (ch, i) => [ch, i]))

const CHUNK = 3

export function bytesToBase64(bytes: Uint8Array): string {
  const out: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const left = bytes.length - i
    out.push(
      ALPHABET[a >> 2] ?? '',
      ALPHABET[((a & 3) << 4) | (b >> 4)] ?? '',
      left > 1 ? (ALPHABET[((b & 15) << 2) | (c >> 6)] ?? '') : '=',
      left > 2 ? (ALPHABET[c & 63] ?? '') : '=',
    )
  }
  return out.join('')
}

/** Null when `text` is not well-formed base64 (wrong characters, or a truncated final group). */
export function base64ToBytes(text: string): Uint8Array | null {
  if (text.length % 4 !== 0) return null
  const body = text.endsWith('==') ? text.slice(0, -2) : text.endsWith('=') ? text.slice(0, -1) : text
  if (body.includes('=')) return null
  const bytes = new Uint8Array(Math.floor((body.length * 6) / 8))
  let acc = 0
  let bits = 0
  let at = 0
  for (const ch of body) {
    const value = REVERSE.get(ch)
    if (value === undefined) return null
    acc = (acc << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[at++] = (acc >> bits) & 0xff
    }
  }
  return at === bytes.length ? bytes : null
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
}

export function base64ToBlob(text: string, mimeType: string): Blob | null {
  const bytes = base64ToBytes(text)
  return bytes === null ? null : new Blob([bytes.buffer as ArrayBuffer], { type: mimeType })
}
