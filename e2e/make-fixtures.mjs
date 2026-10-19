// Generates the E2E fixtures from the page-mascot fox sheets. Run: node e2e/make-fixtures.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'src', 'test', 'assets')
const out = join(here, 'fixtures')
mkdirSync(out, { recursive: true })

/** Composite an RGBA sheet over a per-pixel background; returns an opaque PNG. */
function composite(src, background) {
  const dst = new PNG({ width: src.width, height: src.height })
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const i = (y * src.width + x) * 4
      const a = src.data[i + 3] / 255
      const bg = background(x, y)
      for (let c = 0; c < 3; c += 1) dst.data[i + c] = Math.round(src.data[i + c] * a + bg[c] * (1 - a))
      dst.data[i + 3] = 255
    }
  }
  return dst
}

const load = (name) => PNG.sync.read(readFileSync(join(assets, name)))
const green = () => [0, 255, 0]
const checker = (x, y) => ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? [255, 255, 255] : [204, 204, 204])

const directions = load('fox-directions.png')
const reactions = load('fox-reactions.png')
writeFileSync(join(out, 'fox-directions-green.png'), PNG.sync.write(composite(directions, green)))
writeFileSync(join(out, 'fox-reactions-green.png'), PNG.sync.write(composite(reactions, green)))
writeFileSync(join(out, 'directions-checker.png'), PNG.sync.write(composite(directions, checker)))

// Decompression bomb: valid signature + IHDR declaring 30000x30000, then a stub chunk. Not decodable.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(30000, 0)
ihdr.writeUInt32BE(30000, 4)
ihdr.set([8, 6, 0, 0, 0], 8)
const bomb = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(join(out, 'bomb.png'), bomb)

// A text file masquerading as a PNG.
writeFileSync(join(out, 'not-an-image.png'), 'This is plain text pretending to be a PNG.\n'.repeat(20))
console.log('fixtures written to', out)
