// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../ui/testMatchers'
import './__fixtures__/blobPolyfill'

vi.mock('../mascot/Mascot', () => ({
  Mascot: (p: { directions: string; label?: string }) => (
    <div data-testid="mascot" data-src={p.directions}>
      {p.label}
    </div>
  ),
}))
vi.mock('../embed', () => ({
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
  buildEmbed: () => ({ react: '<Mascot />', html: '<page-mascot>', scriptSource: 's', componentSource: 'c' }),
}))

import { saveInput, sheetBlob } from './__fixtures__/savedInputs'
import { SavedStoreProvider } from './context'
import { inMemoryStore } from './inMemoryStore'
import { exportGallery } from './transfer'
import { SavedView } from './SavedView'
import type { SavedStore, SavedStoreHandle } from './types'

function show(store: SavedStore, persistent = true, reason: string | null = null) {
  const handle: Promise<SavedStoreHandle> = Promise.resolve({ store, persistent, reason })
  return render(
    <SavedStoreProvider value={handle}>
      <SavedView onMakeOwn={onMakeOwn} />
    </SavedStoreProvider>,
  )
}

const onMakeOwn = vi.fn()
let downloaded: string[] = []

beforeEach(() => {
  onMakeOwn.mockReset()
  downloaded = []
  // triggerDownload builds a link and clicks it; record what it would have saved.
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement): void {
    downloaded.push(this.download)
  }
  URL.createObjectURL = vi.fn(() => 'blob:sheet')
  URL.revokeObjectURL = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('SavedView, with nothing saved', () => {
  it('explains what the gallery is for and points at the make flow', async () => {
    const user = userEvent.setup()
    show(inMemoryStore())
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'My gallery' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Make a mascot' }))
    expect(onMakeOwn).toHaveBeenCalled()
  })

  it('says plainly that this is one browser only, and offers no export of nothing', async () => {
    show(inMemoryStore())
    expect(await screen.findByText(/saved in this browser on this device only/)).toBeInTheDocument()
    expect(screen.getByText(/clear your site data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export my gallery/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeDisabled()
  })

  it('warns when the browser will not keep anything', async () => {
    show(inMemoryStore(), false, 'This browser would not open its own storage.')
    expect(await screen.findByRole('alert')).toHaveTextContent('would not open its own storage')
  })
})

describe('SavedView, with saved mascots', () => {
  const twoSaved = async (): Promise<SavedStore> => {
    let clock = 1_000
    const store = inMemoryStore({ now: () => clock })
    await store.save(saveInput({ name: 'Foxy Pal' }))
    clock = 2_000
    await store.save(saveInput({ name: 'Pixel Pup', directions: sheetBlob(21) }))
    return store
  }

  it('shows a card per mascot, newest first, with a live preview and the space used', async () => {
    const store = await twoSaved()
    show(store)
    const cards = await screen.findAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]!).getByText('Pixel Pup')).toBeInTheDocument()
    expect(within(cards[1]!).getByText('Foxy Pal')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('mascot')).toHaveLength(2))
    expect(screen.getAllByTestId('mascot')[0]).toHaveAttribute('data-src', 'blob:sheet')
    expect(screen.getByText(/2 mascots, 256 bytes in this browser/)).toBeInTheDocument()
  })

  it('opens a detail view with downloads, snippets and the date', async () => {
    const user = userEvent.setup()
    show(await twoSaved())
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Foxy Pal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'foxy-pal-directions.webp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'foxy-pal-reactions.webp' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'React' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to my gallery' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'My gallery' })).toBeInTheDocument()
  })

  it('downloads both sheets from the detail view', async () => {
    const user = userEvent.setup()
    show(await twoSaved())
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    const directions = await screen.findByRole('button', { name: 'foxy-pal-directions.webp' })
    await waitFor(() => expect(directions).not.toBeDisabled())
    await user.click(directions)
    await user.click(screen.getByRole('button', { name: 'foxy-pal-reactions.webp' }))
    expect(downloaded).toEqual(['foxy-pal-directions.webp', 'foxy-pal-reactions.webp'])
  })

  it('says so in the detail view when the sheets cannot be read', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    const listed = await store.list()
    const broken: SavedStore = { ...store, get: () => Promise.resolve(null) }
    show(broken)
    await user.click(await screen.findByRole('button', { name: `Open ${listed[0]?.name ?? ''}` }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer in your gallery')
  })

  it('renames a mascot and says so', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    show(store)
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    const field = screen.getByLabelText('Name')
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled()
    await user.clear(field)
    await user.type(field, 'Captain Fox')
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Captain Fox' })).toBeInTheDocument())
    expect((await store.list()).map((m) => m.name)).toContain('Captain Fox')
    expect(screen.getByText('Renamed to Captain Fox.')).toBeInTheDocument()
  })

  it('asks before deleting, and lets the answer be no', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    show(store)
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    await user.click(screen.getByRole('button', { name: 'Delete this mascot' }))
    expect(screen.getByText('Delete Foxy Pal? This cannot be undone.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('button', { name: 'Delete this mascot' })).toBeInTheDocument()
    expect(await store.list()).toHaveLength(2)
  })

  it('deletes on confirmation and goes back to a gallery of one', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    show(store)
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    await user.click(screen.getByRole('button', { name: 'Delete this mascot' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'My gallery' })).toBeInTheDocument())
    expect(screen.queryByText('Foxy Pal')).not.toBeInTheDocument()
    expect(await store.list()).toHaveLength(1)
    expect(screen.getByText('Foxy Pal is no longer in your gallery.')).toBeInTheDocument()
  })

  it('asks before deleting everything, then empties the gallery', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    show(store)
    await user.click(await screen.findByRole('button', { name: 'Delete everything' }))
    expect(screen.getByText(/Delete all 2 saved mascots\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, delete everything' }))
    await waitFor(() => expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument())
    expect(await store.list()).toEqual([])
  })

  it('exports the gallery to a file, and imports one back', async () => {
    const user = userEvent.setup()
    const source = await twoSaved()
    const exported = await exportGallery(source)
    const target = inMemoryStore()
    show(target)
    await user.upload(
      await screen.findByLabelText('Import a gallery file'),
      new File([exported], 'my-mascots.json', { type: 'application/json' }),
    )
    await waitFor(() => expect(screen.getByText('Imported 2 new and updated 0 already here.')).toBeInTheDocument())
    expect((await target.list()).map((m) => m.name)).toEqual(['Pixel Pup', 'Foxy Pal'])
    await user.click(screen.getByRole('button', { name: /Export my gallery/ }))
    await waitFor(() => expect(downloaded).toHaveLength(1))
    expect(downloaded[0]).toBe('my-mascots.mascotgallery.json')
  })

  it('rejects a damaged gallery file with a clear message and imports nothing', async () => {
    const user = userEvent.setup()
    const target = inMemoryStore()
    show(target)
    await user.upload(
      await screen.findByLabelText('Import a gallery file'),
      new File(['{"nope":true}'], 'broken.json', { type: 'application/json' }),
    )
    await waitFor(() => expect(screen.getByText(/not a Mascot Maker gallery export/)).toBeInTheDocument())
    expect(await target.list()).toEqual([])
  })

  it('shows what the store complained about when an action fails', async () => {
    const user = userEvent.setup()
    const store = await twoSaved()
    const broken: SavedStore = { ...store, remove: () => Promise.reject(new Error('Storage went away.')) }
    show(broken)
    await user.click(await screen.findByRole('button', { name: 'Open Foxy Pal' }))
    await user.click(screen.getByRole('button', { name: 'Delete this mascot' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(screen.getByText('Storage went away.')).toBeInTheDocument())
  })
})
