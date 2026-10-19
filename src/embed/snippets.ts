import type { EmbedAssetNames, EmbedBundle, EmbedOptions } from '../core/types'
import componentSource from '../mascot/Mascot.tsx?raw'
import scriptSource from './page-mascot.js?raw'
import { escapeHtmlAttr, escapeJsxString, sanitizeBasePath, slugify } from './escape'

const DEFAULT_SIZE = 140
const MIN_SIZE = 48
const MAX_SIZE = 512
const FALLBACK_LABEL = 'mascot'
const ATTRIBUTION = 'Mascot made with mascot-maker; runtime adapted from page-mascot (MIT, Kamran Ahmed).'

export function assetNames(slug: string): EmbedAssetNames {
  return {
    directions: `${slug}-directions.webp`,
    reactions: `${slug}-reactions.webp`,
    script: 'page-mascot.js',
    component: 'Mascot.tsx',
  }
}

function clampSize(size: number): number {
  if (Number.isNaN(size)) return DEFAULT_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)))
}

function labelFor(o: EmbedOptions): string {
  return o.label.trim() || o.name.trim() || FALLBACK_LABEL
}

interface Resolved {
  readonly base: string
  readonly names: EmbedAssetNames
  readonly size: number
  readonly label: string
}

function resolve(o: EmbedOptions): Resolved {
  return {
    base: sanitizeBasePath(o.basePath),
    names: assetNames(slugify(o.name)),
    size: clampSize(o.size),
    label: labelFor(o),
  }
}

export function reactSnippet(o: EmbedOptions): string {
  const { base, names, size, label } = resolve(o)
  const directions = escapeJsxString(`${base}/${names.directions}`)
  const reactions = escapeJsxString(`${base}/${names.reactions}`)
  return `// ${ATTRIBUTION}
import { Mascot } from './Mascot'

<Mascot
  directions="${directions}"
  reactions="${reactions}"
  size={${size}}
  label="${escapeJsxString(label)}"
/>
`
}

export function htmlSnippet(o: EmbedOptions): string {
  const { base, names, size, label } = resolve(o)
  const script = escapeHtmlAttr(`${base}/${names.script}`)
  const directions = escapeHtmlAttr(`${base}/${names.directions}`)
  const reactions = escapeHtmlAttr(`${base}/${names.reactions}`)
  return `<!-- ${ATTRIBUTION} -->
<script type="module" src="${script}"></script>
<page-mascot
  directions="${directions}"
  reactions="${reactions}"
  size="${size}"
  label="${escapeHtmlAttr(label)}"
></page-mascot>
`
}

export function buildEmbed(o: EmbedOptions): EmbedBundle {
  return {
    assetNames: assetNames(slugify(o.name)),
    react: reactSnippet(o),
    html: htmlSnippet(o),
    componentSource,
    scriptSource,
  }
}
