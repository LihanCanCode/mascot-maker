import type { Issue, RedoTarget, ValidationReport } from '../../core/types'
import { cellLabel, issuesForCell, type CellRef } from '../state/selectors'

interface Props {
  report: ValidationReport
  selected: CellRef | null
  onClearFilter: () => void
  onShowPrompt: (redo: RedoTarget) => void
  onReplaceImage: () => void
}

const SEVERITY_TEXT: Readonly<Record<Issue['severity'], string>> = {
  error: 'Problem',
  warning: 'Note',
  info: 'Info',
}

function IssueItem({ issue, onShowPrompt, onReplaceImage }: { issue: Issue } & Pick<Props, 'onShowPrompt' | 'onReplaceImage'>) {
  const canRedo = issue.redo !== 'none'
  const where =
    issue.sheet !== null && issue.cellIndex !== null ? cellLabel(issue.sheet, issue.cellIndex) : issue.sheet
  return (
    <li className="issue" data-severity={issue.severity}>
      <p className="issue-head">
        <span className="badge" data-severity={issue.severity}>
          {SEVERITY_TEXT[issue.severity]}
          {issue.blocking ? ', blocks export' : ''}
        </span>
        {where !== null && <span className="muted">{where}</span>}
      </p>
      <p className="issue-message">{issue.message}</p>
      <p className="issue-fix">{issue.fix}</p>
      {canRedo && (
        <div className="issue-actions">
          <button type="button" className="btn btn-small" onClick={() => onShowPrompt(issue.redo)}>
            Show prompt
          </button>
          <button type="button" className="btn btn-small" onClick={onReplaceImage}>
            Replace image
          </button>
        </div>
      )}
    </li>
  )
}

export function IssueList({ report, selected, onClearFilter, onShowPrompt, onReplaceImage }: Props) {
  const issues = issuesForCell(report, selected)
  return (
    <section aria-labelledby="issues-heading" className="issues">
      <div className="issues-head">
        <h3 id="issues-heading">{selected ? `Notes for ${cellLabel(selected.sheet, selected.index)}` : 'Notes'}</h3>
        {selected && (
          <button type="button" className="btn btn-small" onClick={onClearFilter}>
            Show all notes
          </button>
        )}
      </div>
      {issues.length === 0 ? (
        <p className="muted">{selected ? 'Nothing to flag on this cell.' : 'Nothing to flag. Nice work.'}</p>
      ) : (
        <ul className="issue-list">
          {issues.map((issue) => (
            <IssueItem key={issue.id} issue={issue} onShowPrompt={onShowPrompt} onReplaceImage={onReplaceImage} />
          ))}
        </ul>
      )}
    </section>
  )
}
