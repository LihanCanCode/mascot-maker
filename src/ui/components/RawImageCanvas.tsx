import { useEffect, useRef } from 'react'
import type { RawImage } from '../../core/types'

interface Props {
  image: RawImage
  label: string
  className?: string
}

/** Draws a RawImage 1:1; CSS scales it. Exposed to assistive tech as an image with `label`. */
export function RawImageCanvas({ image, label, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d') ?? null
    if (ctx === null) return
    const pixels = ctx.createImageData(image.width, image.height)
    pixels.data.set(image.data)
    ctx.putImageData(pixels, 0, 0)
  }, [image])
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={image.width}
      height={image.height}
      className={className}
    />
  )
}
