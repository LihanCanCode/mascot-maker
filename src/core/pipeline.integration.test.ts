import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { checkerSheet, greenSheet } from './__fixtures__/opaqueSheets'
import { runPipeline } from './pipeline'
import { optionsForStyle } from './pipelineOptions'
import type { PipelineInput, RawImage, SheetInput, SheetKind } from './types'

function sheet(kind: SheetKind, image: RawImage, mimeType = 'image/png'): SheetInput {
  return {
    kind,
    image,
    meta: { fileName: `${kind}.png`, mimeType, originalWidth: image.width, originalHeight: image.height, downscaled: false },
  }
}

/** Decodes a PNG and composites it over #00FF00 (what an image model would hand back). */
function loadOnGreen(name: string): RawImage {
  const png = PNG.sync.read(readFileSync(join(__dirname, '..', 'test', 'assets', name)))
  const data = new Uint8ClampedArray(png.width * png.height * 4)
  for (let p = 0; p < png.width * png.height; p++) {
    const a = png.data[p * 4 + 3]! / 255
    data[p * 4] = png.data[p * 4]! * a
    data[p * 4 + 1] = png.data[p * 4 + 1]! * a + 255 * (1 - a)
    data[p * 4 + 2] = png.data[p * 4 + 2]! * a
    data[p * 4 + 3] = 255
  }
  return { width: png.width, height: png.height, data }
}

// Enable when Agent B lands: these use the real measure / aligner / composer / validator.
describe('runPipeline end to end', () => {
  const options = optionsForStyle('colour', 'green', 360, false)

  it('processes a synthetic green pair with no errors', () => {
    const input: PipelineInput = {
      directions: sheet('directions', greenSheet({ cell: 240 }).image),
      reactions: sheet('reactions', greenSheet({ cell: 240 }).image),
    }
    const result = runPipeline(input, options)
    expect(result.ok).toBe(true)
    expect(result.report.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('blocks on a checkerboard directions sheet', () => {
    const input: PipelineInput = {
      directions: sheet('directions', checkerSheet(16, { cell: 160 }).image),
      reactions: sheet('reactions', greenSheet({ cell: 160 }).image),
    }
    const result = runPipeline(input, options)
    expect(result.ok).toBe(false)
    expect(result.report.canExport).toBe(false)
    expect(result.report.issues.some((i) => i.code === 'checkerboard' && i.blocking)).toBe(true)
  })

  it('processes the reference fox sheets composited on #00FF00', () => {
    const input: PipelineInput = {
      directions: sheet('directions', loadOnGreen('fox-directions.png')),
      reactions: sheet('reactions', loadOnGreen('fox-reactions.png')),
    }
    const result = runPipeline(input, options)
    expect(result.ok).toBe(true)
    expect(result.report.issues.filter((i) => i.blocking)).toEqual([])
    expect(result.report.metrics.boopShiftPx).not.toBeNull()
    expect(result.report.metrics.boopShiftPx!).toBeLessThanOrEqual(2)
  })
})

it('keeps the integration suite discoverable', () => {
  expect(typeof runPipeline).toBe('function')
})
