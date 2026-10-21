import { STAR_URL, type StarStorage } from './starAsk'
import { StarGlyph } from './StarGlyph'
import { useStarAsk } from './useStarAsk'

interface Props {
  /** True once the export is actually ready: the files exist and can be taken. */
  ready: boolean
  /** Injected in tests; left out in the app, which uses `localStorage`. */
  storage?: StarStorage | null
}

/**
 * The ask, shown once, after the files are ready.
 *
 * A strip in the normal flow rather than a modal: nothing is covered, nothing
 * is dimmed, and the page carries on working whether it is read or not. Both
 * answers — the link and the dismissal — are final.
 */
export function StarPrompt({ ready, storage }: Props) {
  const { open, dismiss, follow } = useStarAsk(ready, storage)
  if (!open) return null

  return (
    <aside className="star-ask" aria-label="A word from the author">
      <p className="star-ask-words">
        Mascot Maker is one person&rsquo;s side project. If it was useful, a star on GitHub is a kind way to say so.
      </p>
      <p className="star-ask-actions">
        <a className="btn star-ask-go" href={STAR_URL} target="_blank" rel="noopener noreferrer" onClick={follow}>
          <StarGlyph />
          Star Mascot Maker on GitHub
        </a>
        <button type="button" className="btn btn-quiet" aria-label="No thanks, do not ask again" onClick={dismiss}>
          No thanks
        </button>
      </p>
    </aside>
  )
}
