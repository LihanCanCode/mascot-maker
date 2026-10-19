import { useState, type Dispatch } from 'react'
import type { PipelineResult, RedoTarget, SheetAnalysis } from '../../core/types'
import { CellGrid } from '../components/CellGrid'
import { IssueList } from '../components/IssueList'
import { MirrorCheck } from '../components/MirrorCheck'
import { ProgressBar } from '../components/ProgressBar'
import type { AppAction, AppState } from '../state/appReducer'
import {
  canContinueAnyway,
  cellSeverities,
  stageLabel,
  verdictCopy,
  type CellRef,
} from '../state/selectors'

type ReviewState = Extract<AppState, { step: 'processing' | 'review' }>

interface Props {
  state: ReviewState
  dispatch: Dispatch<AppAction>
  onRerun: () => void
  onShowPrompt: (redo: RedoTarget) => void
  onRequestFocus: (id: string) => void
}

function Processing({ state, dispatch }: { state: Extract<AppState, { step: 'processing' }>; dispatch: Dispatch<AppAction> }) {
  const label = stageLabel(state.progress)
  return (
    <div className="step">
      <h2 tabIndex={-1}>Building your mascot</h2>
      <ProgressBar fraction={state.progress.fraction} label="Building your mascot" />
      <p aria-live="polite" role="status" className="stage">
        {label}
      </p>
      <p className="muted">This happens on your device. Usually 5 to 15 seconds, longer on slower devices.</p>
      <button type="button" className="btn" onClick={() => dispatch({ type: 'nav/goto', step: state.from })}>
        Cancel
      </button>
    </div>
  )
}

function SheetGrid({ analysis, title, result, selected, onSelect }: {
  analysis: SheetAnalysis
  title: string
  result: PipelineResult
  selected: CellRef | null
  onSelect: (cell: CellRef | null) => void
}) {
  const cells = analysis.slice?.cells
  if (!cells) {
    return (
      <section aria-label={title}>
        <h3>{title}</h3>
        <p className="muted">We could not cut this image into cells. See the notes below for what to fix.</p>
      </section>
    )
  }
  return (
    <CellGrid
      sheet={analysis.kind}
      title={title}
      cells={cells}
      severities={cellSeverities(result.report, analysis.kind)}
      selected={selected}
      onSelect={onSelect}
    />
  )
}

export function ReviewStep({ state, dispatch, onRerun, onShowPrompt, onRequestFocus }: Props) {
  const [selected, setSelected] = useState<CellRef | null>(null)
  if (state.step === 'processing') return <Processing state={state} dispatch={dispatch} />

  const { result } = state
  const verdict = verdictCopy(result.report)
  const swap = state.options.swapDirectionColumns
  const goto = (step: 'upload' | 'export'): void => dispatch({ type: 'nav/goto', step })
  const toggleSwap = (): void => {
    dispatch({ type: 'options/update', patch: { swapDirectionColumns: !swap } })
    onRequestFocus('mirror-switch')
    onRerun()
  }
  const dirCells = result.directions.slice?.cells ?? []

  return (
    <div className="step">
      <h2 tabIndex={-1}>Check the result</h2>
      <div className="banner" data-tone={verdict.tone} role="status">
        <strong>{verdict.title}</strong>
        <span>{verdict.body}</span>
      </div>

      <div className="grids">
        <SheetGrid analysis={result.directions} title="Directions" result={result} selected={selected} onSelect={setSelected} />
        <SheetGrid analysis={result.reactions} title="Reactions" result={result} selected={selected} onSelect={setSelected} />
      </div>

      <IssueList
        report={result.report}
        selected={selected}
        onClearFilter={() => setSelected(null)}
        onShowPrompt={onShowPrompt}
        onReplaceImage={() => goto('upload')}
      />

      {dirCells.length === 9 && <MirrorCheck cells={dirCells} swapped={swap} onToggle={toggleSwap} />}

      <div className="actions">
        <button type="button" className="btn" onClick={() => goto('upload')}>
          Replace images
        </button>
        {result.ok && result.report.canExport && (
          <button type="button" className="btn btn-primary" onClick={() => goto('export')}>
            {canContinueAnyway(result) ? 'Continue anyway' : 'Continue to export'}
          </button>
        )}
      </div>
    </div>
  )
}
