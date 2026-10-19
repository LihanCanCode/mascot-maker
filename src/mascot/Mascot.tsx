/**
 * Mascot -- a clickable, cursor-following sprite-sheet mascot.
 *
 * Adapted from page-mascot (MIT License, Copyright (c) 2026 Kamran Ahmed) and shipped with
 * your mascot by mascot-maker. This file imports only from 'react' so it drops into any project.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

const DIRECTIONS = [
  'up-left',
  'up',
  'up-right',
  'left',
  'center',
  'right',
  'down-left',
  'down',
  'down-right',
] as const

const REACTIONS = [
  'blink',
  'heart',
  'sparkle',
  'surprised',
  'wink',
  'bashful',
  'sleepy',
  'dizzy',
  'delighted',
] as const

type Direction = (typeof DIRECTIONS)[number]
type Reaction = (typeof REACTIONS)[number]

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE: Direction[] = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]
const SECTOR = (Math.PI * 2) / CLOCKWISE.length
const HYSTERESIS = 0.12
const DEAD_ZONE = 70

const PAYOFFS: Reaction[] = ['heart', 'sparkle', 'delighted']
const BOOP_PAYOFF = 120
const BOOP_END = 560
const SQUASH_MS = 420
const DIZZY_AFTER = 4
const DIZZY_WINDOW = 1600
const DIZZY_END = 1100

const SQUASH: Keyframe[] = [
  { transform: 'scale(1, 1)', easing: 'ease-in' },
  { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
  { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
  { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
  { transform: 'scale(1, 1)' },
]

// background-size 300% makes each cell a clean 0/50/100% step on both axes.
function cell(index: number): CSSProperties {
  return { backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }
}

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** A quoted, escaped css url(): a path containing quotes or parentheses cannot break out. */
function cssUrl(value: string) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n|\r/g, '\\a ')
  return `url("${escaped}")`
}

function mediaMatches(query: string) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

/**
 * Which of the eight sectors the pointer (dx, dy from the mascot's centre) is in:
 * -1 inside the dead zone (look straight ahead), `current` while the pointer is still
 * within the hysteresis margin of it, otherwise the new sector index into CLOCKWISE.
 */
export function sectorFor(dx: number, dy: number, current: number): number {
  if (Math.hypot(dx, dy) < DEAD_ZONE) {
    return -1
  }
  const angle = Math.atan2(dy, dx)
  if (current !== -1 && Math.abs(wrap(angle - current * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
    return current
  }
  return (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length
}

const layer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: '300% 300%',
  backgroundRepeat: 'no-repeat',
}

function useAim(buttonRef: RefObject<HTMLButtonElement | null>): Direction {
  const [direction, setDirection] = useState<Direction>('center')

  useEffect(() => {
    if (!mediaMatches('(hover: hover) and (pointer: fine)')) {
      return
    }

    let sector = -1
    let pointer: { x: number; y: number } | null = null

    const aim = () => {
      const button = buttonRef.current
      if (!button || !pointer) {
        return
      }
      const box = button.getBoundingClientRect()
      sector = sectorFor(pointer.x - (box.left + box.width / 2), pointer.y - (box.top + box.height / 2), sector)
      setDirection(sector === -1 ? 'center' : (CLOCKWISE[sector] ?? 'center'))
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      aim()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', aim, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', aim)
    }
  }, [buttonRef])

  return direction
}

function useBoop(squashRef: RefObject<HTMLSpanElement | null>) {
  const timersRef = useRef<number[]>([])
  const boopsRef = useRef({ count: 0, at: 0 })
  const [reaction, setReaction] = useState<Reaction | null>(null)

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const boop = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []

    const later = (ms: number, next: Reaction | null) => {
      timersRef.current.push(window.setTimeout(() => setReaction(next), ms))
    }

    const now = Date.now()
    const previous = boopsRef.current
    const count = now - previous.at < DIZZY_WINDOW ? previous.count + 1 : 1
    boopsRef.current = { count: count >= DIZZY_AFTER ? 0 : count, at: now }

    if (count >= DIZZY_AFTER) {
      setReaction('dizzy')
      later(DIZZY_END, null)
    } else {
      setReaction('blink')
      later(BOOP_PAYOFF, PAYOFFS[(count - 1) % PAYOFFS.length] ?? 'heart')
      later(BOOP_END, null)
    }

    const element = squashRef.current
    if (mediaMatches('(prefers-reduced-motion: reduce)') || !element || typeof element.animate !== 'function') {
      return
    }

    // Per-keyframe easing with the effect itself linear: an easing on the effect
    // would reinterpret every offset and front-load the whole bounce.
    element.animate(SQUASH, { duration: SQUASH_MS, easing: 'linear' })
  }

  return { reaction, boop }
}

export type MascotProps = {
  /** The 3x3 sheet of head directions. A served path, or an imported image. */
  directions: string
  /** The 3x3 sheet of expressions. */
  reactions: string
  size?: number
  className?: string
  /** What a screen reader calls it. */
  label?: string
}

export function Mascot(props: MascotProps) {
  const { directions, reactions, size = 140, className, label = 'mascot' } = props

  const buttonRef = useRef<HTMLButtonElement>(null)
  const squashRef = useRef<HTMLSpanElement>(null)
  const direction = useAim(buttonRef)
  const { reaction, boop } = useBoop(squashRef)

  // Inline styles so the file drops into any project without a CSS framework.
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={boop}
      aria-label={`Boop the ${label}`}
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: 0,
        background: 'transparent',
        appearance: 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span
        ref={squashRef}
        style={{ position: 'relative', display: 'block', width: '100%', height: '100%', transformOrigin: '50% 78%' }}
      >
        <span
          style={{
            ...layer,
            backgroundImage: cssUrl(directions),
            ...cell(DIRECTIONS.indexOf(direction)),
            opacity: reaction ? 0 : 1,
          }}
        />
        {/* Always mounted so the sheet is fetched up front, never on the first click. */}
        <span
          style={{
            ...layer,
            backgroundImage: cssUrl(reactions),
            ...cell(REACTIONS.indexOf(reaction ?? 'blink')),
            opacity: reaction ? 1 : 0,
          }}
        />
      </span>
    </button>
  )
}
