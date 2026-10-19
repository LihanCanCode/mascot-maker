import type { ReactNode } from 'react'
import { PREVIEW_SIZE_MAX, PREVIEW_SIZE_MIN, type UiOptions } from '../state/appReducer'

type Background = UiOptions['previewBg']

const BACKGROUNDS: readonly { id: Background; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'checker', label: 'Checker' },
]

export function PreviewStage({ bg, children }: { bg: Background; children: ReactNode }) {
  return (
    <div className="stage" data-bg={bg}>
      {children}
    </div>
  )
}

interface Props {
  size: number
  bg: Background
  onSize: (size: number) => void
  onBg: (bg: Background) => void
}

/** Preview size slider and background switch, shared by the generated Export step and the gallery. */
export function PreviewControls({ size, bg, onSize, onBg }: Props) {
  return (
    <>
      <div className="field">
        <label htmlFor="preview-size">Preview size: {size}px</label>
        <input
          id="preview-size"
          type="range"
          min={PREVIEW_SIZE_MIN}
          max={PREVIEW_SIZE_MAX}
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
        />
      </div>
      <fieldset className="field">
        <legend>Preview background</legend>
        <div className="seg">
          {BACKGROUNDS.map((b) => (
            <label key={b.id} className="seg-item">
              <input type="radio" name="preview-bg" checked={bg === b.id} onChange={() => onBg(b.id)} />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}
