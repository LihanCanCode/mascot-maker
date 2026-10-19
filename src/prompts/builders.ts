/**
 * The three chat prompts. Ported from page-mascot generate.py (MIT, Copyright (c) 2026
 * Kamran Ahmed), key route only. Line structure follows the original on purpose.
 */
import { KEY_COLOURS } from '../core/types'
import type { CharacterBrief, KeyColourName, PromptPair } from '../core/types'
import { isNonHumanSubject, normaliseDescribe } from './describeText'
import { pickKeyColour } from './keyColour'
import { DIRECTION_ROWS, EXPRESSIONS, FIRST_OF_TWO, NO_SYMBOLS, STRAIGHT_ON, STRAIGHT_ON_REMINDER, rules, tail } from './sections'
import { STYLE_PARAGRAPHS } from './styles'

const IDENTIFY_HUMAN =
  'hair shape and colour, facial hair, the shape and colour of any glasses, skin tone, and the colour of their top.'
const IDENTIFY_NON_HUMAN = 'the fur, feather or surface colours, markings, ears, tail and any accessories.'
const FALLBACK_DESCRIPTION = 'a cute chibi character'

export function directionsPrompt(brief: CharacterBrief, key: KeyColourName): string {
  const describe = normaliseDescribe(brief.describe) || FALLBACK_DESCRIPTION
  return `Generate a 3x3 grid sprite sheet of ${describe}. ${STYLE_PARAGRAPHS[brief.style]}

${FIRST_OF_TWO}

This sheet is NINE HEAD DIRECTIONS, not expressions -- the face keeps the same calm
expression in every cell and only the direction the head is TURNED changes.

${rules(key)}

Turn the whole head clearly, do not just move the eyes: looking left swings the nose or
muzzle left and brings the far ear or cheek into view.
${DIRECTION_ROWS}

${NO_SYMBOLS}
${tail(key)}`
}

export function referencePrompt(brief: CharacterBrief, key: KeyColourName): string {
  const describe = normaliseDescribe(brief.describe)
  const identify = isNonHumanSubject(describe) ? IDENTIFY_NON_HUMAN : IDENTIFY_HUMAN
  const identity = describe ? ` They are described as: ${describe}.` : ''
  // A photograph pulls the model toward photorealism unless it is told, in as many words,
  // to throw the rendering away and keep only the identifying features.
  return `The attached image shows a person or character. Redraw them as a 3x3 grid sprite
sheet of NINE HEAD DIRECTIONS, in a completely different style from the attached image.

${FIRST_OF_TWO}

DO NOT reproduce the photograph: not its realism, not its lighting, not its proportions, not
its level of detail. Restyle it completely into a BIG HEAD CHIBI CARTOON -- a head roughly one
and a half times the width of the shoulders, very large round friendly eyes far bigger than a
real person's, a simplified nose and mouth, thick clean outlines and soft cheek blush. Think
children's sticker, not portrait.

Keep ONLY the things that identify them: ${identify}${identity}
Simplify everything else away. ${STYLE_PARAGRAPHS[brief.style]}

The face keeps the same calm friendly expression in every cell; only the direction the head is
TURNED changes.

${rules(key)}

Turn the whole head clearly, do not just move the eyes.
${DIRECTION_ROWS}

${NO_SYMBOLS}
${tail(key)}`
}

export function reactionsPrompt(brief: CharacterBrief, key: KeyColourName): string {
  // The description is repeated on purpose: the attached sheet alone is treated as
  // inspiration and the character is quietly redrawn. Words as well as pixels hold it together.
  const describe = normaliseDescribe(brief.describe)
  const same = describe ? `The character is described as: ${describe}. ` : ''
  const look =
    brief.style === 'colour' ? '' : `Keep the ${brief.style} rendering style of the attached sheet exactly. `
  // The reference sheet arrives already keyed, so it shows an empty background while this
  // one is asked for a solid colour. Saying so stops the model copying what it can see.
  const where = `Draw it on the same solid ${KEY_COLOURS[key].phrase} background described below. `
  return `The attached image (the sheet you just drew) is a 3x3 head-direction sprite sheet. Produce the MATCHING
EXPRESSIONS sheet for that same character.

${STRAIGHT_ON}

${same}${look}${where}Copy the character from the attached image
exactly: the same colours, the same markings, the same fur or surface detail, the same line
weight. Every marking visible in the attached sheet must appear here too. Do not restyle,
simplify or redraw it.

NOT head directions. The character faces STRAIGHT AT THE VIEWER in all nine cells, head
perfectly straight. The only thing that changes between cells is the FACE, plus one small
floating symbol in three of them.

CRITICAL: same character, same art style, same palette, same line weight, same proportions,
and EXACTLY THE SAME SIZE AND POSITION IN THE CELL as the attached sheet. The chest and
shoulders must be the same drawing, the same width, and the same height off the bottom of
the cell as in the attached sheet, identical in all nine cells here. If the two sheets do
not line up the character visibly jumps, so match them.

Wide margin on all four sides, nothing touching a cell edge including the floating symbols,
and clear empty space below the shoulders.

The nine expressions, left to right, top to bottom:
${EXPRESSIONS}

${STRAIGHT_ON_REMINDER}

${tail(key)}`
}

export function buildPrompts(brief: CharacterBrief): PromptPair {
  const key = brief.key ?? pickKeyColour(brief.describe)
  return {
    firstKind: brief.usePhoto ? 'reference' : 'directions',
    first: brief.usePhoto ? referencePrompt(brief, key) : directionsPrompt(brief, key),
    second: reactionsPrompt(brief, key),
    key,
  }
}
