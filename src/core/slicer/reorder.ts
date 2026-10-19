/** Fixes a mirrored directions sheet by swapping the left and right columns. */
const SWAP_ORDER = [2, 1, 0, 5, 4, 3, 8, 7, 6] as const

export function swapOuterColumns<T>(cells: readonly T[]): T[] {
  if (cells.length !== 9) throw new RangeError(`expected 9 cells, got ${cells.length}`)
  return SWAP_ORDER.map((from) => cells[from]!)
}
