/**
 * The launch reel: a twenty-second vertical cut for the feeds, and a
 * sixteen-by-nine cut of the same twenty seconds for the timelines.
 *
 *   pnpm run reel
 *
 * Three of the beats are the real application, recorded by Playwright and then
 * given back the cursor it never captured. The opening beat is drawn the same
 * way the README loop is drawn, by running `sectorFor` and `BOOP_TIMING` over a
 * known path, because perfect motion is easier to make than to perform.
 * Everything is composited through one canvas pass, so a recorded beat and a
 * drawn one carry identical captions in identical colours.
 *
 * Every character on screen is drawn by `src/studio` and put through this
 * project's own pipeline. No photograph is opened, and the staged site the
 * shots run against has had page-mascot's gallery artwork removed from it.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { loadImage } from '@napi-rs/canvas'
import { stageSite } from './media/app'
import { captionWidth, drawCaption } from './media/caption'
import type { FrameSize, Tone } from './media/caption'
import { cursorLook, drawClick, drawCursor } from './media/cursor'
import { centreColours, ffmpeg, report } from './media/ffmpeg'
import { drawMascot, tilesOf } from './media/mascot'
import type { MascotTiles } from './media/mascot'
import { INK, INK_SOFT, PAPER, SUN, SURFACE, VIOLET } from './media/palette'
import { cursorAt, recordShot } from './media/record'
import type { Recording, ShotPlan, Size } from './media/record'
import { serve } from './media/serve'
import { LEAD, WRONG, runOn, sheetPair } from './media/sheets'
import { SETUP, checkShot, demoShot } from './media/shots'
import { BODY_FONT, DISPLAY_FONT, MONO_FONT, ctxOf, roundRect, surface } from './media/surface'
import type { Ctx2D } from './media/surface'
import { boopBeat, lap, orbitAt, perform, travel } from './media/runtime'
import type { Frame as Beat, Orbit } from './media/runtime'

const FPS = 30
const SITE = 'lihancancode.github.io/mascot-maker'
const PORT = 4396
const WORK = join('out', 'reel')
const STAGE = join('out', 'reel-site')
const SHEETS = { directions: 'mascots/pip-directions.png', reactions: 'mascots/pip-reactions.png' }

interface Cut {
  readonly kind: 'drawn' | 'clip' | 'endcard'
  /** Which recorded shot, when `kind` is 'clip'. */
  readonly shot: string
  /**
   * First frame of that clip to use, so one recording can span two captions.
   * 'verdict' means "wherever the checker's banner actually appeared", found
   * in the footage rather than guessed -- the app takes a different number of
   * seconds to think in each edition's viewport, so a hardcoded number would
   * be right for one cut and wrong for the other.
   */
  readonly from: number | 'verdict'
  readonly frames: number
  readonly caption: string
  readonly tone: Tone
}

/** Seven beats, in order, totalling twenty seconds. */
const CUTS: readonly Cut[] = [
  { kind: 'drawn', shot: '', from: 0, frames: 118, caption: 'A mascot that watches your cursor', tone: 'ink' },
  { kind: 'clip', shot: 'setup', from: 0, frames: 95, caption: 'Describe it. It writes two prompts.', tone: 'ink' },
  { kind: 'clip', shot: 'setup', from: 95, frames: 55, caption: 'Paste them into your own free chat', tone: 'violet' },
  { kind: 'clip', shot: 'check', from: 16, frames: 90, caption: 'Bring both images back', tone: 'ink' },
  { kind: 'clip', shot: 'check', from: 'verdict', frames: 122, caption: 'It checks them, and names the prompt to redo', tone: 'bad' },
  { kind: 'clip', shot: 'demo', from: 0, frames: 70, caption: 'Then it is live on your page', tone: 'ink' },
  { kind: 'endcard', shot: '', from: 0, frames: 50, caption: 'free, open source, nothing uploaded', tone: 'violet' },
]

const DRAWN_FRAMES = CUTS.filter((c) => c.kind === 'drawn').reduce((n, c) => n + c.frames, 0)
const TOTAL = CUTS.reduce((n, c) => n + c.frames, 0)

interface Edition {
  readonly name: string
  readonly frame: FrameSize
  readonly viewport: Size
  readonly video: Size
  readonly output: string
}

const EDITIONS: readonly Edition[] = [
  {
    name: 'reel',
    frame: { width: 1080, height: 1920 },
    viewport: { width: 540, height: 960 },
    video: { width: 1080, height: 1920 },
    output: join('media', 'mascot-maker-reel.mp4'),
  },
  {
    name: 'wide',
    frame: { width: 1280, height: 720 },
    viewport: { width: 1280, height: 720 },
    video: { width: 1280, height: 720 },
    output: join('media', 'mascot-maker-wide.mp4'),
  },
]

/* ----------------------------- the drawn beat ----------------------------- */

interface Geometry {
  readonly cx: number
  readonly cy: number
  readonly size: number
  readonly orbit: Orbit
  readonly boop: { readonly x: number; readonly y: number }
}

function geometryFor(frame: FrameSize): Geometry {
  const tall = frame.height > frame.width
  const size = Math.round(tall ? frame.width * 0.62 : frame.height * 0.56)
  const cx = frame.width / 2
  const cy = Math.round(frame.height * 0.42)
  const rx = Math.round(frame.width * (tall ? 0.36 : 0.22))
  const ry = Math.round(frame.height * (tall ? 0.2 : 0.29))
  return {
    cx,
    cy,
    size,
    orbit: { cx, cy, rx, ry, from: -Math.PI / 2 },
    boop: { x: cx + size * 0.11, y: cy + size * 0.05 },
  }
}

/** One lap, then three boops: heart, sparkle, delighted. */
function drawnBeats(geometry: Geometry): readonly Beat[] {
  const start = orbitAt(geometry.orbit, 0)
  const moments = [
    ...lap(geometry.orbit, 66),
    ...travel(start, geometry.boop, 8),
    ...boopBeat(geometry.boop, 12),
    ...boopBeat(geometry.boop, 12),
    ...boopBeat(geometry.boop, 20),
  ]
  if (moments.length !== DRAWN_FRAMES) {
    throw new Error(`the drawn beat is ${moments.length} frames, the cut asks for ${DRAWN_FRAMES}`)
  }
  return perform(moments, { fps: FPS, cx: geometry.cx, cy: geometry.cy })
}

function paper(ctx: Ctx2D, frame: FrameSize): void {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, frame.width, frame.height)
  const inset = Math.round(Math.min(frame.width, frame.height) * 0.04)
  const pop = Math.round(inset * 0.18)
  ctx.fillStyle = INK
  roundRect(ctx, inset + pop, inset + pop, frame.width - inset * 2, frame.height - inset * 2, inset / 2)
  ctx.fill()
  ctx.fillStyle = SURFACE
  roundRect(ctx, inset, inset, frame.width - inset * 2, frame.height - inset * 2, inset / 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
}

function paintDrawn(ctx: Ctx2D, frame: FrameSize, tiles: MascotTiles, geometry: Geometry, beat: Beat): void {
  paper(ctx, frame)
  drawMascot(ctx, tiles, {
    cx: geometry.cx, cy: geometry.cy, cell: beat.cell, reaction: beat.reaction, squash: beat.squash,
  })
  if (beat.click !== null) drawClick(ctx, beat.x, beat.y, beat.click, VIOLET)
  drawCursor(ctx, beat.x, beat.y, cursorLook(Math.min(frame.width, frame.height) / 230))
}

function paintEndCard(ctx: Ctx2D, frame: FrameSize, tiles: MascotTiles, index: number): void {
  paper(ctx, frame)
  const unit = Math.min(frame.width, frame.height)
  const rise = Math.min(1, index / 12)
  const tall = frame.height > frame.width
  const cy = Math.round(frame.height * (tall ? 0.33 : 0.30))
  // One blink, late enough that the card has settled and early enough to be seen.
  const blinking = index >= 28 && index < 34
  ctx.save()
  ctx.globalAlpha = rise
  drawMascot(ctx, tiles, { cx: frame.width / 2, cy, cell: 4, reaction: blinking ? 0 : null, squash: null })

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const lift = (1 - rise) * unit * 0.04
  let y = cy + tiles.size * 0.74 + lift
  ctx.fillStyle = INK
  ctx.font = `700 ${Math.round(unit * 0.115)}px "${DISPLAY_FONT}"`
  ctx.fillText('Mascot Maker', frame.width / 2, y)
  y += unit * 0.065
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 ${Math.round(unit * 0.036)}px "${BODY_FONT}"`
  ctx.fillText('A photo and any free chat model, into a page mascot.', frame.width / 2, y)
  y += unit * 0.075
  const url = SITE
  ctx.font = `600 ${Math.round(unit * 0.036)}px "${MONO_FONT}"`
  const w = ctx.measureText(url).width + unit * 0.06
  const h = unit * 0.072
  ctx.fillStyle = SUN
  roundRect(ctx, (frame.width - w) / 2, y - h * 0.72, w, h, h / 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.fillText(url, frame.width / 2, y)
  ctx.restore()
}

/* --------------------------- the recorded beats --------------------------- */

interface Clip {
  readonly files: readonly string[]
  readonly dir: string
  /** Where the clapper ended in the raw recording, kept for the log. */
  readonly zero: number
  readonly scale: number
  readonly recording: Recording
  /** First frame showing the checker's red banner, or null if it never does. */
  readonly verdictAt: number | null
}

function frameFiles(dir: string): readonly string[] {
  return readdirSync(dir).filter((file) => file.endsWith('.jpg')).sort()
}

/** True for the flat chroma green of the clapper. */
function isClap(colour: readonly [number, number, number]): boolean {
  const [r, g, b] = colour
  return g > 150 && r < 130 && b < 150 && g - r > 60 && g - b > 40
}

function extract(recording: Recording, into: string, edition: Edition): Clip {
  rmSync(into, { recursive: true, force: true })
  mkdirSync(into, { recursive: true })
  // The recording also contains everything the shot did to get ready, so the
  // clapper is found first and only the frames after it are written out.
  const colours = centreColours(recording.video, FPS)
  let zero = 0
  colours.forEach((colour, i) => { if (isClap(colour)) zero = i + 1 })
  if (zero === 0) throw new Error(`no clapper found in ${recording.name}; the cursor cannot be synced`)
  ffmpeg([
    '-i', recording.video,
    '-vf', `fps=${FPS},select=gte(n\\,${zero})`, '-fps_mode', 'passthrough',
    '-q:v', '3', '-start_number', '0', join(into, '%05d.jpg'),
  ])
  const files = frameFiles(into)
  return {
    files,
    dir: into,
    zero,
    scale: edition.frame.width / recording.viewport.width,
    recording,
    verdictAt: null,
  }
}

/**
 * The first frame in which the checker's verdict banner is on screen.
 *
 * The banner's background is `--bad-bg`, a colour that appears nowhere else on
 * the page, so counting pixels of it over the top of the frame finds the
 * moment the verdict lands without having to know how long the build took.
 */
async function findVerdict(clip: Clip): Promise<number | null> {
  const probe = surface(240, 240)
  const ctx = ctxOf(probe)
  for (let i = 0; i < clip.files.length; i += 2) {
    const file = clip.files[i]
    if (file === undefined) continue
    const image = await loadImage(join(clip.dir, file))
    // Scaled right down: a 15%-of-frame band of flat colour survives it, and
    // scanning full frames would cost minutes.
    ctx.clearRect(0, 0, 240, 240)
    ctx.drawImage(image, 0, 0, 240, 240)
    const data = ctx.getImageData(0, 0, 240, 144).data
    let hits = 0
    for (let p = 0; p < data.length; p += 4) {
      if (Math.abs((data[p] ?? 0) - 255) < 8 && Math.abs((data[p + 1] ?? 0) - 224) < 12
        && Math.abs((data[p + 2] ?? 0) - 221) < 12) hits += 1
    }
    if (hits / (data.length / 4) > 0.02) return i
  }
  return null
}

/** Where a cut starts in its clip, with a short lead-in before a located moment. */
function startOf(cut: Cut, clip: Clip): number {
  if (cut.from !== 'verdict') return cut.from
  if (clip.verdictAt === null) {
    throw new Error(`no verdict banner was found in the ${clip.recording.name} footage`)
  }
  return Math.max(0, clip.verdictAt - 8)
}

async function paintClip(ctx: Ctx2D, frame: FrameSize, clip: Clip, index: number): Promise<void> {
  const pick = Math.min(index, clip.files.length - 1)
  const file = clip.files[pick]
  if (file === undefined) throw new Error(`no frame ${pick} in ${clip.dir}`)
  ctx.drawImage(await loadImage(join(clip.dir, file)), 0, 0, frame.width, frame.height)
  const where = cursorAt(clip.recording.track, (index * 1000) / FPS)
  // Sized against the footage rather than the frame: the browser painted at
  // `clip.scale` device pixels per CSS pixel, so that is how big a real pointer
  // would have been in these frames.
  if (where !== null) drawCursor(ctx, where.x * clip.scale, where.y * clip.scale, cursorLook(2.1 * clip.scale))
}

/* -------------------------------- assembly -------------------------------- */

/** Every caption has to fit inside the middle 80% of the frame. */
function checkCaptions(frame: FrameSize): void {
  const ctx = ctxOf(surface(frame.width, frame.height))
  for (const cut of CUTS) {
    const share = captionWidth(ctx, cut.caption, frame)
    if (share > 0.92) throw new Error(`the caption "${cut.caption}" takes ${(share * 100).toFixed(0)}% of the frame`)
  }
}

async function build(edition: Edition, browser: Browser, origin: string, tiles: {
  readonly big: MascotTiles
  readonly card: MascotTiles
}, plans: readonly ShotPlan[]): Promise<void> {
  const work = join(WORK, edition.name)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  checkCaptions(edition.frame)

  const clips = new Map<string, Clip>()
  for (const plan of plans) {
    const recording = await recordShot(
      browser, plan, origin, edition.viewport, edition.video, join(work, 'video'),
    )
    const raw = extract(recording, join(work, plan.name), edition)
    const clip: Clip = { ...raw, verdictAt: plan.name === 'check' ? await findVerdict(raw) : null }
    const needed = CUTS.filter((c) => c.shot === plan.name)
      .reduce((n, c) => Math.max(n, startOf(c, clip) + c.frames), 0)
    console.log(`  ${plan.name}: clapper ends at raw frame ${clip.zero}, ${clip.files.length} frames kept `
      + `(the cut needs ${needed}${clip.verdictAt === null ? '' : `, verdict at ${clip.verdictAt}`}), `
      + `${recording.track.length} cursor samples over `
      + `${Math.round(recording.track[recording.track.length - 1]?.t ?? 0)}ms`)
    if (clip.files.length < needed) {
      // Holding the last frame would put a frozen shot in the film. The shot
      // has to be given more tail instead, so this is fatal rather than a note.
      throw new Error(`${plan.name} recorded ${clip.files.length} frames but the cut needs ${needed}; `
        + 'give that shot a longer hold at the end')
    }
    clips.set(plan.name, clip)
  }

  const geometry = geometryFor(edition.frame)
  const beats = drawnBeats(geometry)
  const big = { ...tiles.big, size: geometry.size }
  const card = { ...tiles.card, size: Math.round(Math.min(edition.frame.width, edition.frame.height) * 0.34) }

  const frames = join(work, 'frames')
  mkdirSync(frames, { recursive: true })
  let global = 0
  let drawnAt = 0
  let endAt = 0
  for (const cut of CUTS) {
    const clip = cut.kind === 'clip' ? clips.get(cut.shot) : undefined
    if (cut.kind === 'clip' && clip === undefined) throw new Error(`no clip for ${cut.shot}`)
    for (let i = 0; i < cut.frames; i += 1) {
      const canvas = surface(edition.frame.width, edition.frame.height)
      const ctx = ctxOf(canvas)
      if (cut.kind === 'drawn') {
        const beat = beats[drawnAt]
        if (!beat) throw new Error(`no drawn beat ${drawnAt}`)
        paintDrawn(ctx, edition.frame, big, geometry, beat)
        drawnAt += 1
      } else if (cut.kind === 'endcard') {
        paintEndCard(ctx, edition.frame, card, endAt)
        endAt += 1
      } else if (clip) {
        await paintClip(ctx, edition.frame, clip, startOf(cut, clip) + i)
      }
      drawCaption(ctx, cut.caption, edition.frame, cut.tone)
      writeFileSync(join(frames, `${String(global).padStart(5, '0')}.png`), canvas.toBuffer('image/png'))
      global += 1
    }
  }
  if (global !== TOTAL) throw new Error(`built ${global} frames, expected ${TOTAL}`)

  mkdirSync('media', { recursive: true })
  // A silent stereo track, because several feeds treat a video with no audio
  // stream at all as broken rather than as quiet.
  ffmpeg([
    '-framerate', String(FPS), '-i', join(frames, '%05d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', '4.2', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '96k',
    edition.output,
  ])
  report(edition.name, edition.output)
}

async function main(): Promise<void> {
  const clean = sheetPair('reel', LEAD)
  const result = runOn(clean)
  if (!result.ok) throw new Error('the demonstration pair no longer builds')
  console.log(`pipeline: ${result.report.verdict}, ${result.output.cellSize}px cells`)
  const broken = sheetPair('reel-mismatch', LEAD, WRONG)
  const brokenRun = runOn(broken)
  if (brokenRun.report.verdict !== 'redo') {
    throw new Error(`the mismatched pair now reads "${brokenRun.report.verdict}"; the checker beat needs a real problem`)
  }

  stageSite('dist', STAGE, result.output, 'pip')
  const plans: readonly ShotPlan[] = [SETUP, checkShot(broken), demoShot(SHEETS.directions, SHEETS.reactions)]

  const site = await serve(STAGE, PORT)
  // Playwright records CSS pixels and pads rather than scales when asked for a
  // larger video, so the browser is told to paint at 2x instead. That is what
  // makes a 540px-wide layout come out as a sharp 1080px-wide frame.
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=2'] })
  try {
    const tiles = { big: tilesOf(result.output, 1), card: tilesOf(result.output, 1) }
    for (const edition of EDITIONS) {
      console.log(`${edition.name}: ${edition.frame.width}x${edition.frame.height}, ${TOTAL} frames at ${FPS}fps`)
      await build(edition, browser, site.origin, tiles, plans)
    }
  } finally {
    await browser.close()
    await site.stop()
  }
}

await main()
