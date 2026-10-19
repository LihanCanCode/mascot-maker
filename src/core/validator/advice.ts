/**
 * The ONE place that holds plain-English fix copy and the redo target for every IssueCode.
 */
import type { CellIndex, Issue, IssueCode, RedoTarget, Severity, SheetKind } from '../types'

/** 'sheet' = redo the sheet the issue came from; 'key' = directions needs both. */
type RedoRule = RedoTarget | 'sheet' | 'key'

interface Advice {
  readonly fix: string
  readonly fixReactions?: string
  readonly redo: RedoRule
}

const KEY_FIX_DIRECTIONS =
  'Start a new chat and paste Message 1 exactly as given. Don\'t add words like "transparent" or "PNG". Then redo Message 2 so both sheets match.'
const KEY_FIX_REACTIONS =
  'Start a new chat, attach your directions image, and paste Message 2 exactly as given. Don\'t add words like "transparent" or "PNG".'
const NEW_SHEET = 'Generate this sheet again in a new chat with the same message.'
const REDO_BOTH = 'Redo both messages in a new chat so the two sheets match.'

const ADVICE: Readonly<Record<IssueCode, Advice>> = {
  checkerboard: { fix: KEY_FIX_DIRECTIONS, fixReactions: KEY_FIX_REACTIONS, redo: 'key' },
  'neutral-background': {
    fix: 'The background must be a solid vivid colour. Start a new chat and paste the message unchanged.',
    redo: 'key',
  },
  'non-uniform-background': {
    fix: 'The background has gradients or shadows. Start a new chat and paste the message unchanged.',
    redo: 'key',
  },
  'too-little-keyed': {
    fix: 'Almost no background was found. Make sure the character sits on the solid colour, then try a new chat.',
    redo: 'key',
  },
  'key-colour-mismatch': {
    fix: 'The background colour is not the one the prompt asked for, but it still worked. No action needed.',
    redo: 'none',
  },
  'existing-alpha': { fix: 'Your image already has transparency, so no background removal was needed.', redo: 'none' },
  'corner-marks-removed': { fix: 'A small corner mark (such as a watermark) was removed. No action needed.', redo: 'none' },
  'lossy-source': { fix: 'Chat apps usually give JPEG. That is fine, no action needed.', redo: 'none' },
  'low-resolution': {
    fix: 'The image is small, so the mascot may look soft. Download it at full size instead of screenshotting.',
    redo: 'sheet',
  },
  'odd-aspect': {
    fix: 'The cells are not square. Ask for a square image with a 3x3 grid and nothing else.',
    redo: 'sheet',
  },
  downscaled: { fix: 'Very large images are shrunk before processing. No action needed.', redo: 'none' },
  'grid-uncertain': {
    fix: 'The gaps between characters are unclear. Ask for clear empty space between the nine drawings.',
    redo: 'sheet',
  },
  'grid-mismatch': {
    fix: 'We expected nine separate drawings in a 3x3 grid. Generate the sheet again and keep exactly nine.',
    redo: 'sheet',
  },
  'rule-lines-removed': { fix: 'Drawn grid lines were removed automatically. No action needed.', redo: 'none' },
  'fragments-removed': { fix: 'Stray pieces from neighbouring cells were removed. No action needed.', redo: 'none' },
  'empty-cell': { fix: 'One cell has no character in it. ' + NEW_SHEET, redo: 'sheet' },
  'touches-edge': {
    fix: 'The character touches the edge of its cell and may be cut off. Ask for more empty margin around it.',
    redo: 'sheet',
  },
  'touches-bottom': {
    fix: 'The bottom of the bust reaches the cell edge. That is fine; it fades out smoothly. No action needed.',
    redo: 'none',
  },
  'wide-feature': {
    fix: 'Wide parts such as wings or big hats get cut off. Describe the character with a smaller wide feature and redo both messages.',
    redo: 'both',
  },
  'low-coverage': { fix: 'The character is very small in its cell. Ask for it to fill most of the cell.', redo: 'sheet' },
  'high-coverage': { fix: 'The character fills almost the whole cell. Ask for more empty margin.', redo: 'sheet' },
  'size-outlier': {
    fix: 'This drawing is a different size from the others. ' + NEW_SHEET,
    redo: 'sheet',
  },
  'character-near-key': {
    fix: 'Part of the character is close to the background colour, so it looks see-through. Switch the key colour in setup and redo both messages.',
    redo: 'both',
  },
  'body-inconsistent': {
    fix: 'The body is drawn at slightly different widths in each cell. Small differences are usable. For a steadier mascot, redo both messages in a new chat (a new directions sheet needs a new reactions sheet too) and ask for the same outfit and shoulders in every cell.',
    redo: 'both',
  },
  'shoulders-too-wide': {
    fix: 'The shoulders are as wide as or wider than the head, so head tracking is hard to see. Describe a bigger head and redo both messages.',
    redo: 'both',
  },
  'unanchored-cell': {
    fix: 'We could not find the shoulders in this cell and centred it instead. ' + NEW_SHEET,
    redo: 'sheet',
  },
  'scale-clamped': {
    fix: 'This cell had to be resized more than usual to match the others. ' + NEW_SHEET,
    redo: 'sheet',
  },
  'boop-shift': {
    fix: 'The body sits slightly differently on the reactions sheet, so the mascot may wobble when clicked. Small amounts are usable. For a cleaner result, redo Message 2 with your directions image attached and ask that only the face changes, with the head facing forward.',
    redo: 'reactions',
  },
  'width-change': {
    fix: 'The body changes width when clicked, often because hair covers the shoulders. Tie the hair back in your description and redo Message 2.',
    redo: 'reactions',
  },
  'palette-mismatch': {
    fix: 'The reactions sheet looks like a different drawing. Redo Message 2 with your directions image attached.',
    redo: 'reactions',
  },
  'check-mirrored': {
    fix: 'Check that the left-looking drawing really looks to your left. If not, use the swap left/right toggle.',
    redo: 'none',
  },
}

function resolveRedo(rule: RedoRule, sheet: SheetKind | null): RedoTarget {
  if (rule === 'sheet') return sheet ?? 'both'
  if (rule === 'key') return sheet === 'reactions' ? 'reactions' : 'both'
  return rule
}

export function adviceFor(code: IssueCode, sheet: SheetKind | null): { fix: string; redo: RedoTarget } {
  const entry = ADVICE[code]
  const fix = sheet === 'reactions' && entry.fixReactions ? entry.fixReactions : entry.fix
  return { fix, redo: resolveRedo(entry.redo, sheet) }
}

export function makeIssue(
  code: IssueCode,
  severity: Severity,
  blocking: boolean,
  sheet: SheetKind | null,
  cellIndex: CellIndex | null,
  message: string,
  metric: number | null,
): Issue {
  const { fix, redo } = adviceFor(code, sheet)
  return {
    id: `${code}:${sheet ?? 'pair'}:${cellIndex ?? 'all'}`,
    code, severity, blocking, sheet, cellIndex, message, fix, redo, metric,
  }
}

export const ISSUE_CODES: readonly IssueCode[] = Object.keys(ADVICE) as IssueCode[]
