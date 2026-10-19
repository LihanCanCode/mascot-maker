// Geometry QA: per-cell margins (alpha bbox) and body-identity (lower torso rows) for every preset.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const server = createServer((req, res) => {
  const p = req.url === '/' ? '/blank.html' : req.url.split('?')[0]
  try { res.writeHead(200, { 'content-type': extname(p) === '.js' ? 'text/javascript' : 'text/html' }); res.end(p === '/blank.html' ? '<!doctype html>' : readFileSync(join(here, p))) } catch { res.writeHead(404); res.end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${server.address().port}`)
const rows = await page.evaluate(async () => {
  const { renderSheet } = await import('/rig.js'); const { PRESETS } = await import('/presets.js')
  const make = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
  const out = []
  for (const [name, cfg] of Object.entries(PRESETS)) for (const kind of ['directions', 'reactions']) {
    const cv = renderSheet(cfg, kind, { createCanvas: make }); const ctx = cv.getContext('2d')
    let minM = 999, bodyDiff = 0, ref = null
    for (let i = 0; i < 9; i++) {
      const ox = (i % 3) * 512, oy = Math.floor(i / 3) * 512
      const d = ctx.getImageData(ox, oy, 512, 512).data
      let x0 = 512, y0 = 512, x1 = 0, y1 = 0
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if (d[(y * 512 + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      minM = Math.min(minM, x0, y0, 511 - x1, 511 - y1)
      const body = ctx.getImageData(ox + 150, oy + 392, 212, 52).data
      if (!ref) ref = body; else for (let k = 0; k < body.length; k++) if (body[k] !== ref[k]) { bodyDiff++; if (window.__dbg !== 1 && name==='fox') { window.__dbg = 1; out.push(`first diff cell ${i} px ${(k>>2)%212},${Math.floor((k>>2)/212)+392} ${body[k]} vs ${ref[k]}`) } break }
    }
    out.push(`${name.padEnd(7)} ${kind.padEnd(10)} minMargin=${minM}px  cellsWithBodyDiff=${bodyDiff}`)
  }
  return out
})
console.log(rows.join('\n'))
await browser.close(); server.close()
