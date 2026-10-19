// Screenshot the live studio (light, dark, phone) and exercise pointer + reaction + download.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const types = { '.js': 'text/javascript', '.html': 'text/html' }
const reqs = []
const server = createServer((req, res) => { const p = req.url === '/' ? '/index.html' : req.url.split('?')[0]; reqs.push(p); try { res.writeHead(200, { 'content-type': types[extname(p)] || 'text/html' }); res.end(readFileSync(join(here, p))) } catch { res.writeHead(404); res.end() } })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch()
const errs = []
const ext = []
for (const [name, vp, scheme] of [['light', { width: 1360, height: 1000 }, 'light'], ['dark', { width: 1360, height: 1000 }, 'dark'], ['phone', { width: 390, height: 900 }, 'light']]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) ext.push(r.url()) })
  await page.goto(base)
  await page.waitForSelector('html[data-ready="1"]')
  if (name === 'light') {
    await page.getByRole('button', { name: 'Bun + glasses' }).click(); await page.waitForTimeout(400)
    const box = await page.locator('#mascot').boundingBox()
    await page.mouse.move(box.x + box.width + 200, box.y - 100); await page.waitForTimeout(100)
    console.log('bg-pos after move up-right:', await page.locator('#l-dir').evaluate((e) => e.style.backgroundPosition))
    await page.locator('#mascot').click(); await page.waitForTimeout(250)
    console.log('reaction:', await page.locator('#reaction-name').innerText())
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download directions.png' }).click()])
    console.log('download:', dl.suggestedFilename())
    await page.mouse.move(box.x + box.width + 200, box.y - 100)
  }
  await page.screenshot({ path: join(here, 'out', `studio-${name}.png`), fullPage: true })
  await ctx.close()
}
console.log('page errors:', errs.length ? errs : 'none', '| external requests:', ext.length ? ext : 'none')
await browser.close(); server.close()
