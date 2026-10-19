import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { CSP_BASE, imageSize, shot, sprite, watch } from './helpers'

const cards = (page: Page) => page.locator('.ggrid').getByRole('button')

/** Scroll the whole page so every lazy card has been near the viewport, then return to the top. */
async function loadEveryCard(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(60)
  }
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function openGallery(page: Page, base = ''): Promise<void> {
  await page.goto(`${base}/#gallery`)
  await expect(page.getByRole('heading', { name: 'Pick a ready-made mascot' })).toBeVisible()
}

test.describe('f) gallery', () => {
  test('lists the characters, lazy-loads pictures, no console errors or foreign requests', async ({ page, baseURL }) => {
    const w = await watch(page)
    await openGallery(page)
    await expect(cards(page)).toHaveCount(53)
    const directionsCount = (): number => w.requests.filter((r) => r.url.endsWith('-directions.webp')).length
    await expect.poll(directionsCount).toBeGreaterThan(5)
    await page.waitForLoadState('networkidle')
    const initial = directionsCount()
    expect(initial, 'only cards near the viewport load').toBeLessThan(45)
    expect(w.requests.filter((r) => r.url.endsWith('-reactions.webp'))).toEqual([])

    // scrolling to the bottom brings the rest in, one sheet per card
    await page.getByRole('button', { name: 'Wizard, person' }).scrollIntoViewIfNeeded()
    await expect.poll(directionsCount).toBeGreaterThan(initial)
    const wizardPose = page.getByRole('button', { name: 'Wizard, person' }).locator('.gcard-pose')
    await expect(wizardPose).toHaveCSS('background-image', /wizard-directions\.webp/)

    const origin = new URL(baseURL!).origin
    expect(w.requests.filter((r) => !r.url.startsWith('data:') && !r.url.startsWith('blob:') && new URL(r.url).origin !== origin)).toEqual([])
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
    expect(w.pageErrors).toEqual([])
    await loadEveryCard(page)
    await shot(page, 'gallery-1440-light.png')
  })

  test('cards are keyboard-reachable buttons with names; search and chips filter', async ({ page }) => {
    await openGallery(page)
    await page.getByLabel('Search').fill('panda')
    await expect(cards(page)).toHaveCount(2)
    await expect(page.getByRole('status').filter({ hasText: 'characters' })).toHaveText('2 characters')
    await page.getByLabel('Search').fill('')
    await page.getByRole('button', { name: 'Robots', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Robots', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(cards(page)).toHaveCount(6)
    await page.getByRole('button', { name: 'Art styles' }).click()
    await expect(cards(page)).toHaveCount(6)
    await page.getByLabel('Search').fill('zzzz')
    await expect(page.getByText('No character matches that')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(cards(page)).toHaveCount(53)

    await page.getByLabel('Search').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Fox, animal', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Fox', exact: true })).toBeFocused()
  })

  test('detail: live mascot follows the pointer; use panel downloads valid files', async ({ page }) => {
    await openGallery(page)
    await page.getByRole('button', { name: 'Fox, animal', exact: true }).click()
    const boop = page.getByRole('button', { name: 'Boop the Fox' })
    await expect(boop).toBeVisible()
    const box = (await boop.boundingBox())!
    const cy = box.y + box.height / 2
    const layer = sprite(page)
    await page.mouse.move(box.x + box.width / 2 + 300, cy)
    await expect.poll(() => layer.evaluate((e) => (e as HTMLElement).style.backgroundPosition)).toBe('100% 50%')
    await page.mouse.move(box.x + box.width / 2 - 300, cy)
    await expect.poll(() => layer.evaluate((e) => (e as HTMLElement).style.backgroundPosition)).toBe('0% 50%')
    await expect(layer).toHaveCSS('background-image', /fox-directions\.webp/)

    await page.getByRole('radio', { name: 'pixel' }).check()
    await expect(page.getByRole('heading', { name: 'Fox, pixel' })).toBeVisible()
    await expect(sprite(page)).toHaveCSS('background-image', /fox-pixel-directions\.webp/)
    await page.getByRole('slider', { name: /Preview size/ }).fill('220')
    await shot(page, 'gallery-detail-1440-light.png')

    await page.getByRole('button', { name: 'Use this mascot' }).click()
    await expect(page.getByRole('heading', { name: 'Use Fox, pixel on your site' })).toBeVisible()
    for (const name of ['fox-pixel-directions.webp', 'fox-pixel-reactions.webp']) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name }).click()])
      expect(download.suggestedFilename()).toBe(name)
      const buf = readFileSync((await download.path())!)
      const size = imageSize(buf)
      expect(size?.type).toBe('webp')
      expect(size!.width).toBeGreaterThan(300)
      expect(buf.length).toBeGreaterThan(5000)
    }
    const [js] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'page-mascot.js' }).click()])
    expect(readFileSync((await js.path())!, 'utf8')).toContain('customElements.define')
    const [tsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Mascot.tsx' }).click()])
    expect(readFileSync((await tsx.path())!, 'utf8')).toContain('export function Mascot')

    const panel = page.getByRole('tabpanel')
    await expect(panel).toContainText('/mascots/fox-pixel-directions.webp')
    await page.getByRole('tab', { name: 'HTML' }).click()
    await expect(page.getByRole('tabpanel')).toContainText('<page-mascot')
    await expect(page.getByText('Gallery art by Kamran Ahmed')).toBeVisible()
    await shot(page, 'gallery-use-1440-light.png')

    await page.getByRole('button', { name: 'Make one that looks like you' }).click()
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeFocused()
  })

  test('mode switch and header links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Make my own' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Gallery' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a ready-made mascot' })).toBeFocused()
    await expect(page).toHaveURL(/#gallery$/)
    await expect(page.getByRole('navigation', { name: 'Progress' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Make my own' }).click()
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'See it on a page' })).toHaveAttribute('href', 'demo.html')
  })

  test('dark theme and mobile layouts', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openGallery(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await loadEveryCard(page)
    await shot(page, 'gallery-390-light.png')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await shot(page, 'gallery-390-dark.png')
    await page.setViewportSize({ width: 1440, height: 900 })
    await loadEveryCard(page)
    await shot(page, 'gallery-1440-dark.png')
  })

  test('works under the production CSP (images, preview, downloads)', async ({ page }) => {
    const w = await watch(page)
    await openGallery(page, CSP_BASE)
    await page.getByRole('button', { name: 'Otter, animal', exact: true }).click()
    await expect(sprite(page)).toHaveCSS('background-image', /otter-directions\.webp/)
    await page.getByRole('button', { name: 'Use this mascot' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'otter-directions.webp' }).click()])
    expect(imageSize(readFileSync((await download.path())!))?.type).toBe('webp')
    await page.waitForLoadState('networkidle')
    expect(w.cspViolations).toEqual([])
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
  })
})
