import { STYLE_PRESETS, type StylePreset } from '../../core/types'
import { STYLE_LABELS } from '../../prompts'

interface Props {
  value: StylePreset
  onChange: (style: StylePreset) => void
}

export function StylePicker({ value, onChange }: Props) {
  return (
    <fieldset className="style-picker">
      <legend>Art style</legend>
      <div className="style-grid">
        {STYLE_PRESETS.map((style) => {
          const info = STYLE_LABELS[style]
          return (
            <label key={style} className="style-card" data-checked={style === value}>
              <input
                type="radio"
                name="style"
                value={style}
                checked={style === value}
                onChange={() => onChange(style)}
              />
              <span className="style-name">{info.label}</span>
              <span className="style-blurb">{info.blurb}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
