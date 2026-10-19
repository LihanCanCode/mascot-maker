/**
 * mascot-maker shared contracts. Written by the lead; agents import, never edit.
 *
 * Pipeline concepts, thresholds and the runtime component are ported from
 * page-mascot -- MIT License, Copyright (c) 2026 Kamran Ahmed. See THIRD_PARTY_NOTICES.md.
 *
 * Conventions:
 *  - Every shape is readonly. Functions never mutate inputs; they return new objects/buffers.
 *    Filling a buffer you allocated inside the same function is fine.
 *  - Pixel coordinates: origin top-left, x right, y down.
 *  - Constants suffixed `At341` are tuned for 341-px cells (a 1024-px sheet) and are scaled
 *    by (directions cell height / 341) at runtime.
 */

/* ================================================================== raster */

export interface RawImage {
  readonly width: number
  readonly height: number
  /** RGBA8, row-major, straight (non-premultiplied) alpha. length === width * height * 4. */
  readonly data: Uint8ClampedArray
}

export interface Mask {
  readonly width: number
  readonly height: number
  /** One byte per pixel, 0 or 1, row-major. */
  readonly data: Uint8Array
}

export interface Labels {
  readonly width: number
  readonly height: number
  /** 0 = not in mask; 1..count = component id. */
  readonly data: Int32Array
  readonly count: number
  /** areas[id] = pixel count of component id; areas[0] === 0; length === count + 1. */
  readonly areas: readonly number[]
}

/** Half-open rectangle: x0 <= x < x1, y0 <= y < y1. Width = x1 - x0. */
export interface Box {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

export interface Rgba extends Rgb {
  readonly a: number
}

/** CIE L*a*b*, D65. */
export interface Lab {
  readonly l: number
  readonly a: number
  readonly b: number
}

/** Uniform scale + translation: dest = src * scale + (tx, ty). */
export interface ScaleTranslate {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

/* ================================================================== sheets & cells */

export const SHEET_KINDS = ['directions', 'reactions'] as const
export type SheetKind = (typeof SHEET_KINDS)[number]

/** Row-major cell order of the directions sheet. Must match Mascot.tsx and page-mascot.js. */
export const DIRECTION_NAMES = [
  'up-left', 'up', 'up-right',
  'left', 'center', 'right',
  'down-left', 'down', 'down-right',
] as const
export type Direction = (typeof DIRECTION_NAMES)[number]

/**
 * Row-major cell order of the reactions sheet. Must match Mascot.tsx and page-mascot.js.
 * Index 4 is drawn as "starstruck" by the prompt but keeps the upstream runtime name 'wink'
 * (the boop logic never shows it).
 */
export const REACTION_NAMES = [
  'blink', 'heart', 'sparkle',
  'surprised', 'wink', 'bashful',
  'sleepy', 'dizzy', 'delighted',
] as const
export type Reaction = (typeof REACTION_NAMES)[number]

export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export const CELL_INDICES: readonly CellIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export interface SheetMeta {
  readonly fileName: string
  readonly mimeType: string
  readonly originalWidth: number
  readonly originalHeight: number
  /** True when the adapter shrank the image to fit MAX_PROCESS_SIDE. */
  readonly downscaled: boolean
}

export interface SheetInput {
  readonly kind: SheetKind
  readonly image: RawImage
  readonly meta: SheetMeta
}

/* ================================================================== styles & key colours */

export const STYLE_PRESETS = [
  'colour', 'ink', 'sketch', 'riso', 'paper', 'pixel', 'anime', 'cartoon',
] as const
export type StylePreset = (typeof STYLE_PRESETS)[number]

export const KEY_COLOUR_NAMES = ['green', 'magenta', 'blue'] as const
export type KeyColourName = (typeof KEY_COLOUR_NAMES)[number]

export interface KeyColourSpec {
  readonly name: KeyColourName
  readonly rgb: Rgb
  readonly hex: string
  /** Exact wording used inside prompts. */
  readonly phrase: string
}

export const KEY_COLOURS: Readonly<Record<KeyColourName, KeyColourSpec>> = {
  green: { name: 'green', rgb: { r: 0, g: 255, b: 0 }, hex: '#00FF00', phrase: 'pure bright green (#00FF00)' },
  magenta: { name: 'magenta', rgb: { r: 255, g: 0, b: 255 }, hex: '#FF00FF', phrase: 'pure magenta (#FF00FF)' },
  blue: { name: 'blue', rgb: { r: 0, g: 0, b: 255 }, hex: '#0000FF', phrase: 'pure bright blue (#0000FF)' },
}

/* ================================================================== keyer */

export interface KeyOptions {
  /** Colour the prompt asked for; null = auto-detection only. */
  readonly expected: KeyColourName | null
  /** Lab distance at/below which a pixel is pure background (key.py TOL_LOW). Raised for noisy backgrounds. */
  readonly tolLow: number
  /** Lab distance at/above which a pixel is fully kept (key.py TOL_HIGH). */
  readonly tolHigh: number
  /** Minimum max-min channel spread of a keyable colour (key.py SATURATED). */
  readonly minSaturation: number
  /** Minimum share of corner pixels matching the background (key.py UNIFORM). */
  readonly minUniformity: number
  /** Minimum share of the sheet keying must remove. */
  readonly minKeyedFraction: number
  /** Checkerboard confidence at/above which the sheet is rejected. */
  readonly checkerboardReject: number
  /** Width (px) of the edge ring that gets spill suppression; 0 disables. */
  readonly spillRadius: number
  /** Alpha-only edge softening radius (px); 0 disables. Never raises alpha. */
  readonly featherRadius: number
}

export type KeyFailureReason =
  | 'checkerboard'
  | 'neutral-background'
  | 'non-uniform-background'
  | 'too-little-keyed'

export interface KeyStats {
  readonly checkerboardConfidence: number
  /** Detected checker square size in px, 0 if none. */
  readonly checkerboardSquare: number
  /** Best-3-of-4 corner agreement with the detected colour, 0..1. */
  readonly uniformity: number
  /** Share of the sheet with final alpha < 5. */
  readonly keyedFraction: number
  /** Share of key-coloured candidate pixels kept because they are enclosed by the character. */
  readonly protectedFraction: number
  /** Effective tolLow after noise adaptation. */
  readonly tolLowUsed: number
  /** Small corner marks (e.g. watermarks) erased. */
  readonly cornerMarksRemoved: number
}

export interface KeySuccess {
  readonly ok: true
  readonly mode: 'keyed' | 'existing-alpha'
  readonly image: RawImage
  /** Detected background colour; null in existing-alpha mode. */
  readonly colour: Rgb | null
  readonly hex: string | null
  /** CIE76 distance from detected colour to KEY_COLOURS[expected]; null when not applicable. */
  readonly expectedDeltaE: number | null
  readonly stats: KeyStats
}

export interface KeyFailure {
  readonly ok: false
  readonly reason: KeyFailureReason
  readonly colour: Rgb | null
  readonly hex: string | null
  readonly stats: KeyStats
}

export type KeyResult = KeySuccess | KeyFailure

/* ================================================================== slicer */

export interface SliceOptions {
  readonly detectGrid: boolean
  /** Search window around each expected internal cut, as a fraction of the content span. */
  readonly gutterSearch: number
  /** Column/row coverage at/above which it is a drawn grid line, not art. */
  readonly ruleLineCoverage: number
  /** Column/row coverage at/below which it counts as empty gutter. */
  readonly gutterCoverage: number
  /** Edge band in px used by dropBleed. */
  readonly bleedBand: number
  /** Alpha above which a pixel is opaque for dropBleed. */
  readonly bleedAlpha: number
}

export interface GridSpec {
  /** Ascending: 0, c1, c2, width. */
  readonly xCuts: readonly [number, number, number, number]
  /** Ascending: 0, r1, r2, height. */
  readonly yCuts: readonly [number, number, number, number]
  readonly method: 'gutters' | 'equal'
  /** 0..1; 1 = all four internal cuts landed in clean empty gutters. */
  readonly confidence: number
}

export interface Cell {
  readonly sheet: SheetKind
  /** Position in the (possibly column-swapped) 3x3 order. */
  readonly index: CellIndex
  readonly image: RawImage
  /** Region of the keyed sheet this cell came from. */
  readonly sourceBox: Box
  /** Edge-touching fragments erased by dropBleed. */
  readonly fragmentsRemoved: number
}

export interface SliceResult {
  readonly grid: GridSpec
  /** Exactly 9, row-major, cells[i].index === i. */
  readonly cells: readonly Cell[]
  readonly ruleLinesRemoved: number
  /** Components on the whole keyed sheet with area >= 0.5% of it. Expect 9. */
  readonly significantBlobCount: number
}

/* ================================================================== measure */

export interface EdgeContact {
  readonly top: boolean
  readonly bottom: boolean
  readonly left: boolean
  readonly right: boolean
}

export interface CellMetrics {
  readonly width: number
  readonly height: number
  readonly isEmpty: boolean
  /** Largest 8-connected component of alpha > ALPHA.anchor. */
  readonly bodyBox: Box | null
  /** All pixels with alpha > ALPHA.content, floating symbols included. */
  readonly contentBox: Box | null
  /** Body pixels within (shoulderBand * height) px above the body's bottom row. */
  readonly shoulderBox: Box | null
  readonly bodyArea: number
  /** bodyArea / (width * height). */
  readonly bodyCoverage: number
  /** Components of alpha > ALPHA.silhouette with area >= 4. */
  readonly componentCount: number
  readonly edgeContact: EdgeContact
  /** Widest body row within the top 55% of the body. */
  readonly headWidth: number
  /** shoulderBox width; 0 when there is none. */
  readonly shoulderWidth: number
  /** Inside bodyBox: share of pixels with 10 < alpha < 245 (character colour near the key). */
  readonly translucentFraction: number
}

/* ================================================================== aligner */

export interface AlignOptions {
  /** Shoulder band height as a fraction of cell height (build.py SHOULDER_BAND). */
  readonly shoulderBand: number
  /** Per-cell scale clamp when the anchor is noisy (build.py SCALE_CLAMP). */
  readonly scaleClampNoisy: number
  /** Per-cell scale clamp when the anchor is steady. */
  readonly scaleClampSteady: number
  /** Anchor-width noise above which the noisy clamp applies. */
  readonly noiseThreshold: number
  /** Max cross-sheet rescale of the reactions sheet (build.py MATCH_CLAMP). */
  readonly matchClamp: number
  /** Fraction down the body where the cross-sheet fit silhouette starts (build.py FIT_BAND). */
  readonly fitBand: number
  /** Cross-sheet vertical search range in quarter-resolution px. */
  readonly fitShiftQuarterPx: number
  /** Fraction down the body where the settle band starts (build.py lower_band 0.66). */
  readonly settleBand: number
  /** Per-frame settle search range at 341-px cells (build.py SETTLE). */
  readonly settleRangeAt341: number
  /** Where every character's bottom edge lands down the tile (build.py BOTTOM_ANCHOR). */
  readonly bottomAnchor: number
  readonly cropPadTopAt341: number
  readonly cropPadSideAt341: number
}

export interface FrameAlignment {
  readonly sheet: SheetKind
  readonly index: CellIndex
  /** Maps source-cell pixels to the unit tile square [0,1] x [0,1]. */
  readonly toTile: ScaleTranslate
  /** True when the per-cell scale hit the clamp. */
  readonly scaleClamped: boolean
  /** False when the cell had no shoulder box and was centred instead. */
  readonly anchored: boolean
  /** Per-frame vertical settle in canvas px (reactions only; 0 for directions). */
  readonly settleDy: number
}

export interface CrossSheetFit {
  readonly scale: number
  /** Vertical shift in canvas px. */
  readonly shift: number
  /** Soft IoU of the two shoulder silhouettes after the fit, 0..1. */
  readonly overlap: number
}

export interface AlignResult {
  /** 9 entries, index order. */
  readonly directions: readonly FrameAlignment[]
  /** 9 entries, index order. */
  readonly reactions: readonly FrameAlignment[]
  readonly anchorNoise: number
  readonly scaleClamp: number
  readonly crossSheet: CrossSheetFit
  /** Side of the square crop in canvas px. */
  readonly cropSide: number
}

export type AlignOutcome =
  | { readonly ok: true; readonly value: AlignResult }
  | { readonly ok: false; readonly reason: 'too-few-anchors'; readonly anchoredCells: number }

/* ================================================================== composer */

export const CELL_SIZE_PRESETS = [256, 360, 512] as const
export const MIN_CELL_SIZE = 128
export const MAX_CELL_SIZE = 1024

export interface ComposeOptions {
  /** Output tile side in px; each sheet is 3 * cellSize square. */
  readonly cellSize: number
  readonly sampling: 'smooth' | 'nearest'
  readonly fade: boolean
  /** Bottom fade depth as a fraction of the tile (build.py FADE_DEPTH). */
  readonly fadeDepth: number
}

export interface ComposedMascot {
  readonly cellSize: number
  readonly directions: RawImage
  readonly reactions: RawImage
  readonly directionTiles: readonly RawImage[]
  readonly reactionTiles: readonly RawImage[]
}

/* ================================================================== validator */

export type Severity = 'error' | 'warning' | 'info'
export type RedoTarget = 'directions' | 'reactions' | 'both' | 'none'

export type IssueCode =
  | 'checkerboard'
  | 'neutral-background'
  | 'non-uniform-background'
  | 'too-little-keyed'
  | 'key-colour-mismatch'
  | 'existing-alpha'
  | 'corner-marks-removed'
  | 'lossy-source'
  | 'low-resolution'
  | 'odd-aspect'
  | 'downscaled'
  | 'grid-uncertain'
  | 'grid-mismatch'
  | 'rule-lines-removed'
  | 'fragments-removed'
  | 'empty-cell'
  | 'touches-edge'
  | 'touches-bottom'
  | 'wide-feature'
  | 'low-coverage'
  | 'high-coverage'
  | 'size-outlier'
  | 'character-near-key'
  | 'body-inconsistent'
  | 'shoulders-too-wide'
  | 'unanchored-cell'
  | 'scale-clamped'
  | 'boop-shift'
  | 'width-change'
  | 'palette-mismatch'
  | 'check-mirrored'

export interface Issue {
  /** Stable key: `${code}:${sheet ?? 'pair'}:${cellIndex ?? 'all'}`. */
  readonly id: string
  readonly code: IssueCode
  readonly severity: Severity
  /** True = no usable output until fixed. */
  readonly blocking: boolean
  readonly sheet: SheetKind | null
  readonly cellIndex: CellIndex | null
  /** What is wrong, plain English. */
  readonly message: string
  /** What to do, plain English; names the prompt to redo. */
  readonly fix: string
  readonly redo: RedoTarget
  readonly metric: number | null
}

export interface QualityMetrics {
  /** Directions shoulder-width spread across cells, percent (screen.py). */
  readonly shoulderSpreadPct: number | null
  /** Shoulder width / head width on the directions center cell (screen.py). */
  readonly headShoulderRatio: number | null
  /** Worst body movement on boop, px at boopDisplayPx (verify.py). */
  readonly boopShiftPx: number | null
  /** Lowest band IoU between a reaction frame and the directions center frame. */
  readonly minBandOverlap: number | null
  /** Histogram intersection of the two sheets' body colours, 0..1. */
  readonly paletteMatch: number | null
  /** |reactions - directions| shoulder width / directions shoulder width. */
  readonly widthChange: number | null
}

export interface ValidationThresholds {
  readonly shoulderSpreadWarnPct: number
  readonly shoulderSpreadErrorPct: number
  readonly headShoulderMarginal: number
  readonly headShoulderTooWide: number
  readonly boopDisplayPx: number
  readonly boopSearchAt360: number
  readonly boopBandTop: number
  readonly boopBandBottom: number
  readonly boopWarnPx: number
  readonly boopErrorPx: number
  readonly paletteErrorBelow: number
  readonly paletteWarnBelow: number
  readonly widthChangeWarn: number
  readonly widthChangeError: number
  readonly emptyCoverage: number
  readonly lowCoverage: number
  readonly highCoverage: number
  readonly sizeOutlier: number
  readonly edgePixelsAt341: number
  readonly wideFeatureCells: number
  readonly translucentWarn: number
  readonly keyMismatchDeltaE: number
  readonly minCellSide: number
  readonly maxAspect: number
  readonly gridConfidenceWarn: number
}

export interface ValidationReport {
  /** Sorted: blocking errors, errors, warnings, info; then sheet, then cell. */
  readonly issues: readonly Issue[]
  readonly metrics: QualityMetrics
  readonly verdict: 'ready' | 'usable-with-warnings' | 'redo'
  readonly canExport: boolean
}

/* ================================================================== pipeline */

export interface SheetAnalysis {
  readonly kind: SheetKind
  readonly meta: SheetMeta
  readonly key: KeyResult
  /** null when keying failed. */
  readonly slice: SliceResult | null
  /** 9 entries in cell order; empty when slice is null. */
  readonly metrics: readonly CellMetrics[]
}

export interface PipelineInput {
  readonly directions: SheetInput
  readonly reactions: SheetInput
}

export interface PipelineOptions {
  readonly key: KeyOptions
  readonly slice: SliceOptions
  readonly align: AlignOptions
  readonly compose: ComposeOptions
  readonly thresholds: ValidationThresholds
  readonly swapDirectionColumns: boolean
}

export type PipelineStage =
  | 'keying'
  | 'slicing'
  | 'measuring'
  | 'aligning'
  | 'composing'
  | 'validating'
  | 'done'

export interface PipelineProgress {
  readonly stage: PipelineStage
  readonly sheet: SheetKind | null
  /** Overall 0..1, monotonic. */
  readonly fraction: number
}

export type ProgressCallback = (progress: PipelineProgress) => void

export interface PipelineSuccess {
  readonly ok: true
  readonly directions: SheetAnalysis
  readonly reactions: SheetAnalysis
  readonly alignment: AlignResult
  readonly output: ComposedMascot
  readonly report: ValidationReport
}

export interface PipelineFailure {
  readonly ok: false
  readonly directions: SheetAnalysis
  readonly reactions: SheetAnalysis
  readonly report: ValidationReport
}

export type PipelineResult = PipelineSuccess | PipelineFailure

/* ================================================================== prompts */

export interface CharacterBrief {
  /** Used for file names and the screen-reader label. */
  readonly name: string
  /** One sentence: colours plus two or three distinguishing features. */
  readonly describe: string
  readonly style: StylePreset
  /** True = first message uses the REFERENCE (photo) prompt. */
  readonly usePhoto: boolean
  /** User override; null = pickKeyColour(describe). */
  readonly key: KeyColourName | null
}

export interface PromptPair {
  readonly firstKind: 'directions' | 'reference'
  readonly first: string
  readonly second: string
  readonly key: KeyColourName
}

export type DescribeWarningCode =
  | 'too-short'
  | 'no-colours'
  | 'long-hair'
  | 'held-prop'
  | 'wide-feature'
  | 'mentions-transparency'

export interface DescribeWarning {
  readonly code: DescribeWarningCode
  readonly message: string
}

export type ChatProvider = 'gemini' | 'chatgpt'

export interface ChatGuide {
  readonly id: ChatProvider
  readonly name: string
  readonly steps: readonly string[]
  readonly tips: readonly string[]
}

/* ================================================================== embed */

export interface EmbedOptions {
  readonly name: string
  /** Where the user will serve the files, e.g. '/mascots'. Sanitised before use. */
  readonly basePath: string
  /** Rendered size in px; clamped to 48..512. */
  readonly size: number
  readonly label: string
}

export interface EmbedAssetNames {
  readonly directions: string
  readonly reactions: string
  readonly script: 'page-mascot.js'
  readonly component: 'Mascot.tsx'
}

export interface EmbedBundle {
  readonly assetNames: EmbedAssetNames
  readonly react: string
  readonly html: string
  /** Raw source of src/mascot/Mascot.tsx. */
  readonly componentSource: string
  /** Raw source of src/embed/page-mascot.js. */
  readonly scriptSource: string
}

/* ================================================================== defaults */

/** Alpha thresholds used across measure/align/compose/validate (from build.py / verify.py / screen.py). */
export const ALPHA = {
  content: 8,
  fade: 40,
  silhouette: 100,
  band: 120,
  anchor: 128,
  solid: 200,
} as const

export const MAX_PROCESS_SIDE = 2048
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MIN_UPLOAD_SIDE = 300
export const MAX_UPLOAD_SIDE = 8192
export const REFERENCE_CELL = 341

export const DEFAULT_KEY_OPTIONS: KeyOptions = {
  expected: null,
  tolLow: 6,
  tolHigh: 26,
  minSaturation: 100,
  minUniformity: 0.9,
  minKeyedFraction: 0.2,
  checkerboardReject: 0.5,
  spillRadius: 2,
  featherRadius: 1,
}

export const DEFAULT_SLICE_OPTIONS: SliceOptions = {
  detectGrid: true,
  gutterSearch: 0.1,
  ruleLineCoverage: 0.85,
  gutterCoverage: 0.002,
  bleedBand: 2,
  bleedAlpha: 40,
}

export const DEFAULT_ALIGN_OPTIONS: AlignOptions = {
  shoulderBand: 0.05,
  scaleClampNoisy: 0.1,
  scaleClampSteady: 0.35,
  noiseThreshold: 0.03,
  matchClamp: 0.2,
  fitBand: 0.86,
  fitShiftQuarterPx: 40,
  settleBand: 0.66,
  settleRangeAt341: 26,
  bottomAnchor: 0.93,
  cropPadTopAt341: 8,
  cropPadSideAt341: 16,
}

export const DEFAULT_COMPOSE_OPTIONS: ComposeOptions = {
  cellSize: 360,
  sampling: 'smooth',
  fade: true,
  fadeDepth: 0.12,
}

export const DEFAULT_THRESHOLDS: ValidationThresholds = {
  shoulderSpreadWarnPct: 8,
  shoulderSpreadErrorPct: 20,
  headShoulderMarginal: 0.95,
  headShoulderTooWide: 1.1,
  boopDisplayPx: 140,
  boopSearchAt360: 24,
  boopBandTop: 0.55,
  boopBandBottom: 0.78,
  boopWarnPx: 2,
  boopErrorPx: 4,
  paletteErrorBelow: 0.22,
  paletteWarnBelow: 0.4,
  widthChangeWarn: 0.08,
  widthChangeError: 0.12,
  emptyCoverage: 0.005,
  lowCoverage: 0.03,
  highCoverage: 0.6,
  sizeOutlier: 0.2,
  edgePixelsAt341: 15,
  wideFeatureCells: 4,
  translucentWarn: 0.08,
  keyMismatchDeltaE: 25,
  minCellSide: 200,
  maxAspect: 1.6,
  gridConfidenceWarn: 0.5,
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  key: DEFAULT_KEY_OPTIONS,
  slice: DEFAULT_SLICE_OPTIONS,
  align: DEFAULT_ALIGN_OPTIONS,
  compose: DEFAULT_COMPOSE_OPTIONS,
  thresholds: DEFAULT_THRESHOLDS,
  swapDirectionColumns: false,
}
