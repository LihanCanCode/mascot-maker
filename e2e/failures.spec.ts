import { expect, test } from '@playwright/test'
import { build, fileInput, fillSetup, fixture, gotoUpload, uploadFoxes } from './helpers'

test.describe('b) failure paths', () => {
  test('checkerboard directions sheet gives a blocking issue and no export', async ({ page }) => {
    await page.goto('/')
    await fillSetup(page)
    await gotoUpload(page)
    await uploadFoxes(page, 'directions-checker.png')
    await build(page)

    const banner = page.getByRole('status').filter({ hasText: /redoing|look off/ })
    await expect(banner).toBeVisible()
    const issues = page.locator('.issue')
    await expect(issues.first()).toBeVisible()
    const text = (await page.locator('.issues').innerText()).toLowerCase()
    expect(text).toContain('checker')
    expect(text).toContain('blocks export')
    await expect(page.locator('.issue[data-severity="error"]').first()).toContainText(/checker/i)
    await expect(page.locator('.issue-fix').first()).not.toBeEmpty()
    test.info().annotations.push({ type: 'checkerboard-copy', description: (await issues.first().innerText()).replace(/\s+/g, ' ') })

    await expect(page.getByRole('button', { name: /Continue (anyway|to export)/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  test('decompression-bomb PNG is rejected politely', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('crash', () => errors.push('page crashed'))
    await page.goto('/')
    await fillSetup(page)
    await gotoUpload(page)
    const t0 = Date.now()
    await fileInput(page, 'directions').setInputFiles(fixture('bomb.png'))
    const alert = page.getByRole('alert').filter({ hasText: /./ })
    await expect(alert.first()).toBeVisible({ timeout: 10_000 })
    const msg = await alert.first().innerText()
    test.info().annotations.push({ type: 'bomb-message', description: `${msg} (${Date.now() - t0} ms)` })
    expect(msg).not.toMatch(/undefined|\[object|Error:|NaN/)
    expect(msg.length).toBeGreaterThan(15)
    await expect(page.getByRole('button', { name: 'Remove directions image' })).toBeVisible()
    // App still responsive: the other slot accepts a good file.
    await fileInput(page, 'reactions').setInputFiles(fixture('fox-reactions-green.png'))
    await expect(page.getByAltText('Preview of your reactions image')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('non-image file renamed .png is rejected politely', async ({ page }) => {
    await page.goto('/')
    await gotoUpload(page)
    await fileInput(page, 'directions').setInputFiles(fixture('not-an-image.png'))
    const alert = page.getByRole('alert').filter({ hasText: /./ })
    await expect(alert.first()).toBeVisible()
    await expect(alert.first()).toContainText(/does not look like a PNG, JPEG or WEBP/)
    await expect(page.getByRole('button', { name: 'Build my mascot' })).toHaveAttribute('aria-disabled', 'true')
    // Retry with a real file recovers.
    await fileInput(page, 'directions').setInputFiles(fixture('fox-directions-green.png'))
    await expect(page.getByAltText('Preview of your directions image')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveCount(0)
  })

  test('build with only one image does nothing destructive', async ({ page }) => {
    await page.goto('/')
    await gotoUpload(page)
    await fileInput(page, 'directions').setInputFiles(fixture('fox-directions-green.png'))
    await page.getByRole('button', { name: 'Build my mascot' }).click({ force: true }) // aria-disabled, not disabled
    await expect(page.getByRole('heading', { name: 'Upload your two images' })).toBeVisible()
    await expect(page.getByText('Add both images to continue.')).toBeVisible()
  })
})
