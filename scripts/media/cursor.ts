/**
 * A drawn pointer.
 *
 * Neither a programmatic render nor a Playwright video contains a cursor, and
 * footage of a mascot watching something invisible is unreadable. So the arrow
 * is drawn at the coordinates the animation drove, which is also the only
 * honest option: it is the same number `sectorFor` was given.
 */
import { INK, VIOLET } from './palette'
import type { Ctx2D } from './surface'

/** Outline of a plain arrow pointer, authored with its hotspot at the origin. */
const ARROW: readonly (readonly [number, number])[] = [
  [0, 0], [0, 17.5], [4.4, 13.2], [7.4, 20], [10.6, 18.6], [7.7, 12], [13, 12],
]

export interface CursorLook {
  /** Pixels per unit of the authored outline; 1 draws a 13x20 arrow. */
  readonly scale: number
  readonly fill: string
  readonly stroke: string
}

export const DEFAULT_CURSOR: CursorLook = { scale: 2.1, fill: '#ffffff', stroke: INK }

export function cursorLook(scale: number): CursorLook {
  return { scale, fill: '#ffffff', stroke: INK }
}

export function drawCursor(ctx: Ctx2D, x: number, y: number, look: CursorLook = DEFAULT_CURSOR): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(look.scale, look.scale)
  ctx.beginPath()
  ARROW.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
  ctx.closePath()
  ctx.lineJoin = 'round'
  // A soft drop shadow keeps the arrow readable over both the pale paper and
  // the dark ink of a character.
  ctx.shadowColor = 'rgba(27, 23, 64, 0.35)'
  ctx.shadowBlur = 2.4
  ctx.shadowOffsetY = 0.8
  ctx.fillStyle = look.fill
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.lineWidth = 1.4
  ctx.strokeStyle = look.stroke
  ctx.stroke()
  ctx.restore()
}

/**
 * The ring that says a click just landed. `progress` runs 0 to 1; the ring
 * grows and fades across it, so a boop is visible in a single still frame.
 */
export function drawClick(ctx: Ctx2D, x: number, y: number, progress: number, colour = VIOLET): void {
  if (progress < 0 || progress > 1) return
  const radius = 6 + progress * 26
  ctx.save()
  ctx.globalAlpha = (1 - progress) * 0.85
  ctx.strokeStyle = colour
  ctx.lineWidth = 3.5 * (1 - progress * 0.5)
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
