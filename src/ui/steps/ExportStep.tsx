import { useMemo, type Dispatch } from 'react'
import { textBlob, triggerDownload } from '../../adapters/download'
import { CELL_SIZE_PRESETS } from '../../core/types'
import { buildEmbed, slugify } from '../../embed'
import { Mascot } from '../../mascot/Mascot'
import { PreviewControls, PreviewStage } from '../components/PreviewControls'
import { SnippetTabs } from '../components/SnippetTabs'
import { useEncodedSheets } from '../hooks/useEncodedSheets'
import { useObjectUrls } from '../hooks/useObjectUrls'
import { type AppAction, type AppState, type UiOptions } from '../state/appReducer'
import { adaptSnippetExtension, extensionFor, sheetFileName } from './exportHelpers'

interface Props {
  state: Extract<AppState, { step: 'export' }>
  dispatch: Dispatch<AppAction>
  onRerun: () => void
}

const UPSCALE_TOLERANCE = 1.25

export function ExportStep({ state, dispatch, onRerun }: Props) {
  const { brief, options, result } = state
  const encoded = useEncodedSheets(result.output)
  const blobs = useMemo(
    () => (encoded.status === 'ready' ? [encoded.directions.blob, encoded.reactions.blob] : [null, null]),
    [encoded],
  )
  const [directionsUrl, reactionsUrl] = useObjectUrls(blobs)

  const displayName = brief.name.trim() || 'mascot'
  const slug = slugify(displayName)
  const embed = useMemo(
    () => buildEmbed({ name: displayName, basePath: '/mascots', size: options.previewSize, label: displayName }),
    [displayName, options.previewSize],
  )
  const ext = encoded.status === 'ready' ? extensionFor(encoded.directions.mimeType) : 'webp'
  const sourceCell = result.directions.slice?.cells[0]?.image.width ?? 0
  const upscaled = sourceCell > 0 && options.cellSize > sourceCell * UPSCALE_TOLERANCE
  const sizeChanged = options.cellSize !== result.output.cellSize
  const update = (patch: Partial<UiOptions>): void => dispatch({ type: 'options/update', patch })

  const downloads: readonly { label: string; get: () => void }[] =
    encoded.status === 'ready'
      ? [
          { label: `${sheetFileName(slug, 'directions', ext)}`, get: () => triggerDownload(encoded.directions.blob, sheetFileName(slug, 'directions', ext)) },
          { label: `${sheetFileName(slug, 'reactions', ext)}`, get: () => triggerDownload(encoded.reactions.blob, sheetFileName(slug, 'reactions', ext)) },
          { label: 'page-mascot.js', get: () => triggerDownload(textBlob(embed.scriptSource, 'text/javascript'), 'page-mascot.js') },
          { label: 'Mascot.tsx', get: () => triggerDownload(textBlob(embed.componentSource, 'text/typescript'), 'Mascot.tsx') },
        ]
      : []

  return (
    <div className="step">
      <h2 tabIndex={-1}>Your mascot is ready</h2>

      <div className="export-grid">
        <div className="stage-wrap">
          <PreviewStage bg={options.previewBg}>
            {directionsUrl && reactionsUrl ? (
              <Mascot directions={directionsUrl} reactions={reactionsUrl} size={options.previewSize} label={displayName} />
            ) : encoded.status === 'error' ? (
              <p role="alert" className="muted">
                {encoded.message}
              </p>
            ) : (
              <div className="skeleton" style={{ width: options.previewSize, height: options.previewSize }}>
                <span className="spinner" aria-hidden="true" />
                <span role="status" className="sr-only">
                  Preparing your files
                </span>
              </div>
            )}
          </PreviewStage>
          <p className="muted">Move your pointer around it, and click it.</p>
        </div>

        <div className="controls">
          <PreviewControls
            size={options.previewSize}
            bg={options.previewBg}
            onSize={(previewSize) => update({ previewSize })}
            onBg={(previewBg) => update({ previewBg })}
          />
          <div className="field">
            <label htmlFor="cell-size">Image detail</label>
            <select
              id="cell-size"
              value={options.cellSize}
              onChange={(e) => update({ cellSize: Number(e.target.value) })}
            >
              {CELL_SIZE_PRESETS.map((size) => (
                <option key={size} value={size}>
                  {size}px per pose
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              aria-disabled={!sizeChanged}
              onClick={() => {
                if (sizeChanged) onRerun()
              }}
            >
              Rebuild at this size
            </button>
            <span className="muted">
              {sizeChanged
                ? `Your mascot is currently ${result.output.cellSize}px per pose. Rebuilding takes a few seconds.`
                : 'Pick a different size, then rebuild.'}
            </span>
            {upscaled && (
              <span className="field-note">Your source images are smaller than this, so extra detail will look soft.</span>
            )}
          </div>
        </div>
      </div>

      {encoded.status === 'ready' && encoded.directions.usedFallback && (
        <p className="banner" data-tone="ok" role="note">
          Your browser cannot save WEBP files, so the sheets are PNG instead. They are larger but work the same way, and
          the snippets below use the .png names.
        </p>
      )}

      <section aria-labelledby="dl-heading" className="sticker">
        <h3 id="dl-heading">Download</h3>
        {downloads.length === 0 ? (
          <ul className="downloads" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="skeleton-btn" />
            ))}
          </ul>
        ) : (
          <ul className="downloads">
            {downloads.map((d) => (
              <li key={d.label}>
                <button type="button" className="btn" onClick={d.get}>
                  {d.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="embed-heading" className="sticker">
        <h3 id="embed-heading">Add it to your site</h3>
        <p className="muted">Put the four files above in your site&apos;s /mascots folder, then paste a snippet.</p>
        <SnippetTabs
          react={adaptSnippetExtension(embed.react, slug, ext)}
          html={adaptSnippetExtension(embed.html, slug, ext)}
        />
      </section>

      <div className="actions">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'nav/goto', step: 'review' })}>
          Back to checks
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'reset' })}>
          Start a new mascot
        </button>
      </div>
    </div>
  )
}
