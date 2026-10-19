// Floating reaction symbols (heart, sparkle, zzz), placed so they clear ears, antennae and volume hair.
import { ellipse, heartPath, ink, sparklePath } from '../draw'
import type { Ctx, StudioConfig, SymbolKind } from '../types'

export interface SymbolAnchor {
  readonly x: number
  readonly y: number
  readonly scale: number
}

const TALL_EARS: readonly string[] = ['fox', 'cat', 'bunny']

/**
 * Where the symbol cluster is centred. Tall ears and big hair occupy the upper right of the
 * head, so those characters get a smaller cluster to the right of the head instead.
 */
export function symbolAnchor(cfg: StudioConfig): SymbolAnchor {
  if (TALL_EARS.includes(cfg.ears)) return { x: 440, y: 150, scale: 0.8 }
  if (cfg.hairStyle === 'curly' && cfg.headwear === 'none') return { x: 440, y: 78, scale: 0.8 }
  if (cfg.headwear === 'hijab') return { x: 440, y: 92, scale: 0.85 }
  return { x: 398, y: 82, scale: 1 }
}

function drawHeart(ctx: Ctx, line: string): void {
  ctx.rotate(0.2)
  ink(ctx, (c) => heartPath(c, 1.45), { fill: '#ff4f7b', line, w: 6 })
  ctx.fillStyle = '#ff9bb5'; ctx.beginPath(); ellipse(ctx, -17, -20, 8, 5, -0.7); ctx.fill()
  ctx.translate(42, 42); ink(ctx, (c) => heartPath(c, 0.6), { fill: '#ff86a5', line, w: 4.5 })
}

function drawSparkle(ctx: Ctx, line: string): void {
  ink(ctx, (c) => sparklePath(c, 42, 0.16), { fill: '#ffe14d', line, w: 6 })
  ctx.translate(-46, 8); ink(ctx, (c) => sparklePath(c, 16, 0.2), { fill: '#fff3a0', line, w: 4 })
  ctx.translate(78, 68); ink(ctx, (c) => sparklePath(c, 18, 0.2), { fill: '#fff3a0', line, w: 4 })
}

function drawZzz(ctx: Ctx, line: string): void {
  const z = (x: number, y: number, s: number): void => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.15); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    const zed = (): void => {
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.9); ctx.lineTo(s, -s * 0.9); ctx.lineTo(-s, s * 0.9); ctx.lineTo(s, s * 0.9); ctx.stroke()
    }
    ctx.strokeStyle = line; ctx.lineWidth = s * 0.62 + 6; zed()
    ctx.strokeStyle = '#cdd6ff'; ctx.lineWidth = s * 0.62; zed()
    ctx.restore()
  }
  z(-24, 56, 11); z(0, 28, 14); z(26, -4, 17)
}

export function drawSymbol(ctx: Ctx, cfg: StudioConfig, symbol: SymbolKind | undefined): void {
  if (!symbol) return
  const a = symbolAnchor(cfg)
  ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.scale, a.scale)
  if (symbol === 'heart') drawHeart(ctx, cfg.outline)
  else if (symbol === 'sparkle') drawSparkle(ctx, cfg.outline)
  else drawZzz(ctx, cfg.outline)
  ctx.restore()
}
