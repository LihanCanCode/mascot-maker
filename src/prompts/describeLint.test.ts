import { describe, expect, it } from 'vitest'
import { CHAT_GUIDES, lintDescription } from './index'

function codes(text: string): string[] {
  return lintDescription(text).map((w) => w.code)
}

describe('lintDescription', () => {
  it('accepts a good description without warnings', () => {
    expect(codes('a chibi fox with orange fur, a cream muzzle and dark ear tips')).toEqual([])
  })

  it('flags empty and very short descriptions', () => {
    expect(codes('')).toContain('too-short')
    expect(codes('red fox')).toContain('too-short')
    expect(codes('a small red fox')).not.toContain('too-short')
  })

  it('flags a missing colour word', () => {
    expect(codes('a friendly fox with a bushy tail')).toContain('no-colours')
    expect(codes('a friendly fox with an orange tail')).not.toContain('no-colours')
  })

  it('flags long loose hair but not when it is tied back', () => {
    expect(codes('a girl with long black hair and a red top')).toContain('long-hair')
    expect(codes('a girl with long black hair in a bun and a red top')).not.toContain('long-hair')
    expect(codes('a girl with long black hair under a red beanie')).not.toContain('long-hair')
    expect(codes('a long red scarf and a blue coat')).not.toContain('long-hair')
  })

  it('flags held props', () => {
    expect(codes('a blue robot holding a red balloon')).toContain('held-prop')
    expect(codes('a brown bear with a guitar')).toContain('held-prop')
    expect(codes('a brown bear with a mug and a blue scarf')).toContain('held-prop')
    expect(codes('a brown bear with a blue scarf and a round belly')).not.toContain('held-prop')
  })

  it('flags wide features', () => {
    expect(codes('a red dragon with large wings')).toContain('wide-feature')
    expect(codes('a brown deer with antlers and a white tail')).toContain('wide-feature')
  })

  it('flags mentions of transparency', () => {
    expect(codes('a red fox, transparent background')).toContain('mentions-transparency')
    expect(codes('a red fox as a PNG with alpha')).toContain('mentions-transparency')
  })

  it('returns messages that are plain and non-empty', () => {
    for (const w of lintDescription('fox with long hair, transparent png')) {
      expect(w.message.length).toBeGreaterThan(10)
    }
  })

  it('is case-insensitive and returns a stable order', () => {
    expect(codes('A Red Dragon With WINGS')).toEqual(['wide-feature'])
  })
})

describe('CHAT_GUIDES', () => {
  it('has Gemini and ChatGPT guides', () => {
    expect(CHAT_GUIDES.map((g) => g.id)).toEqual(['gemini', 'chatgpt'])
    expect(CHAT_GUIDES.map((g) => g.name)).toEqual(['Gemini', 'ChatGPT'])
  })

  it('has six generic steps each and the plan tips', () => {
    for (const guide of CHAT_GUIDES) {
      expect(guide.steps).toHaveLength(6)
      expect(guide.steps[0]).toMatch(/new chat/i)
      expect(guide.tips.join(' ')).toMatch(/checkerboard/i)
      expect(guide.tips.join(' ')).toMatch(/NEW chat/)
    }
  })

  it('never claims a specific numeric limit and never mentions transparency in steps', () => {
    for (const guide of CHAT_GUIDES) {
      const all = [...guide.steps, ...guide.tips].join('\n')
      expect(all).not.toMatch(/\b\d+\s*(images?|per day|a day|\/day)\b/i)
      expect(guide.steps.join('\n')).not.toMatch(/transparen|alpha channel/i)
    }
  })
})

describe('CHAT_GUIDES real-world tips', () => {
  it('explains JPEG downloads, the turned-heads fix and the last-resort follow-up', () => {
    for (const guide of CHAT_GUIDES) {
      const tips = guide.tips.join('\n')
      expect(tips).toMatch(/JPEG/)
      expect(tips).toMatch(/heads are still turned.*NEW chat.*attach the directions image/s)
      expect(tips).toContain('Redo the sheet: every one of the nine heads must face straight at me, only the expressions differ.')
      expect(tips).toMatch(/last resort/i)
      expect(tips).not.toMatch(/transparen|alpha channel/i)
    }
  })
})
