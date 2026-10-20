/**
 * The screenshots of the running app that the README shows: one per step, plus
 * the checker's verdict on a pair that really is wrong.
 *
 *   pnpm run shots
 *
 * Taken from the production build at a desktop width, light theme, no browser
 * chrome. The sheets uploaded are the studio-drawn green-backed pairs, so the
 * only characters in any frame are this project's own, and nothing derived from
 * a photograph of a person is opened at any point.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import type { Browser, Locator, Page } from '@playwright/test'
import { build, fillSetup, fixTheme, gotoUpload, scrollTo, stageSite, toExport, uploadPair, useOurMascot } from './media/app'
import { squeezePng } from './media/ffmpeg'
import { LEAD, WRONG, runOn, sheetPair } from './media/sheets'
import { serve } from './media/serve'

const OUT = join('docs', 'images')
const WORK = join('out', 'shots-site')
const PORT = 4394
const BUDGET = 300 * 1024
const VIEWPORT = { width: 1180, height: 1000 }

async function open(browser: Browser, origin: string, path: string): Promise<Page> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await fixTheme(page, 'light')
  await page.goto(`${origin}${path}`)
  return page
}

/**
 * One panel, not the whole window. A README picture of a step wants the step,
 * not the browser's empty margins, and a tight crop also keeps the file small.
 */
interface Shootable { screenshot(opts: { path: string }): Promise<unknown> }

async function shoot(target: Shootable, name: string): Promise<void> {
  const file = join(OUT, `${name}.png`)
  await target.screenshot({ path: file })
  const bytes = squeezePng(file, BUDGET)
  console.log(`${file}  ${(bytes / 1024).toFixed(0)} KB${bytes > BUDGET ? '  OVER BUDGET' : ''}`)
  if (bytes > BUDGET) throw new Error(`${name}.png is over the ${BUDGET / 1024} KB budget`)
}

/**
 * The part of `container` that sits above `below`: a clip rectangle rather
 * than a locator, so a step can be photographed down to the point where the
 * next section starts.
 */
async function clipAbove(page: Page, below: string, container: string) {
  const box = await page.locator(container).first().boundingBox()
  const stop = await page.locator(below).first().boundingBox()
  if (!box || !stop) throw new Error(`no box for ${container} or ${below}`)
  return {
    screenshot: (opts: { path: string }) =>
      page.screenshot({ ...opts, clip: { x: box.x, y: box.y, width: box.width, height: stop.y - box.y - 8 } }),
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const clean = sheetPair('shots', LEAD)
  const result = runOn(clean)
  if (!result.ok) throw new Error('the demonstration pair no longer builds')
  stageSite('dist', WORK, result.output, 'pip')

  const site = await serve(WORK, PORT)
  const browser = await chromium.launch()
  try {
    /* 1. Describe it and pick a style. */
    const app = await open(browser, site.origin, '/')
    await fillSetup(app, 'Pip')
    await app.waitForTimeout(500)
    await shoot(await clipAbove(app, '.prompts', '.step'), 'step-1-describe')

    /* 2. The two prompts it writes for you. */
    await shoot(app.locator('.prompts'), 'step-2-prompts')

    /* 3. Both images, back from the chat and dropped in. */
    await gotoUpload(app)
    await uploadPair(app, clean)
    await app.waitForTimeout(600)
    await shoot(app.locator('.step').first(), 'step-3-upload')

    /* 4. A clean verdict, and then the export panel. */
    await build(app)
    await app.waitForTimeout(700)
    await shoot(app.locator('.banner').first(), 'verdict-good')
    await toExport(app)
    await app.waitForTimeout(900)
    await shoot(app.locator('.step').first(), 'step-4-export')
    await app.context().close()

    /* The checker, on a pair that really is wrong. */
    const broken = sheetPair('shots-mismatch', LEAD, WRONG)
    const bad = await open(browser, site.origin, '/')
    await fillSetup(bad, 'Pip')
    await gotoUpload(bad)
    await uploadPair(bad, broken)
    await build(bad)
    await bad.waitForTimeout(900)
    await scrollTo(bad, '.issues', -8)
    await shoot(bad.locator('.banner').first(), 'verdict-bad')
    await shoot(bad.locator('.issues'), 'checker-notes')
    await bad.context().close()

    /* The mascot on somebody else's page. */
    const demo = await open(browser, site.origin, '/demo.html')
    await useOurMascot(demo, 'mascots/pip-directions.png', 'mascots/pip-reactions.png')
    await demo.waitForTimeout(1200)
    await shoot(demo.locator('.hero'), 'on-your-page')
    await demo.context().close()
  } finally {
    await browser.close()
    await site.stop()
  }
}

await main()
