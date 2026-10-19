/** Per-sheet checks: keying, slicing and per-cell measurements. */
import { median } from '../aligner/withinSheet'
import type {
  CellIndex, CellMetrics, Issue, KeyFailure, KeySuccess, SheetAnalysis, SliceResult, ValidationThresholds,
} from '../types'
import { makeIssue } from './advice'

const FULL_GRID = 9
const pct = (v: number): string => `${Math.round(v * 100)}%`

function keyFailureIssue(a: SheetAnalysis, key: KeyFailure): Issue {
  const messages = {
    checkerboard: 'A grey-and-white checkerboard was drawn into the image instead of a solid background.',
    'neutral-background': 'The background is white, grey or black, which cannot be removed cleanly.',
    'non-uniform-background': 'The background is not one even colour.',
    'too-little-keyed': 'Hardly any of the image matched the background colour.',
  } as const
  const metric = key.reason === 'checkerboard' ? key.stats.checkerboardConfidence : key.stats.uniformity
  return makeIssue(key.reason, 'error', true, a.kind, null, messages[key.reason], metric)
}

function keyIssues(a: SheetAnalysis, key: KeySuccess, t: ValidationThresholds): Issue[] {
  const out: Issue[] = []
  if (key.mode === 'existing-alpha') {
    out.push(makeIssue('existing-alpha', 'info', false, a.kind, null, 'The image already has a transparent background.', null))
  }
  if (key.expectedDeltaE !== null && key.expectedDeltaE > t.keyMismatchDeltaE) {
    out.push(makeIssue('key-colour-mismatch', 'warning', false, a.kind, null,
      'The background colour differs from the colour the prompt asked for.', key.expectedDeltaE))
  }
  if (key.stats.cornerMarksRemoved > 0) {
    out.push(makeIssue('corner-marks-removed', 'info', false, a.kind, null,
      'A small mark in the corner of the image was removed.', key.stats.cornerMarksRemoved))
  }
  return out
}

function sourceIssues(a: SheetAnalysis): Issue[] {
  const out: Issue[] = []
  if (a.meta.mimeType === 'image/jpeg') {
    out.push(makeIssue('lossy-source', 'info', false, a.kind, null, 'This is a JPEG, which is what chat apps usually give.', null))
  }
  if (a.meta.downscaled) {
    out.push(makeIssue('downscaled', 'info', false, a.kind, null, 'The image was shrunk before processing.', null))
  }
  return out
}

function sliceIssues(a: SheetAnalysis, s: SliceResult, t: ValidationThresholds): Issue[] {
  const out: Issue[] = []
  const sides = s.cells.map((c) => [c.image.width, c.image.height] as const)
  const minSide = Math.min(...sides.map(([w, h]) => Math.min(w, h)))
  const aspect = Math.max(...sides.map(([w, h]) => Math.max(w, h) / Math.min(w, h)))
  if (minSide < t.minCellSide) {
    out.push(makeIssue('low-resolution', 'warning', false, a.kind, null, `Each drawing is only ${minSide}px across.`, minSide))
  }
  if (aspect > t.maxAspect) {
    out.push(makeIssue('odd-aspect', 'warning', false, a.kind, null, 'The drawings are much wider than tall (or the reverse).', aspect))
  }
  if (s.grid.confidence < t.gridConfidenceWarn) {
    out.push(makeIssue('grid-uncertain', 'warning', false, a.kind, null, 'The gaps between drawings are unclear.', s.grid.confidence))
  }
  if (s.significantBlobCount !== FULL_GRID) {
    out.push(makeIssue('grid-mismatch', 'error', false, a.kind, null,
      `Found ${s.significantBlobCount} separate drawings instead of 9.`, s.significantBlobCount))
  }
  if (s.ruleLinesRemoved > 0) {
    out.push(makeIssue('rule-lines-removed', 'info', false, a.kind, null, 'Drawn grid lines were removed.', s.ruleLinesRemoved))
  }
  const fragments = s.cells.reduce((n, c) => n + c.fragmentsRemoved, 0)
  if (fragments > 0) {
    out.push(makeIssue('fragments-removed', 'info', false, a.kind, null, 'Pieces of neighbouring drawings were removed.', fragments))
  }
  return out
}

function cellIssues(a: SheetAnalysis, i: number, m: CellMetrics, median_: number, t: ValidationThresholds): Issue[] {
  const idx = i as CellIndex
  if (m.isEmpty || m.bodyCoverage < t.emptyCoverage) {
    return [makeIssue('empty-cell', 'error', true, a.kind, idx, `Cell ${i + 1} has no character.`, m.bodyCoverage)]
  }
  const out: Issue[] = []
  const add = (...args: [Parameters<typeof makeIssue>[0], Parameters<typeof makeIssue>[1], string, number | null]): void => {
    out.push(makeIssue(args[0], args[1], false, a.kind, idx, args[2], args[3]))
  }
  if (m.bodyCoverage < t.lowCoverage) add('low-coverage', 'error', `Cell ${i + 1}: the character is tiny (${pct(m.bodyCoverage)} of the cell).`, m.bodyCoverage)
  if (m.bodyCoverage > t.highCoverage) add('high-coverage', 'warning', `Cell ${i + 1}: the character fills ${pct(m.bodyCoverage)} of the cell.`, m.bodyCoverage)
  const e = m.edgeContact
  if (e.top || e.left || e.right) add('touches-edge', 'warning', `Cell ${i + 1}: the character touches the cell edge.`, null)
  if (e.bottom) add('touches-bottom', 'info', `Cell ${i + 1}: the bust reaches the bottom edge (fine, it fades out).`, null)
  const height = m.bodyBox ? m.bodyBox.y1 - m.bodyBox.y0 : 0
  if (median_ > 0 && Math.abs(height / median_ - 1) > t.sizeOutlier) {
    add('size-outlier', 'warning', `Cell ${i + 1}: the character is a different size from the others.`, height / median_)
  }
  if (m.translucentFraction > t.translucentWarn) {
    add('character-near-key', 'warning', `Cell ${i + 1}: parts look see-through (close to the background colour).`, m.translucentFraction)
  }
  return out
}

export function validateSheet(a: SheetAnalysis, t: ValidationThresholds): readonly Issue[] {
  if (!a.key.ok) return [keyFailureIssue(a, a.key)]
  const out = [...keyIssues(a, a.key, t), ...sourceIssues(a)]
  if (a.slice) out.push(...sliceIssues(a, a.slice, t))
  const heights = a.metrics.flatMap((m) => (m.bodyBox && !m.isEmpty ? [m.bodyBox.y1 - m.bodyBox.y0] : []))
  const med = median(heights)
  a.metrics.forEach((m, i) => out.push(...cellIssues(a, i, m, med, t)))
  const wide = a.metrics.filter((m) => m.edgeContact.left || m.edgeContact.right).length
  if (wide >= t.wideFeatureCells) {
    out.push(makeIssue('wide-feature', 'error', false, a.kind, null,
      `${wide} drawings are cut off at the sides, which usually means a wide feature.`, wide))
  }
  if (a.kind === 'directions') {
    out.push(makeIssue('check-mirrored', 'info', false, 'directions', null, 'Check the left and right drawings face the right way.', null))
  }
  return out
}
