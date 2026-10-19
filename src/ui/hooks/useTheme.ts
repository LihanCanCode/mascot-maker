import { useCallback, useEffect, useState } from 'react'

/** Apply a stored theme before first render so there is no flash of the wrong theme. */
export function applyStoredTheme(): void {
  const stored = readStored()
  if (stored !== null) document.documentElement.setAttribute('data-theme', stored)
}

export type Theme = 'light' | 'dark'
const KEY = 'mascot-maker-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Follows the system until the user picks a theme; the pick is stored and set as `data-theme`. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [choice, setChoice] = useState<Theme | null>(readStored)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (): void => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (choice === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', choice)
  }, [choice])

  const theme = choice ?? system
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }, [theme])

  return { theme, toggle }
}
