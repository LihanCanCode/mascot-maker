// Thin browser adapter: the only studio file that touches DOM globals.
import type { RawImage } from '../core/types'
import type { CanvasFactory, CanvasLike } from './types'

type BlobType = 'image/webp' | 'image/png'

/** OffscreenCanvas when available (workers, modern browsers), else a detached <canvas>. */
export function canvasFactory(): CanvasFactory {
  if (typeof OffscreenCanvas !== 'undefined') {
    return (w, h) => new OffscreenCanvas(w, h) as unknown as CanvasLike
  }
  return (w, h) => {
    const el = document.createElement('canvas')
    el.width = w
    el.height = h
    return el as unknown as CanvasLike
  }
}

function toBlobFrom(canvas: OffscreenCanvas | HTMLCanvasElement, type: BlobType): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`canvas.toBlob produced no ${type} data`))), type)
  })
}

/** Encode a RawImage as a Blob (png always works; webp falls back to png where unsupported). */
export async function rawImageToBlob(img: RawImage, type: BlobType = 'image/webp'): Promise<Blob> {
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(img.width, img.height)
    : Object.assign(document.createElement('canvas'), { width: img.width, height: img.height })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  const blob = await toBlobFrom(canvas, type)
  if (blob.type === type || type === 'image/png') return blob
  return toBlobFrom(canvas, 'image/png')
}
