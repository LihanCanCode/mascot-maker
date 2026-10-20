/**
 * Driving the built site under Playwright: the handful of moves the README
 * screenshots, the stills and the reel all need, written once so a shot and a
 * screenshot of the same panel are reached the same way.
 *
 * The sheets these functions upload are the studio-drawn, green-backed pairs
 * from `./sheets`. No photograph of a person is ever opened by this code, and
 * the gallery -- which is Kamran Ahmed's artwork rather than this project's --
 * is never navigated to.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import type { ComposedMascot } from '../../src/core/types'
import { writeImage } from './surface'
import type { SheetPair } from './sheets'

export const THEME_KEY = 'mascot-maker-theme'

/** Pin a theme before any script runs, so the first paint is already right. */
export async function fixTheme(page: Page, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(String(key), String(value))
      } catch {
        // No storage: the page falls back to the system preference.
      }
    },
    [THEME_KEY, theme],
  )
}

export const CHARACTER_BRIEF =
  'An orange fox with a cream muzzle, a blue jacket and a red scarf'

/** Fill in the setup step so both prompts appear. */
export async function fillSetup(page: Page, name = 'Pip'): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('What does it look like?').fill(CHARACTER_BRIEF)
  await page.locator('#prompt-1 pre').waitFor({ timeout: 30_000 })
  await page.locator('#prompt-2 pre').waitFor({ timeout: 30_000 })
}

/** Type the description a character at a time, for footage rather than a still. */
export async function typeBrief(page: Page, name = 'Pip'): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('What does it look like?').click()
}

export async function gotoUpload(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'I have both images' }).click()
  await page.getByRole('heading', { name: 'Upload your two images' }).waitFor()
}

export function fileInput(page: Page, sheet: 'directions' | 'reactions') {
  return page
    .locator('.dropzone-wrap')
    .filter({ hasText: sheet === 'directions' ? 'Directions image' : 'Reactions image' })
    .locator('input[type=file]')
}

/** Put both of a pair's green-backed sheets into the two drop zones. */
export async function uploadPair(page: Page, pair: SheetPair): Promise<void> {
  await fileInput(page, 'directions').setInputFiles(pair.directionsFile)
  await fileInput(page, 'reactions').setInputFiles(pair.reactionsFile)
  await page.getByAltText('Preview of your directions image').waitFor()
  await page.getByAltText('Preview of your reactions image').waitFor()
}

export async function build(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Build my mascot' }).click()
  await page.getByRole('heading', { name: 'Check the result' }).waitFor({ timeout: 90_000 })
  // The banner is the last thing to settle; without it a shot can catch the
  // review step mid-render.
  await page.getByRole('status').first().waitFor({ timeout: 30_000 })
}

export async function toExport(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Continue (anyway|to export)/ }).click()
  await page.getByRole('heading', { name: 'Your mascot is ready' }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /^Boop the/ }).waitFor({ timeout: 30_000 })
}

/** Scroll a section to the top of the viewport and let the motion settle. */
export async function scrollTo(page: Page, selector: string, offset = 0): Promise<void> {
  await page.evaluate(([target, top]) => {
    const node = document.querySelector(String(target))
    if (node === null) throw new Error(`no element for ${String(target)}`)
    const y = node.getBoundingClientRect().top + window.scrollY + Number(top)
    window.scrollTo({ top: y, behavior: 'instant' })
  }, [selector, offset] as const)
  await page.waitForTimeout(300)
}

/**
 * A copy of the built site whose demo page wears the mascot this run produced.
 *
 * `demo.html` ships pointing at `public/mascots/fox-*.webp`, which is gallery
 * artwork from page-mascot. The launch media is about this project's pipeline,
 * so the staged copy swaps in the sheets the pipeline just made and the shipped
 * artwork never reaches a frame.
 */
export function stageSite(dist: string, into: string, output: ComposedMascot, name: string): string {
  mkdirSync(into, { recursive: true })
  cpSync(dist, into, { recursive: true })
  const mascots = join(into, 'mascots')
  mkdirSync(mascots, { recursive: true })
  // Belt and braces: the gallery sheets are deleted from the staged copy, so
  // no frame of the launch media can contain page-mascot's artwork even if a
  // shot were to wander somewhere it should not. The staged copy is a
  // throwaway under out/; the real public/mascots is untouched.
  for (const file of readdirSync(mascots)) {
    if (file.endsWith('.webp')) rmSync(join(mascots, file))
  }
  const directions = `${name}-directions.png`
  const reactions = `${name}-reactions.png`
  writeImage(join(mascots, directions), output.directions)
  writeImage(join(mascots, reactions), output.reactions)

  const page = join(into, 'demo.html')
  const html = readFileSync(page, 'utf8')
  const swapped = html
    .replace(/directions="mascots\/[^"]+"/g, `directions="mascots/${directions}"`)
    .replace(/reactions="mascots\/[^"]+"/g, `reactions="mascots/${reactions}"`)
  if (swapped === html) throw new Error('demo.html no longer names its sheets the way stageSite expects')
  writeFileSync(page, swapped)
  return into
}

/**
 * Point the demo page's mascot at the sheets this run produced.
 *
 * `src/demo/main.ts` builds a character picker, and its `applyMascot` sets the
 * element's `directions` and `reactions` attributes from the gallery the
 * moment the page boots -- so patching the HTML alone is not enough, and a
 * screenshot taken without this would show page-mascot's artwork rather than
 * anything this pipeline made. The custom element observes those attributes,
 * so setting them after boot is all that is needed; nothing in the media
 * touches the picker afterwards.
 */
export async function useOurMascot(page: Page, directions: string, reactions: string): Promise<void> {
  await page.locator('page-mascot').waitFor({ timeout: 60_000 })
  await page.evaluate(([d, r]) => {
    const el = document.getElementById('mascot')
    if (el === null) throw new Error('the demo page has no #mascot')
    el.setAttribute('directions', String(d))
    el.setAttribute('reactions', String(r))
  }, [directions, reactions] as const)
  await page.waitForTimeout(600)
  const showing = await page.evaluate(() => document.getElementById('mascot')?.getAttribute('directions') ?? '')
  if (!showing.includes(directions)) throw new Error(`the demo mascot is showing ${showing}, not our sheet`)
}
