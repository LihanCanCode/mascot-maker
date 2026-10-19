import { MAX_PROCESS_SIDE, type RawImage, type SheetMeta } from '../core/types'
import { createCanvas } from './canvas'
import { inspectImageFile } from './fileCheck'

/** Thrown with a message that is safe to show to people as-is. */
export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageDecodeError'
  }
}

const DECODE_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'default',
}

function targetSize(width: number, height: number, maxSide: number): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

async function openBitmap(file: Blob, fileName: string, extra: ImageBitmapOptions): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { ...DECODE_OPTIONS, ...extra })
  } catch {
    throw new ImageDecodeError(
      `We could not open "${fileName}". The file may be damaged. Download the image again and retry.`,
    )
  }
}

function readPixels(bitmap: ImageBitmap): RawImage {
  const { ctx } = createCanvas(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, 0, 0)
  const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return { width: pixels.width, height: pixels.height, data: pixels.data }
}

/**
 * Decode a PNG/JPEG/WEBP into straight-alpha RGBA, EXIF-rotated and shrunk to `maxSide`.
 * Dimensions are read from the header first, so oversized files are refused before any decode,
 * and the shrink happens during the one and only decode (a full-size bitmap is never held).
 */
export async function decodeImageFile(
  file: Blob,
  fileName: string,
  maxSide: number = MAX_PROCESS_SIDE,
): Promise<{ image: RawImage; meta: SheetMeta }> {
  const info = await inspectImageFile(file)
  if (!info.ok) throw new ImageDecodeError(`"${fileName}": ${info.message}`)

  const { w, h } = targetSize(info.width, info.height, maxSide)
  const downscaled = w !== info.width || h !== info.height
  const extra: ImageBitmapOptions = downscaled
    ? { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }
    : {}
  const bitmap = await openBitmap(file, fileName, extra)
  try {
    const image = readPixels(bitmap)
    return {
      image,
      meta: {
        fileName,
        mimeType: info.mimeType,
        originalWidth: info.width,
        originalHeight: info.height,
        downscaled,
      },
    }
  } finally {
    bitmap.close()
  }
}
