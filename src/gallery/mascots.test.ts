import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ART_CREDIT, findMascot, MASCOTS, MASCOT_TAGS, sheetFileNames, sheetUrls, variantsOf } from './mascots'

const DIR = join(import.meta.dirname, '..', '..', 'public', 'mascots')

describe('gallery manifest', () => {
  it('has about 58 characters with unique slugs and names', () => {
    expect(MASCOTS.length).toBe(58)
    expect(new Set(MASCOTS.map((m) => m.slug)).size).toBe(MASCOTS.length)
    expect(new Set(MASCOTS.map((m) => m.name)).size).toBe(MASCOTS.length)
  })

  it('uses only valid, URL-safe slugs and known tags', () => {
    for (const m of MASCOTS) {
      expect(m.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)?$/)
      expect(MASCOT_TAGS).toContain(m.tag)
      expect(m.name.trim()).not.toBe('')
    }
  })

  it('has both sheet files on disk, non-empty and really WEBP', () => {
    for (const m of MASCOTS) {
      for (const file of Object.values(sheetFileNames(m.slug))) {
        const path = join(DIR, file)
        expect(existsSync(path), file).toBe(true)
        expect(statSync(path).size, file).toBeGreaterThan(1000)
        const head = readFileSync(path).subarray(0, 12)
        expect(head.subarray(0, 4).toString('ascii'), file).toBe('RIFF')
        expect(head.subarray(8, 12).toString('ascii'), file).toBe('WEBP')
      }
    }
  })

  it('has no stray sheet files that the manifest does not list', () => {
    const listed = new Set(MASCOTS.flatMap((m) => Object.values(sheetFileNames(m.slug))))
    const sheets = readdirSync(DIR).filter((f) => f.endsWith('.webp'))
    expect(sheets.filter((f) => !listed.has(f))).toEqual([])
    expect(sheets).toHaveLength(listed.size)
  })

  it('groups the fox styles as variants of the fox', () => {
    const variants = variantsOf('fox')
    expect(variants.map((v) => v.slug)).toEqual(['fox-ink', 'fox-paper', 'fox-pixel', 'fox-riso', 'fox-sketch'])
    for (const v of variants) {
      expect(findMascot(v.variantOf ?? '')).toBeDefined()
      expect(v.style).toBeTruthy()
    }
    expect(MASCOTS.filter((m) => m.variantOf).length).toBe(5)
  })

  it('covers every tag', () => {
    for (const tag of MASCOT_TAGS) expect(MASCOTS.some((m) => m.tag === tag)).toBe(true)
  })

  it('builds sheet urls under /mascots and ships the credit', () => {
    expect(sheetUrls('fox')).toEqual({ directions: '/mascots/fox-directions.webp', reactions: '/mascots/fox-reactions.webp' })
    expect(ART_CREDIT.text).toMatch(/Kamran Ahmed/)
    const credits = readFileSync(join(DIR, 'CREDITS.txt'), 'utf8')
    expect(credits).toMatch(/nilbuild\/page-mascot/)
    expect(credits).toMatch(/MIT License/)
    expect(findMascot('nope')).toBeUndefined()
  })
})
