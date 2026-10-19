import type { RawImage } from '../core/types'
import { createCanvas, type AnyCanvas } from './canvas'

export interface EncodedImage {
  readonly blob: Blob
  readonly mimeType: 'image/webp' | 'image/png'
  /** True when the browser could not write WEBP and we saved PNG instead. */
  readonly usedFallback: boolean
}

const DEFAULT_QUALITY = 0.92

function canvasToBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Encode to WEBP, or PNG when the browser silently ignores the WEBP request (Safari). */
export async function encodeImage(img: RawImage, quality: number = DEFAULT_QUALITY): Promise<EncodedImage> {
  const { canvas, ctx } = createCanvas(img.width, img.height)
  const pixels = ctx.createImageData(img.width, img.height)
  pixels.data.set(img.data)
  ctx.putImageData(pixels, 0, 0)

  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  if (webp !== null && webp.type === 'image/webp') {
    return { blob: webp, mimeType: 'image/webp', usedFallback: false }
  }
  const png = await canvasToBlob(canvas, 'image/png')
  if (png === null) throw new Error('Your browser could not save the image. Try a different browser.')
  return { blob: png, mimeType: 'image/png', usedFallback: true }
}
