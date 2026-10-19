import {
  DEFAULT_COMPOSE_OPTIONS, DEFAULT_KEY_OPTIONS, DEFAULT_PIPELINE_OPTIONS, MAX_CELL_SIZE, MIN_CELL_SIZE,
} from './types'
import type { KeyColourName, PipelineOptions, StylePreset } from './types'

/** Pipeline options for a style. Pixel art is sampled with nearest-neighbour. Pixel, ink and sketch skip alpha feathering, which would weaken 1 px strokes. */
export function optionsForStyle(
  style: StylePreset,
  expected: KeyColourName | null,
  cellSize: number,
  swapDirectionColumns: boolean,
): PipelineOptions {
  if (!Number.isInteger(cellSize) || cellSize < MIN_CELL_SIZE || cellSize > MAX_CELL_SIZE) {
    throw new RangeError(`cellSize must be an integer in ${MIN_CELL_SIZE}..${MAX_CELL_SIZE}, got ${cellSize}`)
  }
  const isPixel = style === 'pixel'
  const keepsThinStrokes = isPixel || style === 'ink' || style === 'sketch'
  return {
    ...DEFAULT_PIPELINE_OPTIONS,
    key: { ...DEFAULT_KEY_OPTIONS, expected, featherRadius: keepsThinStrokes ? 0 : DEFAULT_KEY_OPTIONS.featherRadius },
    compose: { ...DEFAULT_COMPOSE_OPTIONS, cellSize, sampling: isPixel ? 'nearest' : 'smooth' },
    swapDirectionColumns,
  }
}
