import { expect, test, type Download, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { happyToExport, shot, watch } from './helpers'

const NAME = 'Foxy Pal'

async function savedCard(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: 'My gallery' })).toBeVisible()
  await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible()
}

async function openSaved(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Mode' }).getByRole('button', { name: 'My gallery' }).click()
}

test.describe('g) my gallery', () => {
  test('save, reload, export, clear, import: the mascot comes back', async ({ page }) => {
    const seen = await watch(page)
    await happyToExport(page, NAME)

    // Nothing saved yet: the empty state explains the feature.
    await openSaved(page)
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()
    await expect(page.getByText(/saved in this browser on this device only/)).toBeVisible()
    await expect(page.getByText(/0 mascots, 0 bytes in this browser/)).toBeVisible()

    // Back to the export step, and save.
    await page.getByRole('navigation', { name: 'Mode' }).getByRole('button', { name: 'Make my own' }).click()
    await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
    const save = page.getByRole('button', { name: 'Save to my gallery' })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(`${NAME} is in your gallery.`)).toBeVisible()

    // Pressing it again must update, not duplicate.
    await save.click()
    await page.getByRole('button', { name: 'View my gallery' }).click()
    await savedCard(page, NAME)
    await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(1)

    // THE TEST THAT MATTERS: it is still there after a reload.
    await page.goto('/#saved')
    await savedCard(page, NAME)
    await expect(page.getByText(/1 mascot, \d+ kB in this browser/)).toBeVisible()
    await expect(page.getByRole('button', { name: `Boop the ${NAME}` })).toBeVisible()

    // Detail view: downloads and snippets off the saved blobs.
    await page.getByRole('button', { name: `Open ${NAME}` }).click()
    await expect(page.getByRole('heading', { level: 2, name: NAME })).toBeVisible()
    const sheet = page.getByRole('button', { name: /^foxy-pal-directions\.(webp|png)$/ })
    const [sheetFile] = await Promise.all([page.waitForEvent('download'), sheet.click()])
    expect((await readFile(await sheetFile.path())).length).toBeGreaterThan(1000)
    await expect(page.getByRole('tab', { name: 'React' })).toBeVisible()
    await page.getByRole('button', { name: 'Back to my gallery' }).click()

    // Export the whole gallery to a file.
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export my gallery to a file' }).click(),
    ])
    const text = await readGallery(file)
    expect(JSON.parse(text)).toMatchObject({ format: 'mascot-maker.gallery', version: 1 })

    // Delete everything, then bring it back from the file.
    await page.getByRole('button', { name: 'Delete everything' }).click()
    await page.getByRole('button', { name: 'Yes, delete everything' }).click()
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()

    await page.getByLabel('Import a gallery file').setInputFiles({
      name: 'my-mascots.mascotgallery.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text, 'utf8'),
    })
    await expect(page.getByText('Imported 1 new and updated 0 already here.')).toBeVisible()
    await savedCard(page, NAME)

    // And it survives a reload after the import too.
    await page.reload()
    await savedCard(page, NAME)

    expect(seen.pageErrors).toEqual([])
    expect(seen.requests.filter((r) => !r.url.includes('127.0.0.1'))).toEqual([])
  })

  test('rename and delete one, with a confirmation step', async ({ page }) => {
    await happyToExport(page, 'Mochi')
    await page.getByRole('button', { name: 'Save to my gallery' }).click()
    await page.getByRole('button', { name: 'View my gallery' }).click()
    await page.getByRole('button', { name: 'Open Mochi' }).click()

    const field = page.getByLabel('Name', { exact: true })
    await field.fill('Captain Mochi')
    await page.getByRole('button', { name: 'Rename' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Captain Mochi' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete this mascot' }).click()
    await expect(page.getByText('Delete Captain Mochi? This cannot be undone.')).toBeVisible()
    await page.getByRole('button', { name: 'Keep it' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Captain Mochi' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete this mascot' }).click()
    await page.getByRole('button', { name: 'Yes, delete it' }).click()
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()

    await page.reload()
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()
  })

  test('looks right empty, full, in dark, and on a phone', async ({ page }) => {
    await page.goto('/#saved')
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()
    await shot(page, 'saved-empty.png')

    await happyToExport(page, 'Foxy Pal')
    await page.getByRole('button', { name: 'Save to my gallery' }).click()
    await expect(page.getByText('Foxy Pal is in your gallery.')).toBeVisible()
    await shot(page, 'saved-button.png')
    await page.getByRole('button', { name: 'View my gallery' }).click()
    await savedCard(page, 'Foxy Pal')
    await shot(page, 'saved-grid-light.png')

    await page.getByRole('button', { name: 'Open Foxy Pal' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Foxy Pal' })).toBeVisible()
    await shot(page, 'saved-detail-light.png')

    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await shot(page, 'saved-detail-dark.png')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Back to my gallery' }).click()
    await savedCard(page, 'Foxy Pal')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await shot(page, 'saved-390-dark.png')
  })

  test('rejects a damaged gallery file without throwing', async ({ page }) => {
    await page.goto('/#saved')
    await expect(page.getByRole('heading', { level: 2, name: 'My gallery' })).toBeVisible()
    await page.getByLabel('Import a gallery file').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"mascot-maker.gallery","version":1,"mascots":[{"name":"x"}]}', 'utf8'),
    })
    await expect(page.getByText(/Mascot 1 in that file is incomplete or damaged/)).toBeVisible()
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible()
  })
})

async function readGallery(download: Download): Promise<string> {
  expect(download.suggestedFilename()).toBe('my-mascots.mascotgallery.json')
  const path = await download.path()
  return readFile(path, 'utf8')
}
