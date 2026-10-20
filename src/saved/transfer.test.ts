import { describe, expect, it } from 'vitest'
import { saveInput, sheetBlob } from './__fixtures__/savedInputs'
import { base64ToBytes, bytesToBase64 } from './base64'
import { isSavedStoreError } from './errors'
import { inMemoryStore } from './inMemoryStore'
import { ENVELOPE_FORMAT, ENVELOPE_VERSION, exportGallery, importGallery, parseGalleryFile } from './transfer'
import type { SavedStore } from './types'

async function twoMascots(): Promise<SavedStore> {
  let clock = 1_700_000_000_000
  const store = inMemoryStore({ now: () => clock })
  await store.save(saveInput({ name: 'Foxy Pal' }))
  clock += 60_000
  await store.save(saveInput({ name: 'Pixel Pup', directions: sheetBlob(11, 96), mimeType: 'image/png' }))
  return store
}

describe('base64', () => {
  it('round-trips every byte value, at each padding length', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 255, 256]) {
      const bytes = new Uint8Array(Array.from({ length }, (_, i) => i & 0xff))
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    }
  })

  it('pads to a multiple of four', () => {
    expect(bytesToBase64(new Uint8Array([1]))).toBe('AQ==')
    expect(bytesToBase64(new Uint8Array([1, 2]))).toBe('AQI=')
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe('AQID')
  })

  it('returns null for a truncated group, a stray pad and a bad character', () => {
    expect(base64ToBytes('AQI')).toBeNull()
    expect(base64ToBytes('A=QI')).toBeNull()
    expect(base64ToBytes('AQ*=')).toBeNull()
  })
})

describe('exportGallery / importGallery', () => {
  it('writes an envelope naming the format and version', async () => {
    const text = await exportGallery(await twoMascots(), 42)
    const parsed = JSON.parse(text) as { format: string; version: number; exported: number; mascots: unknown[] }
    expect(parsed.format).toBe(ENVELOPE_FORMAT)
    expect(parsed.version).toBe(ENVELOPE_VERSION)
    expect(parsed.exported).toBe(42)
    expect(parsed.mascots).toHaveLength(2)
  })

  it('round-trips the whole gallery into an empty store, byte for byte', async () => {
    const source = await twoMascots()
    const text = await exportGallery(source)
    const target = inMemoryStore()
    expect(await importGallery(target, text)).toEqual({ added: 2, updated: 0 })

    const before = await source.list()
    const after = await target.list()
    expect(after.map((m) => m.name)).toEqual(before.map((m) => m.name))
    for (const [index, meta] of after.entries()) {
      const original = await source.get(before[index]?.id ?? '')
      const copy = await target.get(meta.id)
      expect(copy?.created).toBe(original?.created)
      expect(copy?.updated).toBe(original?.updated)
      expect(copy?.mimeType).toBe(original?.mimeType)
      expect(copy?.cellSize).toBe(original?.cellSize)
      expect(copy?.brief).toEqual(original?.brief)
      expect(copy?.signature).toBe(original?.signature)
      expect(new Uint8Array(await copy!.sheets.directions.arrayBuffer())).toEqual(
        new Uint8Array(await original!.sheets.directions.arrayBuffer()),
      )
      expect(new Uint8Array(await copy!.sheets.reactions.arrayBuffer())).toEqual(
        new Uint8Array(await original!.sheets.reactions.arrayBuffer()),
      )
    }
  })

  it('updates instead of duplicating when the same file is imported twice', async () => {
    const text = await exportGallery(await twoMascots())
    const target = inMemoryStore()
    await importGallery(target, text)
    expect(await importGallery(target, text)).toEqual({ added: 0, updated: 2 })
    expect(await target.list()).toHaveLength(2)
  })

  it('exports an empty gallery as an empty list', async () => {
    const text = await exportGallery(inMemoryStore())
    const result = parseGalleryFile(text)
    expect(result.ok && result.mascots).toEqual([])
  })
})

describe('import validation', () => {
  const reject = (text: string): string => {
    const result = parseGalleryFile(text)
    expect(result.ok).toBe(false)
    return result.ok ? '' : result.message
  }

  it('rejects something that is not JSON', () => {
    expect(reject('not json at all')).toMatch(/not readable JSON/)
  })

  it('rejects JSON that is not one of our envelopes', () => {
    expect(reject('{"hello":"world"}')).toMatch(/not a Mascot Maker gallery export/)
    expect(reject('[]')).toMatch(/not a Mascot Maker gallery export/)
    expect(reject('null')).toMatch(/not a Mascot Maker gallery export/)
  })

  it('rejects a version it does not read, and says which', () => {
    const text = JSON.stringify({ format: ENVELOPE_FORMAT, version: 9, exported: 0, mascots: [] })
    expect(reject(text)).toMatch(/written by another version .*version 9, this one reads 1/)
  })

  it('rejects a missing or non-array mascot list', () => {
    expect(reject(JSON.stringify({ format: ENVELOPE_FORMAT, version: 1, exported: 0 }))).toMatch(/not a Mascot Maker/)
    expect(reject(JSON.stringify({ format: ENVELOPE_FORMAT, version: 1, mascots: 'two' }))).toMatch(/not a Mascot Maker/)
  })

  it('names the mascot that is damaged, and imports none of them', async () => {
    const text = await exportGallery(await twoMascots())
    const file = JSON.parse(text) as { mascots: Record<string, unknown>[] }
    const second = file.mascots[1]
    if (second) second.directions = `${String(second.directions).slice(0, -5)}`
    const broken = JSON.stringify(file)
    expect(reject(broken)).toMatch(/Mascot 2 in that file is incomplete or damaged/)

    const target = inMemoryStore()
    const error = await importGallery(target, broken).catch((e: unknown) => e)
    expect(isSavedStoreError(error) && error.kind).toBe('invalid')
    expect(await target.list()).toEqual([])
  })

  it('rejects each missing or wrongly typed field in turn', async () => {
    const text = await exportGallery(await twoMascots())
    const original = JSON.parse(text) as { mascots: Record<string, unknown>[] }
    const bad: readonly Record<string, unknown>[] = [
      { name: 42 },
      { cellSize: 'big' },
      { cellSize: Number.NaN },
      { mimeType: 'image/gif' },
      { directions: 123 },
      { reactions: null },
      { directions: '' },
      { brief: 'a fox' },
      { brief: { name: 'a', describe: 'b', style: 'colour', usePhoto: 'yes', key: null } },
      { brief: { name: 'a', describe: 'b', style: 'nonsense', usePhoto: true, key: null } },
      { brief: { name: 'a', describe: 'b', style: 'colour', usePhoto: true, key: 7 } },
      { brief: { name: 'a', describe: 'b', style: 'colour' } },
    ]
    for (const patch of bad) {
      const first = original.mascots[0] ?? {}
      const file = { format: ENVELOPE_FORMAT, version: 1, exported: 0, mascots: [{ ...first, ...patch }] }
      expect(reject(JSON.stringify(file))).toMatch(/Mascot 1 in that file is incomplete or damaged/)
    }
  })

  it('rejects a mascot that is not an object at all', () => {
    const file = { format: ENVELOPE_FORMAT, version: 1, exported: 0, mascots: ['nope'] }
    expect(reject(JSON.stringify(file))).toMatch(/Mascot 1/)
  })
})
