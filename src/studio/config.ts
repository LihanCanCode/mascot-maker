// Config defaults + validation. `normaliseConfig` is the only way configs enter the renderer.
import {
  BROW_STYLES, CHEEK_FLUFFS, EAR_TYPES, EYE_PATCHES, EYE_SIZES, FACE_SHAPES, FACIAL_HAIRS, GLASSES, HAIR_STYLES,
  HEADWEARS, LASHES, LIDS, NECKLINES, SHIRT_DETAILS,
} from './types'
import type { CheekFluff, EarType, StudioConfig } from './types'

export const DEFAULT_CONFIG: StudioConfig = Object.freeze({
  skin: '#f2c29b', muzzle: '#fff1e0', earInner: '#f4a3b5', earTip: '#3b2a33', earColor: null, noseColor: '#4a2d3c',
  faceShape: 'round', ears: 'human', cheekFluff: 'none', eyePatch: 'none', patchColor: '#2b1d33',
  hairStyle: 'messy', hairColor: '#2b2230', facialHairColor: null, facialHair: 'none',
  eyeColor: '#5b3a2a', eyeSize: 'medium', lashes: 'none', lids: 'normal', brows: 'soft',
  glasses: 'none', glassesColor: '#2a1c2e', blush: true, blushColor: '#ff8aa8',
  headwear: 'none', headwearColor: '#e8505b',
  shirt: '#5b7bd5', neckline: 'crew', shirtDetail: 'none', accent: '#ffcf4a', outline: '#2b1d33',
})

const COLOUR_KEYS = [
  'skin', 'muzzle', 'earInner', 'earTip', 'noseColor', 'patchColor', 'hairColor', 'eyeColor', 'glassesColor',
  'blushColor', 'headwearColor', 'shirt', 'accent', 'outline',
] as const

const ENUMS: Readonly<Record<string, readonly string[]>> = {
  faceShape: FACE_SHAPES, ears: EAR_TYPES, cheekFluff: CHEEK_FLUFFS, eyePatch: EYE_PATCHES, hairStyle: HAIR_STYLES,
  facialHair: FACIAL_HAIRS, eyeSize: EYE_SIZES, lashes: LASHES, lids: LIDS, brows: BROW_STYLES, glasses: GLASSES,
  headwear: HEADWEARS, neckline: NECKLINES, shirtDetail: SHIRT_DETAILS,
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function normaliseColour(key: string, value: unknown): string {
  if (typeof value !== 'string' || !HEX.test(value)) {
    throw new RangeError(`${key}: expected a #rgb or #rrggbb colour, got ${JSON.stringify(value)}`)
  }
  const h = value.slice(1).toLowerCase()
  return `#${h.length === 3 ? h.replace(/(.)/g, '$1$1') : h}`
}

function autoFluff(ears: EarType): CheekFluff {
  if (ears === 'fox') return 'ruff'
  return ears === 'cat' ? 'fluff' : 'none'
}

function checkValue(key: string, value: unknown): unknown {
  if ((COLOUR_KEYS as readonly string[]).includes(key)) return normaliseColour(key, value)
  const options = ENUMS[key]
  if (options) {
    if (typeof value !== 'string' || !options.includes(value)) {
      throw new RangeError(`${key}: expected one of ${options.join(', ')}, got ${JSON.stringify(value)}`)
    }
    return value
  }
  if (key === 'blush') {
    if (typeof value !== 'boolean') throw new RangeError(`blush: expected a boolean, got ${JSON.stringify(value)}`)
    return value
  }
  if (key === 'facialHairColor' || key === 'earColor') return value === null ? null : normaliseColour(key, value)
  throw new RangeError(`unknown config key: ${key}`)
}

/** Validate a partial config, fill defaults and return a frozen, fully-populated config. */
export function normaliseConfig(partial: Partial<StudioConfig>): StudioConfig {
  if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
    throw new RangeError('config must be an object')
  }
  const checked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) checked[key] = checkValue(key, value)
  }
  const merged = { ...DEFAULT_CONFIG, ...checked } as StudioConfig
  const cheekFluff = checked['cheekFluff'] === undefined ? autoFluff(merged.ears) : merged.cheekFluff
  return Object.freeze({ ...merged, cheekFluff })
}
