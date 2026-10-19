// Shared hair geometry: silhouette arcs, hairlines on the face sphere, tapered strand shapes.
import { shadedInk } from '../draw'
import type { Build, Ctx, Pt, ProjPt, Rig, SpherePt } from '../types'

const TAU = Math.PI * 2
/** Canvas angles of the left / right temple (slightly below horizontal). */
export const L_TEMPLE = Math.PI - 0.2
export const R_TEMPLE = TAU + 0.2

/** Points along the head silhouette from canvas angle a0 to a1; `amps` adds a repeating bump pattern. */
export function arcPts(R: Rig, a0: number, a1: number, n: number, s: number, amps?: readonly number[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    const bump = amps && amps.length ? (amps[i % amps.length] ?? 0) : 0
    out.push(R.sil(t, s + bump, 0, -3))
  }
  return out
}

/** Linear interpolation of a hairline's latitude at longitude theta. */
export function linePhi(line: readonly SpherePt[], theta: number): number {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i] as SpherePt, b = line[i + 1] as SpherePt
    const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0])
    if (theta >= lo && theta <= hi && hi > lo) return a[1] + ((b[1] - a[1]) * (theta - a[0])) / (b[0] - a[0])
  }
  const edge = (theta < 0 ? line[0] : line[line.length - 1]) as SpherePt
  return edge[1]
}

export interface Strand {
  readonly t: number
  readonly w: number
  readonly tipT: number
  readonly tipP: number
}

/** A tapered lock: wide at the hairline root, pointed at the tip, slightly convex sides. */
export function strandBuild(R: Rig, line: readonly SpherePt[], s: Strand, bulge = 5): Build {
  const rootPhi = linePhi(line, s.t) + 0.1
  const L = R.proj(s.t - s.w, rootPhi, 1.04, true)
  const Rr = R.proj(s.t + s.w, rootPhi, 1.04, true)
  const T = R.proj(s.tipT, s.tipP, 1.05, true)
  const m: Pt = { x: (L.x + Rr.x) / 2, y: (L.y + Rr.y) / 2 }
  const ax = T.x - m.x, ay = T.y - m.y
  const len = Math.hypot(ax, ay) || 1
  const px = -ay / len, py = ax / len
  const ctl = (E: ProjPt): Pt => {
    const sign = Math.sign(px * (E.x - m.x) + py * (E.y - m.y)) || 1
    return { x: (E.x + T.x) / 2 + px * bulge * sign, y: (E.y + T.y) / 2 + py * bulge * sign }
  }
  const c1 = ctl(L), c2 = ctl(Rr)
  return (c) => {
    c.moveTo(L.x, L.y); c.quadraticCurveTo(c1.x, c1.y, T.x, T.y)
    c.quadraticCurveTo(c2.x, c2.y, Rr.x, Rr.y); c.closePath()
  }
}

/** Fill + outline a lock with a soft darker lower-right edge. */
export function drawStrand(ctx: Ctx, R: Rig, build: Build, w = 4.5): void {
  const { pal } = R
  shadedInk(ctx, build, { base: pal.hair, shade: pal.hairShade, line: pal.line, w, off: [-3, -4] })
}

/** Soft light band across the crown: a wide translucent stroke plus a thin bright core. */
export function drawHighlightBand(ctx: Ctx, R: Rig, band: readonly SpherePt[], color: string): void {
  const p = R.pts(band, 1.06, true)
  if (p.every((q) => q.z < 0.1)) return
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color
  ctx.globalAlpha = 0.5; ctx.lineWidth = 17
  ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
  ctx.globalAlpha = 0.9; ctx.lineWidth = 5
  ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x + 2, q.y - 5) : ctx.moveTo(q.x + 2, q.y - 5))); ctx.stroke()
  ctx.globalAlpha = 1
}
