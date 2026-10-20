/**
 * The animated demo at the top of the README.
 *
 *   pnpm run gif
 *
 * A mascot follows a cursor around a closed lap, gets booped four times, and
 * the cursor returns to exactly where it started, so the loop has no seam.
 *
 * No screen recording is involved. The character is drawn by `src/studio`,
 * rendered onto the flat green the prompts ask a chat model for, and then put
 * through the real `runPipeline`; what is blitted per frame is the pipeline's
 * own output tiles. Every pose comes from `sectorFor` and every reaction from
 * `BOOP_TIMING`, so the GIF is a proof of the pipeline and the runtime rather
 * than an illustration of them.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ffmpeg, report } from './media/ffmpeg'
import { drawClick, drawCursor } from './media/cursor'
import { drawMascot, tilesOf } from './media/mascot'
import { INK, INK_SOFT, PAPER, SURFACE, SUN, VIOLET } from './media/palette'
import { LEAD, runOn, sheetPair } from './media/sheets'
import { DISPLAY_FONT, ctxOf, roundRect, surface } from './media/surface'
import { boopBeat, lap, orbitAt, perform, still, travel } from './media/runtime'
import type { Frame, Orbit } from './media/runtime'

const WIDTH = 720
const HEIGHT = 440
const FPS = 14
const MASCOT = 300
/** Centre of the mascot element, and so the origin `sectorFor` measures from. */
const CX = WIDTH / 2
const CY = 208
/** On the cheek: on the face, where a visitor would poke, but clear of the eyes
 * so the reaction is never hidden behind the pointer. */
const BOOP_AT = { x: CX + 32, y: CY + 14 }
/**
 * The orbit has to clear the component's 70px dead zone in every direction or
 * the mascot would simply stare straight ahead for part of the lap.
 */
const ORBIT: Orbit = { cx: CX, cy: CY, rx: 250, ry: 150, from: -Math.PI / 2 }

const FRAMES = join('out', 'gif-frames')
const PALETTE = join('out', 'gif-palette.png')
const OUTPUT = join('docs', 'images', 'demo.gif')

function script(): ReturnType<typeof lap> {
  const start = orbitAt(ORBIT, 0)
  return [
    ...lap(ORBIT, 36),
    ...travel(start, BOOP_AT, 8),
    // Four boops in a row: heart, sparkle, delighted, and then the streak's dizzy.
    ...boopBeat(BOOP_AT, 8),
    ...boopBeat(BOOP_AT, 8),
    ...boopBeat(BOOP_AT, 8),
    ...boopBeat(BOOP_AT, 17),
    ...travel(BOOP_AT, start, 11),
    ...still(start, 6),
  ]
}

function backdrop(ctx: ReturnType<typeof ctxOf>): void {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // A die-cut sticker, the shape every card in the app is.
  ctx.fillStyle = INK
  roundRect(ctx, 18, 18, WIDTH - 32, HEIGHT - 32, 22)
  ctx.fill()
  ctx.fillStyle = SURFACE
  roundRect(ctx, 14, 14, WIDTH - 32, HEIGHT - 32, 22)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = SUN
  roundRect(ctx, 34, HEIGHT - 66, 186, 34, 10)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.font = `600 19px "${DISPLAY_FONT}"`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('Mascot Maker', 48, HEIGHT - 48)
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 16px "${DISPLAY_FONT}"`
  ctx.fillText('two sheets, out of your own chat', 240, HEIGHT - 48)
}

function paint(frame: Frame, tiles: ReturnType<typeof tilesOf>): Buffer {
  const canvas = surface(WIDTH, HEIGHT)
  const ctx = ctxOf(canvas)
  backdrop(ctx)
  drawMascot(ctx, tiles, {
    cx: CX, cy: CY, cell: frame.cell, reaction: frame.reaction, squash: frame.squash,
  })
  if (frame.click !== null) drawClick(ctx, frame.x, frame.y, frame.click, VIOLET)
  drawCursor(ctx, frame.x, frame.y)
  return canvas.toBuffer('image/png')
}

/** The loop is only seamless if the last frame is the first one again. */
function assertSeamless(frames: readonly Frame[]): void {
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (!first || !last) throw new Error('no frames')
  const same = first.x === last.x && first.y === last.y && first.cell === last.cell
    && first.reaction === last.reaction && first.squash === last.squash && first.click === last.click
  if (!same) throw new Error(`the loop does not close: ${JSON.stringify(first)} vs ${JSON.stringify(last)}`)
}

function main(): void {
  const pair = sheetPair('gif', LEAD)
  const result = runOn(pair)
  if (!result.ok) throw new Error('the pipeline could not build the demo mascot')
  console.log(`pipeline: ${result.report.verdict}, ${result.output.cellSize}px cells`)
  const tiles = tilesOf(result.output, MASCOT)

  const frames = perform(script(), { fps: FPS, cx: CX, cy: CY })
  assertSeamless(frames)
  const poses = [...new Set(frames.map((f) => f.cell))].sort((a, b) => a - b)
  if (poses.length < 8) throw new Error(`only ${poses.length} of the nine poses appear; the lap is too tight`)

  rmSync(FRAMES, { recursive: true, force: true })
  mkdirSync(FRAMES, { recursive: true })
  mkdirSync('docs/images', { recursive: true })
  frames.forEach((frame, i) => {
    writeFileSync(join(FRAMES, `${String(i).padStart(4, '0')}.png`), paint(frame, tiles))
  })
  console.log(`${frames.length} frames at ${FPS}fps  ${(frames.length / FPS).toFixed(2)}s`)
  console.log(`poses used: ${poses.join(' ')}`)
  console.log(`reactions used: ${[...new Set(frames.flatMap((f) => (f.reaction === null ? [] : [f.reaction])))].sort((a, b) => a - b).join(' ')}`)

  const input = ['-framerate', String(FPS), '-i', join(FRAMES, '%04d.png')]
  // Two passes: one palette built across the whole clip, then applied. A
  // single-pass GIF picks a palette per frame and both looks worse and weighs
  // several times as much.
  ffmpeg([...input, '-vf', 'palettegen=stats_mode=diff:max_colors=128', '-frames:v', '1', PALETTE])
  ffmpeg([...input, '-i', PALETTE, '-lavfi',
    'paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', OUTPUT])
  report('demo.gif', OUTPUT)
}

main()
