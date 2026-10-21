/*
  Whether to ask this visitor for a GitHub star, and the note that says they
  have already been asked.

  All of it lives behind one key and one function so that no component has to
  touch storage itself. The storage is passed in rather than reached for, which
  is what makes the rule testable in every state it can be in.

  Two deliberate decisions:

  - A browser that refuses storage — a private window, a locked-down profile —
    means "do not ask". Being asked on every single visit is worse than never
    being asked, and an exception thrown out of a getter must never reach the
    page.
  - Any mark at all in the slot, even one this version does not recognise,
    counts as having been asked. Something put it there; the visitor has seen
    the ask once, and once is the whole promise.
*/

/** The repository the ask points at. Nothing here ever fetches from it. */
export const STAR_URL = 'https://github.com/LihanCanCode/mascot-maker'

/** The one storage key this feature owns. */
export const STAR_KEY = 'mascot-maker.star-ask'

/** The one value ever written. Only its presence is read; it never varies. */
export const STAR_MARK = 'asked'

/** The slice of `Storage` this needs, so a test can hand over a map or a trap. */
export interface StarStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** `localStorage`, or null when the browser will not part with it. */
export function browserStorage(): StarStorage | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/** True only for a visitor who has never been shown the ask. */
export function shouldAsk(storage: StarStorage | null): boolean {
  if (storage === null) return false
  try {
    const mark = storage.getItem(STAR_KEY)
    return mark === null || mark.trim().length === 0
  } catch {
    return false
  }
}

/** Note that the ask has happened. A storage that refuses is not an error. */
export function remember(storage: StarStorage | null): void {
  if (storage === null) return
  try {
    storage.setItem(STAR_KEY, STAR_MARK)
  } catch {
    // Storage is unavailable. The ask is already hidden for this visit, which
    // is as much as can be promised without somewhere to write.
  }
}
