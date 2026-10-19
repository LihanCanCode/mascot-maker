import type { PipelineOptions, PipelineProgress, PipelineResult } from '../core/types'

export type WorkerRequest = {
  readonly type: 'run'
  readonly id: number
  readonly directions: File
  readonly reactions: File
  readonly options: PipelineOptions
}

export type WorkerResponse =
  | { readonly type: 'progress'; readonly id: number; readonly progress: PipelineProgress }
  | { readonly type: 'done'; readonly id: number; readonly result: PipelineResult }
  | { readonly type: 'error'; readonly id: number; readonly message: string }
