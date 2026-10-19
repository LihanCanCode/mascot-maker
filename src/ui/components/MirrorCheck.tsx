import type { Cell } from '../../core/types'
import { cellLabel } from '../state/selectors'
import { RawImageCanvas } from './RawImageCanvas'

interface Props {
  cells: readonly Cell[]
  swapped: boolean
  onToggle: () => void
}

/** Left (cell 4) and right (cell 6) poses, so people can spot a mirrored directions sheet. */
export function MirrorCheck({ cells, swapped, onToggle }: Props) {
  const left = cells[3]
  const right = cells[5]
  if (!left || !right) return null
  return (
    <section aria-labelledby="mirror-heading" className="sticker mirror">
      <h3 id="mirror-heading">Mirror check</h3>
      <p>
        Does the left character look toward your left, and the right one toward your right? We cannot tell from the
        pixels, so it is your call.
      </p>
      <div className="mirror-pair">
        <figure>
          <RawImageCanvas image={left.image} label={cellLabel('directions', 3)} className="mirror-canvas" />
          <figcaption>Left pose</figcaption>
        </figure>
        <figure>
          <RawImageCanvas image={right.image} label={cellLabel('directions', 5)} className="mirror-canvas" />
          <figcaption>Right pose</figcaption>
        </figure>
      </div>
      <button id="mirror-switch" type="button" role="switch" aria-checked={swapped} className="btn" onClick={onToggle}>
        Swap left/right columns
        <span className="switch-state" aria-hidden="true">{swapped ? 'On' : 'Off'}</span>
      </button>
    </section>
  )
}
