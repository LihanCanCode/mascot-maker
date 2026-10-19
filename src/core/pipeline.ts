/**
 * runPipeline: key -> slice -> measure (both sheets) -> gate -> align -> compose -> validate.
 * Imports the other agents' modules only through their barrels.
 */
import { alignSheets } from './aligner'
import { composeMascot } from './composer'
import { keySheet } from './keyer'
import { measureCell } from './measure'
import { sliceSheet } from './slicer'
import { REFERENCE_CELL } from './types'
import type {
  Issue, KeyStats, PipelineFailure, PipelineInput, PipelineOptions, PipelineResult, PipelineStage,
  ProgressCallback, QualityMetrics, SheetAnalysis, SheetInput, ValidationReport,
} from './types'
import { buildReport, validatePair, validateSheet } from './validator'

const EDGE_BAND_MIN_PX = 6
const MIN_SHEET_SIDE = 3

const BLANK_KEY_STATS: KeyStats = {
  checkerboardConfidence: 0,
  checkerboardSquare: 0,
  uniformity: 0,
  keyedFraction: 0,
  protectedFraction: 0,
  tolLowUsed: 0,
  cornerMarksRemoved: 0,
}

const NULL_METRICS: QualityMetrics = {
  shoulderSpreadPct: null,
  headShoulderRatio: null,
  boopShiftPx: null,
  minBandOverlap: null,
  paletteMatch: null,
  widthChange: null,
}

type Emit = (stage: PipelineStage, sheet: SheetInput['kind'] | null, fraction: number) => void

/** Wraps the callback so fractions never go backwards. */
function makeEmitter(onProgress: ProgressCallback | undefined): Emit {
  let last = 0
  return (stage, sheet, fraction) => {
    last = Math.max(last, fraction)
    onProgress?.({ stage, sheet, fraction: last })
  }
}

function analyseSheet(
  input: SheetInput,
  options: PipelineOptions,
  emit: Emit,
  base: number,
): SheetAnalysis {
  const kind = input.kind
  emit('keying', kind, base)
  if (Math.min(input.image.width, input.image.height) < MIN_SHEET_SIDE) {
    // Too small to key or cut: report it as an unusable sheet instead of throwing.
    const key = { ok: false as const, reason: 'too-little-keyed' as const, colour: null, hex: null, stats: BLANK_KEY_STATS }
    return { kind, meta: input.meta, key, slice: null, metrics: [] }
  }
  const key = keySheet(input.image, options.key)
  if (!key.ok) return { kind, meta: input.meta, key, slice: null, metrics: [] }
  emit('slicing', kind, base + 0.13)
  const swap = kind === 'directions' && options.swapDirectionColumns
  const slice = sliceSheet(key.image, kind, options.slice, swap)
  emit('measuring', kind, base + 0.2)
  const metrics = slice.cells.map((cell) => {
    const unit = cell.image.height / REFERENCE_CELL
    const edgePixels = Math.max(EDGE_BAND_MIN_PX, Math.round(options.thresholds.edgePixelsAt341 * unit))
    return measureCell(cell.image, options.align, edgePixels)
  })
  return { kind, meta: input.meta, key, slice, metrics }
}

function mergeIssues(...groups: ReadonlyArray<readonly Issue[]>): Issue[] {
  const seen = new Set<string>()
  const merged: Issue[] = []
  for (const issue of groups.flat()) {
    if (seen.has(issue.id)) continue
    seen.add(issue.id)
    merged.push(issue)
  }
  return merged
}

function failure(
  directions: SheetAnalysis,
  reactions: SheetAnalysis,
  report: ValidationReport,
  emit: Emit,
): PipelineFailure {
  emit('done', null, 1)
  // A failed run can never be exported, whatever the report builder says.
  return { ok: false, directions, reactions, report: { ...report, canExport: false, verdict: 'redo' } }
}

export function runPipeline(
  input: PipelineInput,
  options: PipelineOptions,
  onProgress?: ProgressCallback,
): PipelineResult {
  const emit = makeEmitter(onProgress)
  const directions = analyseSheet(input.directions, options, emit, 0.02)
  const reactions = analyseSheet(input.reactions, options, emit, 0.3)
  const t = options.thresholds
  const sheetIssues = [...validateSheet(directions, t), ...validateSheet(reactions, t)]

  if (!directions.key.ok || !reactions.key.ok) {
    emit('validating', null, 0.9)
    return failure(directions, reactions, buildReport(sheetIssues, NULL_METRICS), emit)
  }

  const dirSlice = directions.slice
  const reactSlice = reactions.slice
  if (!dirSlice || !reactSlice) throw new Error('internal: keyed sheet without a slice')
  emit('aligning', null, 0.6)
  const aligned = alignSheets(dirSlice.cells, reactSlice.cells, directions.metrics, reactions.metrics, options.align)
  if (!aligned.ok) {
    emit('validating', null, 0.9)
    const pair = validatePair(directions, reactions, null, null, t)
    return failure(directions, reactions, buildReport(mergeIssues(sheetIssues, pair.issues), pair.metrics), emit)
  }

  emit('composing', null, 0.72)
  const output = composeMascot(dirSlice.cells, reactSlice.cells, aligned.value, options.compose)
  emit('validating', null, 0.9)
  const pair = validatePair(directions, reactions, aligned.value, output, t)
  const report = buildReport(mergeIssues(sheetIssues, pair.issues), pair.metrics)
  emit('done', null, 1)
  return { ok: true, directions, reactions, alignment: aligned.value, output, report }
}
