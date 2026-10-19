/**
 * Failure invariants with the REAL measure and validator (only the aligner is forced to fail).
 */
import { describe, expect, it, vi } from 'vitest'
import { greenSheet } from './__fixtures__/opaqueSheets'
import { createImage } from './raster'
import { DEFAULT_PIPELINE_OPTIONS } from './types'
import type { PipelineInput, RawImage, SheetKind } from './types'

vi.mock('./aligner', () => ({
  alignSheets: vi.fn(() => ({ ok: false, reason: 'too-few-anchors', anchoredCells: 2 })),
}))

import { runPipeline } from './pipeline'

function sheet(kind: SheetKind, image: RawImage): PipelineInput['directions'] {
  return {
    kind,
    image,
    meta: { fileName: `${kind}.png`, mimeType: 'image/png', originalWidth: image.width, originalHeight: image.height, downscaled: false },
  }
}

describe('runPipeline failure invariants (real validator)', () => {
  it('reports canExport=false when alignment finds too few anchors', () => {
    const input: PipelineInput = {
      directions: sheet('directions', greenSheet().image),
      reactions: sheet('reactions', greenSheet().image),
    }
    const result = runPipeline(input, DEFAULT_PIPELINE_OPTIONS)
    expect(result.ok).toBe(false)
    expect(result.report.canExport).toBe(false)
    expect(result.report.verdict).toBe('redo')
  })

  it('returns a blocking report (no throw) for a sheet under 3 px', () => {
    const tiny = createImage(2, 2, { r: 0, g: 255, b: 0, a: 255 })
    const input: PipelineInput = {
      directions: sheet('directions', tiny),
      reactions: sheet('reactions', greenSheet().image),
    }
    const result = runPipeline(input, DEFAULT_PIPELINE_OPTIONS)
    expect(result.ok).toBe(false)
    expect(result.report.canExport).toBe(false)
    expect(result.report.issues.some((i) => i.blocking && i.sheet === 'directions')).toBe(true)
  })
})
