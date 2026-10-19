import { useCallback, useEffect, useReducer, useRef, type Dispatch } from 'react'
import type { RedoTarget } from './core/types'
import { GalleryView } from './gallery/GalleryView'
import { ModeSwitch } from './ui/components/ModeSwitch'
import { StepNav } from './ui/components/StepNav'
import { ThemeToggle } from './ui/components/ThemeToggle'
import { usePipeline } from './ui/hooks/usePipeline'
import { useMode } from './ui/hooks/useMode'
import { useRevokeOnRemoval } from './ui/hooks/useObjectUrls'
import { useTheme } from './ui/hooks/useTheme'
import { appReducer, initialState, type AppAction, type AppState, type StepId } from './ui/state/appReducer'
import { previewUrls, reachableSteps, stepIndex, stepTitle } from './ui/state/selectors'
import { ExportStep } from './ui/steps/ExportStep'
import { ReviewStep } from './ui/steps/ReviewStep'
import { SetupStep } from './ui/steps/SetupStep'
import { UploadStep } from './ui/steps/UploadStep'

function PrivacyLine() {
  return (
    <p className="privacy-line">
      Your images are processed on this device and never uploaded. Your photo goes only to the chat app you choose,
      under their terms.
    </p>
  )
}

/** Move keyboard focus to the new step's heading (or a requested prompt card) after navigation. */
function useStepFocus(focusKey: string, pendingTarget: { current: string | null }): void {
  const isFirst = useRef(true)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const wanted = pendingTarget.current ? document.getElementById(pendingTarget.current) : null
    // A request made before a rebuild stays pending while the step is still "processing".
    if (wanted || !focusKey.endsWith(':processing')) pendingTarget.current = null
    const target = wanted ?? document.querySelector<HTMLElement>('main h2')
    target?.scrollIntoView({ block: 'start' })
    target?.focus({ preventScroll: true })
  }, [focusKey, pendingTarget])
}

function StepView({ state, dispatch, start, onShowPrompt, onRequestFocus }: {
  state: AppState
  dispatch: Dispatch<AppAction>
  start: () => void
  onShowPrompt: (redo: RedoTarget) => void
  onRequestFocus: (id: string) => void
}) {
  switch (state.step) {
    case 'setup':
      return <SetupStep state={state} dispatch={dispatch} />
    case 'upload':
      return <UploadStep state={state} dispatch={dispatch} onProcess={start} />
    case 'processing':
    case 'review':
      return <ReviewStep state={state} dispatch={dispatch} onRerun={start} onShowPrompt={onShowPrompt} onRequestFocus={onRequestFocus} />
    case 'export':
      return <ExportStep state={state} dispatch={dispatch} onRerun={start} />
  }
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { start } = usePipeline(state, dispatch)
  const { theme, toggle } = useTheme()
  const pendingTarget = useRef<string | null>(null)
  useRevokeOnRemoval(previewUrls(state.files))
  const { mode, setMode } = useMode()
  useStepFocus(`${mode}:${state.step}`, pendingTarget)
  const title = mode === 'gallery' ? 'Gallery - Mascot Maker' : stepTitle(state)
  useEffect(() => {
    document.title = title
  }, [title])
  const makeOwn = useCallback(() => {
    dispatch({ type: 'nav/goto', step: 'setup' })
    setMode('make')
  }, [setMode])

  const goto = useCallback((step: StepId) => dispatch({ type: 'nav/goto', step }), [])
  const showPrompt = useCallback((redo: RedoTarget) => {
    pendingTarget.current = redo === 'reactions' ? 'prompt-2' : 'prompt-1'
    dispatch({ type: 'nav/goto', step: 'setup' })
  }, [])

  const requestFocus = useCallback((id: string) => {
    pendingTarget.current = id
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          Mascot Maker
        </h1>
        <div className="header-actions">
          <ModeSwitch mode={mode} onChange={setMode} />
          <a className="btn btn-quiet" href="demo.html">
            See it on a page
          </a>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>
      {mode === 'make' && <StepNav currentIndex={stepIndex(state)} reachable={reachableSteps(state)} onGoto={goto} />}
      <main id="main" tabIndex={-1}>
        {mode === 'gallery' ? (
          <GalleryView onMakeOwn={makeOwn} />
        ) : (
          <StepView state={state} dispatch={dispatch} start={start} onShowPrompt={showPrompt} onRequestFocus={requestFocus} />
        )}
      </main>
      <footer className="site-footer">
        <PrivacyLine />
        <p className="muted">
          Built on page-mascot by Kamran Ahmed, MIT licence. Nothing here uses analytics or loads anything from other
          sites.
        </p>
      </footer>
    </>
  )
}
