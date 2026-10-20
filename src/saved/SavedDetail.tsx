import { useMemo, useState } from 'react'
import { triggerDownload } from '../adapters/download'
import { buildEmbed, slugify } from '../embed'
import { Mascot } from '../mascot/Mascot'
import { PreviewControls, PreviewStage } from '../ui/components/PreviewControls'
import { SnippetTabs } from '../ui/components/SnippetTabs'
import type { UiOptions } from '../ui/state/appReducer'
import { adaptSnippetExtension, extensionFor, sheetFileName } from '../ui/steps/exportHelpers'
import { formatDate } from './format'
import { MAX_NAME_LENGTH } from './record'
import { RenameForm } from './RenameForm'
import type { SavedMascot } from './types'
import { useSavedPreview } from './useSavedRecord'

type Preview = Pick<UiOptions, 'previewSize' | 'previewBg'>

interface Props {
  mascot: SavedMascot
  preview: Preview
  onPreview: (patch: Partial<Preview>) => void
  onBack: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}

/** One saved mascot, with everything a person might want to do to it. */
export function SavedDetail({ mascot, preview, onPreview, onBack, onRename, onDelete }: Props) {
  const { sheets, directionsUrl, reactionsUrl, failed } = useSavedPreview(mascot.id)
  const [confirming, setConfirming] = useState(false)
  const slug = slugify(mascot.name)
  const ext = extensionFor(mascot.mimeType)
  const embed = useMemo(
    () => buildEmbed({ name: mascot.name, basePath: '/mascots', size: preview.previewSize, label: mascot.name }),
    [mascot.name, preview.previewSize],
  )

  const download = (kind: 'directions' | 'reactions'): void => {
    if (sheets === null) return
    triggerDownload(sheets[kind], sheetFileName(slug, kind, ext))
  }

  return (
    <div className="step saved-detail">
      <button type="button" className="btn btn-small" onClick={onBack}>
        Back to my gallery
      </button>
      <h2 tabIndex={-1}>{mascot.name}</h2>
      <p className="muted">Saved {formatDate(mascot.updated)}, {mascot.cellSize}px per pose.</p>

      <div className="export-grid">
        <div className="stage-wrap">
          <PreviewStage bg={preview.previewBg}>
            {directionsUrl !== null && reactionsUrl !== null ? (
              <Mascot
                directions={directionsUrl}
                reactions={reactionsUrl}
                size={preview.previewSize}
                label={mascot.name}
              />
            ) : failed !== null ? (
              <p role="alert" className="muted">
                {failed}
              </p>
            ) : (
              <div className="skeleton" style={{ width: preview.previewSize, height: preview.previewSize }}>
                <span className="spinner" aria-hidden="true" />
              </div>
            )}
          </PreviewStage>
          <p className="muted">Move your pointer around it, and click it.</p>
        </div>
        <div className="controls">
          <PreviewControls
            size={preview.previewSize}
            bg={preview.previewBg}
            onSize={(previewSize) => onPreview({ previewSize })}
            onBg={(previewBg) => onPreview({ previewBg })}
          />
          <RenameForm
            id={mascot.id}
            name={mascot.name}
            maxLength={MAX_NAME_LENGTH}
            onRename={(next) => onRename(mascot.id, next)}
          />
        </div>
      </div>

      <section aria-labelledby="saved-dl-heading" className="sticker">
        <h3 id="saved-dl-heading">Download</h3>
        <ul className="downloads">
          <li>
            <button type="button" className="btn" disabled={sheets === null} onClick={() => download('directions')}>
              {sheetFileName(slug, 'directions', ext)}
            </button>
          </li>
          <li>
            <button type="button" className="btn" disabled={sheets === null} onClick={() => download('reactions')}>
              {sheetFileName(slug, 'reactions', ext)}
            </button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="saved-embed-heading" className="sticker">
        <h3 id="saved-embed-heading">Add it to your site</h3>
        <SnippetTabs
          react={adaptSnippetExtension(embed.react, slug, ext)}
          html={adaptSnippetExtension(embed.html, slug, ext)}
        />
      </section>

      <div className="actions">
        {confirming ? (
          <div className="confirm" role="group" aria-label={`Delete ${mascot.name}`}>
            <p>Delete {mascot.name}? This cannot be undone.</p>
            <button type="button" className="btn btn-primary" onClick={() => onDelete(mascot.id, mascot.name)}>
              Yes, delete it
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            Delete this mascot
          </button>
        )}
      </div>
    </div>
  )
}
