import { useMemo } from 'react'
import { textBlob, triggerDownload } from '../adapters/download'
import { buildEmbed } from '../embed'
import { SnippetTabs } from '../ui/components/SnippetTabs'
import { ART_CREDIT, sheetFileNames, sheetUrls, type MascotEntry } from './mascots'

interface Props {
  mascot: MascotEntry
  size: number
  onBack: () => void
  onMakeOwn: () => void
}

export function MascotUse({ mascot, size, onBack, onMakeOwn }: Props) {
  const embed = useMemo(
    () => buildEmbed({ name: mascot.slug, basePath: '/mascots', size, label: mascot.name }),
    [mascot, size],
  )
  const names = sheetFileNames(mascot.slug)
  const urls = sheetUrls(mascot.slug)
  return (
    <div className="step gallery-use">
      <button type="button" className="btn btn-small" onClick={onBack}>
        Back to {mascot.name}
      </button>
      <h2 tabIndex={-1}>Use {mascot.name} on your site</h2>

      <section aria-labelledby="gdl-heading" className="sticker">
        <h3 id="gdl-heading">Download</h3>
        <ul className="downloads">
          <li>
            <a className="btn" href={urls.directions} download={names.directions}>
              {names.directions}
            </a>
          </li>
          <li>
            <a className="btn" href={urls.reactions} download={names.reactions}>
              {names.reactions}
            </a>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => triggerDownload(textBlob(embed.scriptSource, 'text/javascript'), 'page-mascot.js')}>
              page-mascot.js
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => triggerDownload(textBlob(embed.componentSource, 'text/typescript'), 'Mascot.tsx')}>
              Mascot.tsx
            </button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="gembed-heading" className="sticker">
        <h3 id="gembed-heading">Add it to your site</h3>
        <p className="muted">Put the four files above in your site&apos;s /mascots folder, then paste a snippet.</p>
        <SnippetTabs react={embed.react} html={embed.html} />
      </section>

      <p className="credit">
        {ART_CREDIT.text}{' '}
        <a href={ART_CREDIT.url} target="_blank" rel="noopener noreferrer">
          page-mascot on GitHub
        </a>
      </p>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onMakeOwn}>
          Make one that looks like you
        </button>
      </div>
    </div>
  )
}
