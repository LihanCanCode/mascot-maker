import type { ScaleTranslate } from '../types'

export const IDENTITY_TRANSFORM: ScaleTranslate = { scale: 1, tx: 0, ty: 0 }

/** Apply `first`, then `then`. */
export function composeTransforms(first: ScaleTranslate, then: ScaleTranslate): ScaleTranslate {
  return {
    scale: first.scale * then.scale,
    tx: then.scale * first.tx + then.tx,
    ty: then.scale * first.ty + then.ty,
  }
}

export function invertTransform(t: ScaleTranslate): ScaleTranslate {
  if (!Number.isFinite(t.scale) || t.scale === 0) {
    throw new RangeError(`cannot invert transform with scale ${t.scale}`)
  }
  return { scale: 1 / t.scale, tx: -t.tx / t.scale, ty: -t.ty / t.scale }
}

export function applyTransform(t: ScaleTranslate, x: number, y: number): { x: number; y: number } {
  return { x: x * t.scale + t.tx, y: y * t.scale + t.ty }
}
