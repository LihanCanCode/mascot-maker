interface Props {
  fraction: number
  label: string
}

export function ProgressBar({ fraction, label }: Props) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  )
}
