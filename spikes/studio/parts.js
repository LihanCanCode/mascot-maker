// Character parts. Each part is a pure function of (ctx, R, ...) where R is the per-pose rig
// from rig.js. To add a part: write a draw function that places itself with R.proj / R.pts / R.at
// and register it in the relevant switch below (hair style, headwear, ears, ...).
import { ink, smooth, poly, ellipse, roundRect, starPath, mix, rng } from './draw.js'

const TAU = Math.PI * 2

/** Fill with a shade colour, then the base colour shifted up-left, clipped; then draw the outline. */
function shadedInk(ctx, build, { base, shade, line, w = 6, off = [-6, -8], hi } = {}) {
  ink(ctx, build, { fill: shade, fillOnly: true })
  ctx.save(); ctx.beginPath(); build(ctx); ctx.clip()
  ctx.translate(off[0], off[1]); ctx.fillStyle = base; ctx.beginPath(); build(ctx); ctx.fill()
  ctx.restore()
  if (hi) hi(ctx)
  ink(ctx, build, { line, w })
}

// ---- body: takes no pose, so it is pixel-identical in all 18 cells ---------------------------
export function drawBody(ctx, pal, cfg) {
  const line = pal.line
  const torso = (c) => {
    c.moveTo(228, 352); c.bezierCurveTo(206, 360, 176, 362, 168, 390)
    c.lineTo(164, 428); c.quadraticCurveTo(164, 441, 177, 441); c.lineTo(335, 441)
    c.quadraticCurveTo(348, 441, 348, 428); c.lineTo(344, 390)
    c.bezierCurveTo(336, 362, 306, 360, 284, 352); c.closePath()
  }
  // neck
  ink(ctx, (c) => roundRect(c, 231, 312, 50, 64, 12), { fill: pal.skinShade, line, w: 6, swell: 0.4 })
  shadedInk(ctx, torso, {
    base: pal.shirt, shade: pal.shirtShade, line, w: 7, off: [-9, -4],
    hi: (c) => {
      c.save(); c.beginPath(); torso(c); c.clip()
      c.strokeStyle = pal.shirtHi; c.lineWidth = 8; c.lineCap = 'round'
      c.beginPath(); c.moveTo(184, 400); c.quadraticCurveTo(186, 380, 206, 372); c.stroke()
      if (cfg.shirtDetail === 'stripe') {
        c.fillStyle = pal.accent; c.fillRect(150, 398, 220, 13); c.fillRect(150, 420, 220, 13)
        c.fillStyle = pal.accentShade; c.fillRect(150, 409, 220, 3); c.fillRect(150, 431, 220, 3)
      }
      c.restore()
    },
  })
  if (cfg.shirtDetail === 'badge') {
    ctx.save(); ctx.translate(310, 404)
    ink(ctx, (c) => ellipse(c, 0, 0, 17, 17), { fill: pal.accent, line, w: 4.5, swell: 0.3 })
    ink(ctx, (c) => starPath(c, 10, 0.48), { fill: '#fff', line, w: 2.5, swell: 0 })
    ctx.restore()
  }
  const hole = (path) => ink(ctx, path, { fill: pal.skinShade, line, w: 5, swell: 0.3 })
  switch (cfg.neckline) {
    case 'v':
      hole((c) => { c.moveTo(225, 351); c.lineTo(256, 400); c.lineTo(287, 351); c.closePath() }); break
    case 'boat':
      hole((c) => { c.moveTo(203, 356); c.quadraticCurveTo(256, 388, 309, 356); c.lineTo(309, 350); c.lineTo(203, 350); c.closePath() }); break
    case 'turtle':
      ink(ctx, (c) => roundRect(c, 220, 332, 72, 44, 15), { fill: pal.shirt, line, w: 6, swell: 0.4 })
      ctx.strokeStyle = pal.shirtShade; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.beginPath(); for (const x of [238, 256, 274]) { ctx.moveTo(x, 340); ctx.lineTo(x, 370) } ctx.stroke(); break
    case 'collar':
      hole((c) => { c.moveTo(225, 351); c.lineTo(256, 394); c.lineTo(287, 351); c.closePath() })
      ink(ctx, (c) => { c.moveTo(222, 350); c.lineTo(256, 400); c.lineTo(232, 376); c.closePath() }, { fill: '#fffdf8', line, w: 5, swell: 0.3 })
      ink(ctx, (c) => { c.moveTo(290, 350); c.lineTo(256, 400); c.lineTo(280, 376); c.closePath() }, { fill: '#eee8f2', line, w: 5, swell: 0.3 })
      break
    case 'scarf':
      hole((c) => { c.moveTo(224, 352); c.quadraticCurveTo(256, 394, 288, 352); c.closePath() })
      ink(ctx, (c) => { c.moveTo(270, 372); c.lineTo(300, 366); c.lineTo(312, 428); c.lineTo(282, 436); c.closePath() }, { fill: pal.accentShade, line, w: 6 })
      ink(ctx, (c) => { c.moveTo(208, 356); c.quadraticCurveTo(256, 400, 304, 356); c.lineTo(310, 378); c.quadraticCurveTo(256, 420, 202, 378); c.closePath() }, { fill: pal.accent, line, w: 6 })
      break
    default: // crew
      hole((c) => { c.moveTo(224, 351); c.quadraticCurveTo(256, 392, 288, 351); c.closePath() })
  }
}

// ---- geometry helpers --------------------------------------------------------------------
/** Points along the head silhouette from angle a0 to a1 (canvas angles; PI = left, 1.5PI = top). */
function arcPts(R, a0, a1, n, s, amps) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    out.push(R.sil(t, s + (amps ? amps[i % amps.length] : 0), 0, -3))
  }
  return out
}
const L_TEMPLE = Math.PI - 0.2, R_TEMPLE = TAU + 0.2

// ---- ears --------------------------------------------------------------------------------
const EAR_POS = { cat: [0.8, 0.86], fox: [0.82, 0.84], bear: [1.0, 0.74], bunny: [0.5, 0.98] }

function drawAnimalEar(ctx, R, side) {
  const { cfg, pal } = R
  const [th, ph] = EAR_POS[cfg.ears]
  const P = R.proj(side * th, ph, 1.0, true)
  const rot = side * (cfg.ears === 'bunny' ? 0.2 : 0.3) - R.dy * side * 0.14
  const line = pal.line
  R.at(ctx, P, rot, () => {
    if (cfg.ears === 'cat') {
      const ear = (c) => { c.moveTo(-44, 26); c.quadraticCurveTo(-44, -34, -5, -78); c.quadraticCurveTo(0, -82, 5, -78); c.quadraticCurveTo(44, -34, 44, 26); c.closePath() }
      shadedInk(ctx, ear, { base: pal.skin, shade: pal.skinShade, line, w: 7, off: [-5, -3] })
      ink(ctx, (c) => { c.moveTo(-26, 14); c.quadraticCurveTo(-26, -24, -2, -54); c.quadraticCurveTo(2, -56, 4, -52); c.quadraticCurveTo(26, -24, 26, 14); c.closePath() }, { fill: cfg.earInner, fillOnly: true })
    } else if (cfg.ears === 'fox') {
      const ear = (c) => { c.moveTo(-42, 26); c.quadraticCurveTo(-46, -40, 2, -92); c.quadraticCurveTo(7, -96, 10, -90); c.quadraticCurveTo(48, -40, 42, 26); c.closePath() }
      shadedInk(ctx, ear, { base: pal.skin, shade: pal.skinShade, line, w: 7, off: [-5, -3] })
      ctx.save(); ctx.beginPath(); ear(ctx); ctx.clip()
      ctx.fillStyle = cfg.earTip; ctx.fillRect(-60, -120, 120, 70)
      ctx.restore()
      ink(ctx, (c) => { c.moveTo(-22, 16); c.quadraticCurveTo(-24, -16, 0, -40); c.quadraticCurveTo(24, -16, 22, 16); c.closePath() }, { fill: cfg.muzzle, fillOnly: true })
      ink(ctx, ear, { line, w: 7 })
    } else if (cfg.ears === 'bear') {
      shadedInk(ctx, (c) => ellipse(c, 0, -6, 38, 36), { base: pal.skin, shade: pal.skinShade, line, w: 7, off: [-5, -4] })
      ink(ctx, (c) => ellipse(c, 1, -1, 21, 20), { fill: cfg.earInner, line: pal.skinShade, w: 4, swell: 0 })
    } else if (cfg.ears === 'bunny') {
      const ear = (c) => ellipse(c, 0, -40, 25, 58)
      shadedInk(ctx, ear, { base: pal.skin, shade: pal.skinShade, line, w: 7, off: [-5, -4] })
      ink(ctx, (c) => ellipse(c, 1, -38, 12, 40), { fill: cfg.earInner, fillOnly: true })
    }
  }, Math.max(P.sx, 0.5))
}

function humanEarAt(ctx, R, side) {
  const { cfg, pal } = R
  const P = R.proj(side * 1.5, -0.06, 1.1)
  const bolt = cfg.ears === 'bolt'
  const sx = Math.max(P.sx, 0.72)
  R.at(ctx, P, 0, () => {
    if (bolt) {
      ink(ctx, (c) => roundRect(c, -15, -30, 30, 60, 9), { fill: pal.accent, line: pal.line, w: 6, swell: 0.4 })
      ink(ctx, (c) => ellipse(c, 0, 0, 7, 7), { fill: pal.accentShade, line: pal.line, w: 3.5, swell: 0 })
    } else {
      const ear = (c) => ellipse(c, 0, 0, 21, 28)
      shadedInk(ctx, ear, { base: pal.skin, shade: pal.skinShade, line: pal.line, w: 6.5, off: [-3, -3] })
      ctx.strokeStyle = pal.skinDeep; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(1, 2, 9, 0.6, 3.4); ctx.stroke()
    }
  }, sx)
}

const sides = [-1, 1]
const frontOf = (R, side) => R.proj(side * 1.5, -0.06, 1.1).z > 0.3

export function drawEarsBack(ctx, R) {
  if (R.animal) { sides.forEach((s) => drawAnimalEar(ctx, R, s)); return }
  sides.forEach((s) => { if (!frontOf(R, s)) humanEarAt(ctx, R, s) })
}
export function drawEarsFront(ctx, R) {
  if (R.animal) return
  sides.forEach((s) => { if (frontOf(R, s)) humanEarAt(ctx, R, s) })
}

// ---- muzzle (animals) ----------------------------------------------------------------------
export function drawMuzzle(ctx, R, mode) {
  const { cfg, pal } = R
  if (mode === 'whiskers') {
    if (cfg.ears !== 'cat') return
    ctx.strokeStyle = pal.line; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
    for (const s of sides) {
      const P = R.proj(s * 0.62, -0.36, 1.04)
      if (P.z < 0.12) continue
      R.at(ctx, P, 0, () => {
        ctx.beginPath()
        for (const [dy, a] of [[-8, -0.18], [4, 0.02], [16, 0.2]]) { ctx.moveTo(s * 6, dy); ctx.lineTo(s * 52, dy + a * 52) }
        ctx.stroke()
      })
    }
    return
  }
  const patch = (th, ph, rx, ry, d = 1.08) => {
    const P = R.proj(th, ph, d)
    if (P.z < -0.2) return
    R.at(ctx, P, 0, () => {
      ctx.fillStyle = pal.muzzleShade; ctx.beginPath(); ellipse(ctx, 0, 4, rx, ry); ctx.fill()
      ctx.fillStyle = pal.muzzle; ctx.beginPath(); ellipse(ctx, 0, 0, rx, ry); ctx.fill()
    }, Math.max(P.sx, 0.4))
  }
  switch (cfg.ears) {
    case 'fox': patch(-0.62, -0.5, 74, 46); patch(0.62, -0.5, 74, 46); patch(0, -0.82, 70, 44); patch(0, -0.42, 54, 40); break
    case 'cat': patch(-0.17, -0.46, 36, 27); patch(0.17, -0.46, 36, 27); break
    case 'bear': patch(0, -0.5, 62, 48); break
    case 'bunny': patch(-0.16, -0.48, 34, 29); patch(0.16, -0.48, 34, 29); break
    default:
  }
}

// ---- hair ----------------------------------------------------------------------------------
const FRINGE = {
  messy: [[1.55, -0.1], [1.42, 0.3], [1.15, 0.52], [0.9, 0.38], [0.62, 0.72], [0.38, 0.5], [0.1, 0.8], [-0.18, 0.52], [-0.45, 0.76], [-0.72, 0.46], [-0.98, 0.62], [-1.2, 0.36], [-1.42, 0.3], [-1.55, -0.1]],
  bob: [[1.5, -0.8], [1.45, -0.2], [1.2, 0.34], [0.82, 0.6], [0.4, 0.7], [0.05, 0.74], [-0.4, 0.68], [-0.82, 0.58], [-1.2, 0.34], [-1.45, -0.2], [-1.5, -0.8]],
  bun: [[1.52, -0.25], [1.42, 0.2], [1.1, 0.5], [0.6, 0.68], [0.1, 0.78], [-0.3, 0.7], [-0.8, 0.58], [-1.2, 0.36], [-1.42, 0.2], [-1.52, -0.25]],
  buzz: [[1.45, 0.0], [1.3, 0.4], [0.9, 0.68], [0.4, 0.8], [0, 0.82], [-0.4, 0.8], [-0.9, 0.68], [-1.3, 0.4], [-1.45, 0.0]],
}

function strokeHighlights(ctx, R, col, list) {
  ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const l of list) {
    const p = R.pts(l, 1.05, true)
    if (p.every((q) => q.z < 0.1)) continue
    ctx.beginPath(); smooth(ctx, p, false); ctx.stroke()
  }
}

function hairCap(R, { s, amps, n = 14, fringe, sharp, bobSides }) {
  return (c) => {
    const outer = arcPts(R, L_TEMPLE - (bobSides ? 0.05 : 0), R_TEMPLE + (bobSides ? 0.05 : 0), n, s, amps)
    let lower = R.pts(fringe, 1.03, true)
    if (bobSides) {
      // sides continue down past the jaw: add rim anchors so the panel hugs the silhouette
      const lo = R.sil(Math.PI * 0.72, 1.12, 0, 4), ro = R.sil(Math.PI * 0.28, 1.12, 0, 4)
      const all = [...outer, ro, ...lower, lo]
      if (sharp) poly(c, all); else smooth(c, all)
      return
    }
    lower = lower.slice()
    const all = [...outer, ...lower]
    if (sharp) poly(c, all); else smooth(c, all)
  }
}

export function drawHairBack(ctx, R) {
  const { cfg, pal } = R
  if (cfg.hairStyle === 'bun') {
    const P = R.proj(0, 1.36, 1.22)
    R.at(ctx, P, 0, () => {
      shadedInk(ctx, (c) => ellipse(c, 0, 0, 52, 48), { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-7, -7] })
      ctx.strokeStyle = pal.hairHi; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(0, 0, 30, 3.5, 4.8); ctx.stroke()
      ctx.strokeStyle = pal.hairShade; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(2, 4, 20, 0.4, 2.3); ctx.stroke()
    }, Math.max(P.sx, 0.7))
  }
  if (cfg.hairStyle === 'ponytail') {
    const A = R.proj(1.15, 0.95, 1.08, true)
    const sgn = 1
    R.at(ctx, A, 0, () => {
      const tail = (c) => { c.moveTo(-6, -10); c.bezierCurveTo(36 * sgn, -6, 74, 40, 52, 112); c.bezierCurveTo(48, 140, 22, 130, 24, 100); c.bezierCurveTo(30, 60, 6, 30, -14, 18); c.closePath() }
      shadedInk(ctx, tail, { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-6, -4] })
    }, 1)
  }
}

export function drawHairFront(ctx, R) {
  const { cfg, pal } = R
  const st = cfg.hairStyle
  if (st === 'none' || !FRINGE[st === 'ponytail' ? 'bun' : st]) return
  if (st === 'buzz') {
    const build = hairCap(R, { s: 1.015, n: 16, fringe: FRINGE.buzz })
    ink(ctx, build, { fill: mix(cfg.skin, cfg.hairColor, 0.72), line: pal.hairShade, w: 3, swell: 0 })
    return
  }
  const messy = st === 'messy'
  const key = st === 'ponytail' ? 'bun' : st
  const build = hairCap(R, {
    s: messy ? 1.07 : st === 'bob' ? 1.1 : 1.06,
    amps: messy ? [0, 0.1, 0.02, 0.13, 0.0, 0.08, 0.03, 0.12] : null,
    n: messy ? 16 : 14, fringe: FRINGE[key], sharp: messy, bobSides: st === 'bob',
  })
  shadedInk(ctx, build, { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-7, -9] })
  strokeHighlights(ctx, R, pal.hairHi, [[[-0.9, 1.0], [-0.5, 1.12], [-0.1, 1.15]], [[0.3, 1.15], [0.7, 1.05], [1.0, 0.9]]])
  if (st === 'bun' || st === 'ponytail') {
    ctx.strokeStyle = pal.hairShade; ctx.lineWidth = 4
    const p = R.pts([[-0.05, 0.8], [-0.04, 1.1], [0, 1.35]], 1.05, true)
    ctx.beginPath(); smooth(ctx, p, false); ctx.stroke()
  }
  if (st === 'bun') {
    const P = R.proj(0, 1.3, 1.1)
    R.at(ctx, P, 0, () => ink(ctx, (c) => ellipse(c, 0, 0, 40, 11), { fill: pal.accent, line: pal.line, w: 5, swell: 0.4 }), Math.max(P.sx, 0.6))
  }
  if (st === 'ponytail') {
    const A = R.proj(1.15, 0.95, 1.08, true)
    R.at(ctx, A, 0, () => ink(ctx, (c) => ellipse(c, 2, 2, 17, 12, 0.5), { fill: pal.accent, line: pal.line, w: 5, swell: 0.4 }), 1)
  }
}

// ---- headwear ------------------------------------------------------------------------------
const DOME_ANGLES = [Math.PI - 0.12, TAU + 0.12]

export function drawHeadwearBack(ctx, R) {
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

export function drawHeadwearFront(ctx, R) {
  const { cfg, pal } = R
  const hw = cfg.headwear
  if (hw !== 'cap' && hw !== 'beanie') return
  const line = pal.line
  const bandPhi = hw === 'cap' ? 0.7 : 0.92
  const edge = []
  for (let t = -1.55; t <= 1.56; t += 0.2) edge.push([t, bandPhi + (hw === 'cap' ? 0.04 * Math.cos(t * 2) : 0)])
  const lowerEdge = R.pts(edge, 1.04, true)
  const dome = (c) => {
    const outer = arcPts(R, L_TEMPLE - 0.08, R_TEMPLE + 0.08, 16, hw === 'cap' ? 1.1 : 1.13)
    smooth(c, [...outer, ...lowerEdge.slice().reverse()])
  }
  shadedInk(ctx, dome, { base: pal.hat, shade: pal.hatShade, line, w: 7, off: [-8, -9] })
  ctx.strokeStyle = pal.hatShade; ctx.lineWidth = 4; ctx.lineCap = 'round'
  for (const t of [-0.75, 0, 0.75]) {
    const p = R.pts([[t, bandPhi], [t * 0.6, 1.05], [0, 1.52]], 1.07, true)
    ctx.beginPath(); smooth(ctx, p, false); ctx.stroke()
  }
  strokeHighlights(ctx, R, pal.hatHi, [[[-0.9, 1.1], [-0.55, 1.2], [-0.2, 1.26]]])
  if (hw === 'beanie') {
    const lo = R.pts(edge.map(([t]) => [t, 0.66]), 1.06, true)
    const hi = R.pts(edge.map(([t]) => [t, bandPhi]), 1.06, true)
    ink(ctx, (c) => smooth(c, [...hi, ...lo.slice().reverse()]), { fill: pal.accent, line, w: 7 })
    ctx.strokeStyle = pal.accentShade; ctx.lineWidth = 4; ctx.beginPath()
    for (let t = -1.4; t <= 1.4; t += 0.28) {
      const a = R.proj(t, 0.9, 1.06, true), b = R.proj(t, 0.68, 1.06, true)
      if (a.z > 0.08) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) }
    }
    ctx.stroke()
    const P = R.proj(0, 1.52, 1.18)
    R.at(ctx, P, 0, () => {
      ink(ctx, (c) => ellipse(c, 0, 0, 27, 25), { fill: pal.accent, line, w: 6.5, swell: 0.4 })
      ctx.fillStyle = pal.accentShade; ctx.beginPath(); ellipse(ctx, 6, 8, 12, 8); ctx.fill()
    }, Math.max(P.sx, 0.8))
  } else {
    const inner = R.pts(Array.from({ length: 9 }, (_, i) => [-0.95 + i * 0.2375, 0.7]), 1.03, false)
    const outer = R.pts(Array.from({ length: 9 }, (_, i) => [0.95 - i * 0.2375, 0.42]), 1.3, false)
    shadedInk(ctx, (c) => smooth(c, [...inner, ...outer]), { base: pal.hat, shade: pal.hatShade, line, w: 7, off: [-3, -4] })
    const P = R.proj(0, 1.52, 1.1)
    R.at(ctx, P, 0, () => ink(ctx, (c) => ellipse(c, 0, 0, 12, 7), { fill: pal.hatShade, line, w: 4.5, swell: 0.3 }), Math.max(P.sx, 0.6))
  }
}

// ---- facial hair ---------------------------------------------------------------------------
const BEARD = [
  [-1.5, -0.12, 1.03], [-1.3, -0.45], [-1.0, -0.68], [-0.6, -0.62], [-0.3, -0.5], [0, -0.52], [0.3, -0.5], [0.6, -0.62], [1.0, -0.68], [1.3, -0.45], [1.5, -0.12, 1.03],
  [1.62, -0.7, 1.06], [1.4, -1.2, 1.07], [0.7, -1.5, 1.07], [0, -1.58, 1.07], [-0.7, -1.5, 1.07], [-1.4, -1.2, 1.07], [-1.62, -0.7, 1.06],
]
const MOUSTACHE = [
  [0, -0.47], [0.3, -0.42], [0.62, -0.48], [0.78, -0.6], [0.52, -0.57], [0.26, -0.55], [0, -0.55],
  [-0.26, -0.55], [-0.52, -0.57], [-0.78, -0.6], [-0.62, -0.48], [-0.3, -0.42],
]

export function drawFacialHair(ctx, R, phase) {
  const { cfg, pal } = R
  const fh = cfg.facialHair
  if (fh === 'none' || R.animal) return
  const stubbleCol = mix(cfg.skin, cfg.hairColor, 0.42)
  if (phase === 'under' && fh === 'stubble') {
    const top = R.pts([[-1.6, 0.0], [-1.3, -0.3], [-0.9, -0.5], [-0.45, -0.5], [0, -0.46], [0.45, -0.5], [0.9, -0.5], [1.3, -0.3], [1.6, 0.0]], 1.0, true)
    const bot = R.pts([[1.7, -1.5], [0, -1.7], [-1.7, -1.5]], 1.2, true)
    ctx.fillStyle = stubbleCol; ctx.beginPath(); smooth(ctx, [...top, ...bot]); ctx.fill()
    const rnd = rng(7)
    ctx.fillStyle = pal.hairShade
    for (let i = 0; i < 120; i++) {
      const P = R.proj((rnd() * 2 - 1) * 1.45, -0.5 - rnd() * 0.95, 1.0)
      if (P.z < 0.12) continue
      ctx.beginPath(); ctx.arc(P.x, P.y, 1.5 + rnd(), 0, TAU); ctx.fill()
    }
  }
  if (phase === 'over' && fh === 'beard') {
    const p = R.pts(BEARD, 1.03, true)
    shadedInk(ctx, (c) => smooth(c, p), {
      base: pal.hair, shade: pal.hairShade, line: pal.line, w: 7, off: [-6, -8],
      hi: (c) => { c.save(); c.beginPath(); smooth(c, p); c.clip(); strokeHighlights(c, R, pal.hairHi, [[[-1.2, -0.7], [-0.9, -1.1], [-0.5, -1.35]], [[0.5, -1.35], [0.9, -1.1], [1.2, -0.7]]]); c.restore() },
    })
  }
  if (phase === 'gap') {
    if (fh === 'beard') {
      const P = R.proj(0, -0.66, 1.1)
      R.at(ctx, P, 0, () => {
        ctx.fillStyle = pal.skinShade; ctx.beginPath(); ellipse(ctx, 0, 6, 34, 21); ctx.fill()
        ctx.fillStyle = pal.skin; ctx.beginPath(); ellipse(ctx, 0, 3, 32, 18); ctx.fill()
      }, Math.max(P.sx, 0.5))
    }
    if (fh === 'beard' || fh === 'moustache') {
      const p = R.pts(MOUSTACHE, 1.1, true)
      shadedInk(ctx, (c) => smooth(c, p), { base: pal.hair, shade: pal.hairShade, line: pal.line, w: 6, off: [-3, -4] })
    }
  }
}

// ---- glasses -------------------------------------------------------------------------------
export function drawGlasses(ctx, R, eyeT, g) {
  const { cfg, pal } = R
  if (cfg.glasses === 'none') return
  const frame = cfg.glassesColor
  const round = cfg.glasses === 'round'
  ctx.save(); ctx.beginPath(); R.head(ctx, 1.08); ctx.clip()
  const lenses = sides.map((s) => ({ s, P: R.proj(s * eyeT, g.phi, 1.1) }))
  // temples + bridge first (under the lenses)
  ctx.strokeStyle = frame; ctx.lineWidth = 6; ctx.lineCap = 'round'
  for (const { s, P } of lenses) {
    const e = R.proj(s * 1.5, 0.05, 1.04, true)
    const sx = Math.max(P.sx, 0.4)
    ctx.beginPath(); ctx.moveTo(P.x + s * 46 * sx, P.y - 4); ctx.lineTo(e.x, e.y); ctx.stroke()
  }
  const [a, b] = lenses
  ctx.beginPath(); ctx.moveTo(a.P.x + 44 * Math.max(a.P.sx, 0.4), a.P.y - 8); ctx.quadraticCurveTo((a.P.x + b.P.x) / 2, a.P.y - 18, b.P.x - 44 * Math.max(b.P.sx, 0.4), b.P.y - 8); ctx.stroke()
  for (const { P } of lenses) {
    R.at(ctx, P, 0, () => {
      const shape = (c) => (round ? ellipse(c, 0, 0, 45, 45) : roundRect(c, -46, -40, 92, 80, 16))
      ink(ctx, shape, { fill: 'rgba(205,232,255,.28)', line: frame, w: 6.5, swell: 0.5 })
      ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineCap = 'round'
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-10, -30); ctx.stroke()
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, 14); ctx.lineTo(-10, 4); ctx.stroke()
      ctx.restore()
    }, Math.max(P.sx, 0.4))
  }
  ctx.restore()
  void pal
}
