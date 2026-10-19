// Small drawing + colour helpers shared by the rig and the parts. Pure, DOM-free.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export { clamp }

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t) => {
    t = (t + 1) % 1
    return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}
/** Shift a colour in HSL. l/s are additive (0..1), h in degrees. */
export function tone(hex, { l = 0, s = 0, h = 0 } = {}) {
  const [hh, ss, ll] = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb([hh + h, clamp(ss + s, 0, 1), clamp(ll + l, 0.02, 0.97)]))
}
/** Shade: darker, a little more saturated, hue nudged toward violet (reads richer than plain black mixing). */
export const shadeOf = (hex, k = 1) => tone(hex, { l: -0.15 * k, s: 0.05 * k, h: -7 * k })
export const hiOf = (hex, k = 1) => tone(hex, { l: 0.12 * k, s: -0.03 * k, h: 4 * k })
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}

/** Closed (or open) smooth curve through points using quadratic midpoints. */
export function smooth(ctx, pts, closed = true) {
  const n = pts.length
  if (n < 3) { pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); return }
  if (closed) {
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2)
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n]
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2)
    }
    ctx.closePath()
  } else {
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2)
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y)
  }
}
export function poly(ctx, pts, closed = true) {
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  if (closed) ctx.closePath()
}

/**
 * Fill + inked outline. `build(ctx)` must only issue path commands.
 * The outline is stroked twice (second pass nudged down-right) so line weight swells on the
 * shadow side, a cheap hand-inked weight variation.
 */
export function ink(ctx, build, { fill, line, w = 6, fillOnly = false, swell = 0.5 } = {}) {
  if (fill) { ctx.beginPath(); build(ctx); ctx.fillStyle = fill; ctx.fill() }
  if (fillOnly || !line) return
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = line
  if (swell > 0) {
    ctx.save(); ctx.translate(w * 0.2 * swell * 2, w * 0.38 * swell * 2)
    ctx.lineWidth = w; ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore()
  }
  ctx.lineWidth = w; ctx.beginPath(); build(ctx); ctx.stroke()
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2)
}
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
export function heartPath(ctx, s = 1) {
  ctx.moveTo(0, 14 * s)
  ctx.bezierCurveTo(-30 * s, -6 * s, -22 * s, -30 * s, -9 * s, -28 * s)
  ctx.bezierCurveTo(-3 * s, -27 * s, 0, -21 * s, 0, -17 * s)
  ctx.bezierCurveTo(0, -21 * s, 3 * s, -27 * s, 9 * s, -28 * s)
  ctx.bezierCurveTo(22 * s, -30 * s, 30 * s, -6 * s, 0, 14 * s)
  ctx.closePath()
}
/** Four-point sparkle (concave diamond). */
export function sparklePath(ctx, r, pinch = 0.2) {
  ctx.moveTo(0, -r)
  ctx.quadraticCurveTo(r * pinch, -r * pinch, r, 0)
  ctx.quadraticCurveTo(r * pinch, r * pinch, 0, r)
  ctx.quadraticCurveTo(-r * pinch, r * pinch, -r, 0)
  ctx.quadraticCurveTo(-r * pinch, -r * pinch, 0, -r)
  ctx.closePath()
}
export function starPath(ctx, r, inner = 0.5, pts = 5) {
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts, rr = i % 2 ? r * inner : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
}
/** Deterministic PRNG for stipple (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
