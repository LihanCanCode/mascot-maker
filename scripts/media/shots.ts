/**
 * The three shots that are real footage of the running app.
 *
 * Every measurement a shot needs is taken from the page at the moment it runs
 * rather than written down here, so the same script drives the tall viewport
 * the reel records and the wide one the landscape cut records.
 *
 * The images uploaded are the studio-drawn green-backed pairs from `./sheets`.
 * No photograph is ever opened, and nothing navigates to the gallery.
 */
import type { Page } from '@playwright/test'
import { CHARACTER_BRIEF, fileInput, useOurMascot } from './app'
import type { ShotPlan, Stage } from './record'
import type { SheetPair } from './sheets'

async function centreOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox()
  if (box === null) throw new Error(`no box for ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function jumpTo(page: Page, selector: string, offset: number): Promise<void> {
  await page.evaluate(([target, top]) => {
    const node = document.querySelector(String(target))
    if (node === null) throw new Error(`no element for ${String(target)}`)
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY + Number(top), behavior: 'instant' })
  }, [selector, offset] as const)
  await page.waitForTimeout(400)
}

/** Typing the character in, watching the two prompts write themselves, copying one. */
export const SETUP: ShotPlan = {
  name: 'setup',
  path: '/',
  async prepare(page) {
    await page.getByRole('heading', { name: 'Describe your mascot' }).waitFor({ timeout: 60_000 })
    await page.getByLabel('Name', { exact: true }).fill('Pip')
    await jumpTo(page, '.field', -24)
  },
  async drive(stage: Stage) {
    const box = await centreOf(stage.page, 'textarea')
    await stage.glide(box, 300)
    await stage.click()
    await stage.write(CHARACTER_BRIEF, 26)
    await stage.hold(500)
    // Down to the two messages the app has just written.
    const prompts = await stage.topOf('.prompts')
    await stage.scrollTo(prompts - 40, 1100)
    await stage.hold(500)
    const copy = await centreOf(stage.page, '#prompt-1 button')
    await stage.glide(copy, 520)
    await stage.click()
    await stage.hold(900)
  },
}

/**
 * The part nothing else does: both images go in, the app takes them apart, and
 * the checker says in plain English which of the two prompts to run again.
 *
 * The pair uploaded here is genuinely wrong -- the reactions sheet is a
 * different character -- so the verdict in the footage is a real one.
 */
export function checkShot(pair: SheetPair): ShotPlan {
  return {
    name: 'check',
    path: '/',
    async prepare(page) {
      await page.getByRole('heading', { name: 'Describe your mascot' }).waitFor({ timeout: 60_000 })
      await page.getByLabel('Name', { exact: true }).fill('Pip')
      await page.getByLabel('What does it look like?').fill(CHARACTER_BRIEF)
      await page.locator('#prompt-2 pre').waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'I have both images' }).click()
      await page.getByRole('heading', { name: 'Upload your two images' }).waitFor()
      await jumpTo(page, '.step', -16)
    },
    async drive(stage: Stage) {
      const first = await centreOf(stage.page, '.dropzone-wrap')
      await stage.glide(first, 360)
      // The file input is filled directly -- a real drag cannot be synthesised
      // across the OS boundary -- but the pointer is parked over the drop zone
      // it lands in, so the footage reads the way the action does.
      await stage.doing(700, async () => {
        await fileInput(stage.page, 'directions').setInputFiles(pair.directionsFile)
        await stage.page.getByAltText('Preview of your directions image').waitFor({ timeout: 30_000 })
      })
      const second = await stage.page.locator('.dropzone-wrap').nth(1).boundingBox()
      if (second) await stage.glide({ x: second.x + second.width / 2, y: second.y + second.height / 2 }, 420)
      await stage.doing(700, async () => {
        await fileInput(stage.page, 'reactions').setInputFiles(pair.reactionsFile)
        await stage.page.getByAltText('Preview of your reactions image').waitFor({ timeout: 30_000 })
      })
      await stage.hold(400)

      const go = await centreOf(stage.page, 'button:has-text("Build my mascot")')
      await stage.glide(go, 480)
      await stage.click()
      await stage.doing(600, async () => {
        await stage.page.getByRole('heading', { name: 'Check the result' }).waitFor({ timeout: 90_000 })
      })
      await stage.hold(700)
      // The verdict, then the note under it that names the prompt to redo.
      const notes = await stage.topOf('.issues')
      await stage.scrollTo(notes - 120, 1000)
      // A long tail: this is the beat the whole film is for, and the cut needs
      // several seconds of footage after the verdict lands with room to spare.
      await stage.hold(2600)
    },
  }
}

/** The mascot on somebody else's website, watching the cursor and getting booped. */
export function demoShot(directions: string, reactions: string): ShotPlan {
  return {
    name: 'demo',
    path: '/demo.html',
    async prepare(page) {
      await useOurMascot(page, directions, reactions)
      await jumpTo(page, '.hero', -32)
      await page.waitForTimeout(600)
    },
    async drive(stage: Stage) {
      const mascot = await centreOf(stage.page, 'page-mascot')
      // Clear of the component's 70px dead zone, or it would stare straight
      // ahead for the whole shot.
      const reach = Math.max(110, Math.min(stage.viewport.width, stage.viewport.height) * 0.2)
      await stage.glide({ x: mascot.x - reach, y: mascot.y - reach * 0.6 }, 520)
      await stage.glide({ x: mascot.x + reach, y: mascot.y - reach * 0.7 }, 600)
      await stage.glide({ x: mascot.x + reach * 0.8, y: mascot.y + reach * 0.8 }, 540)
      await stage.glide({ x: mascot.x + 26, y: mascot.y + 14 }, 420)
      await stage.click()
      await stage.hold(900)
    },
  }
}
