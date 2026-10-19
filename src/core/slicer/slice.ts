/** Cuts a keyed sheet into 9 cells: erase rule lines, detect the grid, crop, drop bleed. */
import { cropImage, labelComponents } from '../raster'
import type { Cell, CellIndex, RawImage, SheetKind, SliceOptions, SliceResult } from '../types'
import { dropBleed } from './bleed'
import { detectGrid } from './grid'
import { swapOuterColumns } from './reorder'
import { countRuns, eraseRuleLines, findRuleLines } from './ruleLines'

const BLOB_ALPHA = 100
const BLOB_AREA_FRACTION = 0.005
const MIN_SIDE = 3

function significantBlobs(img: RawImage): number {
  const mask = new Uint8Array(img.width * img.height)
  for (let p = 0; p < mask.length; p++) mask[p] = img.data[p * 4 + 3]! > BLOB_ALPHA ? 1 : 0
  const labels = labelComponents({ width: img.width, height: img.height, data: mask }, 8)
  const minArea = img.width * img.height * BLOB_AREA_FRACTION
  return labels.areas.slice(1).filter((a) => a >= minArea).length
}

export function sliceSheet(
  img: RawImage,
  kind: SheetKind,
  options: SliceOptions,
  swapColumns: boolean,
): SliceResult {
  if (img.width < MIN_SIDE || img.height < MIN_SIDE) {
    throw new RangeError(`sheet ${img.width}x${img.height} is too small to cut into a 3x3 grid`)
  }
  const lines = findRuleLines(img, options)
  const clean = eraseRuleLines(img, lines)
  const grid = detectGrid(clean, options)
  const raw: Omit<Cell, 'index'>[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sourceBox = { x0: grid.xCuts[c]!, y0: grid.yCuts[r]!, x1: grid.xCuts[c + 1]!, y1: grid.yCuts[r + 1]! }
      const bled = dropBleed(cropImage(clean, sourceBox), options.bleedBand, options.bleedAlpha)
      raw.push({ sheet: kind, image: bled.image, sourceBox, fragmentsRemoved: bled.removed })
    }
  }
  const ordered = swapColumns && kind === 'directions' ? swapOuterColumns(raw) : raw
  const cells = ordered.map((c, i): Cell => ({ ...c, index: i as CellIndex }))
  return {
    grid,
    cells,
    ruleLinesRemoved: countRuns(lines.columns) + countRuns(lines.rows),
    significantBlobCount: significantBlobs(clean),
  }
}
