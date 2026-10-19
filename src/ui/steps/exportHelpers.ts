import type { SheetKind } from '../../core/types'

type SheetExtension = 'webp' | 'png'

export function extensionFor(mimeType: 'image/webp' | 'image/png'): SheetExtension {
  return mimeType === 'image/webp' ? 'webp' : 'png'
}

export function sheetFileName(slug: string, kind: SheetKind, ext: SheetExtension): string {
  return `${slug}-${kind}.${ext}`
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The embed snippets always name `.webp` files; swap to the real extension when we had to save PNG. */
export function adaptSnippetExtension(code: string, slug: string, ext: SheetExtension): string {
  if (ext === 'webp') return code
  const pattern = new RegExp(`${escapeRegExp(slug)}-(directions|reactions)\\.webp`, 'g')
  return code.replace(pattern, `${slug}-$1.${ext}`)
}
