/**
 * Shared prompt text. Ported from page-mascot generate.py (MIT, Copyright (c) 2026 Kamran Ahmed),
 * key route only: chat UIs cannot return an alpha channel, and one mention of transparency
 * anywhere brings the painted checkerboard back, so no text here ever raises the idea.
 */
import { KEY_COLOURS } from '../core/types'
import type { KeyColourName } from '../core/types'

const BACKGROUND_SLOT = '{{BACKGROUND}}'

const RULES_TEMPLATE = `LAYOUT: 3 columns by 3 rows, evenly spaced, ${BACKGROUND_SLOT}. Each drawing is head plus upper shoulders, centred in its cell, same character and same head size in all nine cells.

FRAMING: a PORTRAIT BUST. Head, neck and shoulders only. NO arms, NO hands, NO legs, NO lower body. The shoulders are the lowest thing in the cell.

PROPORTIONS: a BIG HEAD chibi that still has a real body. The head is large and dominant, and the shoulders are roughly TWO THIRDS the width of the head -- narrower than the head, but clearly there. Do NOT draw a floating head.

THE RULE THAT MATTERS MOST: draw the BODY ONCE and reuse it. The neck, chest and shoulders must be the EXACT SAME SHAPE in the EXACT SAME POSITION in all nine cells, identical pixels if you can. The body always faces the viewer. Do NOT redraw the body in profile when the head turns. Only the head rotates, on top of an unchanging body.

THE BODY IS ONE FIXED SHAPE: the same shoulders, the same collar/neckline, the same garment, the same width, cut off by the same flat horizontal line at the same height in every cell, as if the nine heads were nine different heads placed on the same unchanging torso. Only the head turns. That flat cut-off edge must sit clearly above the cell's bottom edge, leaving a visible gap; never let the shoulders run down to the bottom of the cell.

MARGINS -- this is what goes wrong most often, so follow it literally: each character must sit ENTIRELY INSIDE its own cell with a wide empty gap on all four sides. Draw it at roughly 75% of the cell height, centred, leaving clear empty space above the head AND below the shoulders. The shoulders must STOP WELL SHORT of the bottom edge of the cell -- do not let the body run off the bottom or bleed into the cell underneath. Nothing may touch or cross a cell boundary. Shrink the character equally in every cell if that is what it takes.`

export const EXPRESSIONS = `1. Eyes closed as two upward curved arcs. No symbol.
2. Same closed arc eyes, plus one clearly visible SMALL RED HEART floating in the empty space above the head. The heart must be present.
3. Same closed arc eyes, plus THREE SMALL YELLOW SPARKLE STARS above the head.
4. Eyes wide open and very round, mouth open in a small round O of surprise.
5. Starstruck: both eyes drawn as bright star shapes, big happy smile.
6. Eyes closed arcs, strong pink blush on both cheeks.
7. Eyes closed sleeping curves, plus a small blue "z z z" above the head.
8. Both eyes drawn as spiral swirls, wavy wobbly mouth. Dizzy.
9. Eyes closed arcs, mouth wide open in a big happy grin.`

/** Said up front because it measurably helps the two sheets agree. */
export const FIRST_OF_TWO =
  'This is the first of two matching sheets; a second sheet of the same character will follow, ' +
  'so keep the design simple to repeat exactly.'

export const DIRECTION_ROWS = `Row 1: up-left, up, up-right. Row 2: left, straight at the viewer, right.
Row 3: down-left, down, down-right.`

export const NO_SYMBOLS = 'NO hearts, NO sparkles, NO "zzz", NO spiral eyes -- no floating symbols of any kind.'

/** Said first and again last in the expressions prompt: models copy the head turns from the attached sheet. */
export const STRAIGHT_ON =
  'The attached sheet shows heads turned in different directions. DO NOT copy those head turns. ' +
  'Every one of the nine cells here must be the same straight front view as the centre cell of the ' +
  'attached sheet (row 2, column 2), head level, eyes looking at the viewer except where an expression ' +
  'changes them. Only the face and the three floating symbols differ between cells.'

export const STRAIGHT_ON_REMINDER =
  'REMINDER: do not copy the head turns from the attached sheet. All nine heads face straight at the ' +
  'viewer, level; only the expressions and the three floating symbols differ.'

export function rules(key: KeyColourName): string {
  const background = `a solid flat ${KEY_COLOURS[key].phrase} background filling the whole cell`
  return RULES_TEMPLATE.replace(BACKGROUND_SLOT, () => background)
}

export function tail(key: KeyColourName): string {
  return (
    'No text, no labels, no borders, no drop shadows. The background is one flat ' +
    `uniform ${KEY_COLOURS[key].phrase} covering the entire canvas edge to edge, with no ` +
    'gradient, texture, pattern or checkerboard, and nothing else on it. ' +
    'Square image, at least 1024x1024.'
  )
}
