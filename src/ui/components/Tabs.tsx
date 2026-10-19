import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  label: string
  tabs: readonly TabItem[]
}

/** Accessible tabs: roving tabindex, arrow keys, Home and End. */
export function Tabs({ label, tabs }: Props) {
  const base = useId()
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '')
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const move = (event: KeyboardEvent, index: number): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const last = tabs.length - 1
    const target =
      event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + last) % tabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1
    const next = tabs[target]
    if (!next) return
    event.preventDefault()
    setActiveId(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === activeId ? 0 : -1}
            className="tab"
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(e) => move(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="tabpanel"
        >
          {tab.id === activeId ? tab.content : null}
        </div>
      ))}
    </div>
  )
}
