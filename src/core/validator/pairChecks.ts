/** Checks that need both sheets: shoulder spread, proportions, alignment and verify.py gates. */
import type {
  AlignResult, CellIndex, ComposedMascot, FrameAlignment, Issue, IssueCode, QualityMetrics, Severity, SheetAnalysis,
  ValidationThresholds,
} from '../types'
import { makeIssue } from './advice'
import { computeVerifyMetrics } from './verifyMetrics'

const CENTRE = 4
/** Below the warning tier, still worth a quiet note. */
const SPREAD_INFO_PCT = 3
const BOOP_INFO_PX = 1

/** error at/above `error`, warning at/above `warn`, info at/above `info`, else null. */
function tier(value: number, info: number, warn: number, error: number): Severity | null {
  if (value >= error) return 'error'
  if (value >= warn) return 'warning'
  return value >= info ? 'info' : null
}

function shoulderSpreadPct(a: SheetAnalysis): number | null {
  const widths = a.metrics.filter((m) => m.shoulderBox !== null).map((m) => m.shoulderWidth)
  if (widths.length < 2) return null
  const mean = widths.reduce((x, y) => x + y, 0) / widths.length
  return (100 * (Math.max(...widths) - Math.min(...widths))) / mean
}

function headShoulderRatio(a: SheetAnalysis): number | null {
  const m = a.metrics[CENTRE]
  return m && m.headWidth > 0 && m.shoulderWidth > 0 ? m.shoulderWidth / m.headWidth : null
}

function proportionIssues(spread: number | null, ratio: number | null, t: ValidationThresholds): Issue[] {
  const out: Issue[] = []
  const spreadTier = spread === null ? null : tier(spread, SPREAD_INFO_PCT, t.shoulderSpreadWarnPct, t.shoulderSpreadErrorPct)
  if (spread !== null && spreadTier) {
    const note =
      spreadTier === 'info'
        ? 'a little uneven, which is normal'
        : spreadTier === 'warning'
          ? 'the result is usable but may wobble slightly'
          : 'the mascot will visibly jump around'
    out.push(makeIssue('body-inconsistent', spreadTier, false, 'directions', null,
      `The body width varies by ${spread.toFixed(1)}% between directions drawings: ${note}.`, spread))
  }
  if (ratio !== null && ratio >= t.headShoulderMarginal) {
    const wide = ratio >= t.headShoulderTooWide
    out.push(makeIssue('shoulders-too-wide', wide ? 'warning' : 'info', false, 'directions', null,
      `Shoulders are ${ratio.toFixed(2)}x the head width.`, ratio))
  }
  return out
}

function alignmentIssues(frames: readonly FrameAlignment[]): Issue[] {
  return frames.flatMap((f) => {
    const out: Issue[] = []
    const idx: CellIndex = f.index
    if (!f.anchored) out.push(makeIssue('unanchored-cell', 'warning', false, f.sheet, idx, `Cell ${idx + 1}: shoulders not found, centred instead.`, null))
    if (f.scaleClamped) out.push(makeIssue('scale-clamped', 'warning', false, f.sheet, idx, `Cell ${idx + 1}: needed an unusually large resize.`, null))
    return out
  })
}

function verifyIssues(m: Pick<QualityMetrics, 'boopShiftPx' | 'paletteMatch' | 'widthChange'>, t: ValidationThresholds): Issue[] {
  const out: Issue[] = []
  const push = (code: IssueCode, severity: Severity, message: string, metric: number): void => {
    out.push(makeIssue(code, severity, false, 'reactions', null, message, metric))
  }
  // The 1e-9 keeps the comparisons strict (> threshold), as before the three-tier grading.
  const boop = m.boopShiftPx === null ? null : tier(m.boopShiftPx, BOOP_INFO_PX + 1e-9, t.boopWarnPx + 1e-9, t.boopErrorPx + 1e-9)
  if (m.boopShiftPx !== null && boop) {
    const note =
      boop === 'info'
        ? 'barely noticeable'
        : boop === 'warning'
          ? 'usable, but it may wobble slightly'
          : 'it would visibly jump'
    push('boop-shift', boop, `The mascot would move about ${m.boopShiftPx.toFixed(1)}px when clicked: ${note}.`, m.boopShiftPx)
  }
  if (m.widthChange !== null && m.widthChange > t.widthChangeWarn) {
    push('width-change', m.widthChange > t.widthChangeError ? 'error' : 'warning',
      `The body width changes by ${Math.round(m.widthChange * 100)}% between sheets.`, m.widthChange)
  }
  if (m.paletteMatch !== null && m.paletteMatch < t.paletteWarnBelow) {
    push('palette-mismatch', m.paletteMatch < t.paletteErrorBelow ? 'error' : 'warning',
      `Only ${Math.round(m.paletteMatch * 100)}% of the colours match between sheets.`, m.paletteMatch)
  }
  return out
}

const NO_VERIFY = { boopShiftPx: null, minBandOverlap: null, paletteMatch: null, widthChange: null } as const

export function pairIssues(
  dirs: SheetAnalysis,
  alignment: AlignResult | null,
  output: ComposedMascot | null,
  t: ValidationThresholds,
): { issues: readonly Issue[]; metrics: QualityMetrics } {
  const shoulderSpread = shoulderSpreadPct(dirs)
  const ratio = headShoulderRatio(dirs)
  const verify = output ? computeVerifyMetrics(output, t) : NO_VERIFY
  const issues = [
    ...proportionIssues(shoulderSpread, ratio, t),
    ...(alignment ? [...alignmentIssues(alignment.directions), ...alignmentIssues(alignment.reactions)] : []),
    ...verifyIssues(verify, t),
  ]
  return { issues, metrics: { shoulderSpreadPct: shoulderSpread, headShoulderRatio: ratio, ...verify } }
}
