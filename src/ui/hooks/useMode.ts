import { useCallback, useEffect, useState } from 'react'

export type Mode = 'make' | 'gallery'

const GALLERY_HASH = '#gallery'

export function modeFromHash(hash: string): Mode {
  return hash === GALLERY_HASH ? 'gallery' : 'make'
}

/** Top-level mode, mirrored in the URL hash so "index.html#gallery" can be linked to. */
export function useMode(): { mode: Mode; setMode: (mode: Mode) => void } {
  const [mode, setModeState] = useState<Mode>(() => modeFromHash(window.location.hash))

  useEffect(() => {
    // Only the mode's own hashes switch it, so in-page links like the skip link (#main) are ignored.
    const onHashChange = (): void => {
      const { hash } = window.location
      if (hash === GALLERY_HASH) setModeState('gallery')
      else if (hash === '') setModeState('make')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    const { pathname, search } = window.location
    window.history.replaceState(null, '', next === 'gallery' ? `${pathname}${search}${GALLERY_HASH}` : `${pathname}${search}`)
  }, [])

  return { mode, setMode }
}
