import { useCallback, useEffect, useRef, useState } from 'react'
import { browserStorage, remember, shouldAsk, type StarStorage } from './starAsk'

/**
 * Holds the one decision the ask needs: open, or never again.
 *
 * The mark goes down the moment the ask opens, not when it is answered, so a
 * visitor who makes five mascots in one sitting — or who ignores the card
 * entirely — is asked exactly once.
 */
export interface StarAskState {
  readonly open: boolean
  readonly dismiss: () => void
  readonly follow: () => void
}

export function useStarAsk(ready: boolean, storage?: StarStorage | null): StarAskState {
  const store = useRef(storage === undefined ? browserStorage() : storage)
  const [open, setOpen] = useState(false)
  const decided = useRef(false)

  useEffect(() => {
    if (!ready || decided.current) return
    decided.current = true
    if (!shouldAsk(store.current)) return
    remember(store.current, 'asked')
    setOpen(true)
  }, [ready])

  const close = useCallback((mark: 'dismissed' | 'starred') => {
    remember(store.current, mark)
    setOpen(false)
  }, [])

  const dismiss = useCallback(() => close('dismissed'), [close])
  const follow = useCallback(() => close('starred'), [close])

  return { open, dismiss, follow }
}
