// 2.5D rig: head silhouette per face shape, face-sphere projection, palette, pose tables.
import { clamp, hiOf, liftDark, shadeOf } from './draw'
import type {
  Ctx, EarType, Expression, ExpressionName, FaceShape, Palette, Pose, ProjPt, Pt, Rig, SpherePt, StudioConfig,
} from './types'

export const CELL_DEFAULT = 512
/** Design-space edge; every part is authored for a 512 cell and scaled at render time. */
export const DESIGN = 512

/** Row-major: up-left, up, up-right, left, centre, right, down-left, down, down-right. dy < 0 is up. */
export const DIRECTIONS: readonly Pose[] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
].map(([dx, dy]) => ({ dx: dx as number, dy: dy as number, expr: 'neutral' as const }))

export const REACTION_NAMES: readonly ExpressionName[] = [
  'blink', 'heart', 'sparkle', 'surprised', 'starstruck', 'bashful', 'sleepy', 'dizzy', 'delighted',
]
export const REACTIONS: readonly Pose[] = REACTION_NAMES.map((expr) => ({ dx: 0, dy: 0, expr }))

export const EXPRESSIONS: Readonly<Record<ExpressionName, Expression>> = {
  neutral: { eyes: ['open', 'open'], mouth: 'smile', brow: 0 },
  blink: { eyes: ['closed', 'closed'], mouth: 'smile', brow: 0 },
  heart: { eyes: ['open', 'open'], mouth: 'smile', brow: 0.2, blush: true, symbol: 'heart', shine: true },
  sparkle: { eyes: ['open', 'open'], mouth: 'open', brow: 0.4, symbol: 'sparkle', shine: true },
  surprised: { eyes: ['wide', 'wide'], mouth: 'o', brow: 1 },
  starstruck: { eyes: ['star', 'wink'], mouth: 'open', brow: 0.3 },
  bashful: { eyes: ['shy', 'shy'], mouth: 'smallsmile', brow: 0.25, worry: 1, blush: true, hatch: true },
  sleepy: { eyes: ['closed', 'closed'], mouth: 'tiny', brow: -0.3, symbol: 'zzz' },
  dizzy: { eyes: ['spiral', 'spiral'], mouth: 'wavy', brow: -0.2 },
  delighted: { eyes: ['happy', 'happy'], mouth: 'grin', brow: 0.5, blush: true },
}

const ANIMAL_EARS: readonly EarType[] = ['cat', 'bear', 'fox', 'bunny']
export const isAnimal = (c: StudioConfig): boolean => ANIMAL_EARS.includes(c.ears)

export function makePalette(c: StudioConfig): Palette {
  const hair = liftDark(c.hairColor, 0.2)
  const beard = c.facialHairColor ?? liftDark(c.hairColor, 0.23)
  const lidFill = c.eyePatch === 'oval' ? c.patchColor : c.skin
  return {
    line: c.outline,
    skin: c.skin, skinShade: shadeOf(c.skin), skinHi: hiOf(c.skin), skinDeep: shadeOf(c.skin, 2),
    hair, hairShade: shadeOf(hair), hairHi: hiOf(hair, 2.6),
    beard, beardShade: shadeOf(beard), beardHi: hiOf(beard, 2.4),
    shirt: c.shirt, shirtShade: shadeOf(c.shirt), shirtHi: hiOf(c.shirt),
    accent: c.accent, accentShade: shadeOf(c.accent),
    muzzle: c.muzzle, muzzleShade: shadeOf(c.muzzle, 0.8),
    hat: c.headwearColor, hatShade: shadeOf(c.headwearColor), hatHi: hiOf(c.headwearColor),
    eye: c.eyeColor, eyeShade: shadeOf(c.eyeColor, 1.8), eyeHi: hiOf(c.eyeColor, 1.7),
    lidFill,
    blush: c.blushColor, mouthIn: '#6a2238', tongue: '#ff7d93',
  }
}

const YAW = 0.74 // radians of head turn at dx = +-1
const PITCH = 0.36 // radians of nod at dy = +-1

interface ShapeSpec {
  readonly rx: number
  readonly ry: number
  /** Superellipse exponent for the upper / lower half. */
  readonly nTop: number
  readonly nBot: number
  /** Narrowing toward the chin (0 = none). */
  readonly taper: number
}

const SHAPES: Readonly<Record<FaceShape, ShapeSpec>> = {
  round: { rx: 138, ry: 121, nTop: 2, nBot: 2, taper: 0 },
  oval: { rx: 127, ry: 128, nTop: 2, nBot: 2.3, taper: 0.1 },
  square: { rx: 134, ry: 118, nTop: 3, nBot: 4, taper: 0 },
  heart: { rx: 140, ry: 123, nTop: 2.1, nBot: 2, taper: 0.4 },
}

const signedPow = (v: number, e: number): number => Math.sign(v) * Math.abs(v) ** e

/** Returns the unit-space silhouette point (x, y in -1..1) for a canvas angle t. */
function unitSil(spec: ShapeSpec, t: number): Pt {
  const co = Math.cos(t), si = Math.sin(t)
  const n = si > 0 ? spec.nBot : spec.nTop
  const py = signedPow(si, 2 / n)
  const lower = Math.max(0, py)
  return { x: signedPow(co, 2 / n) * (1 - spec.taper * lower * lower), y: py }
}

interface Rotation { readonly cYaw: number; readonly sYaw: number; readonly cp: number; readonly sp: number }

function projectSphere(
  rot: Rotation, frame: { cx: number; cy: number; rx: number; ry: number },
  theta: number, phi: number, d: number, rim: boolean,
): ProjPt {
  const x = Math.cos(phi) * Math.sin(theta), y = Math.sin(phi), z = Math.cos(phi) * Math.cos(theta)
  const x1 = x * rot.cYaw + z * rot.sYaw, z1 = z * rot.cYaw - x * rot.sYaw
  const y2 = y * rot.cp + z1 * rot.sp, z2 = z1 * rot.cp - y * rot.sp
  if (rim && z2 < 0) {
    const m = Math.hypot(x1, y2) || 1
    return { x: frame.cx + (frame.rx * 1.02 * d * x1) / m, y: frame.cy - (frame.ry * 1.02 * d * y2) / m, z: z2, sx: 0.3 }
  }
  return {
    x: frame.cx + frame.rx * 0.95 * d * x1, y: frame.cy - frame.ry * 0.95 * d * y2, z: z2,
    sx: clamp(0.3 + 0.7 * Math.max(z2, 0) ** 0.8, 0.3, 1),
  }
}

/** Build the per-pose geometry every part places itself with. */
export function createRig(cfg: StudioConfig, pose: Pose): Rig {
  const { dx, dy } = pose
  const yaw = dx * YAW, pitch = -dy * PITCH
  const spec = SHAPES[cfg.faceShape]
  const cx = 256 + dx * 17
  const cy = 232 + dy * 7
  const rx = spec.rx * (1 - 0.085 * Math.abs(dx))
  const ry = spec.ry * (1 - 0.04 * Math.abs(dy))
  const rot: Rotation = { cYaw: Math.cos(yaw), sYaw: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) }
  const frame = { cx, cy, rx, ry }

  const sil = (t: number, s = 1, ox = 0, oy = 0): Pt => {
    const u = unitSil(spec, t)
    return { x: cx + ox + rx * s * u.x, y: cy + oy + ry * s * u.y }
  }
  const head = (ctx: Ctx, s = 1, ox = 0, oy = 0): void => {
    const N = 120
    for (let i = 0; i < N; i++) {
      const p = sil((i / N) * Math.PI * 2, s, ox, oy)
      if (i) ctx.lineTo(p.x, p.y)
      else ctx.moveTo(p.x, p.y)
    }
    ctx.closePath()
  }
  const proj = (theta: number, phi: number, d = 1, rim = false): ProjPt => projectSphere(rot, frame, theta, phi, d, rim)
  const pts = (list: readonly SpherePt[], d = 1, rim = true): ProjPt[] =>
    list.map(([t, p, dd]) => proj(t, p, dd ?? d, rim))
  const at = (ctx: Ctx, P: ProjPt, rotation: number, fn: () => void, sx: number = P.sx): void => {
    ctx.save(); ctx.translate(P.x, P.y)
    if (rotation) ctx.rotate(rotation)
    ctx.scale(sx, 1); fn(); ctx.restore()
  }
  return {
    cfg, pal: makePalette(cfg), animal: isAnimal(cfg), dx, dy, cx, cy, rx, ry,
    ex: EXPRESSIONS[pose.expr], sil, head, proj, pts, at,
  }
}
