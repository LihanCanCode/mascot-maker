/**
 * Drawn grid lines: thin columns/rows that are almost entirely opaque. Lines are erased
 * (with a 1 px halo for the antialiased fringe) before the grid is detected.
 */
import type { RawImage, SliceOptions } from '../types'

const LINE_ALPHA = 100
const MAX_THICKNESS_FRACTION = 0.01
const HALO = 1

export interface RuleLines {
  /** Every pixel column that belongs to a line, ascending. */
  readonly columns: readonly number[]
  /** Every pixel row that belongs to a line, ascending. */
  readonly rows: readonly number[]
}

function coverage(img: RawImage, byColumn: boolean): number[] {
  const outer = byColumn ? img.width : img.height
  const inner = byColumn ? img.height : img.width
  const out: number[] = []
  for (let a = 0; a < outer; a++) {
    let opaque = 0
    for (let b = 0; b < inner; b++) {
      const i = byColumn ? (b * img.width + a) * 4 : (a * img.width + b) * 4
      if (img.data[i + 3]! > LINE_ALPHA) opaque++
    }
    out.push(opaque / inner)
  }
  return out
}

function thinRuns(cov: readonly number[], minCoverage: number): number[] {
  const maxThickness = Math.max(1, Math.floor(cov.length * MAX_THICKNESS_FRACTION))
  const found: number[] = []
  let i = 0
  while (i < cov.length) {
    if (cov[i]! < minCoverage) {
      i++
      continue
    }
    let j = i
    while (j < cov.length && cov[j]! >= minCoverage) j++
    if (j - i <= maxThickness) for (let k = i; k < j; k++) found.push(k)
    i = j
  }
  return found
}

export function findRuleLines(img: RawImage, options: SliceOptions): RuleLines {
  return {
    columns: thinRuns(coverage(img, true), options.ruleLineCoverage),
    rows: thinRuns(coverage(img, false), options.ruleLineCoverage),
  }
}

/** Number of distinct lines (runs of adjacent indices). */
export function countRuns(indices: readonly number[]): number {
  return indices.filter((v, i) => i === 0 || v !== indices[i - 1]! + 1).length
}

export function eraseRuleLines(img: RawImage, lines: RuleLines): RawImage {
  const data = new Uint8ClampedArray(img.data)
  for (const c of lines.columns) {
    for (let x = Math.max(0, c - HALO); x <= Math.min(img.width - 1, c + HALO); x++) {
      for (let y = 0; y < img.height; y++) data[(y * img.width + x) * 4 + 3] = 0
    }
  }
  for (const r of lines.rows) {
    for (let y = Math.max(0, r - HALO); y <= Math.min(img.height - 1, r + HALO); y++) {
      for (let x = 0; x < img.width; x++) data[(y * img.width + x) * 4 + 3] = 0
    }
  }
  return { width: img.width, height: img.height, data }
}
