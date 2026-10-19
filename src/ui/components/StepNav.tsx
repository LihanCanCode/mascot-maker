import type { StepId } from '../state/appReducer'
import { STEPS } from '../state/selectors'

interface Props {
  currentIndex: number
  reachable: ReadonlySet<StepId>
  onGoto: (step: StepId) => void
}

export function StepNav({ currentIndex, reachable, onGoto }: Props) {
  return (
    <nav aria-label="Progress" className="stepnav">
      <ol>
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIndex
          const isReachable = reachable.has(step.id)
          return (
            <li key={step.id} data-state={isCurrent ? 'current' : i < currentIndex ? 'done' : 'todo'}>
              <button
                type="button"
                className="stepnav-btn"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!isReachable && !isCurrent}
                onClick={() => onGoto(step.id)}
              >
                <span className="stepnav-num" aria-hidden="true">
                  {i + 1}
                </span>
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
