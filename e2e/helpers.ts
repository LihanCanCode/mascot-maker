import { expect, type Locator, type Page } from '@playwright/test'
import { join } from 'node:path'

export const FIXTURES = join(import.meta.dirname, 'fixtures')
export const fixture = (name: string): string => join(FIXTURES, name)
export const SCREENSHOTS = join(import.meta.dirname, 'screenshots')
export const CSP_BASE = 'http://127.0.0.1:4392'

export interface Watch {
  requests: { url: string; type: string; method: string }[]
  consoleErrors: string[]
  pageErrors: string[]
  cspViolations: string[]
}

/** Record requests, console errors and CSP violations. Call BEFORE page.goto. */
export async function watch(page: Page): Promise<Watch> {
  const w: Watch = { requests: [], consoleErrors: [], pageErrors: [], cspViolations: [] }
  page.on('request', (r) => w.requests.push({ url: r.url(), type: r.resourceType(), method: r.method() }))
  page.on('console', (m) => {
    if (m.type() === 'error') w.consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => w.pageErrors.push(String(e)))
  await page.exposeFunction('__reportCsp', (s: string) => w.cspViolations.push(s))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (window as unknown as { __reportCsp: (s: string) => void }).__reportCsp
      report(`${e.violatedDirective} blocked ${e.blockedURI}`)
    })
  })
  return w
}

export async function fillSetup(page: Page, name = 'Foxy Pal'): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('What does it look like?').fill('An orange fox with a white-tipped tail, round glasses and a green scarf')
}

export async function gotoUpload(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'I have both images' }).click()
  await expect(page.getByRole('heading', { name: 'Upload your two images' })).toBeVisible()
}

export function fileInput(page: Page, sheet: 'directions' | 'reactions'): Locator {
  return page
    .locator('.dropzone-wrap')
    .filter({ hasText: sheet === 'directions' ? 'Directions image' : 'Reactions image' })
    .locator('input[type=file]')
}

export async function uploadFoxes(page: Page, directions = 'fox-directions-green.png'): Promise<void> {
  await fileInput(page, 'directions').setInputFiles(fixture(directions))
  await fileInput(page, 'reactions').setInputFiles(fixture('fox-reactions-green.png'))
  await expect(page.getByAltText('Preview of your directions image')).toBeVisible()
  await expect(page.getByAltText('Preview of your reactions image')).toBeVisible()
}

/** Click Build and wait for the review step; returns build wall time in ms. */
export async function build(page: Page): Promise<number> {
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Build my mascot' }).click()
  await expect(page.getByRole('heading', { name: 'Check the result' })).toBeVisible({ timeout: 60_000 })
  return Date.now() - t0
}

export async function toExport(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Continue (anyway|to export)/ }).click()
  await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
}

export function sprite(page: Page): Locator {
  return page.getByRole('button', { name: /^Boop the/ }).locator('> span > span').first()
}
export function reactionLayer(page: Page): Locator {
  return page.getByRole('button', { name: /^Boop the/ }).locator('> span > span').nth(1)
}

/** Full happy path up to the Export step. Returns the build time. */
export async function happyToExport(page: Page, name = 'Foxy Pal'): Promise<number> {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
  await fillSetup(page, name)
  await gotoUpload(page)
  await uploadFoxes(page)
  const ms = await build(page)
  await expect(page.getByRole('status').filter({ hasText: /Looking good|Usable, with a few notes/ })).toBeVisible()
  await toExport(page)
  return ms
}

export async function shot(page: Page, name: string): Promise<string> {
  const path = join(SCREENSHOTS, name)
  await page.screenshot({ path, fullPage: true })
  return path
}

/** Read width/height of a PNG or WEBP buffer; null when neither. */
export function imageSize(buf: Buffer): { type: 'png' | 'webp'; width: number; height: number } | null {
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const fourcc = buf.subarray(12, 16).toString('latin1')
    if (fourcc === 'VP8X') return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
    if (fourcc === 'VP8L') {
      const b = buf.readUInt32LE(21)
      return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
    }
    if (fourcc === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  return null
}
