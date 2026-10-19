// Glasses: round or square frames with temples, bridge and a simple lens glint.
import { ellipse, ink, roundRect } from '../draw'
import type { Ctx, Rig } from '../types'
import { EYE_T } from './eyes'
import type { EyeGeom } from './eyes'

const SIDES = [-1, 1] as const

export function drawGlasses(ctx: Ctx, R: Rig, g: EyeGeom): void {
  const { cfg } = R
  if (cfg.glasses === 'none') return
  const frame = cfg.glassesColor
  const round = cfg.glasses === 'round'
  ctx.save(); ctx.beginPath(); R.head(ctx, 1.08); ctx.clip()
  const lenses = SIDES.map((s) => ({ s, P: R.proj(s * EYE_T, g.phi, 1.1) }))
  ctx.strokeStyle = frame; ctx.lineWidth = 6; ctx.lineCap = 'round'
  for (const { s, P } of lenses) {
    const e = R.proj(s * 1.5, 0.05, 1.04, true)
    const sx = Math.max(P.sx, 0.4)
    ctx.beginPath(); ctx.moveTo(P.x + s * 46 * sx, P.y - 4); ctx.lineTo(e.x, e.y); ctx.stroke()
  }
  const a = lenses[0], b = lenses[1]
  if (a && b) {
    ctx.beginPath(); ctx.moveTo(a.P.x + 44 * Math.max(a.P.sx, 0.4), a.P.y - 8)
    ctx.quadraticCurveTo((a.P.x + b.P.x) / 2, a.P.y - 18, b.P.x - 44 * Math.max(b.P.sx, 0.4), b.P.y - 8); ctx.stroke()
  }
  for (const { P } of lenses) {
    R.at(ctx, P, 0, () => {
      const shape = (c: Ctx): void => (round ? ellipse(c, 0, 0, 45, 45) : roundRect(c, -46, -40, 92, 80, 16))
      ink(ctx, shape, { fill: 'rgba(205,232,255,.28)', line: frame, w: 6.5, swell: 0.5 })
      ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineCap = 'round'
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-10, -30); ctx.stroke()
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, 14); ctx.lineTo(-10, 4); ctx.stroke()
      ctx.restore()
    }, Math.max(P.sx, 0.4))
  }
  ctx.restore()
}
