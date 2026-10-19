import {
  CELL_INDICES,
  DIRECTION_NAMES,
  REACTION_NAMES,
  type CellIndex,
  type Issue,
  type PipelineProgress,
  type PipelineResult,
  type Severity,
  type SheetKind,
  type ValidationReport,
} from '../../core/types'
import type { AppState, Files, StepId } from './appReducer'

export const STEPS: readonly { readonly id: StepId; readonly label: string }[] = [
  { id: 'setup', label: 'Describe' },
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Check' },
  { id: 'export', label: 'Export' },
]

export interface CellRef {
  readonly sheet: SheetKind
  readonly index: CellIndex
}

export function cellLabel(sheet: SheetKind, index: CellIndex): string {
  const names: readonly string[] = sheet === 'directions' ? DIRECTION_NAMES : REACTION_NAMES
  const title = sheet === 'directions' ? 'Directions' : 'Reactions'
  return `${title} cell ${index + 1}, ${names[index] ?? ''}`
}

const STEP_TITLES: Readonly<Record<AppState['step'], string>> = {
  setup: 'Describe your mascot',
  upload: 'Upload your two images',
  processing: 'Building your mascot',
  review: 'Check the result',
  export: 'Your mascot is ready',
}

/** Document title for the current step. */
export function stepTitle(state: AppState): string {
  return `${STEP_TITLES[state.step]} - Mascot Maker`
}

export function stepIndex(state: AppState): number {
  const id: StepId = state.step === 'processing' ? 'review' : state.step
  return STEPS.findIndex((s) => s.id === id)
}

export function reachableSteps(state: AppState): ReadonlySet<StepId> {
  const out = new Set<StepId>(['setup', 'upload'])
  if (state.step === 'processing') return out
  if (state.step === 'review' || state.step === 'export') {
    out.add('review')
    if (state.result.ok && state.result.report.canExport) out.add('export')
  }
  return out
}

/** Preview object URLs currently held in the file slots. */
export function previewUrls(files: Files): readonly string[] {
  return [files.directions, files.reactions].flatMap((slot) => (slot.status === 'ready' ? [slot.previewUrl] : []))
}

export function canProcess(files: Files): boolean {
  return files.directions.status === 'ready' && files.reactions.status === 'ready'
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 }

export function sortSeverity(severity: Severity): number {
  return SEVERITY_RANK[severity]
}

export function issuesForCell(report: ValidationReport, cell: CellRef | null): readonly Issue[] {
  if (cell === null) return report.issues
  return report.issues.filter((i) => i.sheet === cell.sheet && i.cellIndex === cell.index)
}

/** Worst severity per cell (index order) for one sheet; null = no issues on that cell. */
export function cellSeverities(report: ValidationReport, sheet: SheetKind): readonly (Severity | null)[] {
  return CELL_INDICES.map((index) => {
    const here = report.issues.filter((i) => i.sheet === sheet && i.cellIndex === index)
    return here.reduce<Severity | null>(
      (worst, i) => (worst === null || sortSeverity(i.severity) < sortSeverity(worst) ? i.severity : worst),
      null,
    )
  })
}

/** Non-blocking errors let people carry on at their own risk. */
export function canContinueAnyway(result: PipelineResult): boolean {
  return result.ok && result.report.canExport && result.report.verdict === 'redo'
}

interface VerdictCopy {
  readonly tone: 'good' | 'ok' | 'bad'
  readonly title: string
  readonly body: string
}

export function verdictCopy(report: ValidationReport): VerdictCopy {
  if (report.verdict === 'ready') {
    return { tone: 'good', title: 'Looking good', body: 'Both sheets lined up cleanly. You can export now.' }
  }
  if (report.verdict === 'usable-with-warnings') {
    return {
      tone: 'ok',
      title: 'Usable, with a few notes',
      body: 'Your mascot will work. The notes below explain how to make it a little better.',
    }
  }
  const blocked = !report.canExport
  return {
    tone: 'bad',
    title: blocked ? 'One of the images needs redoing' : 'Some things look off',
    body: blocked
      ? 'We could not build the mascot from these images. Follow the fixes below, then upload again.'
      : 'We built the mascot, but the checks found problems. You can fix them or continue anyway.',
  }
}

const STAGE_TEXT: Readonly<Record<PipelineProgress['stage'], string>> = {
  keying: 'Removing the background',
  slicing: 'Cutting the sheet into nine cells',
  measuring: 'Measuring each pose',
  aligning: 'Lining up shoulders across poses',
  composing: 'Building the final sprite sheets',
  validating: 'Running quality checks',
  done: 'All done',
}

export function stageLabel(progress: PipelineProgress): string {
  const base = STAGE_TEXT[progress.stage]
  if (progress.sheet === null) return base
  return `${base} (${progress.sheet} sheet)`
}
