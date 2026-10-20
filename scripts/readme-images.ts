/**
 * Renders the diagrams the README shows.
 *
 *   pnpm run images
 *
 * Everything here is produced by actually running the pipeline. The input is a
 * character drawn by `src/studio`, rendered onto the flat `#00FF00` the prompts
 * ask a chat model for; the output is whatever `runPipeline` returns. Nothing
 * is mocked up, and nothing a chat model did not produce is presented as though
 * it had -- the README caption under each picture says where the sheet came
 * from.
 *
 * The panels are white stickers on a transparent canvas, so one file reads
 * correctly against GitHub's light and dark themes.
 */
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Canvas } from '@napi-rs/canvas'
import type { ComposedMascot, PipelineResult, RawImage } from '../src/core/types'
import { DIRECTION_NAMES, REACTION_NAMES } from '../src/core/types'
import { squeezePng } from './media/ffmpeg'
import { LEAD, runOn, sheetPair, wobbled } from './media/sheets'
import {
  BAD, CHECKER_A, CHECKER_B, GOOD, INK, INK_SOFT, SUN, VIOLET,
} from './media/palette'
import {
  DISPLAY_FONT, checkerboard, ctxOf, roundRect, sticker, surface, toCanvas, writePng,
} from './media/surface'
import type { Ctx2D } from './media/surface'

const OUT = join('docs', 'images')
/** Each committed picture is kept under this. */
const BUDGET = 300 * 1024

function save(name: string, canvas: Canvas): void {
  const file = join(OUT, name)
  writePng(file, canvas)
  const bytes = squeezePng(file, BUDGET)
  const kb = (bytes / 1024).toFixed(0)
  console.log(`${file}  ${canvas.width}x${canvas.height}  ${kb} KB${bytes > BUDGET ? '  OVER BUDGET' : ''}`)
  if (bytes > BUDGET) throw new Error(`${name} is ${kb} KB, over the ${BUDGET / 1024} KB budget`)
}

function label(ctx: Ctx2D, text: string, x: number, y: number, size: number, colour = INK_SOFT): void {
  ctx.fillStyle = colour
  ctx.font = `600 ${size}px "${DISPLAY_FONT}"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** A rounded tag, the shape the app puts round a severity badge. */
function tag(ctx: Ctx2D, text: string, cx: number, cy: number, size: number, fill: string, ink: string): void {
  ctx.font = `700 ${size}px "${DISPLAY_FONT}"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + size * 1.5
  const h = size * 1.9
  ctx.fillStyle = fill
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.fillText(text, cx, cy + size * 0.06)
}

/** An arrow between two panels. */
function arrow(ctx: Ctx2D, x: number, y: number, length: number): void {
  ctx.save()
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + length - 10, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + length, y)
  ctx.lineTo(x + length - 16, y - 10)
  ctx.lineTo(x + length - 16, y + 10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** A sheet drawn into a square box, over the app's transparency checkerboard. */
function sheetBox(ctx: Ctx2D, image: Canvas, x: number, y: number, side: number, onChecker: boolean): void {
  if (onChecker) checkerboard(ctx, x, y, side, side, side / 18, CHECKER_A, CHECKER_B)
  ctx.drawImage(image, x, y, side, side)
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  roundRect(ctx, x, y, side, side, 8)
  ctx.stroke()
}

function composed(result: PipelineResult): ComposedMascot {
  if (!result.ok) throw new Error('the pipeline could not build the demonstration mascot')
  return result.output
}

/* ---------------------------------- hero ---------------------------------- */

/**
 * The whole idea in one picture: the flat-green pair a chat hands back, the
 * cut-out sheet this app makes of it, and the mascot that comes out.
 */
function hero(green: RawImage, output: ComposedMascot): void {
  const W = 1360
  const H = 500
  const canvas = surface(W, H)
  const ctx = ctxOf(canvas)
  const side = 300
  const top = 96
  const panels = [
    { x: 60, caption: 'what your chat gives back', checker: false, image: toCanvas(green) },
    { x: 530, caption: 'what this app makes of it', checker: true, image: toCanvas(output.directions) },
  ]
  for (const panel of panels) {
    sticker(ctx, panel.x - 22, top - 22, side + 44, side + 72, 18, '#ffffff')
    sheetBox(ctx, panel.image, panel.x, top, side, panel.checker)
    label(ctx, panel.caption, panel.x + side / 2, top + side + 26, 21)
  }
  arrow(ctx, 408, top + side / 2, 90)
  arrow(ctx, 878, top + side / 2, 90)

  // The mascot itself, at the size a page would show it.
  const face = output.directionTiles[DIRECTION_NAMES.indexOf('center')]
  if (!face) throw new Error('no centre tile')
  sticker(ctx, 998, top - 22, side + 44, side + 72, 18, '#ffffff')
  ctx.drawImage(toCanvas(face), 1020, top, side, side)
  label(ctx, 'on your page, watching the cursor', 1020 + side / 2, top + side + 26, 21)

  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 40px "${DISPLAY_FONT}"`
  ctx.textBaseline = 'middle'
  ctx.fillText('A photo, two prompts, and any free chat model.', W / 2, 46)
  save('hero.png', canvas)
}

/* -------------------------------- alignment -------------------------------- */

/**
 * The aligner, shown by stacking all nine cells on top of each other.
 *
 * Where the nine drawings disagree the stack smears; where the aligner has put
 * them on a common anchor it is sharp. Left is the sheet as it arrived, right
 * is the same sheet after this app has finished with it.
 */
function ghost(ctx: Ctx2D, cells: readonly RawImage[], x: number, y: number, side: number): void {
  ctx.save()
  ctx.globalAlpha = 0.3
  for (const cell of cells) ctx.drawImage(toCanvas(cell), x, y, side, side)
  ctx.restore()
}

function alignment(before: readonly RawImage[], after: readonly RawImage[]): void {
  const W = 1100
  const H = 626
  const side = 420
  const top = 132
  const canvas = surface(W, H)
  const ctx = ctxOf(canvas)
  const panels = [
    { x: 56, cells: before, title: 'as the nine drawings arrived', bad: true },
    { x: 604, cells: after, title: 'after the app lines them up', bad: false },
  ]
  for (const panel of panels) {
    sticker(ctx, panel.x - 20, top - 20, side + 40, side + 76, 18, '#ffffff')
    checkerboard(ctx, panel.x, top, side, side, side / 22, CHECKER_A, CHECKER_B)
    ghost(ctx, panel.cells, panel.x, top, side)
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    roundRect(ctx, panel.x, top, side, side, 8)
    ctx.stroke()
    label(ctx, panel.title, panel.x + side / 2, top + side + 30, 21)
    tag(
      ctx, panel.bad ? 'the body wanders' : 'one steady body',
      panel.x + side / 2, top - 46, 18,
      panel.bad ? SUN : GOOD, panel.bad ? INK : '#ffffff',
    )
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 34px "${DISPLAY_FONT}"`
  ctx.textBaseline = 'middle'
  ctx.fillText('All nine head positions, stacked on top of each other', W / 2, 38)
  save('alignment.png', canvas)
}

/* ------------------------------ the two sheets ------------------------------ */

/** The nine head directions, as the README's explanation of the format. */
function directions(output: ComposedMascot): void {
  const side = 190
  const gap = 10
  const pad = 20
  const W = pad * 2 + side * 3 + gap * 2
  const H = pad * 2 + side * 3 + gap * 2 + 34
  const canvas = surface(W, H)
  const ctx = ctxOf(canvas)
  sticker(ctx, 6, 6, W - 16, H - 16, 18, '#ffffff')
  output.directionTiles.forEach((tile, i) => {
    const x = pad + (i % 3) * (side + gap)
    const y = pad + Math.floor(i / 3) * (side + gap)
    checkerboard(ctx, x, y, side, side, side / 12, CHECKER_A, CHECKER_B)
    ctx.drawImage(toCanvas(tile), x, y, side, side)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, side, side, 6)
    ctx.stroke()
  })
  label(ctx, 'nine head directions, picked by where your cursor is', W / 2, H - 28, 20)
  save('directions.png', canvas)
}

/** The nine reactions, in a single strip. */
function reactions(output: ComposedMascot): void {
  const side = 150
  const gap = 8
  const pad = 18
  const W = pad * 2 + side * 9 + gap * 8
  const H = pad * 2 + side + 34
  const canvas = surface(W, H)
  const ctx = ctxOf(canvas)
  sticker(ctx, 5, 5, W - 14, H - 14, 16, '#ffffff')
  output.reactionTiles.forEach((tile, i) => {
    const x = pad + i * (side + gap)
    checkerboard(ctx, x, pad, side, side, side / 10, CHECKER_A, CHECKER_B)
    ctx.drawImage(toCanvas(tile), x, pad, side, side)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    roundRect(ctx, x, pad, side, side, 6)
    ctx.stroke()
    label(ctx, REACTION_NAMES[i] ?? '', x + side / 2, pad + side + 18, 16)
  })
  save('reactions.png', canvas)
}

/* -------------------------------- the checker -------------------------------- */

/**
 * What a note from the checker is made of: what is wrong, and what to do about
 * it, including which of the two prompts to run again. The words are the real
 * `Issue.message` and `Issue.fix` from a real run of the mismatched pair.
 */
function anatomy(result: PipelineResult): void {
  const issue = result.report.issues.find((i) => i.code === 'palette-mismatch')
  if (!issue) throw new Error('the mismatched pair no longer produces a palette-mismatch note')
  const W = 1280
  const H = 360
  const CARD = 740
  const canvas = surface(W, H)
  const ctx = ctxOf(canvas)
  sticker(ctx, 14, 44, CARD, H - 92, 20, '#ffffff')
  tag(ctx, issue.severity === 'error' ? 'Problem' : 'Note', 100, 100, 19, BAD, '#ffffff')
  label(ctx, 'reactions sheet', 268, 100, 19)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.font = `700 25px "${DISPLAY_FONT}"`
  ctx.fillText(issue.message, 52, 158)

  ctx.fillStyle = INK_SOFT
  ctx.font = `400 21px "${DISPLAY_FONT}"`
  let y = 204
  for (const line of wrapText(ctx, issue.fix, CARD - 110)) {
    ctx.fillText(line, 52, y)
    y += 30
  }
  tag(ctx, 'Show Message 2', 160, H - 86, 18, VIOLET, '#ffffff')
  tag(ctx, 'Replace image', 392, H - 86, 18, '#ffffff', INK)

  // Called out, so the picture reads as a diagram of a note rather than as a
  // screenshot of one. The real thing is photographed separately.
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 26px "${DISPLAY_FONT}"`
  ctx.fillText('What every note tells you', 14 + CARD / 2, 24)

  const notes: readonly { readonly y: number; readonly text: string }[] = [
    { y: 100, text: 'which sheet' },
    { y: 158, text: 'what is wrong, with the number' },
    { y: 212, text: 'what to do about it' },
    { y: H - 86, text: 'which prompt to run again' },
  ]
  ctx.lineWidth = 2
  for (const note of notes) {
    ctx.strokeStyle = INK_SOFT
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(CARD + 26, note.y)
    ctx.lineTo(CARD + 62, note.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK_SOFT
    ctx.font = `600 20px "${DISPLAY_FONT}"`
    ctx.fillText(note.text, CARD + 74, note.y)
  }
  save('verdict-anatomy.png', canvas)
}

function wrapText(ctx: Ctx2D, text: string, limit: number): readonly string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`
    if (line !== '' && ctx.measureText(next).width > limit) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

/* --------------------------------- assembly --------------------------------- */

function main(): void {
  mkdirSync(OUT, { recursive: true })

  const clean = sheetPair('readme', LEAD)
  const cleanRun = runOn(clean)
  const output = composed(cleanRun)
  console.log(`clean pair: ${cleanRun.report.verdict}`)

  const wobbly = wobbled(clean)
  const wobblyRun = runOn(wobbly)
  const wobblyOut = composed(wobblyRun)
  const arrived = wobblyRun.directions.slice?.cells.map((c) => c.image)
  if (!arrived) throw new Error('the wobbled sheet did not slice')
  console.log(`wobbled pair: ${wobblyRun.report.verdict}, `
    + `shoulder spread ${wobblyRun.report.metrics.shoulderSpreadPct?.toFixed(1) ?? '?'}%`)

  const mismatch = runOn(sheetPair('readme-mismatch', LEAD, 'jonas'))
  console.log(`mismatched pair: ${mismatch.report.verdict}`)

  hero(clean.directions, output)
  alignment(arrived, wobblyOut.directionTiles)
  directions(output)
  reactions(output)
  anatomy(mismatch)
}

main()
