import {
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type CharacterBrief,
  type PipelineProgress,
  type PipelineResult,
  type PipelineSuccess,
  type SheetKind,
} from '../../core/types'

export type FileSlot =
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly file: File; readonly previewUrl: string }
  | { readonly status: 'rejected'; readonly message: string }

export interface Files {
  readonly directions: FileSlot
  readonly reactions: FileSlot
}

export interface UiOptions {
  readonly cellSize: number
  readonly swapDirectionColumns: boolean
  readonly previewBg: 'light' | 'dark' | 'checker'
  readonly previewSize: number
}

export type StepId = 'setup' | 'upload' | 'review' | 'export'

interface Base {
  readonly brief: CharacterBrief
  readonly files: Files
  readonly options: UiOptions
}

export type AppState =
  | ({ readonly step: 'setup' } & Base)
  /** `error` is set when the last run failed before producing a report (e.g. an unreadable image). */
  | ({ readonly step: 'upload'; readonly error?: string } & Base)
  | ({
      readonly step: 'processing'
      readonly progress: PipelineProgress
      readonly runId: number
      /** Where the run was started from; cancelling goes back there. */
      readonly from: 'upload' | 'review' | 'export'
      /** Result being replaced by this run (null for the first run). */
      readonly previous: PipelineResult | null
    } & Base)
  | ({ readonly step: 'review'; readonly result: PipelineResult } & Base)
  | ({ readonly step: 'export'; readonly result: PipelineSuccess } & Base)

export type AppAction =
  | { readonly type: 'brief/update'; readonly patch: Partial<CharacterBrief> }
  | { readonly type: 'nav/goto'; readonly step: StepId }
  | { readonly type: 'file/accepted'; readonly sheet: SheetKind; readonly file: File; readonly previewUrl: string }
  | { readonly type: 'file/rejected'; readonly sheet: SheetKind; readonly message: string }
  | { readonly type: 'file/cleared'; readonly sheet: SheetKind }
  | { readonly type: 'run/started'; readonly runId: number }
  | { readonly type: 'run/progress'; readonly runId: number; readonly progress: PipelineProgress }
  | { readonly type: 'run/finished'; readonly runId: number; readonly result: PipelineResult }
  | { readonly type: 'run/failed'; readonly runId: number; readonly message: string }
  | { readonly type: 'options/update'; readonly patch: Partial<UiOptions> }
  | { readonly type: 'reset' }

export const PREVIEW_SIZE_MIN = 80
export const PREVIEW_SIZE_MAX = 240

export const initialState: AppState = {
  step: 'setup',
  brief: { name: '', describe: '', style: 'colour', usePhoto: true, key: null },
  files: { directions: { status: 'empty' }, reactions: { status: 'empty' } },
  options: { cellSize: 360, swapDirectionColumns: false, previewBg: 'light', previewSize: 140 },
}

const START_PROGRESS: PipelineProgress = { stage: 'keying', sheet: null, fraction: 0 }

function base(state: AppState): Base {
  return { brief: state.brief, files: state.files, options: state.options }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeOptions(options: UiOptions): UiOptions {
  return {
    ...options,
    cellSize: clamp(Math.round(options.cellSize), MIN_CELL_SIZE, MAX_CELL_SIZE),
    previewSize: clamp(Math.round(options.previewSize), PREVIEW_SIZE_MIN, PREVIEW_SIZE_MAX),
  }
}

function sameOptions(a: UiOptions, b: UiOptions): boolean {
  return (
    a.cellSize === b.cellSize &&
    a.swapDirectionColumns === b.swapDirectionColumns &&
    a.previewBg === b.previewBg &&
    a.previewSize === b.previewSize
  )
}

function restoreFromRun(state: Extract<AppState, { step: 'processing' }>, step: StepId): AppState {
  const { previous } = state
  if (previous === null || step !== state.from) return state
  if (step === 'export' && previous.ok) return { step, ...base(state), result: previous }
  if (step === 'review') return { step, ...base(state), result: previous }
  return state
}

function goto(state: AppState, step: StepId): AppState {
  if (state.step === 'processing' && (step === 'review' || step === 'export')) {
    return restoreFromRun(state, step)
  }
  if (step === state.step) return state
  if (step === 'setup' || step === 'upload') return { step, ...base(state) }
  if (step === 'review' && state.step === 'export') return { step, ...base(state), result: state.result }
  if (step === 'export' && state.step === 'review') {
    const { result } = state
    return result.ok && result.report.canExport ? { step, ...base(state), result } : state
  }
  return state
}

function setSlot(state: AppState, sheet: SheetKind, slot: FileSlot): AppState {
  if (state.step !== 'upload') return state
  return { step: 'upload', ...base(state), files: { ...state.files, [sheet]: slot } }
}

/** A bad replacement must not throw away a file that already passed: show the message, keep the file. */
function rejectFile(state: AppState, sheet: SheetKind, message: string): AppState {
  if (state.step !== 'upload') return state
  if (state.files[sheet].status === 'ready') return { ...state, error: message }
  return setSlot(state, sheet, { status: 'rejected', message })
}

function bothReady(files: Files): boolean {
  return files.directions.status === 'ready' && files.reactions.status === 'ready'
}

function startRun(state: AppState, runId: number): AppState {
  const canStart = state.step === 'upload' || state.step === 'review' || state.step === 'export'
  if (!canStart || !bothReady(state.files)) return state
  const previous = state.step === 'upload' ? null : state.result
  return { step: 'processing', ...base(state), progress: START_PROGRESS, runId, from: state.step, previous }
}

function finishRun(state: Extract<AppState, { step: 'processing' }>, result: PipelineResult): AppState {
  if (state.from === 'export' && result.ok && result.report.canExport) {
    return { step: 'export', ...base(state), result }
  }
  return { step: 'review', ...base(state), result }
}

function updateOptions(state: AppState, patch: Partial<UiOptions>): AppState {
  if (state.step === 'processing') return state
  const next = normalizeOptions({ ...state.options, ...patch })
  return sameOptions(next, state.options) ? state : { ...state, options: next }
}

function onRun(state: AppState, action: AppAction): AppState {
  if (state.step !== 'processing') return state
  switch (action.type) {
    case 'run/progress':
      return action.runId === state.runId ? { ...state, progress: action.progress } : state
    case 'run/finished':
      return action.runId === state.runId
        ? finishRun(state, action.result)
        : state
    case 'run/failed':
      return action.runId === state.runId
        ? { step: 'upload', ...base(state), error: action.message }
        : state
    default:
      return state
  }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'brief/update':
      return state.step === 'setup' ? { ...state, brief: { ...state.brief, ...action.patch } } : state
    case 'nav/goto':
      return goto(state, action.step)
    case 'file/accepted':
      return setSlot(state, action.sheet, { status: 'ready', file: action.file, previewUrl: action.previewUrl })
    case 'file/rejected':
      return rejectFile(state, action.sheet, action.message)
    case 'file/cleared':
      return setSlot(state, action.sheet, { status: 'empty' })
    case 'run/started':
      return startRun(state, action.runId)
    case 'run/progress':
    case 'run/finished':
    case 'run/failed':
      return onRun(state, action)
    case 'options/update':
      return updateOptions(state, action.patch)
    case 'reset':
      return state === initialState ? state : initialState
  }
}
