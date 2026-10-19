import { Mascot } from '../mascot/Mascot'
import { PreviewControls, PreviewStage } from '../ui/components/PreviewControls'
import type { UiOptions } from '../ui/state/appReducer'
import { findMascot, sheetUrls, variantsOf, type MascotEntry } from './mascots'

interface Props {
  mascot: MascotEntry
  preview: Pick<UiOptions, 'previewSize' | 'previewBg'>
  onPreview: (patch: Partial<Pick<UiOptions, 'previewSize' | 'previewBg'>>) => void
  onOpen: (slug: string) => void
  onUse: () => void
  onBack: () => void
  onMakeOwn: () => void
}

/** Base character first, then its art-style variants; empty when the character has no variants. */
function styleFamily(mascot: MascotEntry): readonly MascotEntry[] {
  const root = mascot.variantOf ? findMascot(mascot.variantOf) : mascot
  if (!root) return []
  const variants = variantsOf(root.slug)
  return variants.length > 0 ? [root, ...variants] : []
}

function styleLabel(m: MascotEntry): string {
  return m.style ? m.name.replace(/^.*, /, '') : 'Colour'
}

export function MascotDetail({ mascot, preview, onPreview, onOpen, onUse, onBack, onMakeOwn }: Props) {
  const urls = sheetUrls(mascot.slug)
  const family = styleFamily(mascot)
  return (
    <div className="step gallery-detail">
      <button type="button" className="btn btn-small" onClick={onBack}>
        Back to gallery
      </button>
      <h2 tabIndex={-1}>{mascot.name}</h2>
      <div className="export-grid">
        <div className="stage-wrap">
          <PreviewStage bg={preview.previewBg}>
            <Mascot directions={urls.directions} reactions={urls.reactions} size={preview.previewSize} label={mascot.name} />
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
          {family.length > 0 && (
            <fieldset className="field">
              <legend>Art style</legend>
              <div className="seg seg-wrap">
                {family.map((m) => (
                  <label key={m.slug} className="seg-item">
                    <input
                      type="radio"
                      name="gallery-style"
                      checked={m.slug === mascot.slug}
                      onChange={() => onOpen(m.slug)}
                    />
                    <span>{styleLabel(m)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onUse}>
          Use this mascot
        </button>
        <button type="button" className="btn" onClick={onMakeOwn}>
          Make one that looks like you
        </button>
      </div>
    </div>
  )
}
