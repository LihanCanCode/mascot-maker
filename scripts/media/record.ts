/**
 * Recording the real app with Playwright's own video capture.
 *
 * Two problems have to be solved for the footage to be usable. The video has
 * no pointer in it, so the cursor is drawn back on afterwards — which means
 * every position the shot drove has to be kept, with the time it happened. And
 * the video does not start at a time anybody knows, so each recording opens
 * with a clapper: a full-screen chroma-green flash. The compositor finds the
 * last green frame and calls the next one time zero, which pins the drawn
 * cursor to the footage no matter how long the browser took to get going.
 */
import { mkdirSync } from 'node:fs'
import type { Browser, Page } from '@playwright/test'
import { fixTheme } from './app'
import { KEY_GREEN } from './palette'

export interface Point { readonly x: number; readonly y: number }

/** Where the pointer was, in viewport CSS pixels, `t` ms after the clapper. */
export interface CursorSample extends Point { readonly t: number }

export interface Size { readonly width: number; readonly height: number }

/** The moves a shot is allowed to make. Everything is timed and sampled. */
export interface Stage {
  readonly page: Page
  readonly viewport: Size
  at(): Point
  /** Walk the pointer to a point over roughly `ms`. */
  glide(to: Point, ms: number): Promise<void>
  /** Stay put for `ms`. */
  hold(ms: number): Promise<void>
  /** Ease the window scroll to `y` over roughly `ms`; the pointer does not move. */
  scrollTo(y: number, ms: number): Promise<void>
  click(): Promise<void>
  /** Type into whatever has focus, one character at a time. */
  write(text: string, perChar: number): Promise<void>
  /** Page coordinate of the top of an element, for scroll targets. */
  topOf(selector: string): Promise<number>
  /** Run something that is not a pointer move, keeping the cursor track honest. */
  doing(ms: number, action: () => Promise<void>): Promise<void>
}

export interface ShotPlan {
  readonly name: string
  /** Path on the served site. */
  readonly path: string
  /** Everything that should happen before the clapper, and so before time zero. */
  prepare(page: Page): Promise<void>
  drive(stage: Stage): Promise<void>
}

export interface Recording {
  readonly name: string
  readonly video: string
  readonly viewport: Size
  readonly track: readonly CursorSample[]
}

const CLAP_MS = 400
const STEP_MS = 16
/**
 * Dead air before the clapper.
 *
 * Playwright's video is a CDP screencast that begins a moment after the page
 * does, and the opening of a recording can be short by a second or more. A
 * clapper flashed immediately would land in that missing head and the shot
 * could never be synced, so the recording is given time to actually start.
 */
const PREROLL_MS = 1500

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}

/** Flash the whole viewport chroma green, then clear it. Returns the moment it cleared. */
async function clap(page: Page, ms: number): Promise<number> {
  await page.evaluate((colour) => {
    const node = document.createElement('div')
    node.id = 'reel-clap'
    node.style.cssText =
      `position:fixed;inset:0;z-index:2147483647;background:${String(colour)};pointer-events:none`
    document.body.appendChild(node)
  }, KEY_GREEN)
  await page.waitForTimeout(ms)
  await page.evaluate(() => document.getElementById('reel-clap')?.remove())
  return Date.now()
}

function makeStage(page: Page, viewport: Size, zero: number, track: CursorSample[]): Stage {
  let cursor: Point = { x: viewport.width / 2, y: viewport.height / 2 }
  const mark = (): void => { track.push({ t: Date.now() - zero, x: cursor.x, y: cursor.y }) }
  const pace = async (ms: number, step: (fraction: number) => Promise<void>): Promise<void> => {
    const started = Date.now()
    const steps = Math.max(1, Math.round(ms / STEP_MS))
    for (let i = 1; i <= steps; i += 1) {
      await step(i / steps)
      mark()
      const behind = started + (ms * i) / steps - Date.now()
      if (behind > 0) await page.waitForTimeout(behind)
    }
  }

  mark()
  return {
    page,
    viewport,
    at: () => cursor,
    async glide(to, ms) {
      const from = cursor
      await pace(ms, async (fraction) => {
        const e = easeInOut(fraction)
        cursor = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
        await page.mouse.move(cursor.x, cursor.y)
      })
    },
    async hold(ms) {
      mark()
      await page.waitForTimeout(ms)
      mark()
    },
    async scrollTo(y, ms) {
      // Animated inside the page rather than stepped from here: a round trip
      // per step would both stutter the scroll and make the shot run minutes
      // long instead of seconds.
      mark()
      await page.evaluate(([top, over]) => new Promise<void>((done) => {
        const from = window.scrollY
        const began = performance.now()
        const step = (at: number): void => {
          const t = Math.min(1, (at - began) / Number(over))
          const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
          // Explicitly instant: the stylesheet asks for smooth scrolling, and a
          // smooth scroll restarted every frame barely moves at all.
          window.scrollTo({ top: from + (Number(top) - from) * e, behavior: 'instant' })
          if (t < 1) requestAnimationFrame(step)
          else done()
        }
        requestAnimationFrame(step)
      }), [y, ms] as const)
      mark()
    },
    async click() {
      await page.mouse.click(cursor.x, cursor.y)
      mark()
    },
    async write(text, perChar) {
      mark()
      await page.keyboard.type(text, { delay: perChar })
      mark()
    },
    async doing(ms, action) {
      mark()
      const started = Date.now()
      await action()
      const left = ms - (Date.now() - started)
      if (left > 0) await page.waitForTimeout(left)
      mark()
    },
    async topOf(selector) {
      return page.evaluate((target) => {
        const node = document.querySelector(String(target))
        if (node === null) throw new Error(`no element for ${String(target)}`)
        return node.getBoundingClientRect().top + window.scrollY
      }, selector)
    },
  }
}

export async function recordShot(
  browser: Browser,
  plan: ShotPlan,
  origin: string,
  viewport: Size,
  video: Size,
  dir: string,
): Promise<Recording> {
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    recordVideo: { dir, size: video },
  })
  const page = await context.newPage()
  await fixTheme(page, 'light')
  await page.goto(`${origin}${plan.path}`)
  await plan.prepare(page)
  await page.waitForTimeout(PREROLL_MS)

  const track: CursorSample[] = []
  const zero = await clap(page, CLAP_MS)
  await plan.drive(makeStage(page, viewport, zero, track))
  await page.waitForTimeout(250)

  const recorded = page.video()
  if (recorded === null) throw new Error(`no video recorded for ${plan.name}`)
  await context.close()
  return { name: plan.name, video: await recorded.path(), viewport, track }
}

/** The pointer position at `t` ms, interpolated between the samples either side. */
export function cursorAt(track: readonly CursorSample[], t: number): Point | null {
  if (track.length === 0) return null
  const first = track[0]
  const last = track[track.length - 1]
  if (!first || !last) return null
  if (t <= first.t) return first
  if (t >= last.t) return last
  let lo = 0
  for (let i = 1; i < track.length; i += 1) {
    const sample = track[i]
    if (sample && sample.t <= t) lo = i
    else break
  }
  const a = track[lo]
  const b = track[lo + 1]
  if (!a) return null
  if (!b || b.t === a.t) return a
  const f = (t - a.t) / (b.t - a.t)
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
