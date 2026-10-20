/**
 * Six stills of the running site, for posts and listings.
 *
 *   pnpm run stills
 *
 * Captured from the production build at a desktop width and a device pixel
 * ratio that lands exactly on 1600px, light theme, no browser chrome.
 *
 * The sheets uploaded are the studio-drawn green-backed pairs, so every
 * character in every still is this project's own work. The demo page is served
 * from a staged copy whose gallery artwork has been removed.
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import {
  build, fillSetup, fixTheme, gotoUpload, scrollTo, stageSite, toExport, uploadPair, useOurMascot,
} from './media/app'
import { LEAD, WRONG, runOn, sheetPair } from './media/sheets'
import { serve } from './media/serve'

const OUT = join('media', 'stills')
const WORK = join('out', 'stills-site')
const PORT = 4395
const VIEWPORT = { width: 1280, height: 800 }
/** 1280 * 1.25 = 1600, the width every still is asked to be. */
const SCALE = 1.25
const SHEETS = { directions: 'mascots/pip-directions.png', reactions: 'mascots/pip-reactions.png' }

async function open(browser: Browser, origin: string, path: string): Promise<Page> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  const page = await context.newPage()
  await fixTheme(page, 'light')
  await page.goto(`${origin}${path}`)
  return page
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log(`${OUT}/${name}.png  ${VIEWPORT.width * SCALE}x${VIEWPORT.height * SCALE}`)
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const clean = sheetPair('stills', LEAD)
  const result = runOn(clean)
  if (!result.ok) throw new Error('the demonstration pair no longer builds')
  stageSite('dist', WORK, result.output, 'pip')

  const site = await serve(WORK, PORT)
  const browser = await chromium.launch()
  try {
    /* 1. Describe it, and the two prompts that come out. */
    const app = await open(browser, site.origin, '/')
    await fillSetup(app, 'Pip')
    await scrollTo(app, '.prompts', -150)
    await app.waitForTimeout(600)
    await shoot(app, '1-prompts')

    /* 2. Both images back from the chat. */
    await gotoUpload(app)
    await uploadPair(app, clean)
    await app.waitForTimeout(700)
    await scrollTo(app, '.step', -8)
    await shoot(app, '2-upload')

    /* 3. The cells the app cut and lined up. */
    await build(app)
    await app.waitForTimeout(800)
    await scrollTo(app, '.grids', -90)
    await shoot(app, '3-cells')

    /* 5. The export panel. (4 is the checker, shot on a broken pair below.) */
    await toExport(app)
    await app.waitForTimeout(900)
    await scrollTo(app, '.step', -8)
    await shoot(app, '5-export')
    await app.context().close()

    /* 4. The checker, on a pair that really is wrong. */
    const bad = await open(browser, site.origin, '/')
    await fillSetup(bad, 'Pip')
    await gotoUpload(bad)
    await uploadPair(bad, sheetPair('stills-mismatch', LEAD, WRONG))
    await build(bad)
    await bad.waitForTimeout(900)
    await scrollTo(bad, '.banner', -72)
    await shoot(bad, '4-checker')
    await bad.context().close()

    /* 6. The mascot on somebody else's page. */
    const demo = await open(browser, site.origin, '/demo.html')
    await useOurMascot(demo, SHEETS.directions, SHEETS.reactions)
    await demo.waitForTimeout(1200)
    await shoot(demo, '6-demo')
    await demo.context().close()
  } finally {
    await browser.close()
    await site.stop()
  }
}

await main()
