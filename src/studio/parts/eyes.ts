// Eyes (kinds, lids, lashes, size), brows and blush.
import { ellipse, hiOf, ink, mix, shadeOf, starPath } from '../draw'
import type { Ctx, EyeKind, EyeSize, Rig } from '../types'

export const EYE_T = 0.46
const SIZE_K: Readonly<Record<EyeSize, number>> = { small: 0.8, medium: 1, large: 1.14 }
const LID_COVER = { normal: 0, heavy: 0.2, sleepy: 0.36 } as const

export interface EyeGeom { readonly rx: number; readonly ry: number; readonly phi: number; readonly k: number }

export function eyeGeom(R: Rig): EyeGeom {
  const k = SIZE_K[R.cfg.eyeSize]
  return { rx: 29 * k, ry: 37 * k, phi: R.animal ? 0.1 : 0.04, k }
}

function stroked(ctx: Ctx, line: string, w: number, f: () => void): void {
  ctx.strokeStyle = line; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w
  ctx.beginPath(); f(); ctx.stroke()
}

function drawLashes(ctx: Ctx, R: Rig, g: EyeGeom, side: number): void {
  const { lashes } = R.cfg
  if (lashes === 'none') return
  const angles = lashes === 'long' ? [0.3, 0.62, 0.95] : [0.34, 0.7]
  const len = lashes === 'long' ? 15 : 10
  stroked(ctx, R.pal.line, 5, () => {
    for (const a of angles) {
      const bx = side * g.rx * Math.cos(a), by = -g.ry * Math.sin(a)
      const nx = (side * Math.cos(a)) / g.rx, ny = -Math.sin(a) / g.ry
      const nl = Math.hypot(nx, ny)
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + (nx / nl) * len + side * 3, by + (ny / nl) * len - 2)
    }
  })
}

function drawSpiral(ctx: Ctx, line: string, side: number): void {
  ink(ctx, (c) => ellipse(c, 0, 0, 33, 38), { fill: '#fffaf5', line, w: 5 })
  ctx.strokeStyle = line; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath()
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 5 * side, r = (i / 90) * 27
    ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r)
  }
  ctx.stroke()
}

function drawIris(ctx: Ctx, R: Rig, rx: number, ry: number, ir: number, gaze: readonly [number, number]): void {
  const { pal } = R
  const [gx, gy] = gaze
  ctx.fillStyle = pal.eye; ctx.beginPath(); ellipse(ctx, gx, gy, rx * ir, ry * ir); ctx.fill()
  ctx.fillStyle = pal.eyeShade; ctx.beginPath(); ellipse(ctx, gx, -ry * 0.28 * ir + gy, rx * ir * 1.05, ry * ir * 0.78); ctx.fill()
  ctx.fillStyle = pal.eyeHi; ctx.beginPath(); ellipse(ctx, gx, ry * 0.62 * ir + gy, rx * ir * 0.78, ry * ir * 0.34); ctx.fill()
  ctx.fillStyle = '#1b1220'; ctx.beginPath(); ellipse(ctx, gx, 1 + gy, rx * ir * 0.5, ry * ir * 0.52); ctx.fill()
}

function drawCatchlights(ctx: Ctx, rx: number, ry: number, ir: number, gaze: readonly [number, number], shine: boolean): void {
  const [gx, gy] = gaze
  const s = shine ? 1.25 : 1
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ellipse(ctx, gx - ir * 9, gy - ry * 0.36 * ir, 9.5 * s, 10.5 * s, -0.3); ctx.fill()
  ctx.beginPath(); ellipse(ctx, gx + ir * 10, gy + ry * 0.36 * ir, 4.8 * s, 4.8 * s); ctx.fill()
  if (shine) { ctx.beginPath(); ellipse(ctx, gx + ir * 14, gy - ry * 0.14, 3, 3); ctx.fill() }
  void rx
}

function drawLid(ctx: Ctx, R: Rig, rx: number, ry: number, cover: number): void {
  const edge = -ry + 2 * ry * cover
  ctx.fillStyle = R.pal.lidFill
  ctx.beginPath(); ctx.rect(-rx - 4, -ry - 4, rx * 2 + 8, edge + ry + 4); ctx.fill()
  stroked(ctx, R.pal.line, 7, () => {
    ctx.moveTo(-rx - 2, edge - 3); ctx.quadraticCurveTo(0, edge + 7, rx + 2, edge - 3)
  })
}

function drawOpenEye(ctx: Ctx, R: Rig, kind: EyeKind, g: EyeGeom, shine: boolean): void {
  const { pal } = R
  const wide = kind === 'wide'
  const rx = wide ? g.rx * 1.12 : g.rx, ry = wide ? g.ry * 1.1 : g.ry
  ink(ctx, (c) => ellipse(c, 0, 0, rx + 2, ry + 2), { fill: wide ? '#fffaf5' : pal.eyeShade, line: pal.line, w: 5, swell: 0.3 })
  ctx.save(); ctx.beginPath(); ellipse(ctx, 0, 0, rx, ry); ctx.clip()
  const ir = wide ? 0.62 : 1
  const gaze: readonly [number, number] = kind === 'shy' ? [-7, 8] : [0, 0]
  drawIris(ctx, R, rx, ry, ir, gaze)
  if (kind === 'star') {
    ctx.save(); ctx.translate(0, 2); ctx.beginPath(); starPath(ctx, 21, 0.46); ctx.fillStyle = '#ffe45c'
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke(); ctx.restore()
  }
  drawCatchlights(ctx, rx, ry, ir, gaze, shine)
  const cover = kind === 'shy' ? 0.1 : LID_COVER[R.cfg.lids]
  if (cover > 0 && !wide) drawLid(ctx, R, rx, ry, cover)
  ctx.restore()
  if (cover === 0 || wide) {
    stroked(ctx, pal.line, 9, () => ctx.ellipse(0, 0, rx + 2, ry + 2, 0, Math.PI * 1.08, Math.PI * 1.92))
  }
}

function drawEye(ctx: Ctx, R: Rig, kind: EyeKind, side: number, g: EyeGeom, shine: boolean): void {
  const line = R.pal.line
  if (kind === 'happy' || kind === 'wink') {
    stroked(ctx, line, 9, () => { ctx.moveTo(-25, 10); ctx.quadraticCurveTo(0, -26, 25, 10) })
  } else if (kind === 'closed') {
    stroked(ctx, line, 8, () => { ctx.moveTo(-26, -6); ctx.quadraticCurveTo(0, 18, 26, -6) })
    stroked(ctx, line, 5, () => { ctx.moveTo(-25, -5); ctx.lineTo(-33, -11); ctx.moveTo(25, -5); ctx.lineTo(33, -11) })
  } else if (kind === 'spiral') {
    drawSpiral(ctx, line, side)
  } else {
    drawOpenEye(ctx, R, kind, g, shine)
    drawLashes(ctx, R, g, side)
  }
}

/** Both eyes, drawn at their sphere positions. */
export function drawEyes(ctx: Ctx, R: Rig): void {
  const g = eyeGeom(R)
  const sides = [-1, 1] as const
  sides.forEach((side, i) => {
    const P = R.proj(side * EYE_T, g.phi, 1.0)
    const kind = R.ex.eyes[i] ?? 'open'
    R.at(ctx, P, 0, () => drawEye(ctx, R, kind, side, g, R.ex.shine === true), Math.max(P.sx, 0.38))
  })
}

type BrowShape = (c: Ctx, lift: number) => void
const BROWS: Readonly<Record<string, { readonly w: number; readonly draw: BrowShape }>> = {
  soft: { w: 9, draw: (c, l) => { c.moveTo(-19, 3); c.quadraticCurveTo(0, -8 - l * 4, 19, 3) } },
  bold: { w: 13, draw: (c, l) => { c.moveTo(-21, 2); c.quadraticCurveTo(0, -5 - l * 3, 21, 2) } },
  thin: { w: 5, draw: (c, l) => { c.moveTo(-19, 3); c.quadraticCurveTo(0, -10 - l * 4, 19, 3) } },
  arched: { w: 8, draw: (c, l) => { c.moveTo(-19, 6); c.quadraticCurveTo(-6, -12 - l * 4, 2, -9 - l * 4); c.quadraticCurveTo(12, -7, 19, 7) } },
}

/** Brows sit lower under a cap or beanie so the hat band does not cover them. */
function browPhi(R: Rig, g: EyeGeom): number {
  const hat = R.cfg.headwear === 'cap' || R.cfg.headwear === 'beanie'
  return 0.6 + (g.k - 1) * 0.1 - (hat ? 0.12 : 0)
}

export function drawBrows(ctx: Ctx, R: Rig): void {
  const { pal, cfg, ex } = R
  const col = R.animal ? mix(cfg.skin, '#2b1d33', 0.55) : pal.hair
  const g = eyeGeom(R)
  const style = BROWS[cfg.brows] ?? (BROWS['soft'] as (typeof BROWS)[string])
  const lift = ex.brow
  for (const side of [-1, 1]) {
    const P = R.proj(side * EYE_T, browPhi(R, g) + lift * 0.1, 1.02)
    if (P.z < 0.05) continue
    const tilt = (0.1 - lift * 0.1 + (ex.worry ?? 0) * 0.3) * side
    R.at(ctx, P, tilt, () => {
      stroked(ctx, col, R.animal ? Math.min(style.w, 8) : style.w, () => style.draw(ctx, lift))
    })
  }
}

export function drawBlush(ctx: Ctx, R: Rig): void {
  const { cfg, pal, ex } = R
  if (!(cfg.blush || ex.hatch)) return
  const strong = ex.blush ? 1.15 : 1
  for (const side of [-1, 1]) {
    const P = R.proj(side * 0.95, -0.3, 1.0)
    if (P.z < 0.02) continue
    R.at(ctx, P, 0, () => {
      ctx.fillStyle = pal.blush; ctx.globalAlpha = 0.85
      ctx.beginPath(); ellipse(ctx, 0, 0, 26 * strong, 15 * strong); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = hiOf(pal.blush, 1.4); ctx.beginPath(); ellipse(ctx, -7, -4, 8, 3.5, -0.2); ctx.fill()
      if (ex.hatch) {
        ctx.strokeStyle = shadeOf(pal.blush, 1.5); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath()
        for (let i = -1; i <= 1; i++) { ctx.moveTo(i * 11 - 5, 11); ctx.lineTo(i * 11 + 4, -9) }
        ctx.stroke()
      }
    })
  }
}
