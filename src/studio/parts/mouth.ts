// Mouth shapes for every expression, placed on the face sphere.
import { ellipse, ink, roundRect } from '../draw'
import type { Ctx, MouthKind, Palette, Rig } from '../types'
import { mouthPhi } from './facialHair'

function stroke(ctx: Ctx, line: string, w: number, f: () => void): void {
  ctx.strokeStyle = line; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); f(); ctx.stroke()
}

function drawSmile(ctx: Ctx, R: Rig, small: boolean): void {
  const line = R.pal.line
  if (R.animal) {
    if (R.cfg.ears === 'bunny' && !small) {
      ink(ctx, (c) => roundRect(c, -9, 12, 18, 20, 4), { fill: '#fffaf5', line, w: 4, swell: 0.2 })
      stroke(ctx, line, 3, () => { ctx.moveTo(0, 13); ctx.lineTo(0, 31) })
    }
    const k = small ? 0.7 : 1
    stroke(ctx, line, 5.5, () => {
      ctx.moveTo(0, 8); ctx.lineTo(0, 17)
      ctx.moveTo(0, 17); ctx.quadraticCurveTo(-8 * k, 29, -22 * k, 21)
      ctx.moveTo(0, 17); ctx.quadraticCurveTo(8 * k, 29, 22 * k, 21)
    })
    return
  }
  const w = small ? 17 : 27, d = small ? 15 : 24
  stroke(ctx, line, 7, () => { ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, d, w, 0) })
  stroke(ctx, line, 5, () => {
    ctx.moveTo(-w - 1, 0); ctx.lineTo(-w - 5, -5)
    ctx.moveTo(w + 1, 0); ctx.lineTo(w + 5, -5)
  })
}

function drawOpen(ctx: Ctx, pal: Palette, big: boolean): void {
  const w = big ? 40 : 28, h = big ? 38 : 26
  const shape = (c: Ctx): void => {
    c.moveTo(-w, -4); c.quadraticCurveTo(0, big ? 2 : 4, w, -4)
    c.quadraticCurveTo(w * 0.8, h, 0, h + 2); c.quadraticCurveTo(-w * 0.8, h, -w, -4); c.closePath()
  }
  ink(ctx, shape, { fill: pal.mouthIn, line: pal.line, w: 5.5, swell: 0.4 })
  ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip()
  if (big) { ctx.fillStyle = '#fffaf5'; ctx.beginPath(); ctx.rect(-w, -6, w * 2, 11); ctx.fill() }
  ctx.fillStyle = pal.tongue; ctx.beginPath(); ellipse(ctx, 0, h - 2, w * 0.55, h * 0.4); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = pal.line; ctx.lineWidth = 5.5; ctx.beginPath(); shape(ctx); ctx.stroke()
}

function drawMouthShape(ctx: Ctx, R: Rig, kind: MouthKind): void {
  const { pal } = R
  switch (kind) {
    case 'smile': drawSmile(ctx, R, false); break
    case 'smallsmile': drawSmile(ctx, R, true); break
    case 'tiny':
      ink(ctx, (c) => ellipse(c, 0, 4, 9, 11), { fill: pal.mouthIn, line: pal.line, w: 4.5, swell: 0.3 }); break
    case 'wavy':
      stroke(ctx, pal.line, 6, () => {
        ctx.moveTo(-24, 4); ctx.bezierCurveTo(-16, -6, -8, -6, 0, 4); ctx.bezierCurveTo(8, 14, 16, 14, 24, 4)
      }); break
    case 'o':
      ink(ctx, (c) => ellipse(c, 0, 8, 13, 18), { fill: pal.mouthIn, line: pal.line, w: 5.5, swell: 0.3 })
      ctx.fillStyle = pal.tongue; ctx.beginPath(); ellipse(ctx, 0, 17, 7, 5); ctx.fill(); break
    case 'open': drawOpen(ctx, pal, false); break
    case 'grin': drawOpen(ctx, pal, true); break
  }
}

export function drawMouth(ctx: Ctx, R: Rig): void {
  const kind = R.ex.mouth
  const open = kind !== 'smile' && kind !== 'smallsmile'
  const P = R.animal ? R.proj(0, open ? -0.55 : -0.3, 1.12) : R.proj(0, mouthPhi(R), 1.08)
  R.at(ctx, P, 0, () => drawMouthShape(ctx, R, kind))
}
