// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cell, CellIndex, Issue, ValidationReport } from '../../core/types'
import { CELL_INDICES } from '../../core/types'
import '../testMatchers'

vi.mock('../../prompts', () => ({
  STYLE_LABELS: new Proxy({}, { get: (_t, k) => ({ label: `Label ${String(k)}`, blurb: `Blurb ${String(k)}` }) }),
  CHAT_GUIDES: [
    { id: 'gemini', name: 'Gemini', steps: ['Open a chat'], tips: ['Tip one'] },
    { id: 'chatgpt', name: 'ChatGPT', steps: ['Open ChatGPT'], tips: ['Tip two'] },
  ],
}))

import { CellGrid } from './CellGrid'
import { ChatHowTo } from './ChatHowTo'
import { CopyButton } from './CopyButton'
import { DropZone } from './DropZone'
import { IssueList } from './IssueList'
import { MirrorCheck } from './MirrorCheck'
import { ProgressBar } from './ProgressBar'
import { SnippetTabs } from './SnippetTabs'
import { StepNav } from './StepNav'
import { StylePicker } from './StylePicker'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
})
afterEach(cleanup)

const issue = (over: Partial<Issue>): Issue => ({
  id: 'i',
  code: 'touches-edge',
  severity: 'warning',
  blocking: false,
  sheet: 'directions',
  cellIndex: 2,
  message: 'Message text',
  fix: 'Fix text',
  redo: 'directions',
  metric: null,
  ...over,
})
const report = (issues: Issue[]): ValidationReport => ({
  issues,
  verdict: 'usable-with-warnings',
  canExport: true,
  metrics: {
    shoulderSpreadPct: null, headShoulderRatio: null, boopShiftPx: null,
    minBandOverlap: null, paletteMatch: null, widthChange: null,
  },
})
const cells = (sheet: 'directions' | 'reactions' = 'directions'): Cell[] =>
  CELL_INDICES.map((index) => ({
    sheet,
    index,
    image: { width: 2, height: 2, data: new Uint8ClampedArray(16) },
    sourceBox: { x0: 0, y0: 0, x1: 2, y1: 2 },
    fragmentsRemoved: 0,
  }))

describe('CopyButton', () => {
  it('copies the text and announces it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CopyButton text="hello" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(await screen.findByRole('status')).toHaveTextContent('Copied to clipboard')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})

describe('DropZone', () => {
  const base = { sheet: 'directions' as const, title: 'Directions', hint: 'hint' }

  it('passes a chosen file up and lets keyboard users reach the input', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<DropZone {...base} slot={{ status: 'empty' }} onSelect={onSelect} onClear={() => {}} />)
    await user.tab()
    const input = screen.getByLabelText('Directions')
    expect(input).toHaveFocus()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await user.upload(input, file)
    expect(onSelect).toHaveBeenCalledWith(file)
  })

  it('accepts dropped files', () => {
    const onSelect = vi.fn()
    const { container } = render(<DropZone {...base} slot={{ status: 'empty' }} onSelect={onSelect} onClear={() => {}} />)
    const file = new File(['x'], 'a.png')
    const zone = container.querySelector('label.dropzone') as HTMLElement
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.assign(drop, { dataTransfer: { files: [file] } })
    zone.dispatchEvent(drop)
    expect(onSelect).toHaveBeenCalledWith(file)
  })

  it('shows the rejection message as an alert and can clear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<DropZone {...base} slot={{ status: 'rejected', message: 'Too big' }} onSelect={() => {}} onClear={onClear} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Too big')
    await user.click(screen.getByRole('button', { name: /remove directions image/i }))
    expect(onClear).toHaveBeenCalled()
  })

  it('shows a thumbnail with alt text for a ready file', () => {
    const file = new File(['x'], 'mine.png')
    render(<DropZone {...base} slot={{ status: 'ready', file, previewUrl: 'blob:1' }} onSelect={() => {}} onClear={() => {}} />)
    expect(screen.getByAltText('Preview of your directions image')).toHaveAttribute('src', 'blob:1')
    expect(screen.getByText('mine.png')).toBeInTheDocument()
  })
})

describe('IssueList', () => {
  const issues = [
    issue({ id: 'a', cellIndex: 2, message: 'Edge issue' }),
    issue({ id: 'b', cellIndex: 4, message: 'Other cell issue', redo: 'none' }),
    issue({ id: 'c', cellIndex: null, sheet: null, message: 'Global issue', redo: 'both' }),
  ]

  it('lists everything when no cell is selected', () => {
    render(<IssueList report={report(issues)} selected={null} onClearFilter={() => {}} onShowPrompt={() => {}} onReplaceImage={() => {}} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('filters by the selected cell and offers to clear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <IssueList
        report={report(issues)}
        selected={{ sheet: 'directions', index: 2 as CellIndex }}
        onClearFilter={onClear}
        onShowPrompt={() => {}}
        onReplaceImage={() => {}}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Edge issue')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Directions cell 3, up-right/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all notes' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('shows an empty message and routes redo buttons', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    const onReplace = vi.fn()
    const { rerender } = render(
      <IssueList report={report(issues)} selected={{ sheet: 'reactions', index: 0 }} onClearFilter={() => {}} onShowPrompt={onShow} onReplaceImage={onReplace} />,
    )
    expect(screen.getByText('Nothing to flag on this cell.')).toBeInTheDocument()
    rerender(<IssueList report={report([issues[0] as Issue])} selected={null} onClearFilter={() => {}} onShowPrompt={onShow} onReplaceImage={onReplace} />)
    await user.click(screen.getByRole('button', { name: 'Show prompt' }))
    await user.click(screen.getByRole('button', { name: 'Replace image' }))
    expect(onShow).toHaveBeenCalledWith('directions')
    expect(onReplace).toHaveBeenCalled()
  })
})

describe('CellGrid', () => {
  it('renders nine labelled cells with severity badges and toggles selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const severities = CELL_INDICES.map((i) => (i === 2 ? ('error' as const) : null))
    render(<CellGrid sheet="directions" title="Directions" cells={cells()} severities={severities} selected={null} onSelect={onSelect} />)
    expect(screen.getAllByRole('button')).toHaveLength(9)
    expect(screen.getByRole('img', { name: 'Directions cell 3, up-right' })).toBeInTheDocument()
    expect(screen.getByText('Problem')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button')[2] as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith({ sheet: 'directions', index: 2 })
  })

  it('clears the selection when the selected cell is clicked again', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CellGrid sheet="reactions" title="Reactions" cells={cells('reactions')} severities={[]} selected={{ sheet: 'reactions', index: 1 }} onSelect={onSelect} />)
    const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    await user.click(pressed[0] as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

describe('MirrorCheck', () => {
  it('shows poses 4 and 6 and toggles the swap', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<MirrorCheck cells={cells()} swapped={false} onToggle={onToggle} />)
    expect(screen.getByRole('img', { name: /cell 4/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /cell 6/ })).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: /swap left\/right columns/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(onToggle).toHaveBeenCalled()
  })

  it('renders nothing without all cells', () => {
    const { container } = render(<MirrorCheck cells={[]} swapped={false} onToggle={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('StepNav', () => {
  it('marks the current step and disables unreachable steps', async () => {
    const user = userEvent.setup()
    const onGoto = vi.fn()
    render(<StepNav currentIndex={1} reachable={new Set(['setup', 'upload'] as const)} onGoto={onGoto} />)
    expect(screen.getByRole('button', { name: /Upload/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Describe/ }))
    expect(onGoto).toHaveBeenCalledWith('setup')
  })
})

describe('Tabs consumers', () => {
  it('SnippetTabs switches panels with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<SnippetTabs react="<Mascot />" html="<page-mascot>" />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('<Mascot />')
    screen.getByRole('tab', { name: 'React' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'HTML' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('<page-mascot>')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'React' })).toHaveFocus()
    await user.keyboard('{End}')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'React' })).toHaveAttribute('aria-selected', 'true')
  })

  it('ChatHowTo lists provider steps and tips', async () => {
    const user = userEvent.setup()
    render(<ChatHowTo />)
    expect(within(screen.getByRole('tabpanel')).getByText('Open a chat')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'ChatGPT' }))
    expect(screen.getByText('Tip two')).toBeInTheDocument()
  })
})

describe('small components', () => {
  it('StylePicker is a radio group that reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StylePicker value="colour" onChange={onChange} />)
    expect(screen.getAllByRole('radio')).toHaveLength(8)
    await user.click(screen.getByRole('radio', { name: /Label ink/ }))
    expect(onChange).toHaveBeenCalledWith('ink')
  })

  it('ProgressBar exposes a clamped percentage', () => {
    render(<ProgressBar fraction={1.7} label="Building" />)
    expect(screen.getByRole('progressbar', { name: 'Building' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('ThemeToggle names the theme it will switch to', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<ThemeToggle theme="light" onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(onToggle).toHaveBeenCalled()
  })
})
