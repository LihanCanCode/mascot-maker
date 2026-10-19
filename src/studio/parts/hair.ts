// Hair: messy (tapered locks), bob, buzz, bun, ponytail. Curly lives in hairCurly.ts.
import { ellipse, ink, mix, poly, shadedInk, smooth } from '../draw'
import type { Build, Ctx, Pt, Rig, SpherePt } from '../types'
import { drawCurlyBack, drawCurlyFront, curlyShadowBuilds } from './hairCurly'
import {
  L_TEMPLE, R_TEMPLE, arcPts, drawHighlightBand, drawStrand, strandBuild,
} from './hairGeometry'
import type { Strand } from './hairGeometry'

const MESSY_LINE: readonly SpherePt[] = [
  [1.55, 0.22], [1.42, 0.4], [1.15, 0.62], [0.8, 0.8], [0.4, 0.9], [0, 0.94], [-0.4, 0.9], [-0.8, 0.8],
  [-1.15, 0.62], [-1.42, 0.4], [-1.55, 0.22],
]
const BOB_LINE: readonly SpherePt[] = [
  [1.5, -0.5], [1.45, -0.1], [1.2, 0.34], [0.82, 0.6], [0.4, 0.7], [0.05, 0.74], [-0.4, 0.68], [-0.82, 0.58],
  [-1.2, 0.34], [-1.45, -0.1], [-1.5, -0.5],
]
const BUN_LINE: readonly SpherePt[] = [
  [1.52, -0.25], [1.42, 0.2], [1.1, 0.5], [0.6, 0.68], [0.1, 0.78], [-0.3, 0.7], [-0.8, 0.58], [-1.2, 0.36],
  [-1.42, 0.2], [-1.52, -0.25],
]
const BUZZ_LINE: readonly SpherePt[] = [
  [1.45, 0], [1.3, 0.4], [0.9, 0.68], [0.4, 0.8], [0, 0.82], [-0.4, 0.8], [-0.9, 0.68], [-1.3, 0.4], [-1.45, 0],
]

const MESSY_STRANDS: readonly Strand[] = [
  { t: -1.25, w: 0.22, tipT: -1.38, tipP: 0.1 }, { t: -1.0, w: 0.26, tipT: -1.12, tipP: 0.26 },
  { t: -0.74, w: 0.24, tipT: -0.8, tipP: 0.56 }, { t: -0.22, w: 0.26, tipT: -0.14, tipP: 0.58 },
  { t: 0.22, w: 0.26, tipT: 0.34, tipP: 0.54 }, { t: 0.76, w: 0.24, tipT: 0.84, tipP: 0.56 },
  { t: 1.05, w: 0.26, tipT: 1.14, tipP: 0.26 }, { t: 1.3, w: 0.2, tipT: 1.4, tipP: 0.1 },
]
const TAU_ = Math.PI * 2
const MESSY_BUMPS = [0, 0.03, 0.012, 0.045, 0.004, 0.032]

interface CapSpec {
  readonly s: number
  readonly n: number
  readonly line: readonly SpherePt[]
  readonly amps?: readonly number[]
  readonly a0?: number
  readonly a1?: number
  readonly afterOuter?: readonly Pt[]
  readonly afterLower?: readonly Pt[]
  readonly sharp?: boolean
}

function capBuild(R: Rig, spec: CapSpec): Build {
  const outer = arcPts(R, spec.a0 ?? L_TEMPLE, spec.a1 ?? R_TEMPLE, spec.n, spec.s, spec.amps)
  const lower = R.pts(spec.line, 1.03, true)
  const all = [...outer, ...(spec.afterOuter ?? []), ...lower, ...(spec.afterLower ?? [])]
  return (c) => (spec.sharp ? poly(c, all) : smooth(c, all))
}

function capFor(R: Rig): Build | null {
  switch (R.cfg.hairStyle) {
    case 'messy': return capBuild(R, { s: 1.07, n: 16, line: MESSY_LINE, amps: MESSY_BUMPS, a0: Math.PI + 0.12, a1: TAU_ - 0.12 })
    case 'bun': case 'ponytail': return capBuild(R, { s: 1.06, n: 14, line: BUN_LINE })
    case 'buzz': return capBuild(R, { s: 1.015, n: 16, line: BUZZ_LINE })
    case 'bob': {
      const lo = R.sil(Math.PI - 0.36, 1.1, 0, 6), ro = R.sil(0.36, 1.1, 0, 6)
      return capBuild(R, {
        s: 1.13, n: 14, line: BOB_LINE, a0: Math.PI - 0.5, a1: Math.PI * 2 + 0.5, afterOuter: [ro], afterLower: [lo],
      })
    }
    default: return null
  }
}

/** Every filled region of the front hair (used for the forehead cast shadow). */
function frontShapes(R: Rig): Build[] {
  if (R.cfg.headwear === 'hijab') return []
  if (R.cfg.hairStyle === 'curly') return curlyShadowBuilds(R)
  const cap = capFor(R)
  if (!cap || R.cfg.hairStyle === 'buzz') return []
  const strands = R.cfg.hairStyle === 'messy' ? MESSY_STRANDS.map((s) => strandBuild(R, MESSY_LINE, s)) : []
  return [cap, ...strands]
}

/** Soft shadow the fringe casts on the forehead; call with the head clip active. */
export function drawHairCastShadow(ctx: Ctx, R: Rig): void {
  const shapes = frontShapes(R)
  if (!shapes.length) return
  ctx.save(); ctx.translate(2, 11); ctx.globalAlpha = 0.5; ctx.fillStyle = R.pal.skinDeep
  for (const b of shapes) { ctx.beginPath(); b(ctx); ctx.fill() }
  ctx.restore()
}

function drawBobBack(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const pts = [
    ...arcPts(R, Math.PI - 0.55, Math.PI * 2 + 0.55, 14, 1.15),
    R.sil(0.3, 1.1, 0, 8), R.sil(Math.PI - 0.3, 1.1, 0, 8),
  ]
  shadedInk(ctx, (c) => smooth(c, pts), { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 6, off: [-6, -4] })
}

function drawBun(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const P = R.proj(0, 1.36, 1.22)
  R.at(ctx, P, 0, () => {
    shadedInk(ctx, (c) => ellipse(c, 0, 0, 52, 48), { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-7, -7] })
    ctx.strokeStyle = pal.hairHi; ctx.lineWidth = 6; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, 0, 30, 3.5, 4.8); ctx.stroke()
    ctx.strokeStyle = pal.hairShade; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(2, 4, 20, 0.4, 2.3); ctx.stroke()
  }, Math.max(P.sx, 0.7))
}

function drawPonytailTail(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const A = R.proj(1.15, 0.95, 1.08, true)
  R.at(ctx, A, 0, () => {
    const tail: Build = (c) => {
      c.moveTo(-6, -10); c.bezierCurveTo(36, -6, 74, 40, 52, 112); c.bezierCurveTo(48, 140, 22, 130, 24, 100)
      c.bezierCurveTo(30, 60, 6, 30, -14, 18); c.closePath()
    }
    shadedInk(ctx, tail, { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-6, -4] })
  }, 1)
}

export function drawHairBack(ctx: Ctx, R: Rig): void {
  const { cfg } = R
  if (cfg.headwear === 'hijab') return
  if (cfg.hairStyle === 'bun') drawBun(ctx, R)
  else if (cfg.hairStyle === 'ponytail') drawPonytailTail(ctx, R)
  else if (cfg.hairStyle === 'bob') drawBobBack(ctx, R)
  else if (cfg.hairStyle === 'curly') drawCurlyBack(ctx, R)
}

function drawBuzz(ctx: Ctx, R: Rig, cap: Build): void {
  const { cfg, pal } = R
  ink(ctx, cap, { fill: mix(cfg.skin, pal.hair, 0.7), line: pal.hairShade, w: 3, swell: 0 })
}

function drawPartAndTie(ctx: Ctx, R: Rig): void {
  const { cfg, pal } = R
  ctx.strokeStyle = pal.hairShade; ctx.lineWidth = 4; ctx.lineCap = 'round'
  ctx.beginPath(); smooth(ctx, R.pts([[-0.05, 0.8], [-0.04, 1.1], [0, 1.35]], 1.05, true), false); ctx.stroke()
  if (cfg.hairStyle === 'bun') {
    const P = R.proj(0, 1.3, 1.1)
    R.at(ctx, P, 0, () => ink(ctx, (c) => ellipse(c, 0, 0, 40, 11), { fill: pal.accent, line: pal.line, w: 5, swell: 0.4 }), Math.max(P.sx, 0.6))
  } else {
    const A = R.proj(1.15, 0.95, 1.08, true)
    R.at(ctx, A, 0, () => ink(ctx, (c) => ellipse(c, 2, 2, 17, 12, 0.5), { fill: pal.accent, line: pal.line, w: 5, swell: 0.4 }), 1)
  }
}

export function drawHairFront(ctx: Ctx, R: Rig): void {
  const { cfg, pal } = R
  if (cfg.hairStyle === 'none' || cfg.headwear === 'hijab') return
  if (cfg.hairStyle === 'curly') { drawCurlyFront(ctx, R); return }
  const cap = capFor(R)
  if (!cap) return
  if (cfg.hairStyle === 'buzz') { drawBuzz(ctx, R, cap); return }
  shadedInk(ctx, cap, {
    base: pal.hair, shade: pal.hairShade, line: pal.line, w: 6, off: [-7, -9],
    hi: () => drawHighlightBand(ctx, R, [[-1.0, 1.0], [-0.55, 1.14], [-0.05, 1.18], [0.5, 1.12]], pal.hairHi),
  })
  if (cfg.hairStyle === 'messy') {
    MESSY_STRANDS.forEach((s) => drawStrand(ctx, R, strandBuild(R, MESSY_LINE, s)))
  }
  if (cfg.hairStyle === 'bun' || cfg.hairStyle === 'ponytail') drawPartAndTie(ctx, R)
}
