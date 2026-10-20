import { describe, expect, it } from 'vitest'
import { fakeIndexedDb, fakeRows } from './__fixtures__/fakeIndexedDb'
import { saveInput, sheetBlob } from './__fixtures__/savedInputs'
import { isSavedStoreError } from './errors'
import { indexedDbStore } from './indexedDbStore'
import { createSavedStore } from './store'

describe('indexedDbStore', () => {
  it('saves, lists without blobs, and reads the sheets back', async () => {
    const store = indexedDbStore(fakeIndexedDb())
    const meta = await store.save(saveInput())
    const listed = await store.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]).not.toHaveProperty('sheets')
    const full = await store.get(meta.id)
    expect(full?.name).toBe('Foxy Pal')
    expect(full?.sheets.directions.size).toBe(64)
    expect(full?.sheets.reactions.type).toBe('image/webp')
  })

  it('survives a fresh store object over the same database, which is what a reload is', async () => {
    const factory = fakeIndexedDb()
    const meta = await indexedDbStore(factory).save(saveInput())
    const reopened = indexedDbStore(factory)
    expect((await reopened.list()).map((m) => m.id)).toEqual([meta.id])
    expect((await reopened.get(meta.id))?.sheets.reactions.size).toBe(64)
  })

  it('applies the same save-or-update rule as the in-memory store', async () => {
    const store = indexedDbStore(fakeIndexedDb())
    const first = await store.save(saveInput())
    const again = await store.save(saveInput())
    expect(again.id).toBe(first.id)
    expect(await store.list()).toHaveLength(1)
    await store.save(saveInput({ name: 'Other Fox' }))
    expect(await store.list()).toHaveLength(2)
  })

  it('renames, removes, clears and reports usage', async () => {
    const store = indexedDbStore(fakeIndexedDb())
    const a = await store.save(saveInput({ name: 'A' }))
    const b = await store.save(saveInput({ name: 'B', directions: sheetBlob(8) }))
    await store.rename(a.id, 'Renamed')
    expect((await store.get(a.id))?.name).toBe('Renamed')
    expect(await store.usage()).toEqual({ bytes: 256, count: 2 })
    await store.remove(b.id)
    expect(await store.usage()).toEqual({ bytes: 128, count: 1 })
    await store.clear()
    expect(await store.usage()).toEqual({ bytes: 0, count: 0 })
    expect(await store.get(a.id)).toBeNull()
  })

  it('rejects a rename of something that is gone', async () => {
    const store = indexedDbStore(fakeIndexedDb())
    await expect(store.rename('nope', 'x')).rejects.toThrow(/no longer in your gallery/)
  })

  it('turns a full database into a quota error that names the amount already stored', async () => {
    const store = indexedDbStore(fakeIndexedDb({ quotaBytes: 400 }))
    await store.save(saveInput({ name: 'A' }))
    const error = await store.save(saveInput({ name: 'B', directions: sheetBlob(4) })).catch((e: unknown) => e)
    expect(isSavedStoreError(error) && error.kind).toBe('quota')
    expect(isSavedStoreError(error) && error.message).toMatch(/Delete a mascot/)
    expect((await store.list())).toHaveLength(1)
  })

  it('ignores records written by a newer schema instead of mangling them', async () => {
    const factory = fakeIndexedDb()
    const store = indexedDbStore(factory)
    const meta = await store.save(saveInput())
    const row = fakeRows(factory, 'mascots')?.get(meta.id)
    expect(row).toBeDefined()
    if (row) row.schema = 99
    expect(await store.list()).toEqual([])
    expect(await store.get(meta.id)).toBeNull()
  })

  it('says saving is not possible when there is no IndexedDB at all', async () => {
    const store = indexedDbStore(undefined)
    const error = await store.list().catch((e: unknown) => e)
    expect(isSavedStoreError(error) && error.kind).toBe('unavailable')
    expect(isSavedStoreError(error) && error.message).toMatch(/will not let the page store anything/)
  })

  it('says saving is not possible when opening fails or throws', async () => {
    const failing = await indexedDbStore(fakeIndexedDb({ openFails: 'SecurityError' })).usage().catch((e: unknown) => e)
    expect(isSavedStoreError(failing) && failing.kind).toBe('unavailable')
    const throwing = await indexedDbStore(fakeIndexedDb({ openThrows: true })).usage().catch((e: unknown) => e)
    expect(isSavedStoreError(throwing) && throwing.kind).toBe('unavailable')
  })
})

describe('createSavedStore', () => {
  it('reports a persistent store when IndexedDB opens', async () => {
    const handle = await createSavedStore(fakeIndexedDb())
    expect(handle.persistent).toBe(true)
    expect(handle.reason).toBeNull()
    await handle.store.save(saveInput())
    expect(await handle.store.list()).toHaveLength(1)
  })

  it('falls back to memory and says so when IndexedDB is unavailable', async () => {
    const handle = await createSavedStore(undefined)
    expect(handle.persistent).toBe(false)
    expect(handle.reason).toMatch(/will last beyond this visit/)
    const meta = await handle.store.save(saveInput())
    expect((await handle.store.get(meta.id))?.name).toBe('Foxy Pal')
  })

  it('falls back with a plain reason when the failure is not one of ours', async () => {
    const handle = await createSavedStore(fakeIndexedDb({ openThrows: true }))
    expect(handle.persistent).toBe(false)
    expect(handle.reason).toMatch(/will last beyond this visit/)
  })
})
