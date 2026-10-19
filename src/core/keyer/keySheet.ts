/**
 * Orchestrates keying in key.py order. Ported from page-mascot (MIT, Kamran Ahmed).
 * Order: existing alpha -> checkerboard -> background -> noise tolerance -> keyOut ->
 * corner marks -> spill -> feather.
 */
import { deltaE, rgbToHex, srgbToLab } from '../color/lab'
import { assertImage } from '../raster'
import { KEY_COLOURS } from '../types'
import type { KeyFailure, KeyOptions, KeyResult, KeyStats, RawImage, Rgb } from '../types'
import { detectBackground, hasExistingAlpha, isKeyable, noiseTolerance } from './background'
import { detectCheckerboard } from './checkerboard'
import { removeCornerMarks } from './cornerMarks'
import { keyOut } from './keyOut'
import { featherAlpha, suppressSpill } from './spill'

const ALPHA_GONE_BYTE = 5
const TOL_GAP = 20

const BLANK_STATS: KeyStats = {
  checkerboardConfidence: 0,
  checkerboardSquare: 0,
  uniformity: 0,
  keyedFraction: 0,
  protectedFraction: 0,
  tolLowUsed: 0,
  cornerMarksRemoved: 0,
}

function keyedShare(img: RawImage): number {
  const count = img.width * img.height
  let gone = 0
  for (let p = 0; p < count; p++) if (img.data[p * 4 + 3]! < ALPHA_GONE_BYTE) gone++
  return gone / count
}

function fail(reason: KeyFailure['reason'], colour: Rgb | null, stats: KeyStats): KeyFailure {
  return { ok: false, reason, colour, hex: colour ? rgbToHex(colour) : null, stats }
}

function existingAlpha(img: RawImage): KeyResult {
  return {
    ok: true,
    mode: 'existing-alpha',
    image: { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) },
    colour: null,
    hex: null,
    expectedDeltaE: null,
    stats: { ...BLANK_STATS, keyedFraction: keyedShare(img) },
  }
}

export function keySheet(img: RawImage, options: KeyOptions): KeyResult {
  assertImage(img)
  if (hasExistingAlpha(img)) return existingAlpha(img)

  const board = detectCheckerboard(img)
  const stats: KeyStats = {
    ...BLANK_STATS,
    checkerboardConfidence: board.confidence,
    checkerboardSquare: board.confidence > 0 ? board.square : 0,
  }
  if (board.confidence >= options.checkerboardReject) return fail('checkerboard', null, stats)

  const { colour, uniformity } = detectBackground(img, options.tolHigh)
  const seen = { ...stats, uniformity }
  if (!isKeyable(colour, options.minSaturation)) return fail('neutral-background', colour, seen)
  if (uniformity < options.minUniformity) return fail('non-uniform-background', colour, seen)

  const tolLow = noiseTolerance(img, colour, options.tolLow)
  const tolHigh = Math.max(options.tolHigh, tolLow + TOL_GAP)
  const keyed = keyOut(img, colour, tolLow, tolHigh)
  const withTol = { ...seen, tolLowUsed: tolLow, protectedFraction: keyed.protectedFraction }
  if (keyed.keyedFraction < options.minKeyedFraction) {
    return fail('too-little-keyed', colour, { ...withTol, keyedFraction: keyed.keyedFraction })
  }

  const marks = removeCornerMarks(keyed.image)
  const despilled = suppressSpill(marks.image, colour, options.spillRadius)
  const image = featherAlpha(despilled, options.featherRadius)
  const expected = options.expected
  const expectedDeltaE = expected
    ? deltaE(srgbToLab(colour), srgbToLab(KEY_COLOURS[expected].rgb))
    : null
  return {
    ok: true,
    mode: 'keyed',
    image,
    colour,
    hex: rgbToHex(colour),
    expectedDeltaE,
    stats: { ...withTol, keyedFraction: keyedShare(image), cornerMarksRemoved: marks.removed },
  }
}
