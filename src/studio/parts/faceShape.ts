// Head fill and the features that follow the head shape: cheek tufts (ruff / fluff) and eye patches.
import { ellipse, ink, shadedInk } from '../draw'
import type { Ctx, Pt, Rig } from '../types'

interface Tuft {
  /** Canvas angle on the right cheek (0 = right, +y down); mirrored for the left side. */
  readonly t: number
  readonly len: number
  readonly half: number
}

const RUFF: readonly Tuft[] = [
  { t: 0.1, len: 30, half: 0.21 }, { t: 0.38, len: 32, half: 0.21 }, { t: 0.64, len: 24, half: 0.19 },
]
const FLUFF: readonly Tuft[] = [{ t: 0.22, len: 20, half: 0.18 }, { t: 0.5, len: 16, half: 0.16 }]

/** Pointy fur tuft sticking out of the silhouette at canvas angle t. */
function tuftPath(R: Rig, t: number, tuft: Tuft): (c: Ctx) => void {
  const a = R.sil(t - tuft.half, 0.96)
  const b = R.sil(t + tuft.half, 0.96)
  const m = R.sil(t, 1)
  const nx = (m.x - R.cx) / R.rx, ny = (m.y - R.cy) / R.ry
  const k = Math.hypot(nx, ny) || 1
  const tip: Pt = { x: m.x + (nx / k) * tuft.len, y: m.y + (ny / k) * tuft.len * 0.6 + tuft.len * 0.35 }
  const upper = a.y <= b.y
  const ca: Pt = { x: (a.x + tip.x) / 2 + nx * 12, y: (a.y + tip.y) / 2 + (upper ? -8 : 12) }
  const cb: Pt = { x: (b.x + tip.x) / 2 + nx * 4, y: (b.y + tip.y) / 2 + (upper ? 12 : -8) }
  return (c) => {
    c.moveTo(a.x, a.y); c.quadraticCurveTo(ca.x, ca.y, tip.x, tip.y)
    c.quadraticCurveTo(cb.x, cb.y, b.x, b.y); c.closePath()
  }
}

/** Cheek tufts are drawn before the head so the head outline hides their roots. */
export function drawCheekTufts(ctx: Ctx, R: Rig): void {
  const { cfg, pal } = R
  if (cfg.cheekFluff === 'none') return
  const list = cfg.cheekFluff === 'ruff' ? RUFF : FLUFF
  for (const tuft of list) {
    for (const t of [tuft.t, Math.PI - tuft.t]) {
      shadedInk(ctx, tuftPath(R, t, tuft), {
        base: pal.muzzle, shade: pal.muzzleShade, line: pal.line, w: 6, off: [-3, -3],
      })
    }
  }
}

/** Shade first, then the base-coloured form pushed up-left leaves a shaded crescent; top-left sheen. */
export function drawHeadFill(ctx: Ctx, R: Rig): void {
  const { pal } = R
  ink(ctx, (c) => R.head(c), { fill: pal.skinShade, fillOnly: true })
  ctx.save(); ctx.beginPath(); R.head(ctx); ctx.clip()
  ctx.fillStyle = pal.skin; ctx.beginPath(); R.head(ctx, 0.97, -9, -11); ctx.fill()
  const H = R.proj(-0.6, 0.85, 1)
  if (H.z > 0.1) {
    ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(-0.5); ctx.fillStyle = pal.skinHi; ctx.globalAlpha = 0.7
    ctx.beginPath(); ellipse(ctx, 0, 0, 26 * H.sx, 8); ctx.fill(); ctx.restore()
  }
  ctx.restore()
}

/** Dark oval eye patches (panda style); drawn clipped to the head, under the eyes. */
export function drawEyePatches(ctx: Ctx, R: Rig): void {
  if (R.cfg.eyePatch === 'none') return
  for (const side of [-1, 1]) {
    const P = R.proj(side * 0.48, -0.02, 1.02)
    if (P.z < 0.02) continue
    R.at(ctx, P, side * 0.5, () => {
      ctx.fillStyle = R.cfg.patchColor; ctx.beginPath(); ellipse(ctx, 0, 2, 44, 56); ctx.fill()
    }, Math.max(P.sx, 0.4))
  }
}
