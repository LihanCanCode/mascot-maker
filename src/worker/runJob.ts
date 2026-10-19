import { runPipeline } from '../core/pipeline'
import type {
  PipelineOptions,
  PipelineResult,
  ProgressCallback,
  RawImage,
  SheetAnalysis,
  SheetInput,
} from '../core/types'
import { decodeImageFile, ImageDecodeError } from '../adapters/decode'
import type { WorkerRequest, WorkerResponse } from './protocol'

function abortError(): DOMException {
  return new DOMException('The run was cancelled.', 'AbortError')
}

async function decodeSheet(kind: SheetInput['kind'], file: File): Promise<SheetInput> {
  const { image, meta } = await decodeImageFile(file, file.name)
  return { kind, image, meta }
}

/**
 * Decode both files and run the whole pipeline. Used by the worker and the main-thread fallback.
 * `signal` is checked between the stages this function controls (before and after each decode).
 */
export async function runJob(
  directions: File,
  reactions: File,
  options: PipelineOptions,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const check = (): void => {
    if (signal?.aborted) throw abortError()
  }
  check()
  const dirs = await decodeSheet('directions', directions)
  check()
  const reacts = await decodeSheet('reactions', reactions)
  check()
  return runPipeline({ directions: dirs, reactions: reacts }, options, (progress) => {
    check()
    onProgress(progress)
  })
}

export function friendlyMessage(error: unknown): string {
  if (error instanceof ImageDecodeError) return error.message
  const detail = error instanceof Error ? error.message : 'unknown error'
  return `Something went wrong while building your mascot. Try again, or use smaller images. (${detail})`
}

function imagesOf(analysis: SheetAnalysis): readonly RawImage[] {
  const keyed = analysis.key.ok ? [analysis.key.image] : []
  const cells = analysis.slice?.cells.map((c) => c.image) ?? []
  return [...keyed, ...cells]
}

/** Every pixel buffer in a result, deduplicated, so it can be moved to the main thread instead of copied. */
export function collectTransferables(result: PipelineResult): ArrayBuffer[] {
  const images: RawImage[] = [...imagesOf(result.directions), ...imagesOf(result.reactions)]
  if (result.ok) {
    const { output } = result
    images.push(output.directions, output.reactions, ...output.directionTiles, ...output.reactionTiles)
  }
  const buffers = new Set<ArrayBuffer>()
  for (const image of images) {
    const { buffer } = image.data
    if (buffer instanceof ArrayBuffer) buffers.add(buffer)
  }
  return [...buffers]
}

export type PostFn = (response: WorkerResponse, transfer?: ArrayBuffer[]) => void

/** Worker entry logic, kept separate from `self` so it can be tested. */
export async function handleRequest(request: WorkerRequest, post: PostFn): Promise<void> {
  const { id } = request
  try {
    const result = await runJob(request.directions, request.reactions, request.options, (progress) =>
      post({ type: 'progress', id, progress }),
    )
    post({ type: 'done', id, result }, collectTransferables(result))
  } catch (error: unknown) {
    post({ type: 'error', id, message: friendlyMessage(error) })
  }
}
