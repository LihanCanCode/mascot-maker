import { describe, expect, it } from 'vitest'
import { KEY_COLOURS, KEY_COLOUR_NAMES, STYLE_PRESETS } from '../core/types'
import type { CharacterBrief } from '../core/types'
import {
  STYLE_LABELS,
  STYLE_PARAGRAPHS,
  buildPrompts,
  directionsPrompt,
  pickKeyColour,
  referencePrompt,
  reactionsPrompt,
} from './index'

const FOX = 'a cute chibi fox with warm orange fur, a cream muzzle and dark ear tips'
const FORBIDDEN = /transparen|alpha channel/i

function brief(patch: Partial<CharacterBrief> = {}): CharacterBrief {
  return { name: 'Fox', describe: FOX, style: 'colour', usePhoto: false, key: null, ...patch }
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

describe('pickKeyColour', () => {
  it.each([
    ['a cute chibi fox with warm orange fur', 'green'],
    ['Emerald frog with a cream belly', 'magenta'],
    ['a green dragon with pink spikes', 'blue'],
    ['a teal robot', 'magenta'],
    ['a purple cat', 'green'],
    ['', 'green'],
  ])('maps %j to %s', (describe, expected) => {
    expect(pickKeyColour(describe)).toBe(expected)
  })

  it('tolerates a missing description at runtime', () => {
    expect(pickKeyColour(undefined as unknown as string)).toBe('green')
  })
})

describe('style paragraphs', () => {
  it('has a non-empty paragraph and label for every preset', () => {
    for (const style of STYLE_PRESETS) {
      expect(STYLE_PARAGRAPHS[style].length).toBeGreaterThan(80)
      expect(STYLE_LABELS[style].label.length).toBeGreaterThan(0)
      expect(STYLE_LABELS[style].blurb.length).toBeGreaterThan(0)
    }
  })

  it('keeps the appeal-asking colour paragraph intact', () => {
    expect(STYLE_PARAGRAPHS.colour).toContain('Not flat, not plain, not minimal.')
    expect(STYLE_PARAGRAPHS.colour).toContain('big expressive eyes each with a bright white catchlight')
  })

  it('keeps the chibi guard on ink and sketch', () => {
    expect(STYLE_PARAGRAPHS.ink).toContain('Do NOT make it realistic or detailed.')
    expect(STYLE_PARAGRAPHS.sketch).toContain('Do NOT make it realistic or detailed.')
  })

  it('ports the two new styles', () => {
    expect(STYLE_PARAGRAPHS.anime).toMatch(/^Cute chibi anime sticker art:/)
    expect(STYLE_PARAGRAPHS.anime).toContain('two white highlights')
    expect(STYLE_PARAGRAPHS.cartoon).toMatch(/^Bold modern animated-series cartoon art:/)
    expect(STYLE_PARAGRAPHS.cartoon).toContain('No photorealism, no 3D render, no airbrushed gradients.')
  })

  it('never forbids appeal with the word flat as an instruction', () => {
    expect(STYLE_PARAGRAPHS.colour).not.toMatch(/FLAT cartoon/)
  })
})

describe('prompt builders', () => {
  const combos = STYLE_PRESETS.flatMap((style) => KEY_COLOUR_NAMES.map((key) => ({ style, key })))

  it.each(combos)('never mentions transparency ($style, $key)', ({ style, key }) => {
    const b = brief({ style })
    for (const text of [directionsPrompt(b, key), referencePrompt(b, key), reactionsPrompt(b, key)]) {
      expect(text).not.toMatch(FORBIDDEN)
      expect(text).not.toMatch(/\{\{|\}\}/)
    }
  })

  it('states the key colour in the rules and the tail of a directions prompt', () => {
    const phrase = KEY_COLOURS.green.phrase
    const text = directionsPrompt(brief(), 'green')
    expect(count(text, phrase)).toBe(2)
    expect(text).toContain(`a solid flat ${phrase} background filling the whole cell`)
    expect(text).toContain(`The background is one flat uniform ${phrase} covering the entire canvas edge to edge`)
  })

  it('substitutes each key colour phrase', () => {
    for (const key of KEY_COLOUR_NAMES) {
      expect(directionsPrompt(brief(), key)).toContain(KEY_COLOURS[key].phrase)
      expect(referencePrompt(brief(), key)).toContain(KEY_COLOURS[key].phrase)
      expect(reactionsPrompt(brief(), key)).toContain(KEY_COLOURS[key].phrase)
    }
  })

  it('includes the style paragraph verbatim in the directions and reference prompts', () => {
    for (const style of STYLE_PRESETS) {
      expect(directionsPrompt(brief({ style }), 'green')).toContain(STYLE_PARAGRAPHS[style])
      expect(referencePrompt(brief({ style }), 'green')).toContain(STYLE_PARAGRAPHS[style])
    }
  })

  it('announces the matching second sheet in directions and reference prompts', () => {
    const sentence = 'This is the first of two matching sheets; a second sheet of the same character will follow'
    expect(directionsPrompt(brief(), 'green')).toContain(sentence)
    expect(referencePrompt(brief(), 'green')).toContain(sentence)
    expect(reactionsPrompt(brief(), 'green')).not.toContain(sentence)
  })

  it('keeps the shared layout rules', () => {
    const text = directionsPrompt(brief(), 'green')
    for (const marker of ['LAYOUT:', 'FRAMING:', 'PROPORTIONS:', 'THE RULE THAT MATTERS MOST:', 'MARGINS --']) {
      expect(text).toContain(marker)
    }
    expect(text).toContain('Row 1: up-left, up, up-right.')
    expect(text).toContain('Generate a 3x3 grid sprite sheet of ' + FOX + '.')
  })

  it('does not double the full stop when the description already ends with one', () => {
    const text = directionsPrompt(brief({ describe: 'a fox.  ' }), 'green')
    expect(text).toContain('sprite sheet of a fox. ')
    expect(text).not.toContain('fox..')
  })

  it('falls back to a generic description for an empty one', () => {
    expect(directionsPrompt(brief({ describe: '   ' }), 'green')).toContain('sprite sheet of a cute chibi character.')
  })

  describe('reactions', () => {
    it('restates the description and the same-background sentence', () => {
      const text = reactionsPrompt(brief(), 'magenta')
      expect(text).toContain(`The character is described as: ${FOX}.`)
      expect(text).toContain(`Draw it on the same solid ${KEY_COLOURS.magenta.phrase} background described below.`)
      expect(count(text, KEY_COLOURS.magenta.phrase)).toBe(2)
      expect(text).toContain('The attached image (the sheet you just drew) is a 3x3 head-direction sprite sheet.')
    })

    it('lists all nine expressions', () => {
      const text = reactionsPrompt(brief(), 'green')
      for (let n = 1; n <= 9; n += 1) expect(text).toContain(`\n${n}. `)
      expect(text).toContain('SMALL RED HEART')
    })

    it('repeats the style name for non-colour styles only', () => {
      expect(reactionsPrompt(brief({ style: 'pixel' }), 'green')).toContain(
        'Keep the pixel rendering style of the attached sheet exactly.',
      )
      expect(reactionsPrompt(brief({ style: 'anime' }), 'green')).toContain('Keep the anime rendering style')
      expect(reactionsPrompt(brief({ style: 'colour' }), 'green')).not.toContain('rendering style')
    })

    it('omits the character sentence when there is no description', () => {
      expect(reactionsPrompt(brief({ describe: '' }), 'green')).not.toContain('described as')
    })
  })

  describe('reference', () => {
    it('keeps the discard-the-photograph paragraph and appends the description', () => {
      const text = referencePrompt(brief(), 'green')
      expect(text).toContain('DO NOT reproduce the photograph')
      expect(text).toContain('They are described as: ' + FOX + '.')
    })

    it('works without a description', () => {
      const text = referencePrompt(brief({ describe: '' }), 'green')
      expect(text).toContain('the colour of their top.\nSimplify everything else away.')
      expect(text).not.toContain('described as')
    })
  })
})

describe('buildPrompts', () => {
  it('uses the directions prompt without a photo and picks the key colour', () => {
    const pair = buildPrompts(brief({ usePhoto: false }))
    expect(pair.firstKind).toBe('directions')
    expect(pair.key).toBe('green')
    expect(pair.first).toBe(directionsPrompt(brief(), 'green'))
    expect(pair.second).toBe(reactionsPrompt(brief(), 'green'))
  })

  it('uses the reference prompt with a photo', () => {
    const pair = buildPrompts(brief({ usePhoto: true }))
    expect(pair.firstKind).toBe('reference')
    expect(pair.first).toBe(referencePrompt(brief(), 'green'))
  })

  it('lets the user override the key colour', () => {
    const pair = buildPrompts(brief({ describe: 'an emerald frog', key: 'blue' }))
    expect(pair.key).toBe('blue')
    expect(pair.first).toContain(KEY_COLOURS.blue.phrase)
    expect(pair.second).toContain(KEY_COLOURS.blue.phrase)
  })

  it('auto-picks magenta for a green character', () => {
    expect(buildPrompts(brief({ describe: 'an emerald frog' })).key).toBe('magenta')
  })

  it('is deterministic and does not mutate the brief', () => {
    const b = brief()
    const frozen = Object.freeze({ ...b })
    expect(buildPrompts(frozen)).toEqual(buildPrompts(b))
  })

  it('handles special characters and emoji in the description without touching them', () => {
    const odd = 'a fox 🦊 with "quotes" & <tags> $& $1'
    const pair = buildPrompts(brief({ describe: odd }))
    expect(pair.first).toContain(odd)
    expect(pair.second).toContain(odd)
  })
})

describe('real-world corrections (Gemini run)', () => {
  const DO_NOT_COPY = 'DO NOT copy those head turns'
  const FRONT =
    'Every one of the nine cells here must be the same straight front view as the centre cell of the attached sheet (row 2, column 2), head level, eyes looking at the viewer except where an expression changes them. Only the face and the three floating symbols differ between cells.'

  it('reactions: states the straight-on rule before the description, style and expression list', () => {
    for (const style of ['colour', 'pixel'] as const) {
      const text = reactionsPrompt(brief({ style }), 'green')
      const first = text.indexOf(DO_NOT_COPY)
      expect(first).toBeGreaterThan(-1)
      expect(text).toContain('The attached sheet shows heads turned in different directions.')
      expect(text).toContain(FRONT)
      expect(first).toBeLessThan(text.indexOf('The character is described as'))
      expect(first).toBeLessThan(text.indexOf('Draw it on the same solid'))
      expect(first).toBeLessThan(text.indexOf('Copy the character'))
      expect(first).toBeLessThan(text.indexOf('\n1. Eyes closed'))
    }
  })

  it('reactions: repeats the rule after the expression list, before the background tail', () => {
    const text = reactionsPrompt(brief(), 'green')
    const list = text.indexOf('9. Eyes closed arcs')
    const reminder = text.lastIndexOf('REMINDER')
    expect(reminder).toBeGreaterThan(list)
    expect(text.slice(reminder)).toMatch(/do not copy the head turns/i)
    expect(text.slice(reminder)).toContain('face straight at the viewer')
    expect(reminder).toBeLessThan(text.indexOf('No text, no labels', list))
  })

  it('directions and reference: one fixed torso with a visible gap above the cell bottom', () => {
    for (const text of [directionsPrompt(brief(), 'green'), referencePrompt(brief(), 'green')]) {
      expect(text).toContain('THE BODY IS ONE FIXED SHAPE: the same shoulders, the same collar/neckline, the same garment, the same width')
      expect(text).toContain('cut off by the same flat horizontal line at the same height in every cell')
      expect(text).toContain('nine different heads placed on the same unchanging torso. Only the head turns.')
      expect(text).toContain('clearly above the cell\'s bottom edge, leaving a visible gap')
      expect(text).not.toMatch(/transparen|alpha channel/i)
    }
  })
})
