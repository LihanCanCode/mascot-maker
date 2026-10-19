import { useCallback, useEffect, useRef, type Dispatch } from 'react'
import { optionsForStyle } from '../../core/pipelineOptions'
import { buildPrompts } from '../../prompts'
import { runInWorker } from '../../worker/client'
import type { AppAction, AppState } from '../state/appReducer'

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while building your mascot. Please try again.'
}

/** Starts runs and executes whichever run the state machine is currently waiting for. */
export function usePipeline(state: AppState, dispatch: Dispatch<AppAction>): { start: () => void } {
  const counter = useRef(0)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })
  const runId = state.step === 'processing' ? state.runId : null

  useEffect(() => {
    const current = latest.current
    if (runId === null || current.step !== 'processing') return undefined
    const { directions, reactions } = current.files
    if (directions.status !== 'ready' || reactions.status !== 'ready') return undefined

    const expected = current.brief.key ?? buildPrompts(current.brief).key
    const options = optionsForStyle(current.brief.style, expected, current.options.cellSize, current.options.swapDirectionColumns)
    const controller = new AbortController()
    runInWorker(
      directions.file,
      reactions.file,
      options,
      (progress) => dispatch({ type: 'run/progress', runId, progress }),
      controller.signal,
    )
      .then((result) => dispatch({ type: 'run/finished', runId, result }))
      .catch((error: unknown) => {
        if (!isAbort(error)) dispatch({ type: 'run/failed', runId, message: errorText(error) })
      })
    return () => controller.abort()
  }, [runId, dispatch])

  const start = useCallback(() => {
    counter.current += 1
    dispatch({ type: 'run/started', runId: counter.current })
  }, [dispatch])

  return { start }
}
