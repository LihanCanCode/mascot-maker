export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

interface CanvasPair {
  readonly canvas: AnyCanvas
  readonly ctx: AnyContext
}

const CONTEXT_OPTIONS = { willReadFrequently: true, colorSpace: 'srgb' } as const
const NO_CONTEXT = 'Your browser could not create a drawing surface for the image.'

/** OffscreenCanvas when available (workers, modern browsers), else a detached <canvas>. */
export function createCanvas(width: number, height: number): CanvasPair {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', CONTEXT_OPTIONS)
    if (ctx === null) throw new Error(NO_CONTEXT)
    return { canvas, ctx }
  }
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', CONTEXT_OPTIONS) as CanvasRenderingContext2D | null
  if (ctx === null) throw new Error(NO_CONTEXT)
  return { canvas, ctx }
}
