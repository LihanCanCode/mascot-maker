// Muzzle patches and whiskers (animals) and the nose (animals and humans).
import { ellipse, ink, mix, shadeOf } from '../draw'
import type { Ctx, Rig } from '../types'

type PatchSpec = readonly [theta: number, phi: number, rx: number, ry: number]

const PATCHES: Readonly<Record<string, readonly PatchSpec[]>> = {
  fox: [[-0.62, -0.5, 74, 46], [0.62, -0.5, 74, 46], [0, -0.82, 70, 44], [0, -0.42, 54, 40]],
  cat: [[-0.17, -0.46, 36, 27], [0.17, -0.46, 36, 27]],
  bear: [[0, -0.5, 62, 48]],
  bunny: [[-0.16, -0.48, 34, 29], [0.16, -0.48, 34, 29]],
}

export function drawMuzzlePads(ctx: Ctx, R: Rig): void {
  const { pal, cfg } = R
  for (const [th, ph, rx, ry] of PATCHES[cfg.ears] ?? []) {
    const P = R.proj(th, ph, 1.08)
    if (P.z < -0.2) continue
    R.at(ctx, P, 0, () => {
      ctx.fillStyle = pal.muzzleShade; ctx.beginPath(); ellipse(ctx, 0, 4, rx, ry); ctx.fill()
      ctx.fillStyle = pal.muzzle; ctx.beginPath(); ellipse(ctx, 0, 0, rx, ry); ctx.fill()
    }, Math.max(P.sx, 0.4))
  }
}

export function drawWhiskers(ctx: Ctx, R: Rig): void {
  if (R.cfg.ears !== 'cat') return
  ctx.strokeStyle = R.pal.line; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
  for (const s of [-1, 1]) {
    const P = R.proj(s * 0.62, -0.36, 1.04)
    if (P.z < 0.12) continue
    R.at(ctx, P, 0, () => {
      ctx.beginPath()
      for (const [dy, a] of [[-8, -0.18], [4, 0.02], [16, 0.2]] as const) {
        ctx.moveTo(s * 6, dy); ctx.lineTo(s * 52, dy + a * 52)
      }
      ctx.stroke()
    })
  }
}

const NOSE_SCALE: Readonly<Record<string, number>> = { bear: 1.35, cat: 0.8, bunny: 0.78 }

function drawAnimalNose(ctx: Ctx, R: Rig): void {
  const { pal, cfg } = R
  const P = R.proj(0, -0.27, 1.14)
  R.at(ctx, P, 0, () => {
    const col = cfg.ears === 'cat' || cfg.ears === 'bunny' ? '#ff8fa8' : cfg.noseColor
    const sz = NOSE_SCALE[cfg.ears] ?? 1
    ctx.save(); ctx.scale(sz, sz)
    ink(ctx, (c) => {
      c.moveTo(-16, -9); c.quadraticCurveTo(0, -17, 16, -9); c.quadraticCurveTo(15, 5, 0, 12)
      c.quadraticCurveTo(-15, 5, -16, -9); c.closePath()
    }, { fill: col, line: pal.line, w: 5, swell: 0.3 })
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ellipse(ctx, -5, -6.5, 5.5, 2.8, -0.15); ctx.fill()
    ctx.restore()
  })
}

/** Human nose: a soft shaded bulb with nostril dots and a bridge highlight, readable at 140 px. */
function drawHumanNose(ctx: Ctx, R: Rig): void {
  const { pal, cfg } = R
  const P = R.proj(0, -0.35, 1.14)
  const bulb = mix(cfg.skin, pal.skinDeep, 0.38)
  R.at(ctx, P, 0, () => {
    ink(ctx, (c) => ellipse(c, 0, 5, 16, 11.5), { fill: bulb, line: pal.skinDeep, w: 4.5, swell: 0.3 })
    ctx.fillStyle = pal.skinHi; ctx.beginPath(); ellipse(ctx, -4, -1, 6.5, 4.2, -0.4); ctx.fill()
    ctx.fillStyle = shadeOf(cfg.skin, 3.2)
    for (const s of [-1, 1]) { ctx.beginPath(); ellipse(ctx, s * 6.5, 9, 2.8, 2.2); ctx.fill() }
  })
}

export function drawNose(ctx: Ctx, R: Rig): void {
  if (R.animal) drawAnimalNose(ctx, R)
  else if (R.cfg.ears !== 'bolt') drawHumanNose(ctx, R)
}
