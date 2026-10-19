import { chromium } from '@playwright/test'
const out = 'e2e/screenshots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } })
await page.goto('http://127.0.0.1:5173/')
await page.getByLabel('Name', { exact: true }).fill('Me')
await page.getByLabel('What does it look like?').fill('a man with short black hair, a small beard and a black t-shirt')
await page.getByRole('button', { name: 'I have both images' }).click()
const input = (t) => page.locator('.dropzone-wrap').filter({ hasText: t }).locator('input[type=file]')
await input('Directions image').setInputFiles('e2e/fixtures/real/directions.jpg')
await input('Reactions image').setInputFiles('e2e/fixtures/real/reactions.jpg')
await page.getByRole('button', { name: 'Build my mascot' }).click()
await page.getByRole('heading', { name: 'Check the result' }).waitFor({ timeout: 90000 })
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/real-review.png`, fullPage: true })
const cont = page.getByRole('button', { name: /Continue (anyway|to export)/ })
console.log('continue button:', await cont.count() ? await cont.first().innerText() : 'none')
if (await cont.count()) { await cont.first().click(); await page.getByRole('heading', { name: 'Your mascot is ready' }).waitFor(); await page.waitForTimeout(2000); await page.screenshot({ path: `${out}/real-export.png`, fullPage: true }) }
await browser.close()
