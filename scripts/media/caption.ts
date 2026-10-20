/**
 * Burnt-in captions.
 *
 * Most of a feed is watched with the sound off, so the words are part of the
 * picture rather than a subtitle track. They sit on a solid ink slab inside
 * the middle 80% of the frame, clear of the bars of controls every platform
 * lays over the top and bottom.
 */
import { BAD, INK, VIOLET } from './palette'
import { DISPLAY_FONT, roundRect } from './surface'
import type { Ctx2D } from './surface'

export interface FrameSize { readonly width: number; readonly height: number }

export type Tone = 'ink' | 'violet' | 'bad'

/** Bottom of the caption block, as a fraction of frame height. Inside the safe area. */
const BASELINE = 0.86

const SLAB: Readonly<Record<Tone, string>> = { ink: INK, violet: VIOLET, bad: BAD }

function fontSize(frame: FrameSize): number {
  return Math.round(Math.min(frame.width * 0.056, frame.height * 0.07))
}

function wrap(ctx: Ctx2D, text: string, limit: number): readonly string[] {
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

/**
 * The same wrapping, but with the lines evened up.
 *
 * Greedy wrapping fills each line to the brim and leaves whatever is left on
 * the last one, which on a tall frame regularly produces a full line followed
 * by a single word. Once the line count is known, the narrowest width that
 * still fits that many lines is the balanced one.
 */
function balance(ctx: Ctx2D, text: string, limit: number): readonly string[] {
  const lines = wrap(ctx, text, limit)
  if (lines.length < 2) return lines
  let best = lines
  for (let narrower = limit; narrower > limit * 0.5; narrower -= limit * 0.02) {
    const tried = wrap(ctx, text, narrower)
    if (tried.length !== lines.length) break
    best = tried
  }
  return best
}

export function drawCaption(ctx: Ctx2D, text: string, frame: FrameSize, tone: Tone = 'ink'): void {
  if (text === '') return
  const size = fontSize(frame)
  ctx.save()
  ctx.font = `600 ${size}px "${DISPLAY_FONT}"`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const lines = balance(ctx, text, frame.width * 0.8)
  const lineHeight = Math.round(size * 1.34)
  const padX = Math.round(size * 0.52)
  const padY = Math.round(size * 0.2)
  const bottom = frame.height * BASELINE
  const top = bottom - lines.length * lineHeight

  lines.forEach((line, i) => {
    const centreY = top + lineHeight * (i + 0.5)
    const width = ctx.measureText(line).width + padX * 2
    const height = lineHeight - padY
    ctx.fillStyle = SLAB[tone]
    roundRect(ctx, (frame.width - width) / 2, centreY - height / 2, width, height, Math.round(size * 0.22))
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line, frame.width / 2, centreY + size * 0.04)
  })
  ctx.restore()
}

/** The widest line a caption will occupy, as a fraction of the frame. For the safe-area check. */
export function captionWidth(ctx: Ctx2D, text: string, frame: FrameSize): number {
  const size = fontSize(frame)
  ctx.save()
  ctx.font = `600 ${size}px "${DISPLAY_FONT}"`
  const widest = balance(ctx, text, frame.width * 0.8)
    .reduce((w, line) => Math.max(w, ctx.measureText(line).width), 0)
  ctx.restore()
  return (widest + size * 1.04) / frame.width
}
