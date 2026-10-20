/** Running ffmpeg and ffprobe, both of which are expected on PATH. */
import { execFileSync } from 'node:child_process'
import { renameSync, statSync } from 'node:fs'

export function ffmpeg(args: readonly string[]): void {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { stdio: 'inherit' })
}

export interface Probe {
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly seconds: number
  readonly bytes: number
}

export function probe(file: string): Probe {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames:format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=0', file,
  ], { encoding: 'utf8' })
  const field = (name: string): string => {
    const line = out.split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line === undefined ? '' : line.slice(name.length + 1)
  }
  const ratio = field('avg_frame_rate').split('/')
  const num = Number(ratio[0] ?? 0)
  const den = Number(ratio[1] ?? 1)
  const duration = Number(field('duration'))
  const nbFrames = Number(field('nb_frames'))
  const fps = den === 0 ? 0 : num / den
  const seconds = Number.isFinite(duration) && duration > 0
    ? duration
    : (fps > 0 && Number.isFinite(nbFrames) ? nbFrames / fps : 0)
  return {
    width: Number(field('width')),
    height: Number(field('height')),
    fps: Math.round(fps * 100) / 100,
    seconds: Math.round(seconds * 100) / 100,
    bytes: statSync(file).size,
  }
}

export function report(label: string, file: string): Probe {
  const p = probe(file)
  const mb = (p.bytes / (1024 * 1024)).toFixed(2)
  console.log(`${label}  ${p.width}x${p.height}  ${p.fps}fps  ${p.seconds}s  ${mb} MB  ${file}`)
  return p
}

/**
 * The colour at the middle of every frame, one RGB triple per frame.
 *
 * One ffmpeg pass that crops the centre and scales it to a single pixel, which
 * is enough to find the clapper at the head of a recording without decoding
 * hundreds of full frames into memory.
 */
export function centreColours(file: string, fps: number): readonly (readonly [number, number, number])[] {
  const raw = execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', file,
    '-vf', `fps=${fps},crop=16:16:(iw-16)/2:(ih-16)/2,scale=1:1`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { maxBuffer: 1 << 26 })
  const out: [number, number, number][] = []
  for (let i = 0; i + 2 < raw.length; i += 3) {
    out.push([raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0])
  }
  return out
}

/**
 * Re-encode a PNG so it fits a byte budget: first a straight maximum-effort
 * pass, then, only if that is still too big, a 256-colour palette. The app's
 * surfaces are flat fills and type, so quantising them is invisible, but it is
 * worth avoiding on the pictures that carry a rendered character.
 */
export function squeezePng(file: string, maxBytes: number): number {
  const scratch = `${file}.tmp.png`
  const pass = (filter: readonly string[]): void => {
    ffmpeg(['-i', file, ...filter, '-compression_level', '100', scratch])
    renameSync(scratch, file)
  }
  pass([])
  if (statSync(file).size <= maxBytes) return statSync(file).size
  pass(['-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a'])
  return statSync(file).size
}
