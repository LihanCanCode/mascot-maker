const REVOKE_DELAY_MS = 4000

/** Save a Blob through a temporary link. The object URL is released shortly afterwards. */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export function textBlob(text: string, mimeType: string): Blob {
  return new Blob([text], { type: `${mimeType};charset=utf-8` })
}
