// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './ui/testMatchers'

vi.mock('./prompts', () => ({
  STYLE_LABELS: new Proxy({}, { get: (_t, k) => ({ label: `Label ${String(k)}`, blurb: 'b' }) }),
  CHAT_GUIDES: [],
  lintDescription: (d: string) => (d.length < 10 ? [{ code: 'too-short', message: 'Add a few more details.' }] : []),
  buildPrompts: () => ({ firstKind: 'directions', first: 'FIRST MESSAGE', second: 'SECOND MESSAGE', key: 'green' }),
}))
vi.mock('./embed', () => ({ slugify: (s: string) => s, buildEmbed: () => ({}) }))
vi.mock('./mascot/Mascot', () => ({ Mascot: () => null }))
vi.mock('./worker/client', () => ({ runInWorker: vi.fn() }))
vi.mock('./core/pipelineOptions', () => ({ optionsForStyle: vi.fn() }))

import { App } from './App'

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('App', () => {
  it('starts on the describe step with the privacy line and nav in place', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 2, name: 'Describe your mascot' })).toBeInTheDocument()
    expect(screen.getAllByText(/never uploaded/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Describe/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Check/ })).toBeDisabled()
  })

  it('has a page heading and a title for the current step', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Mascot Maker' })).toBeInTheDocument()
    expect(document.title).toBe('Describe your mascot - Mascot Maker')
    await user.click(screen.getByRole('button', { name: 'I have both images' }))
    expect(document.title).toBe('Upload your two images - Mascot Maker')
  })

  it('shows the generated messages once a description is typed, and lint hints', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByText('FIRST MESSAGE')).toBeNull()
    await user.type(screen.getByLabelText('What does it look like?'), 'a fox')
    expect(screen.getByText('FIRST MESSAGE')).toBeInTheDocument()
    expect(screen.getByText('SECOND MESSAGE')).toBeInTheDocument()
    expect(screen.getByText('Add a few more details.')).toBeInTheDocument()
  })

  it('moves to upload, moves focus to the new heading, and disables Build until both files exist', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'I have both images' }))
    const heading = screen.getByRole('heading', { level: 2, name: 'Upload your two images' })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Build my mascot' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Back to messages' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Describe your mascot' })).toHaveFocus()
  })
})
