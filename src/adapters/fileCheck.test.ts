import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES } from '../core/types'
import { checkDimensions, checkFile, inspectImageFile, readImageSize, sniffImageType } from './fileCheck'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]
const ascii = (s: string): number[] => Array.from(s).map((c) => c.charCodeAt(0))
const WEBP = [...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')]
const HEIC = [0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('heic')]
const head = (bytes: readonly number[]): Uint8Array<ArrayBuffer> => new Uint8Array(bytes)

describe('sniffImageType', () => {
  it('recognises PNG, JPEG, WEBP and HEIC by magic bytes', () => {
    expect(sniffImageType(head(PNG))).toBe('image/png')
    expect(sniffImageType(head(JPEG))).toBe('image/jpeg')
    expect(sniffImageType(head(WEBP))).toBe('image/webp')
    expect(sniffImageType(head(HEIC))).toBe('image/heic')
    expect(sniffImageType(head([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('mif1')]))).toBe('image/heic')
  })

  it('returns null for garbage, truncated and look-alike data', () => {
    expect(sniffImageType(head([]))).toBeNull()
    expect(sniffImageType(head([0x89, 0x50]))).toBeNull()
    expect(sniffImageType(head(ascii('GIF89a......')))).toBeNull()
    expect(sniffImageType(head([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')]))).toBeNull()
    expect(sniffImageType(head([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('avif')]))).toBeNull()
  })
})

describe('checkFile', () => {
  it('accepts supported images with their sniffed type, ignoring the file name', () => {
    expect(checkFile(1000, head(PNG))).toEqual({ ok: true, mimeType: 'image/png' })
    expect(checkFile(1000, head(JPEG))).toEqual({ ok: true, mimeType: 'image/jpeg' })
    expect(checkFile(1000, head(WEBP))).toEqual({ ok: true, mimeType: 'image/webp' })
  })

  it('rejects empty files', () => {
    const r = checkFile(0, head(PNG))
    expect(r).toMatchObject({ ok: false, reason: 'empty' })
  })

  it('rejects files over the upload cap but accepts exactly the cap', () => {
    expect(checkFile(MAX_UPLOAD_BYTES + 1, head(PNG))).toMatchObject({ ok: false, reason: 'too-large' })
    expect(checkFile(MAX_UPLOAD_BYTES, head(PNG)).ok).toBe(true)
  })

  it('gives specific advice for HEIC', () => {
    const r = checkFile(1000, head(HEIC))
    expect(r).toMatchObject({ ok: false, reason: 'heic' })
    if (!r.ok) expect(r.message).toMatch(/PNG|JPEG/)
  })

  it('rejects unknown types with a friendly message', () => {
    const r = checkFile(1000, head(ascii('GIF89a......')))
    expect(r).toMatchObject({ ok: false, reason: 'unsupported-type' })
    if (!r.ok) expect(r.message).toMatch(/PNG, JPEG or WEBP/i)
  })
})

const be32 = (n: number): number[] => [Math.floor(n / 16777216) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const le16 = (n: number): number[] => [n & 255, (n >> 8) & 255]
const le24 = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255]

const pngHeader = (w: number, h: number): Uint8Array<ArrayBuffer> =>
  head([...PNG.slice(0, 8), ...be32(13), ...ascii('IHDR'), ...be32(w), ...be32(h), 8, 6, 0, 0, 0])

const jpegHeader = (w: number, h: number, withApp = true): Uint8Array<ArrayBuffer> =>
  head([
    0xff, 0xd8,
    ...(withApp ? [0xff, 0xe1, 0x00, 0x08, 1, 2, 3, 4, 5, 6] : []),
    0xff, 0xff, 0xc0, 0x00, 0x11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3,
  ])

const webpLossy = (w: number, h: number): Uint8Array<ArrayBuffer> =>
  head([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8 '), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)])

const webpLossless = (w: number, h: number): Uint8Array<ArrayBuffer> => {
  const bits = (w - 1) + (h - 1) * 16384
  return head([
    ...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8L'), 0, 0, 0, 0, 0x2f,
    bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, Math.floor(bits / 16777216) & 255,
  ])
}

const webpExtended = (w: number, h: number): Uint8Array<ArrayBuffer> =>
  head([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)])

describe('readImageSize', () => {
  it('reads PNG dimensions from IHDR', () => {
    expect(readImageSize(pngHeader(1536, 1024))).toEqual({ width: 1536, height: 1024 })
  })

  it('reads JPEG dimensions past other segments and fill bytes', () => {
    expect(readImageSize(jpegHeader(1024, 768))).toEqual({ width: 1024, height: 768 })
    expect(readImageSize(jpegHeader(640, 480, false))).toEqual({ width: 640, height: 480 })
  })

  it('reads all three WEBP flavours', () => {
    expect(readImageSize(webpLossy(800, 600))).toEqual({ width: 800, height: 600 })
    expect(readImageSize(webpLossless(1234, 987))).toEqual({ width: 1234, height: 987 })
    expect(readImageSize(webpExtended(4000, 3000))).toEqual({ width: 4000, height: 3000 })
  })

  it('reads very large claimed sizes so they can be rejected', () => {
    expect(readImageSize(pngHeader(65535, 65535))).toEqual({ width: 65535, height: 65535 })
    expect(readImageSize(pngHeader(4294967295, 2))?.width).toBe(4294967295)
  })

  it('returns null for truncated, malformed or zero-sized headers', () => {
    expect(readImageSize(pngHeader(10, 10).slice(0, 20))).toBeNull()
    expect(readImageSize(head([...PNG.slice(0, 8), 0, 0, 0, 13, ...ascii('XXXX'), ...be32(10), ...be32(10)]))).toBeNull()
    expect(readImageSize(pngHeader(0, 10))).toBeNull()
    expect(readImageSize(jpegHeader(10, 10).slice(0, 14))).toBeNull()
    expect(readImageSize(head([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0, 0]))).toBeNull()
    expect(readImageSize(head([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0, 0]))).toBeNull()
    expect(readImageSize(webpLossy(10, 10).slice(0, 25))).toBeNull()
    expect(readImageSize(head(ascii('hello world, not an image')))).toBeNull()
    expect(readImageSize(head([]))).toBeNull()
  })

  it('terminates on a hostile JPEG made only of tiny segments', () => {
    const hostile = head([0xff, 0xd8, ...Array.from({ length: 4000 }, () => [0xff, 0xe1, 0x00, 0x02]).flat()])
    expect(readImageSize(hostile)).toBeNull()
  })
})

describe('checkDimensions', () => {
  it('accepts normal sizes', () => {
    expect(checkDimensions(1024, 1024)).toEqual({ ok: true })
    expect(checkDimensions(8192, 4000)).toEqual({ ok: true })
  })

  it('rejects images that are too small, too long on one side, or too many pixels', () => {
    expect(checkDimensions(200, 1000)).toMatchObject({ ok: false })
    expect(checkDimensions(9000, 400)).toMatchObject({ ok: false })
    const bomb = checkDimensions(8000, 8000)
    expect(bomb).toMatchObject({ ok: false })
    if (!bomb.ok) expect(bomb.message).toMatch(/megapixel/i)
  })
})

describe('inspectImageFile', () => {
  it('returns type and size for a good file', async () => {
    const r = await inspectImageFile(new Blob([pngHeader(1024, 1024)]))
    expect(r).toEqual({ ok: true, mimeType: 'image/png', width: 1024, height: 1024 })
  })

  it('rejects non-images, unreadable headers, hostile sizes and empty files with messages', async () => {
    expect((await inspectImageFile(new Blob([new Uint8Array(ascii('hello world!'))]))).ok).toBe(false)
    expect((await inspectImageFile(new Blob([pngHeader(4294967295, 4294967295)]))).ok).toBe(false)
    const noSize = await inspectImageFile(new Blob([new Uint8Array(PNG.slice(0, 8))]))
    expect(noSize.ok).toBe(false)
    const empty = await inspectImageFile(new Blob([]))
    expect(empty.ok === false && empty.message).toMatch(/empty/i)
  })
})
