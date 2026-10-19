import type { Theme } from '../hooks/useTheme'

interface Props {
  theme: Theme
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="btn btn-quiet" onClick={onToggle}>
      <span aria-hidden="true" className="theme-dot" data-theme-dot={theme} />
      Switch to {next} theme
    </button>
  )
}
