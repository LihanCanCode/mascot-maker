import { useEffect, useRef, useState } from 'react'

/** Object URLs for blobs (pass a memoised array). Old URLs are revoked when it changes and on unmount. */
export function useObjectUrls(blobs: readonly (Blob | null)[]): readonly (string | null)[] {
  const [urls, setUrls] = useState<readonly (string | null)[]>(() => blobs.map(() => null))
  useEffect(() => {
    const created = blobs.map((b) => (b === null ? null : URL.createObjectURL(b)))
    setUrls(created)
    return () => {
      for (const url of created) if (url !== null) URL.revokeObjectURL(url)
    }
  }, [blobs])
  return urls
}

/** Revoke externally created object URLs once they leave `urls`, and all of them on unmount. */
export function useRevokeOnRemoval(urls: readonly string[]): void {
  const known = useRef<ReadonlySet<string>>(new Set())
  const key = urls.join('|')
  useEffect(() => {
    const next = new Set(urls)
    for (const url of known.current) if (!next.has(url)) URL.revokeObjectURL(url)
    known.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(
    () => () => {
      for (const url of known.current) URL.revokeObjectURL(url)
      known.current = new Set()
    },
    [],
  )
}
