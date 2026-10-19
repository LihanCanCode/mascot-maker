import { createImage } from '../raster'
import type { AlignResult, Cell, ComposeOptions, ComposedMascot, FrameAlignment, RawImage } from '../types'
import { applyBottomFade } from './fade'
import { renderTile } from './renderTile'

const GRID = 3
const CELLS = GRID * GRID

/** Places nine square tiles in a 3x3 sheet of side 3 * cellSize. */
export function composeSheet(tiles: readonly RawImage[], cellSize: number): RawImage {
  if (tiles.length !== CELLS) throw new RangeError(`composeSheet needs ${CELLS} tiles, got ${tiles.length}`)
  const side = cellSize * GRID
  const sheet = createImage(side, side)
  tiles.forEach((tile, k) => {
    if (tile.width !== cellSize || tile.height !== cellSize) {
      throw new RangeError(`tile ${k} is ${tile.width}x${tile.height}, expected ${cellSize}`)
    }
    const ox = (k % GRID) * cellSize
    const oy = Math.floor(k / GRID) * cellSize
    for (let y = 0; y < cellSize; y++) {
      const from = y * cellSize * 4
      sheet.data.set(tile.data.subarray(from, from + cellSize * 4), ((oy + y) * side + ox) * 4)
    }
  })
  return sheet
}

function renderSheetTiles(
  cells: readonly Cell[],
  frames: readonly FrameAlignment[],
  o: ComposeOptions,
): RawImage[] {
  if (cells.length !== CELLS || frames.length !== CELLS) {
    throw new RangeError('composeMascot needs nine cells and nine frame alignments per sheet')
  }
  return cells.map((cell, i) => {
    const tile = renderTile(cell.image, frames[i]!.toTile, o)
    return o.fade ? applyBottomFade(tile, o.fadeDepth) : tile
  })
}

export function composeMascot(
  dirs: readonly Cell[],
  reacts: readonly Cell[],
  alignment: AlignResult,
  o: ComposeOptions,
): ComposedMascot {
  const directionTiles = renderSheetTiles(dirs, alignment.directions, o)
  const reactionTiles = renderSheetTiles(reacts, alignment.reactions, o)
  return {
    cellSize: o.cellSize,
    directions: composeSheet(directionTiles, o.cellSize),
    reactions: composeSheet(reactionTiles, o.cellSize),
    directionTiles,
    reactionTiles,
  }
}
