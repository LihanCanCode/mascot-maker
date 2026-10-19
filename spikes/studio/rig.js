// Parametric 2.5D mascot rig. Pure functions; the only environment dependency is an injected
// `createCanvas(w, h)` factory, so the same code runs in a page, an OffscreenCanvas worker or
// a headless browser. Output: the two 3x3 sheets our app consumes.
import { clamp, hiOf, shadeOf, mix, ink, ellipse, roundRect, heartPath, sparklePath, starPath } from './draw.js'
import {
  drawBody, drawEarsBack, drawEarsFront, drawHairBack, drawHairFront, drawHeadwearBack,
  drawHeadwearFront, drawFacialHair, drawGlasses, drawMuzzle,
} from './parts.js'

export const CELL = 512

/** Row-major: up-left, up, up-right, left, centre, right, down-left, down, down-right. dy<0 is up. */
export const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
]
export const REACTIONS = ['blink', 'heart', 'sparkle', 'surprised', 'starstruck', 'bashful', 'sleepy', 'dizzy', 'delighted']

/** What each reaction does to the face. eyes: per-eye kind [viewerLeft, viewerRight]. */
export const EXPRESSIONS = {
  neutral: { eyes: ['open', 'open'], mouth: 'smile', brow: 0 },
  blink: { eyes: ['closed', 'closed'], mouth: 'smile', brow: 0 },
  heart: { eyes: ['open', 'open'], mouth: 'smile', brow: 0.2, blush: true, symbol: 'heart', shine: true },
  sparkle: { eyes: ['open', 'open'], mouth: 'open', brow: 0.4, symbol: 'sparkle', shine: true },
  surprised: { eyes: ['wide', 'wide'], mouth: 'o', brow: 1 },
  starstruck: { eyes: ['star', 'wink'], mouth: 'open', brow: 0.3 },
  bashful: { eyes: ['down', 'down'], mouth: 'wavy', brow: -0.6, blush: true, hatch: true },
  sleepy: { eyes: ['closed', 'closed'], mouth: 'tiny', brow: -0.3, symbol: 'zzz' },
  dizzy: { eyes: ['spiral', 'spiral'], mouth: 'wavy', brow: -0.2 },
  delighted: { eyes: ['happy', 'happy'], mouth: 'grin', brow: 0.5, blush: true },
}

export const DEFAULTS = Object.freeze({
  skin: '#f2c29b', muzzle: '#fff1e0', earInner: '#f4a3b5', noseColor: '#4a2d3c',
  hairStyle: 'messy', hairColor: '#2b2230', eyeColor: '#5b3a2a',
  glasses: 'none', glassesColor: '#2a1c2e', facialHair: 'none',
  ears: 'human', headShape: 'round', blush: true, blushColor: '#ff8aa8',
  headwear: 'none', headwearColor: '#e8505b', earTip: '#3b2a33',
  shirt: '#5b7bd5', neckline: 'crew', shirtDetail: 'none', accent: '#ffcf4a',
  outline: '#2b1d33', eyeScale: 1,
})

export function mergeConfig(cfg = {}) {
  const c = { ...DEFAULTS }
  for (const k of Object.keys(cfg)) if (cfg[k] !== undefined) c[k] = cfg[k]
  return c
}

export const isAnimal = (c) => ['cat', 'bear', 'fox', 'bunny'].includes(c.ears)

export function palette(c) {
  return {
    line: c.outline,
    skin: c.skin, skinShade: shadeOf(c.skin), skinHi: hiOf(c.skin), skinDeep: shadeOf(c.skin, 2),
    hair: c.hairColor, hairShade: shadeOf(c.hairColor), hairHi: hiOf(c.hairColor, 2.4),
    shirt: c.shirt, shirtShade: shadeOf(c.shirt), shirtHi: hiOf(c.shirt),
    accent: c.accent, accentShade: shadeOf(c.accent),
    muzzle: c.muzzle, muzzleShade: shadeOf(c.muzzle, 0.8),
    hat: c.headwearColor, hatShade: shadeOf(c.headwearColor), hatHi: hiOf(c.headwearColor),
    eye: c.eyeColor, eyeShade: shadeOf(c.eyeColor, 1.8), eyeHi: hiOf(c.eyeColor, 1.7),
    blush: c.blushColor, mouthIn: '#6a2238', tongue: '#ff7d93',
  }
}

// ---- rig math ---------------------------------------------------------------------------
const YAW = 0.74    // radians of head turn at dx = +-1
const PITCH = 0.36  // radians of nod at dy = +-1

/**
 * Build the per-pose geometry. Everything the parts need to place themselves comes from here:
 *  - sil(t,s): point on the head silhouette (superellipse, so a "square" head works too)
 *  - proj(theta, phi, depth, rim): a point on a virtual face-sphere, yaw+pitch rotated, then
 *    flattened to the screen. z > 0 faces the viewer. sx is the horizontal foreshortening.
 */
export function createRig(cfgIn, pose) {
  const cfg = mergeConfig(cfgIn)
  const dx = pose.dx || 0, dy = pose.dy || 0
  const yaw = dx * YAW, pitch = -dy * PITCH
  const sq = cfg.headShape === 'square'
  const n = sq ? 3.4 : 2
  const cx = 256 + dx * 17
  const cy = 232 + dy * 7
  const rx = (sq ? 132 : 138) * (1 - 0.085 * Math.abs(dx))
  const ry = (sq ? 118 : 121) * (1 - 0.04 * Math.abs(dy))
  const cYaw = Math.cos(yaw), sYaw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)

  const sil = (t, s = 1, ox = 0, oy = 0) => {
    const co = Math.cos(t), si = Math.sin(t)
    const px = Math.sign(co) * Math.abs(co) ** (2 / n), py = Math.sign(si) * Math.abs(si) ** (2 / n)
    return { x: cx + ox + rx * s * px, y: cy + oy + ry * s * py }
  }
  const head = (ctx, s = 1, ox = 0, oy = 0) => {
    const N = 120
    for (let i = 0; i < N; i++) {
      const p = sil((i / N) * Math.PI * 2, s, ox, oy)
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y)
    }
    ctx.closePath()
  }
  const proj = (theta, phi, d = 1, rim = false) => {
    const x = Math.cos(phi) * Math.sin(theta), y = Math.sin(phi), z = Math.cos(phi) * Math.cos(theta)
    const x1 = x * cYaw + z * sYaw, z1 = z * cYaw - x * sYaw
    const y2 = y * cp + z1 * sp, z2 = z1 * cp - y * sp
    if (rim && z2 < 0) {
      const m = Math.hypot(x1, y2) || 1
      return { x: cx + (rx * 1.02 * d * x1) / m, y: cy - (ry * 1.02 * d * y2) / m, z: z2, sx: 0.3 }
    }
    return {
      x: cx + rx * 0.95 * d * x1, y: cy - ry * 0.95 * d * y2, z: z2,
      sx: clamp(0.3 + 0.7 * Math.max(z2, 0) ** 0.8, 0.3, 1),
    }
  }
  const pts = (list, d = 1, rim = true) => list.map(([t, p, dd]) => proj(t, p, dd ?? d, rim))
  const at = (ctx, P, rot, fn, sx = P.sx) => {
    ctx.save(); ctx.translate(P.x, P.y); if (rot) ctx.rotate(rot); ctx.scale(sx, 1); fn(); ctx.restore()
  }
  return { cfg, pal: palette(cfg), animal: isAnimal(cfg), dx, dy, yaw, pitch, cx, cy, rx, ry, sil, head, proj, pts, at, line: cfg.outline, ex: EXPRESSIONS[pose.expr || 'neutral'] }
}

// ---- face -------------------------------------------------------------------------------
const EYE_T = 0.46

function eyeGeom(R) {
  const k = R.cfg.eyeScale
  return { rx: 29 * k, ry: 37 * k, phi: R.animal ? 0.1 : 0.04 }
}

function drawEye(ctx, R, kind, side, shine) {
  const { pal } = R
  const g = eyeGeom(R), line = pal.line
  if (kind === 'happy' || kind === 'wink') {
    ctx.strokeStyle = line; ctx.lineCap = 'round'; ctx.lineWidth = 9
    ctx.beginPath(); ctx.moveTo(-25, 10); ctx.quadraticCurveTo(0, -26, 25, 10); ctx.stroke()
    return
  }
  if (kind === 'closed') {
    ctx.strokeStyle = line; ctx.lineCap = 'round'; ctx.lineWidth = 8
    ctx.beginPath(); ctx.moveTo(-26, -6); ctx.quadraticCurveTo(0, 18, 26, -6); ctx.stroke()
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-25, -5); ctx.lineTo(-33, -11); ctx.moveTo(25, -5); ctx.lineTo(33, -11); ctx.stroke()
    return
  }
  if (kind === 'spiral') {
    ink(ctx, (c) => ellipse(c, 0, 0, 33, 38), { fill: '#fffaf5', line, w: 5 })
    ctx.strokeStyle = line; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath()
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 5 * side, r = (i / 90) * 27
      ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r)
    }
    ctx.stroke()
    return
  }
  const wide = kind === 'wide'
  const rx = wide ? g.rx * 1.12 : g.rx, ry = wide ? g.ry * 1.1 : g.ry
  ink(ctx, (c) => ellipse(c, 0, 0, rx + 2, ry + 2), { fill: wide ? '#fffaf5' : pal.eyeShade, line, w: 5, swell: 0.3 })
  ctx.save(); ctx.beginPath(); ellipse(ctx, 0, 0, rx, ry); ctx.clip()
  const down = kind === 'down' ? 7 : 0
  const ir = wide ? 0.62 : 1
  // iris: three flat tones (body, dark top, light lower rim)
  ctx.fillStyle = pal.eye; ctx.beginPath(); ellipse(ctx, 0, down, rx * ir, ry * ir); ctx.fill()
  ctx.fillStyle = pal.eyeShade; ctx.beginPath(); ellipse(ctx, 0, -ry * 0.28 * ir + down, rx * ir * 1.05, ry * ir * 0.78); ctx.fill()
  ctx.fillStyle = pal.eyeHi; ctx.beginPath(); ellipse(ctx, 0, ry * 0.62 * ir + down, rx * ir * 0.78, ry * ir * 0.34); ctx.fill()
  ctx.fillStyle = '#1b1220'; ctx.beginPath(); ellipse(ctx, 0, 1 + down, rx * ir * 0.5, ry * ir * 0.52); ctx.fill()
  if (kind === 'star') {
    ctx.save(); ctx.translate(0, 2); ctx.beginPath(); starPath(ctx, 21, 0.46); ctx.fillStyle = '#ffe45c'
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke(); ctx.restore()
  }
  // catchlights sit on the same side in every eye: one light source
  const s = shine ? 1.25 : 1
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ellipse(ctx, -ir * 9, -ry * 0.36 * ir + down, 9.5 * s, 10.5 * s, -0.3); ctx.fill()
  ctx.beginPath(); ellipse(ctx, ir * 10, ry * 0.36 * ir + down, 4.8 * s, 4.8 * s); ctx.fill()
  if (shine) { ctx.beginPath(); ellipse(ctx, ir * 14, -ry * 0.14, 3, 3); ctx.fill() }
  if (kind === 'down') {
    ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.rect(-rx - 4, -ry - 4, rx * 2 + 8, ry * 0.75); ctx.fill()
  }
  ctx.restore()
  // heavy upper lid
  ctx.strokeStyle = line; ctx.lineCap = 'round'; ctx.lineWidth = kind === 'down' ? 7 : 9
  ctx.beginPath()
  if (kind === 'down') { ctx.moveTo(-rx - 2, -ry * 0.22); ctx.quadraticCurveTo(0, -ry * 0.6, rx + 2, -ry * 0.22) }
  else ctx.ellipse(0, 0, rx + 2, ry + 2, 0, Math.PI * 1.08, Math.PI * 1.92)
  ctx.stroke()
}

function drawBrows(ctx, R) {
  const { pal, cfg, ex } = R
  const col = R.animal ? mix(cfg.skin, '#2b1d33', 0.55) : pal.hair
  const lift = ex.brow
  for (const side of [-1, 1]) {
    const P = R.proj(side * EYE_T, 0.6 + lift * 0.1, 1.02)
    if (P.z < 0.05) continue
    const tilt = (0.12 - lift * 0.1) * side + (ex.hatch ? side * -0.22 : 0)
    R.at(ctx, P, tilt, () => {
      ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = R.animal ? 7 : 9
      ctx.beginPath(); ctx.moveTo(-19, 3); ctx.quadraticCurveTo(0, -8 - lift * 4, 19, 3); ctx.stroke()
    })
  }
}

function drawBlush(ctx, R) {
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

function drawNose(ctx, R) {
  const { pal, cfg } = R
  if (!R.animal) {
    const P = R.proj(0, -0.37, 1.14)
    R.at(ctx, P, 0, () => {
      ctx.strokeStyle = shadeOf(cfg.skin, 2.2); ctx.lineWidth = 4.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, 9, 9, -2); ctx.stroke()
      ctx.fillStyle = pal.skinHi; ctx.beginPath(); ellipse(ctx, -2, -9, 5, 3.4, -0.4); ctx.fill()
    })
    return
  }
  const P = R.proj(0, -0.27, 1.14)
  const kind = cfg.ears
  R.at(ctx, P, 0, () => {
    const col = kind === 'cat' || kind === 'bunny' ? '#ff8fa8' : cfg.noseColor
    const sz = kind === 'bear' ? 1.35 : kind === 'cat' ? 0.8 : kind === 'bunny' ? 0.78 : 1
    ctx.save(); ctx.scale(sz, sz)
    ink(ctx, (c) => {
      c.moveTo(-16, -9); c.quadraticCurveTo(0, -17, 16, -9); c.quadraticCurveTo(15, 5, 0, 12); c.quadraticCurveTo(-15, 5, -16, -9); c.closePath()
    }, { fill: col, line: pal.line, w: 5, swell: 0.3 })
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ellipse(ctx, -5, -6.5, 5.5, 2.8, -0.15); ctx.fill()
    ctx.restore()
  })
}

function drawMouthShape(ctx, R, kind, P) {
  const { pal } = R
  const line = pal.line
  const stroke = (w, f) => { ctx.strokeStyle = line; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); f(); ctx.stroke() }
  R.at(ctx, P, 0, () => {
    if (kind === 'smile') {
      if (R.animal) {
        if (R.cfg.ears === 'bunny') {
          ink(ctx, (c) => roundRect(c, -9, 12, 18, 20, 4), { fill: '#fffaf5', line, w: 4, swell: 0.2 })
          ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, 31); ctx.stroke()
        }
        stroke(5.5, () => { ctx.moveTo(0, 8); ctx.lineTo(0, 17); ctx.moveTo(0, 17); ctx.quadraticCurveTo(-8, 29, -22, 21); ctx.moveTo(0, 17); ctx.quadraticCurveTo(8, 29, 22, 21) })
      } else {
        stroke(5.5, () => { ctx.moveTo(-20, 0); ctx.quadraticCurveTo(0, 20, 20, 0) })
      }
    } else if (kind === 'tiny') {
      ink(ctx, (c) => ellipse(c, 0, 4, 9, 11), { fill: pal.mouthIn, line, w: 4.5, swell: 0.3 })
    } else if (kind === 'wavy') {
      stroke(5.5, () => { ctx.moveTo(-24, 4); ctx.bezierCurveTo(-16, -6, -8, -6, 0, 4); ctx.bezierCurveTo(8, 14, 16, 14, 24, 4) })
    } else if (kind === 'o') {
      ink(ctx, (c) => ellipse(c, 0, 8, 13, 18), { fill: pal.mouthIn, line, w: 5.5, swell: 0.3 })
      ctx.fillStyle = pal.tongue; ctx.beginPath(); ellipse(ctx, 0, 17, 7, 5); ctx.fill()
    } else if (kind === 'open' || kind === 'grin') {
      const big = kind === 'grin'
      const w = big ? 40 : 28, h = big ? 38 : 26
      const shape = (c) => { c.moveTo(-w, -4); c.quadraticCurveTo(0, big ? 2 : 4, w, -4); c.quadraticCurveTo(w * 0.8, h, 0, h + 2); c.quadraticCurveTo(-w * 0.8, h, -w, -4); c.closePath() }
      ink(ctx, shape, { fill: pal.mouthIn, line, w: 5.5, swell: 0.4 })
      ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip()
      if (big) { ctx.fillStyle = '#fffaf5'; ctx.beginPath(); ctx.rect(-w, -6, w * 2, 11); ctx.fill() }
      ctx.fillStyle = pal.tongue; ctx.beginPath(); ellipse(ctx, 0, h - 2, w * 0.55, h * 0.4); ctx.fill()
      ctx.restore()
      ctx.strokeStyle = line; ctx.lineWidth = 5.5; ctx.beginPath(); shape(ctx); ctx.stroke()
    }
  })
}

function drawMouth(ctx, R) {
  const kind = R.ex.mouth
  const open = kind !== 'smile'
  const P = R.animal ? R.proj(0, open ? -0.55 : -0.3, 1.12) : R.proj(0, -0.66, 1.08)
  drawMouthShape(ctx, R, kind, P)
}

function drawSymbol(ctx, R) {
  const sym = R.ex.symbol
  if (!sym) return
  const line = R.pal.line
  ctx.save()
  if (sym === 'heart') {
    ctx.translate(398, 82); ctx.rotate(0.2)
    ink(ctx, (c) => heartPath(c, 1.45), { fill: '#ff4f7b', line, w: 6 })
    ctx.fillStyle = '#ff9bb5'; ctx.beginPath(); ellipse(ctx, -17, -20, 8, 5, -0.7); ctx.fill()
    ctx.translate(42, 42); ink(ctx, (c) => heartPath(c, 0.6), { fill: '#ff86a5', line, w: 4.5 })
  } else if (sym === 'sparkle') {
    ctx.translate(396, 84)
    ink(ctx, (c) => sparklePath(c, 42, 0.16), { fill: '#ffe14d', line, w: 6 })
    ctx.translate(-46, 8); ink(ctx, (c) => sparklePath(c, 16, 0.2), { fill: '#fff3a0', line, w: 4 })
    ctx.translate(78, 68); ink(ctx, (c) => sparklePath(c, 18, 0.2), { fill: '#fff3a0', line, w: 4 })
  } else if (sym === 'zzz') {
    const z = (x, y, s) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.15); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      const zed = () => { ctx.beginPath(); ctx.moveTo(-s, -s * 0.9); ctx.lineTo(s, -s * 0.9); ctx.lineTo(-s, s * 0.9); ctx.lineTo(s, s * 0.9); ctx.stroke() }
      ctx.strokeStyle = line; ctx.lineWidth = s * 0.62 + 6; zed()
      ctx.strokeStyle = '#cdd6ff'; ctx.lineWidth = s * 0.62; zed()
      ctx.restore()
    }
    z(374, 138, 11); z(398, 110, 14); z(424, 78, 17)
  }
  ctx.restore()
}

// ---- head ---------------------------------------------------------------------------------
function drawHead(ctx, R) {
  const { pal, cfg } = R
  // shade first, then the base-coloured form pushed up-left leaves a shaded crescent
  ink(ctx, (c) => R.head(c), { fill: pal.skinShade, fillOnly: true })
  ctx.save(); ctx.beginPath(); R.head(ctx); ctx.clip()
  ctx.fillStyle = pal.skin; ctx.beginPath(); R.head(ctx, 0.97, -9, -11); ctx.fill()
  const H = R.proj(-0.6, 0.85, 1)
  if (H.z > 0.1) {
    ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(-0.5); ctx.fillStyle = pal.skinHi; ctx.globalAlpha = 0.7
    ctx.beginPath(); ellipse(ctx, 0, 0, 26 * H.sx, 8); ctx.fill(); ctx.restore()
  }
  if (R.animal) drawMuzzle(ctx, R, 'pads')
  drawBlush(ctx, R)
  drawFacialHair(ctx, R, 'under')
  ctx.restore()
  void cfg
}

/** Draw one full character cell in 512x512 design space. */
export function drawCharacter(ctx, cfgIn, pose = {}, bodyLayer = null) {
  const R = createRig(cfgIn, pose)
  const { cfg } = R
  drawHairBack(ctx, R); drawHeadwearBack(ctx, R)
  drawEarsBack(ctx, R)
  // The body takes no pose, so it is identical by construction; sheets additionally blit one cached
  // raster of it so antialiasing cannot differ between cells either.
  if (bodyLayer) ctx.drawImage(bodyLayer, 0, 0, CELL, CELL); else drawBody(ctx, R.pal, cfg)
  drawHead(ctx, R)
  ink(ctx, (c) => R.head(c), { line: cfg.outline, w: 8, swell: 0.7 })
  drawEarsFront(ctx, R)
  if (cfg.ears === 'cat' || cfg.ears === 'fox') drawMuzzle(ctx, R, 'whiskers')
  drawFacialHair(ctx, R, 'over')
  drawNose(ctx, R)
  drawFacialHair(ctx, R, 'gap')
  drawMouth(ctx, R)
  const g = eyeGeom(R)
  for (const [i, side] of [-1, 1].entries()) {
    const P = R.proj(side * EYE_T, g.phi, 1.0)
    const kind = R.ex.eyes[i]
    R.at(ctx, P, 0, () => drawEye(ctx, R, kind, side, R.ex.shine), Math.max(P.sx, 0.38))
  }
  drawBrows(ctx, R)
  drawGlasses(ctx, R, EYE_T, g)
  drawHairFront(ctx, R); drawHeadwearFront(ctx, R)
  drawSymbol(ctx, R)
}

// ---- sheets -------------------------------------------------------------------------------
/**
 * Render a 3x3 sheet. opts: { createCanvas(w,h), cell = 512, background: 'transparent' | '#00FF00' }.
 * Each cell is drawn inside its own save/clip so nothing can bleed across cells.
 */
export function renderSheet(cfg, kind, opts) {
  const cell = opts.cell || CELL
  const cv = opts.createCanvas(cell * 3, cell * 3)
  const ctx = cv.getContext('2d')
  if (opts.background && opts.background !== 'transparent') { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, cell * 3, cell * 3) }
  const poses = kind === 'directions'
    ? DIRECTIONS.map(([dx, dy]) => ({ dx, dy, expr: 'neutral' }))
    : REACTIONS.map((expr) => ({ dx: 0, dy: 0, expr }))
  const bodyLayer = opts.createCanvas(cell, cell)
  const bctx = bodyLayer.getContext('2d')
  bctx.scale(cell / CELL, cell / CELL)
  drawBody(bctx, palette(mergeConfig(cfg)), mergeConfig(cfg))
  poses.forEach((pose, i) => {
    const col = i % 3, row = Math.floor(i / 3)
    ctx.save()
    ctx.beginPath(); ctx.rect(col * cell, row * cell, cell, cell); ctx.clip()
    ctx.translate(col * cell, row * cell); ctx.scale(cell / CELL, cell / CELL)
    drawCharacter(ctx, cfg, pose, bodyLayer)
    ctx.restore()
  })
  return cv
}
