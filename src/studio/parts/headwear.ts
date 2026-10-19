// Headwear: cap, beanie (thick cuff + fluffy pom-pom), antenna, hijab (simple headscarf).
import { TAU, ellipse, ink, shadedInk, smooth, unionInk } from '../draw'
import type { Build, Ctx, Rig, SpherePt } from '../types'
import { L_TEMPLE, R_TEMPLE, arcPts } from './hairGeometry'

const HIJAB_WINDOW: readonly SpherePt[] = [
  [0, 1.02], [0.55, 0.96], [1.0, 0.72], [1.3, 0.25], [1.32, -0.3], [1.12, -0.8], [0.62, -1.12], [0, -1.24],
  [-0.62, -1.12], [-1.12, -0.8], [-1.32, -0.3], [-1.3, 0.25], [-1.0, 0.72], [-0.55, 0.96],
]

const edgeList = (phi: number, wobble = 0): SpherePt[] => {
  const out: SpherePt[] = []
  for (let t = -1.55; t <= 1.56; t += 0.2) out.push([t, phi + wobble * Math.cos(t * 2)])
  return out
}

/** Dome outline for cap / beanie: silhouette arc over the top, hairline-parallel lower edge. */
function domeBuild(R: Rig): Build {
  const beanie = R.cfg.headwear === 'beanie'
  const outer = arcPts(R, L_TEMPLE - 0.08, R_TEMPLE + 0.08, 16, beanie ? 1.13 : 1.1)
  const lower = R.pts(edgeList(beanie ? 0.98 : 0.7, beanie ? 0 : 0.04), 1.04, true)
  const all = [...outer, ...lower.slice().reverse()]
  return (c) => smooth(c, all)
}

function hijabBuild(R: Rig): Build {
  const N = 48
  const outer = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * TAU
    return R.sil(t, 1.12 - 0.09 * Math.max(0, Math.sin(t)) ** 2, 0, -2)
  })
  const win = R.pts(HIJAB_WINDOW, 1.0, true)
  return (c) => { smooth(c, outer); smooth(c, win) }
}

/** The region of the face the headwear shades (cast shadow on the forehead). */
export function drawHeadwearCastShadow(ctx: Ctx, R: Rig): void {
  const hw = R.cfg.headwear
  if (hw === 'hijab') {
    ctx.save(); ctx.strokeStyle = R.pal.skinDeep; ctx.globalAlpha = 0.4; ctx.lineWidth = 20; ctx.lineJoin = 'round'
    ctx.beginPath(); smooth(ctx, R.pts(HIJAB_WINDOW, 1.0, true)); ctx.stroke(); ctx.restore()
    return
  }
  if (hw !== 'cap' && hw !== 'beanie') return
  ctx.save(); ctx.translate(0, 11); ctx.globalAlpha = 0.5; ctx.fillStyle = R.pal.skinDeep
  ctx.beginPath(); domeBuild(R)(ctx); ctx.fill(); ctx.restore()
}

export function drawHeadwearBack(ctx: Ctx, R: Rig): void {
  const { cfg, pal } = R
  if (cfg.headwear !== 'antenna') return
  const P = R.proj(0, 1.5, 1.0)
  const top = { x: P.x + R.dx * 8, y: P.y - 58 }
  ctx.strokeStyle = pal.line; ctx.lineWidth = 12; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(P.x, P.y + 12); ctx.lineTo(top.x, top.y); ctx.stroke()
  ctx.strokeStyle = pal.skinShade; ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(P.x, P.y + 12); ctx.lineTo(top.x, top.y); ctx.stroke()
  ink(ctx, (c) => ellipse(c, top.x, top.y - 8, 17, 17), { fill: pal.accent, line: pal.line, w: 6, swell: 0.4 })
  ctx.fillStyle = '#fff'; ctx.beginPath(); ellipse(ctx, top.x - 6, top.y - 14, 5, 3.5, -0.5); ctx.fill()
}

function strokeSpherePath(ctx: Ctx, R: Rig, list: readonly SpherePt[], depth: number): void {
  const p = R.pts(list, depth, true)
  ctx.beginPath(); smooth(ctx, p, false); ctx.stroke()
}

function drawDomeBody(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const bandPhi = R.cfg.headwear === 'cap' ? 0.7 : 0.98
  shadedInk(ctx, domeBuild(R), { base: pal.hat, shade: pal.hatShade, line: pal.line, w: 7, off: [-8, -9] })
  ctx.strokeStyle = pal.hatShade; ctx.lineWidth = 4; ctx.lineCap = 'round'
  for (const t of [-0.75, 0, 0.75]) strokeSpherePath(ctx, R, [[t, bandPhi], [t * 0.6, 1.05], [0, 1.52]], 1.07)
  ctx.strokeStyle = pal.hatHi; ctx.lineWidth = 7
  strokeSpherePath(ctx, R, [[-0.9, 1.1], [-0.55, 1.2], [-0.2, 1.26]], 1.07)
}

function drawPomPom(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const P = R.proj(0, 1.5, 1.2)
  R.at(ctx, P, 0, () => {
    const balls: Build[] = [(c) => ellipse(c, 0, 0, 24, 22)]
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU
      balls.push((c) => ellipse(c, Math.cos(a) * 22, Math.sin(a) * 20, 12, 12))
    }
    unionInk(ctx, balls, { fill: pal.accent, line: pal.line, w: 5 })
    ctx.strokeStyle = pal.accentShade; ctx.lineWidth = 4; ctx.lineCap = 'round'
    for (let i = 0; i < 9; i += 2) {
      const a = (i / 9) * TAU
      ctx.beginPath(); ctx.arc(Math.cos(a) * 22, Math.sin(a) * 20, 6, a + 0.6, a + 2.2); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ellipse(ctx, -9, -10, 8, 4.5, -0.5); ctx.fill()
  }, Math.max(P.sx, 0.8))
}

function drawBeanieCuff(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const top = R.pts(edgeList(0.98), 1.08, true)
  const bottom = R.pts(edgeList(0.58), 1.08, true)
  const cuff: Build = (c) => smooth(c, [...top, ...bottom.slice().reverse()])
  shadedInk(ctx, cuff, {
    base: pal.accent, shade: pal.accentShade, line: pal.line, w: 7, off: [-5, -7],
    hi: (c) => {
      c.strokeStyle = pal.accentShade; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath()
      for (let t = -1.4; t <= 1.4; t += 0.24) {
        const a = R.proj(t, 0.98, 1.08, true), b = R.proj(t, 0.58, 1.08, true)
        if (a.z > 0.08) { c.moveTo(a.x, a.y + 4); c.lineTo(b.x, b.y - 4) }
      }
      c.stroke()
    },
  })
}

function drawCapBrim(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const ptsAt = (n: number, from: number, step: number, phi: number, d: number) =>
    R.pts(Array.from({ length: n }, (_, i): SpherePt => [from + i * step, phi]), d, false)
  const inner = ptsAt(9, -0.95, 0.2375, 0.7, 1.03)
  const outer = ptsAt(9, 0.95, -0.2375, 0.42, 1.3)
  shadedInk(ctx, (c) => smooth(c, [...inner, ...outer]), { base: pal.hat, shade: pal.hatShade, line: pal.line, w: 7, off: [-3, -4] })
  const P = R.proj(0, 1.52, 1.1)
  R.at(ctx, P, 0, () => ink(ctx, (c) => ellipse(c, 0, 0, 12, 7), { fill: pal.hatShade, line: pal.line, w: 4.5, swell: 0.3 }), Math.max(P.sx, 0.6))
}

function drawHijab(ctx: Ctx, R: Rig): void {
  const { pal } = R
  shadedInk(ctx, hijabBuild(R), {
    base: pal.hat, shade: pal.hatShade, line: pal.line, w: 6.5, off: [-6, -7], rule: 'evenodd',
    hi: (c) => {
      c.lineCap = 'round'; c.strokeStyle = pal.hatHi; c.lineWidth = 8
      strokeSpherePath(c, R, [[-1.2, 0.95], [-0.7, 1.2], [-0.1, 1.3]], 1.1)
      c.strokeStyle = pal.hatShade; c.lineWidth = 4
      strokeSpherePath(c, R, [[0.95, 0.9], [1.35, 0.1], [1.4, -0.7]], 1.08)
      strokeSpherePath(c, R, [[-0.9, -1.0], [-1.3, -0.6]], 1.08)
    },
  })
}

export function drawHeadwearFront(ctx: Ctx, R: Rig): void {
  const hw = R.cfg.headwear
  if (hw === 'hijab') { drawHijab(ctx, R); return }
  if (hw !== 'cap' && hw !== 'beanie') return
  drawDomeBody(ctx, R)
  if (hw === 'beanie') { drawBeanieCuff(ctx, R); drawPomPom(ctx, R) } else drawCapBrim(ctx, R)
}
