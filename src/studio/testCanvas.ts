// Test-only canvas factory backed by @napi-rs/canvas (native Skia, installed on D: via pnpm).
import { createCanvas } from '@napi-rs/canvas'
import type { CanvasFactory, CanvasLike } from './types'

export const nodeCanvasFactory: CanvasFactory = (w, h) => createCanvas(w, h) as unknown as CanvasLike
