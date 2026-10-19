// Renders contact sheets of every studio preset (centre cell + the 9 reactions) plus full
// per-preset direction/reaction sheets for close inspection. Output: spikes/studio/out/contact-*.png
// usage: node scripts/studio-contact-sheet.mjs [--cell 192] [--only fox,sam] [--full]
import { createCanvas, ImageData } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStudio, outDir } from './studio-bundle.mjs'

const args = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : dflt
}
const SLOT = Number(flag('cell', '192'))
const only = flag('only', '')
const wantFull = args.includes('--full')
const bg = flag('bg', '#f6f1ea')
const zoom = flag('zoom', '')

const { STUDIO_PRESETS, renderCell, renderSheet } = await loadStudio()
const factory = (w, h) => createCanvas(w, h)
const presets = STUDIO_PRESETS.filter((p) => !only || only.split(',').includes(p.id))

function toCanvas(img) {
  const cv = createCanvas(img.width, img.height)
  cv.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  return cv
}

function contact(list, file) {
  const cols = 10
  const cv = createCanvas(cols * SLOT, list.length * SLOT)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.imageSmoothingQuality = 'high'
  list.forEach((p, row) => {
    const cells = [renderCell(p.config, 'directions', 4, { cell: 256, createCanvas: factory })]
    for (let i = 0; i < 9; i++) cells.push(renderCell(p.config, 'reactions', i, { cell: 256, createCanvas: factory }))
    cells.forEach((img, col) => ctx.drawImage(toCanvas(img), col * SLOT, row * SLOT, SLOT, SLOT))
  })
  writeFileSync(join(outDir, file), cv.toBuffer('image/png'))
  console.log('wrote', file, `(${list.map((p) => p.id).join(', ')})`)
}

mkdirSync(outDir, { recursive: true })
for (const tag of ['animal', 'person', 'robot']) {
  const list = presets.filter((p) => p.tag === tag)
  if (list.length) contact(list, `contact-${tag}.png`)
}
if (wantFull) {
  for (const p of presets) {
    for (const kind of ['directions', 'reactions']) {
      const img = renderSheet(p.config, kind, { cell: 384, createCanvas: factory, background: 'transparent' })
      const cv = createCanvas(img.width, img.height)
      const ctx = cv.getContext('2d')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.drawImage(toCanvas(img), 0, 0)
      writeFileSync(join(outDir, `studio-${p.id}-${kind}.png`), cv.toBuffer('image/png'))
    }
  }
  console.log('wrote full sheets')
}

// --zoom <id>[,<id>]: centre + selected reactions at 512 px for close inspection (zoom-<id>.png)
if (zoom) {
  for (const id of zoom.split(',')) {
    const p = STUDIO_PRESETS.find((q) => q.id === id)
    if (!p) throw new Error('unknown preset ' + id)
    const picks = [['directions', 4], ['directions', 2], ['reactions', 5], ['reactions', 2]]
    const cv = createCanvas(picks.length * 512, 512)
    const ctx = cv.getContext('2d')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height)
    picks.forEach(([kind, idx], i) => ctx.drawImage(toCanvas(renderCell(p.config, kind, idx, { cell: 512, createCanvas: factory })), i * 512, 0))
    writeFileSync(join(outDir, 'zoom-' + id + '.png'), cv.toBuffer('image/png'))
    console.log('wrote zoom-' + id + '.png')
  }
}
