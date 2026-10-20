import type { CharacterBrief } from '../../core/types'
import type { SaveInput, SheetMimeType } from '../types'

export const BRIEF: CharacterBrief = {
  name: 'Foxy Pal',
  describe: 'An orange fox with a white-tipped tail and a green scarf',
  style: 'colour',
  usePhoto: true,
  key: null,
}

/** Deterministic bytes, so two calls with the same seed hash to the same signature. */
export function sheetBlob(seed: number, size = 64, mimeType: SheetMimeType = 'image/webp'): Blob {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i += 1) bytes[i] = (seed * 31 + i * 7) & 0xff
  return new Blob([bytes], { type: mimeType })
}

export function saveInput(overrides: Partial<SaveInput> = {}): SaveInput {
  return {
    name: 'Foxy Pal',
    brief: BRIEF,
    cellSize: 360,
    mimeType: 'image/webp',
    directions: sheetBlob(1),
    reactions: sheetBlob(2),
    ...overrides,
  }
}
