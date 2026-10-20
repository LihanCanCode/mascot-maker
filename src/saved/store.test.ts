import { beforeEach, describe, expect, it } from 'vitest'
import { saveInput, sheetBlob } from './__fixtures__/savedInputs'
import { isSavedStoreError } from './errors'
import { inMemoryStore } from './inMemoryStore'
import { displayName, FALLBACK_NAME, MAX_NAME_LENGTH } from './record'
import { hashBytes, newId, normalizeName, signatureOf, signatureWithName } from './signature'
import { SCHEMA_VERSION, type SavedStore } from './types'

let store: SavedStore

beforeEach(() => {
  store = inMemoryStore()
})

describe('inMemoryStore', () => {
  it('starts empty, with no usage', async () => {
    expect(await store.list()).toEqual([])
    expect(await store.usage()).toEqual({ bytes: 0, count: 0 })
    expect(await store.get('nope')).toBeNull()
  })

  it('saves a mascot and reads its metadata back without the blobs', async () => {
    const meta = await store.save(saveInput())
    expect(meta.name).toBe('Foxy Pal')
    expect(meta.schema).toBe(SCHEMA_VERSION)
    expect(meta.bytes).toBe(128)
    expect(meta.created).toBe(meta.updated)
    const [listed] = await store.list()
    expect(listed).toEqual(meta)
    expect(listed).not.toHaveProperty('sheets')
  })

  it('reads the sheets back with their real mime type and the brief that made them', async () => {
    const meta = await store.save(saveInput({ mimeType: 'image/png', directions: sheetBlob(3, 64, 'image/png') }))
    const full = await store.get(meta.id)
    expect(full?.mimeType).toBe('image/png')
    expect(full?.cellSize).toBe(360)
    expect(full?.brief.describe).toContain('orange fox')
    expect(full?.sheets.directions.size).toBe(64)
    expect(full?.sheets.reactions.size).toBe(64)
  })

  it('lists newest first', async () => {
    let clock = 1_000
    const timed = inMemoryStore({ now: () => clock })
    const first = await timed.save(saveInput({ name: 'One' }))
    clock = 2_000
    const second = await timed.save(saveInput({ name: 'Two', directions: sheetBlob(9) }))
    expect((await timed.list()).map((m) => m.id)).toEqual([second.id, first.id])
  })

  it('renames, and rejects renaming something that is gone', async () => {
    const meta = await store.save(saveInput())
    await store.rename(meta.id, '  Captain   Fox  ')
    expect((await store.get(meta.id))?.name).toBe('Captain Fox')
    await expect(store.rename('missing', 'x')).rejects.toThrow(/no longer in your gallery/)
  })

  it('removes one and clears everything', async () => {
    const a = await store.save(saveInput({ name: 'A' }))
    await store.save(saveInput({ name: 'B', directions: sheetBlob(5) }))
    await store.remove(a.id)
    expect((await store.list()).map((m) => m.name)).toEqual(['B'])
    await store.remove('already-gone')
    await store.clear()
    expect(await store.usage()).toEqual({ bytes: 0, count: 0 })
  })

  it('adds up usage across mascots', async () => {
    await store.save(saveInput({ name: 'A' }))
    await store.save(saveInput({ name: 'B', directions: sheetBlob(5, 128), reactions: sheetBlob(6, 128) }))
    expect(await store.usage()).toEqual({ bytes: 128 + 256, count: 2 })
  })
})

describe('the save-or-update rule', () => {
  it('updates in place when the name and both sheets are the same', async () => {
    let clock = 1_000
    const timed = inMemoryStore({ now: () => clock })
    const first = await timed.save(saveInput())
    clock = 5_000
    const again = await timed.save(saveInput())
    expect(again.id).toBe(first.id)
    expect(again.created).toBe(1_000)
    expect(again.updated).toBe(5_000)
    expect(await timed.usage()).toEqual({ bytes: 128, count: 1 })
  })

  it('treats capitalisation and padding as the same name', async () => {
    const first = await store.save(saveInput({ name: 'Foxy Pal' }))
    const again = await store.save(saveInput({ name: '  foxy   pal ' }))
    expect(again.id).toBe(first.id)
    expect(await store.list()).toHaveLength(1)
  })

  it('keeps both when the name matches but a sheet differs', async () => {
    await store.save(saveInput())
    await store.save(saveInput({ reactions: sheetBlob(99) }))
    expect(await store.list()).toHaveLength(2)
  })

  it('keeps both when the sheets match but the name differs', async () => {
    await store.save(saveInput({ name: 'Foxy Pal' }))
    await store.save(saveInput({ name: 'Second Fox' }))
    const names = (await store.list()).map((m) => m.name)
    expect([...names].sort()).toEqual(['Foxy Pal', 'Second Fox'])
  })

  it('re-keys after a rename, so saving under the new name updates rather than duplicates', async () => {
    const meta = await store.save(saveInput({ name: 'Foxy Pal' }))
    await store.rename(meta.id, 'Captain Fox')
    const again = await store.save(saveInput({ name: 'Captain Fox' }))
    expect(again.id).toBe(meta.id)
    expect(await store.list()).toHaveLength(1)
  })
})

describe('quota', () => {
  it('refuses the save and says what is full, keeping what was already there', async () => {
    const small = inMemoryStore({ quotaBytes: 200 })
    await small.save(saveInput({ name: 'A' }))
    const error = await small.save(saveInput({ name: 'B', directions: sheetBlob(7) })).catch((e: unknown) => e)
    expect(isSavedStoreError(error) && error.kind).toBe('quota')
    expect(isSavedStoreError(error) && error.message).toMatch(/storage for Mascot Maker is full/)
    expect(await small.usage()).toEqual({ bytes: 128, count: 1 })
  })

  it('lets an update through, because it replaces rather than adds', async () => {
    const small = inMemoryStore({ quotaBytes: 200 })
    const first = await small.save(saveInput())
    const again = await small.save(saveInput())
    expect(again.id).toBe(first.id)
  })
})

describe('names and signatures', () => {
  it('falls back when the brief had no name, and trims an over-long one', () => {
    expect(displayName('   ')).toBe(FALLBACK_NAME)
    expect(displayName('a'.repeat(200))).toHaveLength(MAX_NAME_LENGTH)
    expect(normalizeName(' a  b ')).toBe('a b')
  })

  it('hashes bytes stably and distinguishes different content and length', () => {
    const a = hashBytes(new Uint8Array([1, 2, 3]))
    expect(hashBytes(new Uint8Array([1, 2, 3]))).toBe(a)
    expect(hashBytes(new Uint8Array([1, 2, 4]))).not.toBe(a)
    expect(hashBytes(new Uint8Array([1, 2, 3, 0]))).not.toBe(a)
  })

  it('swaps only the name out of a signature', () => {
    const sig = signatureOf({ name: 'Fox', mimeType: 'image/webp', directions: 'd', reactions: 'r' })
    expect(signatureWithName(sig, 'Wolf')).toBe('wolf|image/webp|d|r')
  })

  it('mints distinct url-safe ids', () => {
    const ids = new Set(Array.from({ length: 50 }, newId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
