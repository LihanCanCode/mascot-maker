import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { build, CSP_BASE, fillSetup, gotoUpload, imageSize, reactionLayer, sprite, toExport, uploadFoxes, watch } from './helpers'

test.describe('c) privacy and CSP', () => {
  test('no third-party requests, no console errors, whole flow', async ({ page, baseURL }) => {
    const w = await watch(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const afterLoad = w.requests.length
    await fillSetup(page)
    await gotoUpload(page)
    await uploadFoxes(page)
    await build(page)
    await toExport(page)
    await expect(sprite(page)).toBeVisible()
    await page.waitForLoadState('networkidle')

    const origin = new URL(baseURL!).origin
    const offenders = w.requests.filter((r) => {
      if (r.url.startsWith('blob:') || r.url.startsWith('data:')) return false
      return new URL(r.url).origin !== origin
    })
    expect(offenders, JSON.stringify(offenders)).toEqual([])
    // After the initial page load only blob:/data: (and same-origin worker/chunk) loads may happen; no fetch/xhr/ws/beacon.
    const late = w.requests.slice(afterLoad).filter((r) => !r.url.startsWith('blob:') && !r.url.startsWith('data:'))
    const lateNet = late.filter((r) => ['fetch', 'xhr', 'websocket', 'ping', 'eventsource'].includes(r.type))
    expect(lateNet, JSON.stringify(lateNet)).toEqual([])
    const nonGet = w.requests.filter((r) => r.method !== 'GET')
    expect(nonGet).toEqual([])
    test.info().annotations.push({ type: 'requests', description: w.requests.map((r) => `${r.type} ${r.url.slice(0, 80)}`).join(' | ') })
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
    expect(w.pageErrors).toEqual([])
    expect(w.cspViolations).toEqual([])
  })

  test('happy path under the production CSP header', async ({ page }) => {
    const w = await watch(page)
    const response = await page.goto(`${CSP_BASE}/`)
    const csp = response!.headers()['content-security-policy']
    expect(csp, 'CSP header must be served').toContain("default-src 'self'")
    expect(csp).toContain("worker-src 'self' blob:")
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await fillSetup(page, 'Foxy Pal')
    await gotoUpload(page)
    await uploadFoxes(page)
    await expect(page.locator('.dropzone-thumb').first()).toBeVisible()
    // blob: preview actually loaded (naturalWidth>0), not blocked.
    await expect.poll(() => page.locator('.dropzone-thumb').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(300)
    await build(page)
    await expect(page.getByRole('status').filter({ hasText: /Looking good|Usable, with a few notes/ })).toBeVisible()
    await toExport(page)

    const mascot = page.getByRole('button', { name: 'Boop the Foxy Pal' })
    await expect(mascot).toBeVisible()
    const layer = sprite(page)
    const box = (await mascot.boundingBox())!
    await page.mouse.move(box.x + box.width / 2 - 250, box.y + box.height / 2, { steps: 4 })
    await expect.poll(() => layer.evaluate((e) => (e as HTMLElement).style.backgroundPosition)).toBe('0% 50%')
    await mascot.click()
    await expect(reactionLayer(page)).toHaveCSS('opacity', '1')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^foxy-pal-directions\.(webp|png)$/ }).click(),
    ])
    const size = imageSize(readFileSync(await download.path()))
    expect(size).not.toBeNull()
    expect(size!.width % 3).toBe(0)

    expect(w.cspViolations, w.cspViolations.join('\n')).toEqual([])
    expect(w.consoleErrors, w.consoleErrors.join('\n')).toEqual([])
    expect(w.pageErrors).toEqual([])
    const origin = new URL(CSP_BASE).origin
    const external = w.requests.filter((r) => !r.url.startsWith('blob:') && !r.url.startsWith('data:') && new URL(r.url).origin !== origin)
    expect(external).toEqual([])
  })
})
