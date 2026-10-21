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
    remember(store.current)
    setOpen(true)
  }, [ready])

  // Both answers are the same answer: do not ask again. The mark is already
  // down from the moment it opened, so these only close the card.
  const close = useCallback(() => {
    remember(store.current)
    setOpen(false)
  }, [])

  const dismiss = close
  const follow = close

  return { open, dismiss, follow }
}
