/**
 * Canvas plumbing shared by the launch-media scripts.
 *
 * The studio draws onto anything that answers `getContext('2d')`, so the node
 * canvas is handed straight to it. Everything else here is the small amount of
 * glue needed to move a `RawImage` onto a surface, to name the fonts the site
 * itself uses so a rendered frame and a screenshot agree, and to write a PNG.
 */
import { Canvas, ImageData, createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import type { RawImage } from '../../src/core/types'
import type { CanvasFactory, CanvasLike } from '../../src/studio/types'
import { INK } from './palette'

export type Ctx2D = SKRSContext2D

/**
 * `--font` in `src/index.css` asks for Nunito and falls back through the
 * system rounded stacks; these are the names Windows reports for the two the
 * app actually lands on here.
 */
export const DISPLAY_FONT = 'Segoe UI Variable Display'
export const BODY_FONT = 'Segoe UI'
export const MONO_FONT = 'Consolas'

export function surface(width: number, height: number): Canvas {
  return createCanvas(width, height)
}

export function ctxOf(canvas: Canvas): Ctx2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D context on the canvas')
  return ctx
}

/** The canvas factory the studio renderers take. */
export const studioFactory: CanvasFactory = (width, height) =>
  createCanvas(width, height) as unknown as CanvasLike

/** A pixel buffer, moved onto a surface of its own so it can be blitted. */
export function toCanvas(image: RawImage): Canvas {
  const canvas = createCanvas(image.width, image.height)
  ctxOf(canvas).putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0,
  )
  return canvas
}

export function writePng(file: string, canvas: Canvas): void {
  writeFileSync(file, canvas.toBuffer('image/png'))
}

export function writeImage(file: string, image: RawImage): void {
  writePng(file, toCanvas(image))
}

export function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * A die-cut sticker: a filled round rect with an ink outline and the hard
 * offset shadow `--pop` gives every card in the app.
 */
export function sticker(
  ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, fill: string, pop = 4,
): void {
  ctx.fillStyle = INK
  roundRect(ctx, x + pop, y + pop, w, h, r)
  ctx.fill()
  ctx.fillStyle = fill
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
}

/** The transparency checkerboard the app shows behind a keyed sheet. */
export function checkerboard(
  ctx: Ctx2D, x: number, y: number, w: number, h: number, square: number, a: string, b: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = a
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = b
  for (let row = 0; row * square < h; row += 1) {
    for (let col = 0; col * square < w; col += 1) {
      if ((row + col) % 2 === 1) ctx.fillRect(x + col * square, y + row * square, square, square)
    }
  }
  ctx.restore()
}
