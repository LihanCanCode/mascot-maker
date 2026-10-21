import { expect, test } from '@playwright/test'
import { happyToExport } from './helpers'

const REPO = 'https://github.com/LihanCanCode/mascot-maker'
const ASK = 'Star Mascot Maker on GitHub'

test.describe('the star ask', () => {
  test('the header always offers the repository, in a new tab', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Star on GitHub' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', REPO)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('nothing asks before a mascot has been built', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await expect(page.getByRole('link', { name: ASK })).toHaveCount(0)
  })

  test('the ask arrives with the finished mascot, and survives a reload once dismissed', async ({ page }) => {
    await happyToExport(page)

    const ask = page.getByRole('link', { name: ASK })
    await expect(ask).toBeVisible()
    await expect(ask).toHaveAttribute('href', REPO)
    // Nothing is covered: the downloads are still right there.
    await expect(page.getByRole('button', { name: /^foxy-pal-directions\.(webp|png)$/ })).toBeVisible()

    await page.getByRole('button', { name: /No thanks/ }).click()
    await expect(ask).toBeHidden()

    await happyToExport(page)
    await expect(page.getByRole('link', { name: ASK })).toHaveCount(0)
    // The quiet one is still there, because it is not the ask.
    await expect(page.getByRole('link', { name: 'Star on GitHub' })).toBeVisible()
  })
})
