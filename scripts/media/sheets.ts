/**
 * The input every picture and every shot in the launch media is built from.
 *
 * The project's claim is that it turns two chat-generated images into a working
 * mascot, so the honest thing to photograph is the pipeline doing exactly that.
 * What it must not photograph is a real person's face, or the fifty-three
 * gallery characters, which are Kamran Ahmed's artwork rather than this
 * project's. So the input is drawn instead: `src/studio` holds original
 * code-drawn characters, and rendering one onto the flat `#00FF00` the prompts
 * ask for produces a sheet pair shaped exactly like what a chat model hands
 * back. Those sheets then go through the real `runPipeline`, unmodified.
 *
 * The rendered sheets are a build artefact, written into the gitignored
 * `media/sheets/`. Nothing drawn by the studio is ever committed as a README
 * image; only the pipeline's own output is.
 */
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { runPipeline } from '../../src/core/pipeline'
import { DEFAULT_PIPELINE_OPTIONS } from '../../src/core/types'
import type { PipelineResult, RawImage, SheetInput, SheetKind } from '../../src/core/types'
import { STUDIO_PRESETS, renderSheet } from '../../src/studio/index'
import type { StudioPreset } from '../../src/studio/presets'
import { studioFactory, writeImage } from './surface'

export const SHEET_DIR = join('media', 'sheets')

/**
 * 400px cells, so a sheet is 1200px square: comfortably over the validator's
 * 200px `minCellSide` and well under `MAX_PROCESS_SIDE`, which keeps the
 * `downscaled` note out of every screenshot.
 */
export const CELL = 400

export function presetById(id: string): StudioPreset {
  const preset = STUDIO_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`no studio preset ${id}; have ${STUDIO_PRESETS.map((p) => p.id).join(', ')}`)
  return preset
}

export interface SheetPair {
  /** How the pair is named on disk and in the log. */
  readonly label: string
  readonly characterName: string
  readonly directions: RawImage
  readonly reactions: RawImage
  readonly directionsFile: string
  readonly reactionsFile: string
}

function green(id: string, kind: SheetKind): RawImage {
  return renderSheet(presetById(id).config, kind, {
    cell: CELL, background: 'green', createCanvas: studioFactory,
  })
}

/**
 * A green-backed sheet pair, cached on disk.
 *
 * `reactionsFrom` exists so a deliberately mismatched pair can be built: two
 * different characters is precisely the mistake a visitor makes when they run
 * Message 2 in a fresh chat instead of the one holding their directions image,
 * and it is what the checker's `palette-mismatch` note is for.
 */
export function sheetPair(label: string, directionsFrom: string, reactionsFrom = directionsFrom): SheetPair {
  mkdirSync(SHEET_DIR, { recursive: true })
  const directions = green(directionsFrom, 'directions')
  const reactions = green(reactionsFrom, 'reactions')
  const directionsFile = join(SHEET_DIR, `${label}-directions.png`)
  const reactionsFile = join(SHEET_DIR, `${label}-reactions.png`)
  if (!existsSync(directionsFile)) writeImage(directionsFile, directions)
  if (!existsSync(reactionsFile)) writeImage(reactionsFile, reactions)
  return {
    label,
    characterName: presetById(directionsFrom).name,
    directions,
    reactions,
    directionsFile,
    reactionsFile,
  }
}

function input(kind: SheetKind, image: RawImage, label: string): SheetInput {
  return {
    kind,
    image,
    meta: {
      fileName: `${label}-${kind}.png`,
      mimeType: 'image/png',
      originalWidth: image.width,
      originalHeight: image.height,
      downscaled: false,
    },
  }
}

/** The pair, through the real pipeline, with the real default options. */
export function runOn(pair: SheetPair): PipelineResult {
  return runPipeline(
    {
      directions: input('directions', pair.directions, pair.label),
      reactions: input('reactions', pair.reactions, pair.label),
    },
    DEFAULT_PIPELINE_OPTIONS,
  )
}

/** The character every piece of media leads with. */
export const LEAD = 'fox'
/** The character the mismatched pair's reactions sheet is drawn from. */
export const WRONG = 'jonas'

/* --------------------------- imitating a chat model --------------------------- */

/**
 * A small, deterministic per-cell wobble.
 *
 * The studio blits one pose-free body into all nine cells, so a sheet it draws
 * is already perfectly consistent -- which makes it a poor demonstration of the
 * aligner, because there is nothing to align. An image model does not work that
 * way: it redraws the character nine times, and each one lands at a slightly
 * different size and height. This reproduces that, so the before-and-after
 * picture in the README shows the aligner doing real work on input shaped like
 * the input it was written for.
 *
 * It is cosmetic jitter applied to the INPUT, never to a result. Any README
 * picture built from a jittered sheet says so in its caption.
 */
export function jitter(image: RawImage, seed: number): RawImage {
  const cell = Math.round(image.width / 3)
  const out = new Uint8ClampedArray(image.data.length)
  // Pure background, so the untouched margins stay keyable.
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 0
    out[i + 1] = 255
    out[i + 2] = 0
    out[i + 3] = 255
  }
  let state = seed >>> 0
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  for (let index = 0; index < 9; index += 1) {
    const col = index % 3
    const row = Math.floor(index / 3)
    // +/-4% of a cell in size, +/-3% in position: the order of drift a 3x3
    // sheet from a chat model actually comes back with.
    const scale = 1 + (next() - 0.5) * 0.08
    const dx = (next() - 0.5) * 0.06 * cell
    const dy = (next() - 0.5) * 0.06 * cell
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        // Sample the source for this destination pixel, about the cell centre.
        const sx = Math.round((x - cell / 2 - dx) / scale + cell / 2) + col * cell
        const sy = Math.round((y - cell / 2 - dy) / scale + cell / 2) + row * cell
        if (sx < col * cell || sx >= (col + 1) * cell || sy < row * cell || sy >= (row + 1) * cell) continue
        const from = (sy * image.width + sx) * 4
        const to = ((row * cell + y) * image.width + col * cell + x) * 4
        out[to] = image.data[from] ?? 0
        out[to + 1] = image.data[from + 1] ?? 255
        out[to + 2] = image.data[from + 2] ?? 0
        out[to + 3] = 255
      }
    }
  }
  return { width: image.width, height: image.height, data: out }
}

/** The same pair, with both sheets wobbled as a chat model would wobble them. */
export function wobbled(pair: SheetPair, seed = 20261020): SheetPair {
  const directions = jitter(pair.directions, seed)
  const reactions = jitter(pair.reactions, seed + 977)
  const label = `${pair.label}-wobbled`
  const directionsFile = join(SHEET_DIR, `${label}-directions.png`)
  const reactionsFile = join(SHEET_DIR, `${label}-reactions.png`)
  mkdirSync(SHEET_DIR, { recursive: true })
  if (!existsSync(directionsFile)) writeImage(directionsFile, directions)
  if (!existsSync(reactionsFile)) writeImage(reactionsFile, reactions)
  return { ...pair, label, directions, reactions, directionsFile, reactionsFile }
}
