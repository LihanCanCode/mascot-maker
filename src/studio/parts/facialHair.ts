// Facial hair: stubble (under the face features), jaw-following beard with a real mouth cut-out,
// and an outlined moustache drawn over the nose/mouth gap.
import { TAU, ellipse, mix, rng, shadedInk, smooth } from '../draw'
import type { Ctx, Pt, Rig, SpherePt } from '../types'

export type FacialHairPhase = 'under' | 'over' | 'gap'

/** Mouth latitude on the sphere; lower when a moustache needs room above it. */
export function mouthPhi(R: Rig): number {
  const fh = R.cfg.facialHair
  return fh === 'beard' || fh === 'moustache' ? -0.78 : -0.66
}

/** Right lobe of the moustache as sphere points; mirrored for the left. */
const LOBE: readonly SpherePt[] = [
  [0, -0.47], [0.26, -0.43], [0.56, -0.47], [0.8, -0.58], [0.9, -0.7], [0.72, -0.66], [0.5, -0.64],
  [0.26, -0.63], [0, -0.6],
]
const mirror = (list: readonly SpherePt[]): SpherePt[] => list.map(([t, p, d]) => [-t, p, d] as const)

/** Inner (cheek) edge of the beard, left sideburn to right sideburn. */
const BEARD_INNER: readonly SpherePt[] = [
  [-1.42, -0.32], [-1.34, -0.5], [-1.12, -0.7], [-0.8, -0.72], [-0.45, -0.66], [0, -0.64],
  [0.45, -0.66], [0.8, -0.72], [1.12, -0.7], [1.34, -0.5], [1.42, -0.32],
]

function beardOuter(R: Rig): Pt[] {
  const out: Pt[] = []
  const n = 12
  const a0 = 0.32, a1 = Math.PI - 0.32
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    out.push(R.sil(t, 1.035, 0, 7 * Math.sin(t) ** 3))
  }
  return out
}

function drawBeard(ctx: Ctx, R: Rig): void {
  const { pal } = R
  const outer = beardOuter(R)
  const inner = R.pts(BEARD_INNER, 1.03, true)
  const M = R.proj(0, mouthPhi(R), 1.1)
  const build = (c: Ctx): void => {
    smooth(c, [...outer, ...inner])
    c.moveTo(M.x + 30 * M.sx, M.y + 4)
    c.ellipse(M.x, M.y + 4, 30 * Math.max(M.sx, 0.5), 16, 0, 0, TAU)
  }
  shadedInk(ctx, build, {
    base: pal.beard, shade: pal.beardShade, line: pal.line, w: 6, off: [-5, -7], rule: 'evenodd',
    hi: (c) => {
      c.strokeStyle = pal.beardHi; c.lineWidth = 6; c.lineCap = 'round'; c.globalAlpha = 0.75
      for (const side of [-1, 1]) {
        const p = R.pts([[side * 1.25, -0.7], [side * 0.95, -1.05], [side * 0.5, -1.3]], 1.06, true)
        if (p.every((q) => q.z < 0.1)) continue
        c.beginPath(); smooth(c, p, false); c.stroke()
      }
      c.globalAlpha = 1
    },
  })
}

function drawMoustache(ctx: Ctx, R: Rig): void {
  const { pal } = R
  for (const list of [LOBE, mirror(LOBE)]) {
    const p = R.pts(list, 1.1, false)
    if (p.reduce((s, q) => s + q.z, 0) / p.length < 0.2) continue
    shadedInk(ctx, (c) => smooth(c, p), {
      base: pal.beard, shade: pal.beardShade, line: pal.line, w: 5.5, off: [-3, -4],
      hi: (c) => {
        const a = p[3], b = p[2]
        if (!a || !b) return
        c.strokeStyle = pal.beardHi; c.lineWidth = 4; c.lineCap = 'round'
        c.beginPath(); c.moveTo(b.x, b.y - 3); c.lineTo(a.x, a.y - 5); c.stroke()
      },
    })
  }
}

function drawStubble(ctx: Ctx, R: Rig): void {
  const { cfg, pal } = R
  const top = R.pts([[-1.6, 0], [-1.3, -0.3], [-0.9, -0.5], [-0.45, -0.5], [0, -0.46], [0.45, -0.5], [0.9, -0.5], [1.3, -0.3], [1.6, 0]], 1.0, true)
  const bot = R.pts([[1.7, -1.5], [0, -1.7], [-1.7, -1.5]], 1.2, true)
  ctx.fillStyle = mix(cfg.skin, pal.hair, 0.4); ctx.globalAlpha = 0.85
  ctx.beginPath(); smooth(ctx, [...top, ...bot]); ctx.fill(); ctx.globalAlpha = 1
  const rnd = rng(7)
  ctx.fillStyle = pal.hairShade
  for (let i = 0; i < 120; i++) {
    const P = R.proj((rnd() * 2 - 1) * 1.45, -0.5 - rnd() * 0.95, 1.0)
    if (P.z < 0.12) continue
    ctx.beginPath(); ellipse(ctx, P.x, P.y, 1.5 + rnd(), 1.5 + rnd()); ctx.fill()
  }
}

export function drawFacialHair(ctx: Ctx, R: Rig, phase: FacialHairPhase): void {
  const fh = R.cfg.facialHair
  if (fh === 'none' || R.animal) return
  if (phase === 'under' && fh === 'stubble') drawStubble(ctx, R)
  else if (phase === 'over' && fh === 'beard') drawBeard(ctx, R)
  else if (phase === 'gap' && (fh === 'beard' || fh === 'moustache')) drawMoustache(ctx, R)
}
