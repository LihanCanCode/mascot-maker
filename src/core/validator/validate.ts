import type {
  AlignResult, ComposedMascot, Issue, QualityMetrics, SheetAnalysis, ValidationReport, ValidationThresholds,
} from '../types'
import { pairIssues } from './pairChecks'
import { validateSheet } from './sheetChecks'

export { validateSheet }

export function validatePair(
  dirs: SheetAnalysis,
  reacts: SheetAnalysis,
  alignment: AlignResult | null,
  output: ComposedMascot | null,
  t: ValidationThresholds,
): { issues: readonly Issue[]; metrics: QualityMetrics } {
  const pair = pairIssues(dirs, alignment, output, t)
  return {
    issues: [...validateSheet(dirs, t), ...validateSheet(reacts, t), ...pair.issues],
    metrics: pair.metrics,
  }
}

function rank(i: Issue): number {
  if (i.blocking) return 0
  return i.severity === 'error' ? 1 : i.severity === 'warning' ? 2 : 3
}

const SHEET_ORDER = { directions: 0, reactions: 1 } as const

function compare(a: Issue, b: Issue): number {
  const sheet = (i: Issue): number => (i.sheet ? SHEET_ORDER[i.sheet] : 2)
  return (
    rank(a) - rank(b) ||
    sheet(a) - sheet(b) ||
    (a.cellIndex ?? -1) - (b.cellIndex ?? -1) ||
    a.id.localeCompare(b.id)
  )
}

export function buildReport(issues: readonly Issue[], metrics: QualityMetrics): ValidationReport {
  const sorted = [...issues].sort(compare)
  const verdict = sorted.some((i) => i.severity === 'error')
    ? 'redo'
    : sorted.some((i) => i.severity === 'warning')
      ? 'usable-with-warnings'
      : 'ready'
  return { issues: sorted, metrics, verdict, canExport: !sorted.some((i) => i.blocking) }
}
