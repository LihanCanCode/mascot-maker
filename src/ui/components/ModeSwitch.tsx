import type { Mode } from '../hooks/useMode'

interface Props {
  mode: Mode
  onChange: (mode: Mode) => void
}

const MODES: readonly { id: Mode; label: string }[] = [
  { id: 'make', label: 'Make my own' },
  { id: 'gallery', label: 'Gallery' },
]

export function ModeSwitch({ mode, onChange }: Props) {
  return (
    <nav aria-label="Mode" className="modeswitch">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className="modeswitch-btn"
          aria-pressed={mode === m.id}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </nav>
  )
}
