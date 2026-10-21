import { STAR_URL } from './starAsk'
import { StarGlyph } from './StarGlyph'

/**
 * The quiet option: always in the header, never counted as the ask.
 *
 * A plain link out. Nothing is fetched for it, so the page keeps its promise
 * that it talks to no other origin.
 */
export function StarLink() {
  return (
    <a className="btn btn-quiet star-link" href={STAR_URL} target="_blank" rel="noopener noreferrer">
      <StarGlyph />
      Star on GitHub
    </a>
  )
}
