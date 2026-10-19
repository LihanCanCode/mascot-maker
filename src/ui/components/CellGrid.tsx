import type { Cell, Severity, SheetKind } from '../../core/types'
import { cellLabel, type CellRef } from '../state/selectors'
import { RawImageCanvas } from './RawImageCanvas'

interface Props {
  sheet: SheetKind
  title: string
  cells: readonly Cell[]
  severities: readonly (Severity | null)[]
  selected: CellRef | null
  onSelect: (cell: CellRef | null) => void
}

const BADGE_TEXT: Readonly<Record<Severity, string>> = { error: 'Problem', warning: 'Note', info: 'Info' }

export function CellGrid({ sheet, title, cells, severities, selected, onSelect }: Props) {
  return (
    <section aria-label={title} className="cellgrid-wrap">
      <h3>{title}</h3>
      <div className="cellgrid">
        {cells.map((cell) => {
          const severity = severities[cell.index] ?? null
          const isSelected = selected?.sheet === sheet && selected.index === cell.index
          const label = cellLabel(sheet, cell.index)
          return (
            <button
              key={cell.index}
              type="button"
              className="cell"
              aria-pressed={isSelected}
              data-severity={severity ?? 'none'}
              onClick={() => onSelect(isSelected ? null : { sheet, index: cell.index })}
            >
              <RawImageCanvas image={cell.image} label={label} className="cell-canvas" />
              {severity !== null && (
                <span className="badge" data-severity={severity}>
                  {BADGE_TEXT[severity]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
