// Headless render: node render.mjs [presetNames...]  -> out/<preset>-{directions,reactions}[-green].png
// Uses Playwright chromium (browsers on D:) and a throwaway static server; no network.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
mkdirSync(out, { recursive: true })
const mime = { '.js': 'text/javascript', '.html': 'text/html' }
const server = createServer((req, res) => {
  const p = req.url === '/' ? '/blank.html' : req.url.split('?')[0]
  try {
    const body = p === '/blank.html' ? '<!doctype html><title>r</title>' : readFileSync(join(here, p))
    res.writeHead(200, { 'content-type': mime[extname(p)] || 'text/html' }); res.end(body)
  } catch { res.writeHead(404); res.end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('PAGE ERROR', e))
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()))
await page.goto(base)
const names = process.argv.slice(2)
const result = await page.evaluate(async (names) => {
  const { renderSheet } = await import('/rig.js')
  const { PRESETS } = await import('/presets.js')
  const make = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
  const res = {}
  for (const name of names.length ? names : Object.keys(PRESETS)) {
    for (const kind of ['directions', 'reactions']) {
      for (const bg of ['transparent', '#00FF00']) {
        const cv = renderSheet(PRESETS[name], kind, { createCanvas: make, background: bg })
        res[`${name}-${kind}${bg === '#00FF00' ? '-green' : ''}`] = cv.toDataURL('image/png').split(',')[1]
      }
    }
  }
  return res
}, names)
for (const [k, b64] of Object.entries(result)) writeFileSync(join(out, `${k}.png`), Buffer.from(b64, 'base64'))
console.log('wrote', Object.keys(result).length, 'PNGs to', out)
await browser.close(); server.close()
