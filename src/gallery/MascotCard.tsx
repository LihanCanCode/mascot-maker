import { useRef } from 'react'
import { sheetUrls, type MascotEntry } from './mascots'
import { useNearViewport } from './useNearViewport'

interface Props {
  mascot: MascotEntry
  onOpen: (slug: string) => void
}

const SINGULAR: Readonly<Record<MascotEntry['tag'], string>> = {
  animal: 'Animal',
  person: 'Person',
  robot: 'Robot',
  object: 'Object',
}

/** One gallery card. Its picture (the centre-facing pose) is only fetched when it nears the viewport. */
export function MascotCard({ mascot, onOpen }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const near = useNearViewport(ref)
  return (
    <button
      type="button"
      className="gcard"
      aria-label={`${mascot.name}, ${SINGULAR[mascot.tag].toLowerCase()}`}
      onClick={() => onOpen(mascot.slug)}
    >
      <span
        ref={ref}
        className="gcard-pose"
        data-loaded={near}
        aria-hidden="true"
        style={near ? { backgroundImage: `url("${sheetUrls(mascot.slug).directions}")` } : undefined}
      />
      <span className="gcard-name">{mascot.name}</span>
      <span className="gcard-tag">{mascot.style ?? SINGULAR[mascot.tag]}</span>
    </button>
  )
}
