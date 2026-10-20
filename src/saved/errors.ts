/** Why a save or a read failed, in terms the interface can speak about. */
export type SavedErrorKind = 'quota' | 'unavailable' | 'invalid' | 'not-found'

export class SavedStoreError extends Error {
  readonly kind: SavedErrorKind
  constructor(kind: SavedErrorKind, message: string) {
    super(message)
    this.name = 'SavedStoreError'
    this.kind = kind
  }
}

export function isSavedStoreError(error: unknown): error is SavedStoreError {
  return error instanceof SavedStoreError
}

/** True for the handful of names browsers use when the origin's storage is full. */
export function looksLikeQuota(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = (error as { name?: unknown }).name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || name === 'QUOTA_EXCEEDED_ERR'
}

export function quotaError(usedBytes: number): SavedStoreError {
  const used = Math.round(usedBytes / 1024)
  return new SavedStoreError(
    'quota',
    `This browser's storage for Mascot Maker is full (about ${used} kB already saved). ` +
      'Delete a mascot you no longer need, or clear the whole gallery, then save again.',
  )
}

export function unavailableError(detail: string): SavedStoreError {
  return new SavedStoreError(
    'unavailable',
    `This browser will not let the page store anything, so saving is not possible here (${detail}). ` +
      'Private windows and locked-down settings do this. Download the files instead.',
  )
}
