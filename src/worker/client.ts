import type { PipelineOptions, PipelineResult, ProgressCallback } from '../core/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

let nextId = 1

const RECEIVE_FAILED = 'The result could not be received. Please try again, or use smaller images.'
const WORKER_STOPPED = 'The background worker stopped unexpectedly. Please try again, or use smaller images.'

function abortError(): DOMException {
  return new DOMException('The run was cancelled.', 'AbortError')
}

async function runOnMainThread(
  directions: File,
  reactions: File,
  options: PipelineOptions,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<PipelineResult> {
  const { runJob } = await import('./runJob')
  if (signal.aborted) throw abortError()
  return runJob(directions, reactions, options, onProgress, signal)
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('./pipeline.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
}

/** Run the pipeline off the main thread; falls back to the main thread if no worker can start. */
export function runInWorker(
  directions: File,
  reactions: File,
  options: PipelineOptions,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<PipelineResult> {
  if (signal.aborted) return Promise.reject(abortError())
  const worker = createWorker()
  if (worker === null) return runOnMainThread(directions, reactions, options, onProgress, signal)

  const id = nextId++
  return new Promise<PipelineResult>((resolve, reject) => {
    let heardFromWorker = false
    const finish = (settle: () => void): void => {
      signal.removeEventListener('abort', onAbort)
      worker.terminate()
      settle()
    }
    const onAbort = (): void => finish(() => reject(abortError()))
    signal.addEventListener('abort', onAbort, { once: true })

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.id !== id) return
      heardFromWorker = true
      if (msg.type === 'progress') onProgress(msg.progress)
      else if (msg.type === 'done') finish(() => resolve(msg.result))
      else finish(() => reject(new Error(msg.message)))
    }
    worker.onmessageerror = () => finish(() => reject(new Error(RECEIVE_FAILED)))
    worker.onerror = () =>
      finish(() => {
        // Only a worker that never started (for example a blocked script) is safe to replace;
        // rerunning after real work began would just freeze the page the same way.
        if (heardFromWorker) reject(new Error(WORKER_STOPPED))
        else resolve(runOnMainThread(directions, reactions, options, onProgress, signal))
      })

    const request: WorkerRequest = { type: 'run', id, directions, reactions, options }
    worker.postMessage(request)
  })
}
