import { bestRowShift } from '../measure/shift'
import type { Mask } from '../types'

/**
 * Step 3: per reaction frame, the vertical nudge (canvas px) that best lands its lower band
 * on the directions centre frame's lower band (build.py settle). Ties go to smallest |dy|.
 */
export function settleFrames(reference: Mask, frames: readonly Mask[], range: number): readonly number[] {
  return frames.map((f) => bestRowShift(reference, f, range).dy)
}
