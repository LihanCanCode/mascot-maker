import { expect, test } from '@playwright/test'
import { happyToExport, sprite } from './helpers'

test.describe('d) rebuild flow', () => {
  test('change Image detail then Rebuild returns to Export', async ({ page }) => {
    await happyToExport(page)
    const size = page.getByLabel('Image detail')
    await expect(size).toHaveValue('360')
    const rebuild = page.getByRole('button', { name: 'Rebuild at this size' })
    await expect(rebuild).toHaveAttribute('aria-disabled', 'true')

    await size.selectOption('512')
    await expect(rebuild).toHaveAttribute('aria-disabled', 'false')
    await expect(page.getByText('Your mascot is currently 360px per pose')).toBeVisible()
    await rebuild.click()

    // Rebuild goes through processing and the review step; then continue back to Export.
    await expect(page.getByRole('heading', { name: /Building your mascot|Check the result|Your mascot is ready/ })).toBeVisible()
    await page.getByRole('heading', { name: /Check the result|Your mascot is ready/ }).waitFor({ timeout: 60_000 })
    const onReview = await page.getByRole('heading', { name: 'Check the result' }).isVisible()
    test.info().annotations.push({ type: 'rebuild-lands-on', description: onReview ? 'Check step (needs Continue)' : 'Export directly' })
    if (onReview) await page.getByRole('button', { name: /Continue (anyway|to export)/ }).click()
    await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
    await expect(page.getByLabel('Image detail')).toHaveValue('512')
    await expect(page.getByRole('button', { name: 'Rebuild at this size' })).toHaveAttribute('aria-disabled', 'true')
    await expect(sprite(page)).toBeVisible()
  })

  test('cancelling a rebuild restores the previous result', async ({ page }) => {
    await happyToExport(page)
    await page.getByLabel('Image detail').selectOption('512')
    // Slow the main thread and worker so the Cancel button is observable deterministically.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
    await page.getByRole('button', { name: 'Rebuild at this size' }).click()
    await expect(page.getByRole('heading', { name: 'Building your mascot' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

    await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
    await expect(sprite(page)).toBeVisible()
    await expect(page.getByRole('button', { name: /^foxy-pal-directions|^mascot-directions/ })).toBeVisible()
    // Previous result: still 360 built; the select keeps the pending choice so the hint mentions it.
    await expect(page.getByText(/Your mascot is currently 360px per pose/)).toBeVisible()
    // And it is still usable after settling (no late result stomping the state).
    await page.waitForTimeout(3000)
    await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
    await expect(page.getByText(/Your mascot is currently 360px per pose/)).toBeVisible()
  })
})
