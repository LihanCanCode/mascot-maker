import { useId, type Dispatch } from 'react'
import { DropZone } from '../components/DropZone'
import { useFileIntake } from '../hooks/useFileIntake'
import type { AppAction, AppState } from '../state/appReducer'
import { canProcess } from '../state/selectors'

interface Props {
  state: Extract<AppState, { step: 'upload' }>
  dispatch: Dispatch<AppAction>
  onProcess: () => void
}

export function UploadStep({ state, dispatch, onProcess }: Props) {
  const { files } = state
  const ready = canProcess(files)
  const accept = useFileIntake(dispatch)
  const hintId = useId()

  return (
    <div className="step">
      <h2 tabIndex={-1}>Upload your two images</h2>
      <p className="privacy" role="note">
        Your images are processed on this device and never uploaded. Your photo goes only to the chat app you choose,
        under their terms.
      </p>
      {state.error && (
        <p role="alert" className="banner" data-tone="bad">
          {state.error}
        </p>
      )}
      <div className="dropzones">
        <DropZone
          sheet="directions"
          title="Directions image"
          hint="The first picture: nine head poses looking in different directions."
          slot={files.directions}
          onSelect={(f) => void accept('directions', f)}
          onClear={() => dispatch({ type: 'file/cleared', sheet: 'directions' })}
        />
        <DropZone
          sheet="reactions"
          title="Reactions image"
          hint="The second picture: nine facial reactions."
          slot={files.reactions}
          onSelect={(f) => void accept('reactions', f)}
          onClear={() => dispatch({ type: 'file/cleared', sheet: 'reactions' })}
        />
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'nav/goto', step: 'setup' })}>
          Back to messages
        </button>
        <button
          type="button"
          className="btn btn-primary"
          aria-disabled={!ready}
          aria-describedby={ready ? undefined : hintId}
          onClick={() => {
            if (ready) onProcess()
          }}
        >
          Build my mascot
        </button>
        {!ready && (
          <span id={hintId} className="muted">
            Add both images to continue.
          </span>
        )}
      </div>
    </div>
  )
}
