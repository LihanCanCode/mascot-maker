// Curly / afro hair: a cloud of curls behind the head and a scalloped curly hairline in front.
import { ellipse, smooth, unionInk } from '../draw'
import type { Build, Ctx, Rig, SpherePt } from '../types'
import { L_TEMPLE, R_TEMPLE, arcPts } from './hairGeometry'

const CURL_LINE: readonly SpherePt[] = [
  [1.45, 0.3], [1.32, 0.55], [1.02, 0.78], [0.62, 0.92], [0.22, 0.98], [-0.22, 0.98], [-0.62, 0.92], [-1.02, 0.78],
  [-1.32, 0.55], [-1.45, 0.3],
]
const RADII = [20, 22, 19, 23, 21, 21, 23, 19, 22, 20]

const circle = (x: number, y: number, r: number): Build => (c) => ellipse(c, x, y, r, r)

function backBuilds(R: Rig): Build[] {
  const builds: Build[] = [(c) => ellipse(c, R.cx, R.cy - 10, R.rx * 1.1, R.ry * 1.06)]
  const steps = 17
  const a0 = Math.PI - 0.45, a1 = Math.PI * 2 + 0.45
  for (let i = 0; i <= steps; i++) {
    const p = R.sil(a0 + ((a1 - a0) * i) / steps, 1.13, 0, -4)
    builds.push(circle(p.x, p.y, 30 + (Math.min(i, steps - i) % 3) * 4))
  }
  return builds
}

function frontCircles(R: Rig): { build: Build; x: number; y: number; r: number; z: number }[] {
  return R.pts(CURL_LINE, 1.04, true).map((p, i) => {
    const r = RADII[i % RADII.length] ?? 24
    return { build: circle(p.x, p.y, r), x: p.x, y: p.y, r, z: p.z }
  })
}

function capBuild(R: Rig): Build {
  const pts = [...arcPts(R, L_TEMPLE, R_TEMPLE, 14, 1.12), ...R.pts(CURL_LINE, 1.03, true)]
  return (c) => smooth(c, pts)
}

export function curlyShadowBuilds(R: Rig): Build[] {
  return [capBuild(R), ...frontCircles(R).map((f) => f.build)]
}

export function drawCurlyBack(ctx: Ctx, R: Rig): void {
  unionInk(ctx, backBuilds(R), { fill: R.pal.hairShade, line: R.pal.line, w: 6 })
}

function drawCurlDetails(ctx: Ctx, R: Rig): void {
  const { pal } = R
  ctx.lineCap = 'round'
  for (const f of frontCircles(R)) {
    if (f.z < 0.1) continue
    ctx.strokeStyle = pal.hairHi; ctx.lineWidth = 4.5; ctx.globalAlpha = 0.85
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke()
    ctx.strokeStyle = pal.hairShade; ctx.lineWidth = 4; ctx.globalAlpha = 1
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6, 0.1, 1.2); ctx.stroke()
  }
}

export function drawCurlyFront(ctx: Ctx, R: Rig): void {
  const { pal } = R
  unionInk(ctx, [capBuild(R), ...frontCircles(R).map((f) => f.build)], { fill: pal.hair, line: pal.line, w: 5 })
  drawCurlDetails(ctx, R)
  // crown curls: a few arcs of light across the top
  ctx.strokeStyle = pal.hairHi; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.7
  for (const t of [-0.55, 0.05, 0.6]) {
    const p = R.proj(t, 1.12, 1.1, true)
    if (p.z < 0.1) continue
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke()
  }
  ctx.globalAlpha = 1
}
