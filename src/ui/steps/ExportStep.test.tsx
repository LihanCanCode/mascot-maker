// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComposedMascot, PipelineSuccess } from '../../core/types'
import { initialState, type AppState } from '../state/appReducer'
import '../testMatchers'

const encodeImage = vi.fn()
vi.mock('../../adapters/encode', () => ({ encodeImage: (...a: unknown[]): unknown => encodeImage(...a) }))
vi.mock('../../embed', () => ({
  slugify: (s: string) => s.toLowerCase(),
  buildEmbed: () => ({ react: '<Mascot />', html: '<page-mascot>', scriptSource: 's', componentSource: 'c' }),
}))
vi.mock('../../mascot/Mascot', () => ({
  Mascot: (p: { directions: string }) => <div data-testid="mascot">{p.directions}</div>,
}))

import { ExportStep } from './ExportStep'

const makeOutput = (): ComposedMascot => ({ cellSize: 360, directions: {}, reactions: {} }) as unknown as ComposedMascot
const makeResult = (output: ComposedMascot): PipelineSuccess => ({
  ok: true,
  output,
  directions: { slice: { cells: [{ image: { width: 300 } }] } },
  report: { canExport: true },
}) as unknown as PipelineSuccess
const exportState = (cellSize = 360, result = makeResult(makeOutput())): Extract<AppState, { step: 'export' }> => ({
  ...initialState,
  step: 'export',
  brief: { ...initialState.brief, name: 'Mochi' },
  options: { ...initialState.options, cellSize },
  result,
})

beforeEach(() => {
  encodeImage.mockReset()
  encodeImage.mockImplementation(async () => ({ blob: new Blob(['x']), mimeType: 'image/webp', usedFallback: false }))
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

describe('ExportStep', () => {
  it('changing the image detail only updates the option, and rebuilding is an explicit button', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const onRerun = vi.fn()
    render(<ExportStep state={exportState(360)} dispatch={dispatch} onRerun={onRerun} />)
    await user.selectOptions(screen.getByLabelText('Image detail'), '512')
    expect(dispatch).toHaveBeenCalledWith({ type: 'options/update', patch: { cellSize: 512 } })
    expect(onRerun).not.toHaveBeenCalled()
  })

  it('enables the rebuild button only when the size differs from the built one', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    const { rerender } = render(<ExportStep state={exportState(360)} dispatch={vi.fn()} onRerun={onRerun} />)
    const button = screen.getByRole('button', { name: 'Rebuild at this size' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(onRerun).not.toHaveBeenCalled()
    rerender(<ExportStep state={exportState(512)} dispatch={vi.fn()} onRerun={onRerun} />)
    await user.click(screen.getByRole('button', { name: 'Rebuild at this size' }))
    expect(onRerun).toHaveBeenCalledTimes(1)
  })

  it('shows the preview and downloads once encoded, and does not re-encode the same output', async () => {
    const state = exportState(360, makeResult(makeOutput()))
    const first = render(<ExportStep state={state} dispatch={vi.fn()} onRerun={vi.fn()} />)
    expect(await screen.findByTestId('mascot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'mochi-directions.webp' })).toBeInTheDocument()
    expect(encodeImage).toHaveBeenCalledTimes(2)
    first.unmount()
    render(<ExportStep state={state} dispatch={vi.fn()} onRerun={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('mascot')).toBeInTheDocument())
    expect(encodeImage).toHaveBeenCalledTimes(2)
  })
})
