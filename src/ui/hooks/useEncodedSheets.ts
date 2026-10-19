import { useEffect, useState } from 'react'
import { encodeImage, type EncodedImage } from '../../adapters/encode'
import type { ComposedMascot } from '../../core/types'

export type EncodedSheets =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly directions: EncodedImage; readonly reactions: EncodedImage }

type Ready = Extract<EncodedSheets, { status: 'ready' }>

/** Finished encodes per pipeline output, so coming back to Export does not re-encode. */
const cache = new WeakMap<ComposedMascot, Ready>()

/** Encodes both composed sheets once per output; cancels stale work on change or unmount. */
export function useEncodedSheets(output: ComposedMascot): EncodedSheets {
  const [state, setState] = useState<EncodedSheets>(() => cache.get(output) ?? { status: 'loading' })
  useEffect(() => {
    const cached = cache.get(output)
    if (cached) {
      setState(cached)
      return undefined
    }
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([encodeImage(output.directions), encodeImage(output.reactions)])
      .then(([directions, reactions]) => {
        const ready: Ready = { status: 'ready', directions, reactions }
        cache.set(output, ready)
        if (!cancelled) setState(ready)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Your browser could not save the images.'
        if (!cancelled) setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [output])
  return state
}
