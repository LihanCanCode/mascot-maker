import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { CSP_BASE, SCREENSHOTS, shot, watch } from './helpers'

const layer = (page: Page) => page.getByRole('button', { name: /^Boop the/ }).locator('> span > span').first()

test.describe('g) demo page', () => {
  test('loads with no console errors and no foreign requests', async ({ page, baseURL }) => {
    const w = await watch(page)
    await page.goto('/demo.html')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Roasted Tuesday')
    await expect(page.getByRole('button', { name: 'Boop the Fox' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const origin = new URL(baseURL!).origin
    const foreign = w.requests.filter((r) => !r.url.startsWith('data:') && !r.url.startsWith('blob:') && new URL(r.url).origin !== origin)
    expect(foreign, JSON.stringify(foreign)).toEqual([])
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
    expect(w.pageErrors).toEqual([])
    expect(w.requests.filter((r) => r.method !== 'GET')).toEqual([])
    // the shipped element, not a copy
    expect(await page.evaluate(() => customElements.get('page-mascot') !== undefined)).toBe(true)
    await page.screenshot({ path: join(SCREENSHOTS, 'demo-hero-1280-light.png') })
    await shot(page, 'demo-1440-light.png')
  })

  test('the mascot at the top follows the pointer', async ({ page }) => {
    await page.goto('/demo.html')
    const boop = page.getByRole('button', { name: 'Boop the Fox' })
    const box = (await boop.boundingBox())!
    expect(box.y).toBeLessThan(500)
    expect(box.y + box.height / 2 + 150).toBeLessThan(720)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const position = () => layer(page).evaluate((e) => (e as HTMLElement).style.backgroundPosition)
    const seen = new Set<string>()
    for (const [dx, dy, want] of [
      [300, 0, '100% 50%'],
      [-300, 0, '0% 50%'],
      [0, 150, '50% 100%'],
      [0, -150, '50% 0%'],
    ] as const) {
      await page.mouse.move(cx + dx, cy + dy)
      await expect.poll(position).toBe(want)
      seen.add(await position())
    }
    expect(seen.size).toBe(4)
    await page.mouse.move(cx + 5, cy + 5)
    await expect.poll(position).toBe('50% 50%')
  })

  test('picking another mascot swaps the sheets live; size slider; copy embed code', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    const w = await watch(page)
    await page.goto('/demo.html')
    const picker = page.getByRole('complementary', { name: 'Try another mascot' })
    await expect(picker.getByRole('button', { pressed: true })).toHaveText('Fox')
    await expect(picker.getByRole('group', { name: 'Mascots' }).getByRole('button')).toHaveCount(8)

    await picker.getByRole('button', { name: 'Panda', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Boop the Panda' })).toBeVisible()
    await expect(layer(page)).toHaveCSS('background-image', /panda-directions\.webp/)
    await expect(page.locator('#mascot')).toHaveAttribute('reactions', /panda-reactions\.webp$/)
    await expect(picker.getByRole('button', { name: 'Panda', exact: true })).toBeFocused()
    await expect(picker.getByRole('status')).toHaveText('Now showing Panda.')
    await page.waitForLoadState('networkidle')
    expect(w.requests.some((r) => r.url.endsWith('/mascots/panda-directions.webp'))).toBe(true)

    await picker.getByRole('slider', { name: /Mascot size/ }).fill('120')
    await expect(page.locator('#mascot')).toHaveAttribute('size', '120')
    expect((await page.getByRole('button', { name: 'Boop the Panda' }).boundingBox())!.width).toBe(120)

    await picker.getByRole('button', { name: 'Copy embed code' }).click()
    await expect(picker.getByRole('status')).toHaveText('Copied the embed code for Panda.')
    const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')
    expect(clip).toContain('<page-mascot')
    expect(clip).toContain('/mascots/panda-directions.webp')
    expect(clip).toContain('size="120"')
    expect(clip).toContain('label="Panda"')
    expect(w.consoleErrors).toEqual([])
  })

  test('links lead to the gallery and the maker; picker can collapse', async ({ page }) => {
    await page.goto('/demo.html')
    const picker = page.getByRole('complementary', { name: 'Try another mascot' })
    await picker.getByRole('button', { name: 'Hide' }).click()
    await expect(picker.getByRole('button', { name: 'Show options' })).toHaveAttribute('aria-expanded', 'false')
    await expect(picker.getByRole('button', { name: 'Fox' })).toBeHidden()
    await picker.getByRole('button', { name: 'Show options' }).click()
    await expect(picker.getByRole('link', { name: 'Open gallery' })).toHaveAttribute('href', 'index.html#gallery')
    await expect(picker.getByRole('link', { name: 'Make your own' })).toHaveAttribute('href', 'index.html')
    await picker.getByRole('link', { name: 'Open gallery' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a ready-made mascot' })).toBeVisible()
    await page.goBack()
    await picker.getByRole('link', { name: 'Make your own' }).click()
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
  })

  test('brew calculator, theme toggle and keyboard order', async ({ page }) => {
    await page.goto('/demo.html')
    await page.locator('#cups').fill('4')
    await expect(page.locator('#calc-out')).toHaveText('Use 63 g of coffee and 1000 g of water.')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
    await shot(page, 'demo-1440-dark.png')
    await page.keyboard.press('Home')
    await page.getByRole('link', { name: 'Skip to this week' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#roasts$/)
  })

  test('mobile layout has no horizontal scroll and the mascot sits at the top', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/demo.html')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const box = (await page.getByRole('button', { name: 'Boop the Fox' }).boundingBox())!
    expect(box.y).toBeLessThan(260)
    await shot(page, 'demo-390-light.png')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await shot(page, 'demo-390-dark.png')
  })

  test('works under the production CSP with no violations', async ({ page }) => {
    const w = await watch(page)
    await page.goto(`${CSP_BASE}/demo.html`)
    await expect(page.getByRole('button', { name: 'Boop the Fox' })).toBeVisible()
    await expect(layer(page)).toHaveCSS('background-image', /fox-directions\.webp/)
    await page.getByRole('complementary').getByRole('button', { name: 'Owl', exact: true }).click()
    await expect(layer(page)).toHaveCSS('background-image', /owl-directions\.webp/)
    await page.waitForLoadState('networkidle')
    expect(w.cspViolations).toEqual([])
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
  })
})
