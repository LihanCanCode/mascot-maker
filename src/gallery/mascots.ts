/**
 * Built-in gallery characters. Artwork: nilbuild/page-mascot by Kamran Ahmed, MIT licence.
 * See public/mascots/CREDITS.txt and THIRD_PARTY_NOTICES.md.
 */

export const MASCOT_TAGS = ['animal', 'person', 'robot', 'object'] as const
export type MascotTag = (typeof MASCOT_TAGS)[number]

export const TAG_LABELS: Readonly<Record<MascotTag, string>> = {
  animal: 'Animals',
  person: 'People',
  robot: 'Robots',
  object: 'Objects',
}

export interface MascotEntry {
  readonly slug: string
  readonly name: string
  readonly tag: MascotTag
  /** Set on art-style variants; points at the base character they restyle. */
  readonly variantOf?: string
  /** Short description of the art style, only on variants. */
  readonly style?: string
}

const base = (slug: string, name: string, tag: MascotTag): MascotEntry => ({ slug, name, tag })
const variant = (of: string, style: string, note: string): MascotEntry => ({
  slug: `${of}-${style}`,
  name: `Fox, ${style}`,
  tag: 'animal',
  variantOf: of,
  style: note,
})

export const MASCOTS: readonly MascotEntry[] = [
  // Animals
  base('bear', 'Bear', 'animal'),
  base('bunny', 'Bunny', 'animal'),
  base('cat', 'Cat', 'animal'),
  base('deer', 'Deer', 'animal'),
  base('dino', 'Dino', 'animal'),
  base('fox', 'Fox', 'animal'),
  variant('fox', 'ink', 'Black line art'),
  variant('fox', 'paper', 'Cut paper'),
  variant('fox', 'pixel', 'Pixel art, 32 across'),
  variant('fox', 'riso', 'Two-tone print'),
  variant('fox', 'sketch', 'Pencil sketch'),
  base('frog', 'Frog', 'animal'),
  base('hamster', 'Hamster', 'animal'),
  base('hedgehog', 'Hedgehog', 'animal'),
  base('koala', 'Koala', 'animal'),
  base('mouse', 'Mouse', 'animal'),
  base('otter', 'Otter', 'animal'),
  base('owl', 'Owl', 'animal'),
  base('panda', 'Panda', 'animal'),
  base('penguin', 'Penguin', 'animal'),
  base('pug', 'Pug', 'animal'),
  base('raccoon', 'Raccoon', 'animal'),
  base('redpanda', 'Red panda', 'animal'),
  base('sheep', 'Sheep', 'animal'),
  base('sloth', 'Sloth', 'animal'),
  base('tiger', 'Tiger', 'animal'),
  // People
  base('afro', 'Afro', 'person'),
  base('astronaut', 'Astronaut', 'person'),
  base('bald', 'Bald', 'person'),
  base('ballerina', 'Ballerina', 'person'),
  base('beard', 'Beard', 'person'),
  base('builder', 'Builder', 'person'),
  base('cap', 'Cap', 'person'),
  base('chef', 'Chef', 'person'),
  base('glasses', 'Glasses', 'person'),
  base('grandpa', 'Grandpa', 'person'),
  base('granny', 'Granny', 'person'),
  base('hijabi', 'Hijabi', 'person'),
  base('kamran', 'Kamran', 'person'),
  base('nurse', 'Nurse', 'person'),
  base('pirate', 'Pirate', 'person'),
  base('scientist', 'Scientist', 'person'),
  base('sikh', 'Sikh', 'person'),
  base('skater', 'Skater', 'person'),
  base('wizard', 'Wizard', 'person'),
  // Robots
  base('clockwork', 'Clockwork', 'robot'),
  base('drone', 'Drone', 'robot'),
  base('gearbot', 'Gearbot', 'robot'),
  base('knight', 'Knight', 'robot'),
  base('postbot', 'Postbot', 'robot'),
  base('scout', 'Scout', 'robot'),
  // Objects
  base('crt', 'CRT monitor', 'object'),
  base('cube', 'Cube', 'object'),
  base('lantern', 'Lantern', 'object'),
  base('radio', 'Radio', 'object'),
  base('rocket', 'Rocket', 'object'),
  base('toaster', 'Toaster', 'object'),
  base('tv', 'TV', 'object'),
]

export const ART_CREDIT = {
  text: 'Gallery art by Kamran Ahmed, from page-mascot (MIT licence).',
  url: 'https://github.com/nilbuild/page-mascot',
} as const

export function findMascot(slug: string): MascotEntry | undefined {
  return MASCOTS.find((m) => m.slug === slug)
}

/** The style variants of a base character, in manifest order. */
export function variantsOf(slug: string): readonly MascotEntry[] {
  return MASCOTS.filter((m) => m.variantOf === slug)
}

const MASCOT_DIR = `${import.meta.env.BASE_URL}mascots`

export function sheetFileNames(slug: string): { directions: string; reactions: string } {
  return { directions: `${slug}-directions.webp`, reactions: `${slug}-reactions.webp` }
}

export function sheetUrls(slug: string): { directions: string; reactions: string } {
  const names = sheetFileNames(slug)
  return { directions: `${MASCOT_DIR}/${names.directions}`, reactions: `${MASCOT_DIR}/${names.reactions}` }
}
