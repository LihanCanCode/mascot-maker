import { DEFAULT_THRESHOLDS } from '../types'
import type { ValidationThresholds } from '../types'

/**
 * Severity tiers calibrated on real free-chat output (JPEG, Gemini), where cells are looser than
 * the paid-API results the original page-mascot limits were tuned for:
 *   body spread  <3% quiet, 3-8% info, 8-20% warning (usable), >=20% error
 *   boop shift   <=1px quiet, 1-2px info, 2-4px warning (usable), >4px error (at 140px)
 * Use this as the pipeline's thresholds (or copy the four changed numbers into DEFAULT_THRESHOLDS).
 */
export const CALIBRATED_THRESHOLDS: ValidationThresholds = {
  ...DEFAULT_THRESHOLDS,
  shoulderSpreadWarnPct: 8,
  shoulderSpreadErrorPct: 20,
  boopWarnPx: 2,
  boopErrorPx: 4,
}
