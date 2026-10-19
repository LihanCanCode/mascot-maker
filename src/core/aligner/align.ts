/**
 * alignSheets: within-sheet shoulder anchoring, cross-sheet fit, per-frame settle, crop.
 * All steps compose into ONE scale+translate per frame (single resample later).
 * Port of build.py --anchor shoulders -- page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import { bodyMask, fitBand, lowerBand } from '../measure/bands'
import { ALPHA, REFERENCE_CELL } from '../types'
import type {
  AlignOptions, AlignOutcome, Cell, CellIndex, CellMetrics, FrameAlignment, Mask, ScaleTranslate,
} from '../types'
import { cropFromBounds, mapBox, tileTransform } from './crop'
import { fitCrossSheet, matchTransform } from './crossSheet'
import { settleFrames } from './settle'
import { composeTransforms } from './transform'
import { warpMask, warpMaskQuarter } from './warp'
import { median, withinSheetTransforms } from './withinSheet'
import type { WithinSheetResult } from './withinSheet'

const MIN_ANCHORED_DIRECTIONS = 5
const CENTRE_CELL = 4

type Canvas = { width: number; height: number }

function fitMasks(cells: readonly Cell[], within: WithinSheetResult, o: AlignOptions): Mask[] {
  return cells.map((cell, i) => {
    const silhouette = fitBand(bodyMask(cell.image, ALPHA.silhouette), o.fitBand)
    return warpMaskQuarter(silhouette, within.transforms[i]!, within.canvas.width, within.canvas.height)
  })
}

function bandOnCanvas(cell: Cell, t: ScaleTranslate, canvas: Canvas, o: AlignOptions): Mask {
  const body = bodyMask(cell.image, ALPHA.band)
  return lowerBand(warpMask(body, t, canvas.width, canvas.height), o.settleBand)
}

function frameAlignments(
  sheet: 'directions' | 'reactions',
  within: WithinSheetResult,
  finals: readonly ScaleTranslate[],
  settle: readonly number[],
): FrameAlignment[] {
  return finals.map((toTile, i) => ({
    sheet,
    index: i as CellIndex,
    toTile,
    scaleClamped: within.clamped[i]!,
    anchored: within.anchored[i]!,
    settleDy: settle[i]!,
  }))
}

export function alignSheets(
  dirs: readonly Cell[],
  reacts: readonly Cell[],
  dirMetrics: readonly CellMetrics[],
  reactMetrics: readonly CellMetrics[],
  o: AlignOptions,
): AlignOutcome {
  const anchoredCells = dirMetrics.filter((m) => m.shoulderBox !== null).length
  if (anchoredCells < MIN_ANCHORED_DIRECTIONS) return { ok: false, reason: 'too-few-anchors', anchoredCells }

  const dirHeight = median(dirs.map((c) => c.image.height))
  const reactHeight = median(reacts.map((c) => c.image.height))
  const sheetScale = reactHeight > 0 ? dirHeight / reactHeight : 1
  const unit = dirHeight / REFERENCE_CELL

  const dirWithin = withinSheetTransforms(dirs, dirMetrics, dirs, dirMetrics, 1, o)
  const reactWithin = withinSheetTransforms(dirs, dirMetrics, reacts, reactMetrics, sheetScale, o)
  const canvas = dirWithin.canvas

  const fit = fitCrossSheet(fitMasks(dirs, dirWithin, o), fitMasks(reacts, reactWithin, o), canvas, o)
  const match = matchTransform(fit, canvas)
  const matched = reactWithin.transforms.map((t) => composeTransforms(t, match))

  const reference = bandOnCanvas(dirs[CENTRE_CELL]!, dirWithin.transforms[CENTRE_CELL]!, canvas, o)
  const bands = reacts.map((cell, i) => bandOnCanvas(cell, matched[i]!, canvas, o))
  const settle = settleFrames(reference, bands, Math.round(o.settleRangeAt341 * unit))
  const reactFinals = matched.map((t, i) => composeTransforms(t, { scale: 1, tx: 0, ty: settle[i]! }))

  const bounds = [
    ...dirs.map((c, i) => boundsOf(dirMetrics[i]!, dirWithin.transforms[i]!)),
    ...reacts.map((c, i) => boundsOf(reactMetrics[i]!, reactFinals[i]!)),
  ]
  const crop = cropFromBounds(bounds, o, unit, canvas)

  return {
    ok: true,
    value: {
      directions: frameAlignments('directions', dirWithin, dirWithin.transforms.map((t) => tileTransform(t, crop)), dirs.map(() => 0)),
      reactions: frameAlignments('reactions', reactWithin, reactFinals.map((t) => tileTransform(t, crop)), settle),
      anchorNoise: dirWithin.anchorNoise,
      scaleClamp: dirWithin.scaleClamp,
      crossSheet: fit,
      cropSide: crop.side,
    },
  }
}

function boundsOf(m: CellMetrics, t: ScaleTranslate): ReturnType<typeof mapBox> | null {
  return m.contentBox ? mapBox(m.contentBox, t) : null
}
