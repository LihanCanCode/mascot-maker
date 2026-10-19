/**
 * Mascot studio public API: code-drawn characters rendered to the two 3x3 sheets the pipeline
 * consumes. DOM-free; callers inject a canvas factory (see ./browser for the browser one).
 */
export { normaliseConfig, DEFAULT_CONFIG } from './config'
export { STUDIO_PRESETS } from './presets'
export type { PresetTag, StudioPreset } from './presets'
export { renderSheet, renderCell } from './render'
export { CELL_DEFAULT } from './rig'
export { symbolAnchor } from './parts/symbols'
export type {
  CanvasFactory, CanvasLike, SheetBackground, SheetKind, RenderOptions, StudioConfig,
} from './types'
export {
  BROW_STYLES, CHEEK_FLUFFS, EAR_TYPES, EYE_PATCHES, EYE_SIZES, FACE_SHAPES, FACIAL_HAIRS, GLASSES, HAIR_STYLES,
  HEADWEARS, LASHES, LIDS, NECKLINES, SHIRT_DETAILS,
} from './types'
