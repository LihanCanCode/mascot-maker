import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { build, fillSetup, gotoUpload, happyToExport, imageSize, reactionLayer, sprite, toExport, uploadFoxes } from './helpers'

test.describe('a) happy path', () => {
  test('setup shows both prompts, copy works, full flow to export', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await expect(page.getByText('Describe your character above and your two messages will appear here.')).toBeVisible()

    await fillSetup(page, 'Foxy Pal')
    await page.getByRole('radio', { name: /Flat|Pixel|Sticker|Colour|Watercolou?r|Line/i }).first().check()
    const msg1 = page.locator('#prompt-1 pre')
    const msg2 = page.locator('#prompt-2 pre')
    await expect(msg1).toBeVisible()
    await expect(msg2).toBeVisible()
    await expect(msg1).toContainText('orange fox')

    await page.locator('#prompt-1').getByRole('button', { name: 'Copy message' }).click()
    await expect(page.locator('#prompt-1').getByRole('button', { name: 'Copied' })).toBeVisible()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    // Windows clipboards convert LF to CRLF; compare with normalised line endings.
    expect(clip.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))).toBe((await msg1.textContent()) ?? '')

    await gotoUpload(page)
    await uploadFoxes(page)
    await build(page)
    const banner = page.getByRole('status').filter({ hasText: /Looking good|Usable, with a few notes|needs redoing|look off/ })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/Looking good|Usable, with a few notes/)
    await toExport(page)
  })

  test('export: cursor tracking, click reaction, downloads, snippets', async ({ page }) => {
    await happyToExport(page, 'Foxy Pal')
    const mascot = page.getByRole('button', { name: 'Boop the Foxy Pal' })
    await expect(mascot).toBeVisible()
    const layer = sprite(page)
    await expect.poll(async () => (await layer.evaluate((e) => (e as HTMLElement).style.backgroundImage)).startsWith('url("blob:')).toBe(true)

    const box = (await mascot.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const positionAfter = async (x: number, y: number): Promise<string> => {
      await page.mouse.move(x, y, { steps: 5 })
      await page.waitForTimeout(50) // let React commit the state update
      return layer.evaluate((e) => (e as HTMLElement).style.backgroundPosition)
    }
    const center = await positionAfter(cx, cy)
    const left = await positionAfter(cx - 250, cy)
    const right = await positionAfter(cx + 250, cy)
    const up = await positionAfter(cx, cy - 250)
    expect(new Set([center, left, right, up]).size).toBeGreaterThanOrEqual(4)
    expect(left).toBe('0% 50%')
    expect(right).toBe('100% 50%')
    expect(up).toBe('50% 0%')

    const react = reactionLayer(page)
    await expect(react).toHaveCSS('opacity', '0')
    await mascot.click()
    await expect(react).toHaveCSS('opacity', '1')
    expect(await react.evaluate((e) => (e as HTMLElement).style.backgroundImage)).toContain('blob:')
    await expect(react).toHaveCSS('opacity', '0', { timeout: 5000 })

    // Downloads
    for (const sheet of ['directions', 'reactions']) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: new RegExp(`^foxy-pal-${sheet}\\.(webp|png)$`) }).click(),
      ])
      const path = await download.path()
      const buf = readFileSync(path)
      const size = imageSize(buf)
      expect(size, `${sheet} should be webp/png`).not.toBeNull()
      expect(size!.width).toBe(size!.height)
      expect(size!.width % 3).toBe(0)
      expect(size!.width / 3).toBeGreaterThanOrEqual(256)
      // Decode it in a fresh page context to prove it is a valid image.
      const decoded = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const bmp = await createImageBitmap(new Blob([bytes]))
        return { w: bmp.width, h: bmp.height }
      }, buf.toString('base64'))
      expect(decoded).toEqual({ w: size!.width, h: size!.height })
      test.info().annotations.push({ type: 'download', description: `${download.suggestedFilename()} ${size!.type} ${size!.width}x${size!.height} cell=${size!.width / 3}` })
    }

    // Snippets
    const react_ = page.getByRole('region', { name: 'React snippet' })
    await expect(react_).toBeVisible()
    await expect(react_).toContainText('foxy-pal')
    await page.getByRole('tab', { name: 'HTML' }).click()
    const html = page.getByRole('region', { name: 'HTML snippet' })
    await expect(html).toBeVisible()
    await expect(html).toContainText('foxy-pal')
  })
})
