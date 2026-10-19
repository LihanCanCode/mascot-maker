import { MAX_UPLOAD_BYTES, MAX_UPLOAD_SIDE, MIN_UPLOAD_SIDE } from '../core/types'

type SniffedType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic'

export type FileCheck =
  | { readonly ok: true; readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }
  | {
      readonly ok: false
      readonly reason: 'too-large' | 'unsupported-type' | 'heic' | 'empty'
      readonly message: string
    }

/** Enough for JPEG files that carry large EXIF/ICC segments before the frame header. */
const INSPECT_BYTES = 1024 * 1024
const MAX_PIXELS = 40_000_000
const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1',
])

function ascii(head: Uint8Array, start: number, end: number): string {
  let out = ''
  for (let i = start; i < end; i += 1) out += String.fromCharCode(head[i] ?? 0)
  return out
}

function startsWith(head: Uint8Array, bytes: readonly number[]): boolean {
  return head.length >= bytes.length && bytes.every((b, i) => head[i] === b)
}

/** Identify an image by its first bytes. The file name and declared type are never trusted. */
export function sniffImageType(head: Uint8Array): SniffedType | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (head.length >= 12 && ascii(head, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(head, 8, 12))) {
    return 'image/heic'
  }
  return null
}

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

export function checkFile(sizeBytes: number, head: Uint8Array): FileCheck {
  if (sizeBytes <= 0) {
    return { ok: false, reason: 'empty', message: 'That file is empty. Download the image again and retry.' }
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      message: `That file is larger than ${MAX_MB} MB. Download the image at its normal size instead of upscaling it.`,
    }
  }
  const type = sniffImageType(head)
  if (type === 'image/heic') {
    return {
      ok: false,
      reason: 'heic',
      message: 'HEIC photos are not supported by browsers. Save or export the image as PNG or JPEG and try again.',
    }
  }
  if (type === null) {
    return {
      ok: false,
      reason: 'unsupported-type',
      message: 'That does not look like a PNG, JPEG or WEBP image. Try downloading it again from your chat.',
    }
  }
  return { ok: true, mimeType: type }
}

export interface ImageSize {
  readonly width: number
  readonly height: number
}

const u16be = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0)
const u32be = (b: Uint8Array, o: number): number => u16be(b, o) * 65536 + u16be(b, o + 2)
const u16le = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8)
const u24le = (b: Uint8Array, o: number): number => u16le(b, o) | ((b[o + 2] ?? 0) << 16)

function validSize(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null
}

function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || ascii(b, 12, 16) !== 'IHDR') return null
  return validSize(u32be(b, 16), u32be(b, 20))
}

function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let offset = 2
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) return null
    const marker = b[offset + 1] ?? 0
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (isStartOfFrame(marker)) {
      return offset + 9 <= b.length ? validSize(u16be(b, offset + 7), u16be(b, offset + 5)) : null
    }
    const length = u16be(b, offset + 2)
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

function webpSize(b: Uint8Array): ImageSize | null {
  const chunk = ascii(b, 12, 16)
  if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return validSize(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const bits = u16le(b, 21) + u16le(b, 23) * 65536
    return validSize((bits % 16384) + 1, (Math.floor(bits / 16384) % 16384) + 1)
  }
  if (chunk === 'VP8X' && b.length >= 30) return validSize(u24le(b, 24) + 1, u24le(b, 27) + 1)
  return null
}

/** Read width and height from the file header alone, without decoding any pixels. */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  switch (sniffImageType(bytes)) {
    case 'image/png':
      return pngSize(bytes)
    case 'image/jpeg':
      return jpegSize(bytes)
    case 'image/webp':
      return webpSize(bytes)
    default:
      return null
  }
}

export type DimensionCheck = { readonly ok: true } | { readonly ok: false; readonly message: string }

export function checkDimensions(width: number, height: number): DimensionCheck {
  if (Math.min(width, height) < MIN_UPLOAD_SIDE) {
    return {
      ok: false,
      message: `That image is only ${width} x ${height}px. Use the full-size image from your chat (at least ${MIN_UPLOAD_SIDE}px on each side).`,
    }
  }
  if (Math.max(width, height) > MAX_UPLOAD_SIDE || width * height > MAX_PIXELS) {
    return {
      ok: false,
      message: `That image is ${width} x ${height}px, which is too large to process (up to ${MAX_UPLOAD_SIDE}px on a side and ${MAX_PIXELS / 1_000_000} megapixels). Download it at its normal size.`,
    }
  }
  return { ok: true }
}

export type InspectResult =
  | {
      readonly ok: true
      readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
      readonly width: number
      readonly height: number
    }
  | { readonly ok: false; readonly message: string }

/** Validate type, byte size and pixel dimensions from the header only. Nothing is decoded. */
export async function inspectImageFile(file: Blob): Promise<InspectResult> {
  const bytes = new Uint8Array(await file.slice(0, INSPECT_BYTES).arrayBuffer())
  const check = checkFile(file.size, bytes)
  if (!check.ok) return { ok: false, message: check.message }
  const size = readImageSize(bytes)
  if (size === null) {
    return {
      ok: false,
      message: 'We could not read the size of that image. The file may be damaged. Download it again and retry.',
    }
  }
  const dims = checkDimensions(size.width, size.height)
  if (!dims.ok) return { ok: false, message: dims.message }
  return { ok: true, mimeType: check.mimeType, width: size.width, height: size.height }
}
