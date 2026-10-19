import type { DescribeWarning } from '../core/types'

const MIN_WORDS = 4
const COLOUR_WORD =
  /\b(red|orange|yellow|green|blue|purple|pink|brown|black|white|grey|gray|cream|tan|beige|gold|golden|silver|teal|navy|cyan|magenta|violet|lilac|lavender|maroon|crimson|scarlet|turquoise|peach|ginger|olive|mint|lime|emerald|indigo|coral|ivory|blonde|auburn|colou?rs?)\b/i
const LONG_HAIR = /\b(long|loose|flowing|waist|braids?|braided)\b/i
const HAIR_TIED = /\b(tied|buns?|ponytails?|hats?|beanies?|caps?)\b/i
const HELD_PROP = /\bholding\b|\bwith an? (mug|staff|guitar|sword|phone)\b/i
const WIDE_FEATURE = /\b(wings|headdress|antlers|wide hat)\b/i
const TRANSPARENCY = /transparen|alpha|png/i

const MESSAGES = {
  tooShort: 'Add a few more details: colours plus two or three features that make this character recognisable.',
  noColours: 'Name the main colours (for example "warm orange fur and a cream belly"). Colours are what keep the two sheets matching.',
  longHair:
    'Long or loose hair that falls over the shoulders is the most common cause of a mascot that jumps when clicked. Tie it back, or add a bun, ponytail, hat or beanie.',
  heldProp: 'Held props are drawn differently from cell to cell and get clipped. Describe the character without holding anything.',
  wideFeature:
    'Wide features such as wings, antlers or headdresses get clipped by the cell edge. Say they are drawn small, with clear space either side inside the cell.',
  transparency:
    'Leave out words like "transparent", "alpha" and "PNG". Mentioning them makes the chat paint a grey-and-white checkerboard instead of a clean background.',
} as const

/** Plain-English warnings about a character description. Never throws; an empty list means it looks fine. */
export function lintDescription(describe: string): readonly DescribeWarning[] {
  const text = (describe || '').trim()
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const warnings: DescribeWarning[] = []
  const add = (code: DescribeWarning['code'], message: string): void => {
    warnings.push({ code, message })
  }

  if (words.length < MIN_WORDS) add('too-short', MESSAGES.tooShort)
  if (!COLOUR_WORD.test(text)) add('no-colours', MESSAGES.noColours)
  if (LONG_HAIR.test(text) && /hair/i.test(text) && !HAIR_TIED.test(text)) add('long-hair', MESSAGES.longHair)
  if (HELD_PROP.test(text)) add('held-prop', MESSAGES.heldProp)
  if (WIDE_FEATURE.test(text)) add('wide-feature', MESSAGES.wideFeature)
  if (TRANSPARENCY.test(text)) add('mentions-transparency', MESSAGES.transparency)
  return warnings
}
