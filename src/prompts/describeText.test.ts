import { describe, expect, it } from 'vitest'
import type { CharacterBrief } from '../core/types'
import { directionsPrompt, reactionsPrompt, referencePrompt } from './index'
import { isNonHumanSubject, normaliseDescribe } from './describeText'

function brief(describe: string): CharacterBrief {
  return { name: 'x', describe, style: 'colour', usePhoto: true, key: null }
}

describe('normaliseDescribe', () => {
  it.each([
    ['An orange fox with a white-tipped tail', 'an orange fox with a white-tipped tail'],
    ['A girl with red hair', 'a girl with red hair'],
    ['The wizard in a blue hat', 'the wizard in a blue hat'],
    ['Tall man with a grey beard', 'tall man with a grey beard'],
    ['a girl with a red bun.', 'a girl with a red bun'],
    ['  a girl with a red bun!!  ', 'a girl with a red bun'],
    ['Mario with a red cap', 'Mario with a red cap'],
    ['Captain Hook in a red coat', 'Captain Hook in a red coat'],
    ['NASA astronaut in white', 'NASA astronaut in white'],
    ['Pikachu', 'Pikachu'],
    ['', ''],
  ])('%j -> %j', (input, expected) => {
    expect(normaliseDescribe(input)).toBe(expected)
  })

  it('tolerates a missing value', () => {
    expect(normaliseDescribe(undefined as unknown as string)).toBe('')
  })
})

describe('isNonHumanSubject', () => {
  it.each(['an orange fox with a white tail', 'a grey robot', 'a green dragon', 'a pink bunny', 'a brown bear'])(
    'treats %j as non-human',
    (text) => expect(isNonHumanSubject(text)).toBe(true),
  )
  it.each(['a girl with red hair', 'a man with a beard', 'a girl in a fox hat', 'a cat girl', '', 'the wizard'])(
    'treats %j as human',
    (text) => expect(isNonHumanSubject(text)).toBe(false),
  )
})

describe('grammar in every builder', () => {
  const cases = ['An orange fox with a white-tipped tail.', 'a girl with a red bun', 'Tall man with a grey beard', 'The wizard in a blue hat.']

  it.each(cases)('interpolates %j consistently', (text) => {
    const clean = normaliseDescribe(text)
    expect(directionsPrompt(brief(text), 'green')).toContain(`sprite sheet of ${clean}.`)
    expect(referencePrompt(brief(text), 'green')).toContain(`They are described as: ${clean}.`)
    expect(reactionsPrompt(brief(text), 'green')).toContain(`The character is described as: ${clean}.`)
    for (const p of [directionsPrompt(brief(text), 'green'), referencePrompt(brief(text), 'green'), reactionsPrompt(brief(text), 'green')]) {
      expect(p).not.toContain('They are An')
      expect(p).not.toMatch(/\.\./)
    }
  })
})

describe('reference identity list', () => {
  it('keeps the human wording for people', () => {
    const text = referencePrompt(brief('a girl with a red bun'), 'green')
    expect(text).toContain('hair shape and colour, facial hair, the shape and colour of any glasses, skin tone, and the colour of their top')
    expect(text).not.toContain('fur, feather or surface colours')
  })

  it('keeps the human wording when there is no description', () => {
    expect(referencePrompt(brief(''), 'green')).toContain('skin tone')
  })

  it('uses the animal and object wording for non-human subjects', () => {
    const text = referencePrompt(brief('An orange fox with a white-tipped tail'), 'green')
    expect(text).toContain('Keep ONLY the things that identify them: the fur, feather or surface colours, markings, ears, tail and any accessories.')
    expect(text).not.toContain('skin tone')
    expect(text).not.toContain('facial hair')
    expect(text).not.toMatch(/transparen|alpha channel/i)
  })
})
