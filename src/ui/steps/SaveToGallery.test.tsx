// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBrief } from '../../core/types'
import '../../saved/__fixtures__/blobPolyfill'
import { SavedStoreProvider } from '../../saved/context'
import { quotaError } from '../../saved/errors'
import { inMemoryStore } from '../../saved/inMemoryStore'
import type { SavedStore, SavedStoreHandle } from '../../saved/types'
import '../testMatchers'
import { SaveToGallery, type SaveSheets } from './SaveToGallery'

const BRIEF: CharacterBrief = { name: 'Foxy Pal', describe: 'an orange fox', style: 'colour', usePhoto: true, key: null }

const sheets = (): SaveSheets => ({
  directions: new Blob([new Uint8Array(32)], { type: 'image/webp' }),
  reactions: new Blob([new Uint8Array(48)], { type: 'image/webp' }),
  mimeType: 'image/webp',
})

const onViewGallery = vi.fn()

function show(store: SavedStore, ready = true, persistent = true, reason: string | null = null) {
  const handle: Promise<SavedStoreHandle> = Promise.resolve({ store, persistent, reason })
  return render(
    <SavedStoreProvider value={handle}>
      <SaveToGallery brief={BRIEF} cellSize={360} sheets={ready ? sheets() : null} onViewGallery={onViewGallery} />
    </SavedStoreProvider>,
  )
}

beforeEach(() => onViewGallery.mockReset())
afterEach(cleanup)

describe('SaveToGallery', () => {
  it('waits for the sheets before it can be pressed, and says where things go', () => {
    show(inMemoryStore(), false)
    expect(screen.getByRole('button', { name: 'Save to my gallery' })).toBeDisabled()
    expect(screen.getByText(/Kept in this browser only/)).toBeInTheDocument()
  })

  it('saves the mascot under the name from the brief and confirms it politely', async () => {
    const user = userEvent.setup()
    const store = inMemoryStore()
    show(store)
    await user.click(screen.getByRole('button', { name: 'Save to my gallery' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Foxy Pal is in your gallery.'))
    const [saved] = await store.list()
    expect(saved?.name).toBe('Foxy Pal')
    expect(saved?.cellSize).toBe(360)
    expect(saved?.bytes).toBe(80)
    expect(saved?.brief).toEqual(BRIEF)
  })

  it('offers the gallery straight afterwards', async () => {
    const user = userEvent.setup()
    show(inMemoryStore())
    await user.click(screen.getByRole('button', { name: 'Save to my gallery' }))
    await user.click(await screen.findByRole('button', { name: 'View my gallery' }))
    expect(onViewGallery).toHaveBeenCalled()
  })

  it('updates rather than duplicating when pressed twice', async () => {
    const user = userEvent.setup()
    const store = inMemoryStore()
    show(store)
    const button = screen.getByRole('button', { name: 'Save to my gallery' })
    await user.click(button)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('in your gallery'))
    await user.click(button)
    await waitFor(async () => expect(await store.list()).toHaveLength(1))
  })

  it('falls back to a name when the brief has none', async () => {
    const user = userEvent.setup()
    const store = inMemoryStore()
    const handle: Promise<SavedStoreHandle> = Promise.resolve({ store, persistent: true, reason: null })
    render(
      <SavedStoreProvider value={handle}>
        <SaveToGallery
          brief={{ ...BRIEF, name: '  ' }}
          cellSize={360}
          sheets={sheets()}
          onViewGallery={onViewGallery}
        />
      </SavedStoreProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Save to my gallery' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('My mascot is in your gallery.'))
  })

  it('reports a full browser without pretending the save worked', async () => {
    const user = userEvent.setup()
    const store = inMemoryStore()
    const full: SavedStore = { ...store, save: () => Promise.reject(quotaError(2048)) }
    show(full)
    await user.click(screen.getByRole('button', { name: 'Save to my gallery' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('storage for Mascot Maker is full'))
    expect(screen.getByRole('status')).toHaveTextContent('Delete a mascot')
    expect(screen.getByRole('button', { name: 'View my gallery' })).toBeInTheDocument()
  })

  it('warns after saving when the browser will not keep it', async () => {
    const user = userEvent.setup()
    show(inMemoryStore(), true, false, 'This browser would not open its own storage.')
    await user.click(screen.getByRole('button', { name: 'Save to my gallery' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('would not open its own storage')
  })
})
