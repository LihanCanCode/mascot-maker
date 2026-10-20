import { useCallback, useEffect, useState } from 'react'

export type Mode = 'make' | 'gallery' | 'saved'

const HASHES: Readonly<Record<string, Mode>> = { '#gallery': 'gallery', '#saved': 'saved', '': 'make' }

export function modeFromHash(hash: string): Mode {
  return HASHES[hash] ?? 'make'
}

function hashFor(mode: Mode): string {
  return mode === 'make' ? '' : `#${mode}`
}

/** Top-level mode, mirrored in the URL hash so "index.html#saved" can be linked to. */
export function useMode(): { mode: Mode; setMode: (mode: Mode) => void } {
  const [mode, setModeState] = useState<Mode>(() => modeFromHash(window.location.hash))

  useEffect(() => {
    // Only the mode's own hashes switch it, so in-page links like the skip link (#main) are ignored.
    const onHashChange = (): void => {
      const known = HASHES[window.location.hash]
      if (known !== undefined) setModeState(known)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}${hashFor(next)}`)
  }, [])

  return { mode, setMode }
}
