// Run presets through the REAL app (dev server) like a user: upload both PNGs, Build, read the verdict.
// usage: node pipeline.mjs [presetNames...]    needs out/<preset>-{directions,reactions}[-green].png (node render.mjs)
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = join(dirname(fileURLToPath(import.meta.url)), 'out')
const APP = process.env.APP_URL || 'http://127.0.0.1:5173/'
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['fox', 'beard', 'bun']
const browser = await chromium.launch()
const input = (page, t) => page.locator('.dropzone-wrap').filter({ hasText: t }).locator('input[type=file]')
for (const name of names) for (const variant of ['', '-green']) {
  const d = join(out, `${name}-directions${variant}.png`), r = join(out, `${name}-reactions${variant}.png`)
  if (!existsSync(d) || !existsSync(r)) { console.log(name + variant, 'missing PNGs'); continue }
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } })
  await page.goto(APP)
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('What does it look like?').fill('a cartoon mascot')
  await page.getByRole('button', { name: 'I have both images' }).click()
  await input(page, 'Directions image').setInputFiles(d)
  await input(page, 'Reactions image').setInputFiles(r)
  await page.getByRole('button', { name: 'Build my mascot' }).click()
  await page.getByRole('heading', { name: 'Check the result' }).waitFor({ timeout: 90000 })
  await page.waitForTimeout(600)
  const banner = (await page.locator('.banner[role=status]').first().innerText()).replace(/\s+/g, ' ')
  const tone = await page.locator('.banner[role=status]').first().getAttribute('data-tone')
  const body = (await page.locator('.step').innerText()).replace(/\n{2,}/g, '\n')
  const notes = body.split('\n').filter((l) => /shift|boop|margin|edge|crop|shoulder|align|background|key|fringe|halo|mirror|size|cell|cut/i.test(l)).slice(0, 14)
  console.log(`\n=== ${name}${variant || ' (transparent)'}  tone=${tone}\n${banner}\n${notes.map((n) => '  - ' + n.trim()).join('\n')}`)
  await page.screenshot({ path: join(out, `check-${name}${variant || '-transparent'}.png`), fullPage: true })
  await page.close()
}
await browser.close()
