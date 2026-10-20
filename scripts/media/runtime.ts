/**
 * Turning a cursor path into frames, using the runtime's own logic.
 *
 * The point of doing it this way rather than by hand is that the pose in every
 * frame comes out of `sectorFor`, threaded through the whole path so the dead
 * zone and the hysteresis are the real ones, and the reaction in every frame
 * comes out of `BOOP_TIMING`. What the animation shows is therefore what a
 * visitor would see, not an impression of it.
 *
 * Nothing here restates a table that the source already owns. The nine cell
 * orders come from `DIRECTION_NAMES` and `REACTION_NAMES` in `src/core/types`,
 * which the sheet format defines, and the sector-to-direction mapping is
 * derived from the sector's own angle rather than copied out of the component.
 */
import { BOOP_TIMING, sectorFor } from '../../src/mascot/Mascot'
import { DIRECTION_NAMES, REACTION_NAMES } from '../../src/core/types'

export interface Point { readonly x: number; readonly y: number }

/** One frame's worth of intent: where the cursor is, and whether it was clicked. */
export interface Moment extends Point {
  readonly boop: boolean
}

export interface Frame extends Point {
  /** Index into the directions sheet, 0..8. */
  readonly cell: number
  /** Index into the reactions sheet, or null when the pose is showing. */
  readonly reaction: number | null
  /** 0..1 through the squash animation, or null when it is not running. */
  readonly squash: number | null
  /** Click-ring progress, 0 to 1, or null when no ring is showing. */
  readonly click: number | null
}

export const CLICK_MS = 300
/** Straight ahead: the cell the component shows inside the dead zone. */
export const CENTRE_CELL = DIRECTION_NAMES.indexOf('center')

/**
 * The direction a sector points at, worked out from its angle.
 *
 * `sectorFor` numbers the sectors clockwise from the right with y pointing
 * down, so sector n sits at n * 45 degrees; rounding that unit vector gives
 * the signs that name it. Deriving it means the component's own table is never
 * transcribed here, and `assertCellMap` proves the derivation agrees with the
 * sheet layout.
 */
function nameForSector(sector: number): string {
  const angle = (sector * Math.PI) / 4
  const dx = Math.round(Math.cos(angle))
  const dy = Math.round(Math.sin(angle))
  const down = dy < 0 ? 'up' : dy > 0 ? 'down' : ''
  const across = dx < 0 ? 'left' : dx > 0 ? 'right' : ''
  if (down !== '' && across !== '') return `${down}-${across}`
  return down !== '' ? down : across
}

export function cellForSector(sector: number): number {
  if (sector === -1) return CENTRE_CELL
  const name = nameForSector(sector)
  const cell = DIRECTION_NAMES.indexOf(name as (typeof DIRECTION_NAMES)[number])
  if (cell < 0) throw new Error(`sector ${sector} named ${name}, which is not a direction`)
  return cell
}

/**
 * The eight sectors plus the dead zone must cover all nine cells exactly once.
 * If a future sheet order or sector order breaks that, the media fails to build
 * rather than quietly showing the wrong face.
 */
export function assertCellMap(): void {
  const cells = [CENTRE_CELL, ...Array.from({ length: 8 }, (_, i) => cellForSector(i))].sort((a, b) => a - b)
  const expected = Array.from({ length: 9 }, (_, i) => i)
  if (cells.join(',') !== expected.join(',')) {
    throw new Error(`the sector-to-cell map is not a permutation of 0..8: ${cells.join(',')}`)
  }
}

function reactionCell(name: string): number {
  const cell = REACTION_NAMES.indexOf(name as (typeof REACTION_NAMES)[number])
  if (cell < 0) throw new Error(`no reaction cell named ${name}`)
  return cell
}

interface Scheduled { readonly at: number; readonly reaction: string | null }

/**
 * `useBoop`, replayed.
 *
 * A boop cancels whatever the previous one had queued, lands 'blink' at once
 * and swaps in the payoff after `payoffAt`; the fourth boop inside
 * `dizzyWindow` gives 'dizzy' instead and resets the run.
 */
class Boops {
  private count = 0
  private at = Number.NEGATIVE_INFINITY
  private queue: readonly Scheduled[] = []
  private showing: string | null = null
  private startedAt = Number.NEGATIVE_INFINITY

  boop(now: number): void {
    const run = now - this.at < BOOP_TIMING.dizzyWindow ? this.count + 1 : 1
    this.count = run >= BOOP_TIMING.dizzyAfter ? 0 : run
    this.at = now
    this.startedAt = now
    if (run >= BOOP_TIMING.dizzyAfter) {
      this.showing = 'dizzy'
      this.queue = [{ at: now + BOOP_TIMING.dizzyEnd, reaction: null }]
      return
    }
    const payoff = BOOP_TIMING.payoffs[(run - 1) % BOOP_TIMING.payoffs.length]
    if (payoff === undefined) throw new Error('the payoff list is empty')
    this.showing = 'blink'
    this.queue = [
      { at: now + BOOP_TIMING.payoffAt, reaction: payoff },
      { at: now + BOOP_TIMING.endAt, reaction: null },
    ]
  }

  /** The reaction cell showing at `now`, and how far through the squash it is. */
  settle(now: number): { reaction: number | null; squash: number | null } {
    for (const step of this.queue) {
      if (step.at <= now) this.showing = step.reaction
    }
    this.queue = this.queue.filter((step) => step.at > now)
    const since = now - this.startedAt
    const squash = since >= 0 && since < BOOP_TIMING.squashMs ? since / BOOP_TIMING.squashMs : null
    return { reaction: this.showing === null ? null : reactionCell(this.showing), squash }
  }

  /** ms since the most recent boop, for the click ring. */
  since(now: number): number {
    return now - this.startedAt
  }
}

export interface PerformOptions {
  readonly fps: number
  /** Centre of the mascot element: what the pointer offset is measured against. */
  readonly cx: number
  readonly cy: number
}

export function perform(moments: readonly Moment[], opts: PerformOptions): readonly Frame[] {
  assertCellMap()
  const step = 1000 / opts.fps
  const boops = new Boops()
  let sector = -1
  return moments.map((moment, i) => {
    const now = i * step
    sector = sectorFor(moment.x - opts.cx, moment.y - opts.cy, sector)
    if (moment.boop) boops.boop(now)
    const settled = boops.settle(now)
    const since = boops.since(now)
    return {
      x: moment.x,
      y: moment.y,
      cell: cellForSector(sector),
      reaction: settled.reaction,
      squash: settled.squash,
      click: since >= 0 && since < CLICK_MS ? since / CLICK_MS : null,
    }
  })
}

/* ----------------------------- path builders ----------------------------- */

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}

export interface Orbit {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  /** Where the lap starts, in radians. -PI/2 is straight above the centre. */
  readonly from: number
}

export function orbitAt(orbit: Orbit, turn: number): Point {
  const angle = orbit.from + turn * Math.PI * 2
  return { x: orbit.cx + orbit.rx * Math.cos(angle), y: orbit.cy + orbit.ry * Math.sin(angle) }
}

/** `count` moments around a closed lap, ending one step short of the start. */
export function lap(orbit: Orbit, count: number): readonly Moment[] {
  return Array.from({ length: count }, (_, i) => ({ ...orbitAt(orbit, i / count), boop: false }))
}

/** `count` moments easing from one point to another, excluding `from`. */
export function travel(from: Point, to: Point, count: number): readonly Moment[] {
  return Array.from({ length: count }, (_, i) => {
    const t = easeInOut((i + 1) / count)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, boop: false }
  })
}

export function still(at: Point, count: number): readonly Moment[] {
  return Array.from({ length: count }, () => ({ ...at, boop: false }))
}

/** A still beat whose first frame carries a boop. */
export function boopBeat(at: Point, count: number): readonly Moment[] {
  return Array.from({ length: count }, (_, i) => ({ ...at, boop: i === 0 }))
}
