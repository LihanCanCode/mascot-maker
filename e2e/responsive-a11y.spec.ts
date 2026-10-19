import { expect, test, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fillSetup, gotoUpload, happyToExport, shot, uploadFoxes, build } from './helpers'

const WIDTHS = [320, 768, 1440] as const
const SCHEMES = ['light', 'dark'] as const

async function noHorizontalOverflow(page: Page): Promise<{ sw: number; iw: number }> {
  return page.evaluate(() => ({ sw: document.scrollingElement!.scrollWidth, iw: window.innerWidth }))
}

test.describe('e) responsive + a11y', () => {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`screenshots ${width}px ${scheme} (setup, upload, export)`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        await fillSetup(page, 'Foxy Pal')
        await shot(page, `setup-${width}-${scheme}.png`)
        const setup = await noHorizontalOverflow(page)
        await gotoUpload(page)
        await uploadFoxes(page)
        await shot(page, `upload-${width}-${scheme}.png`)
        const upload = await noHorizontalOverflow(page)
        await build(page)
        await shot(page, `review-${width}-${scheme}.png`)
        const review = await noHorizontalOverflow(page)
        await page.getByRole('button', { name: /Continue (anyway|to export)/ }).click()
        await expect(page.getByRole('heading', { name: 'Your mascot is ready' })).toBeVisible()
        await shot(page, `export-${width}-${scheme}.png`)
        const exp = await noHorizontalOverflow(page)
        test.info().annotations.push({ type: 'overflow', description: JSON.stringify({ setup, upload, review, export: exp }) })
        if (width === 320) {
          for (const [name, m] of Object.entries({ setup, upload, review, export: exp })) {
            expect(m.sw, `${name} scrollWidth at 320 (${scheme})`).toBeLessThanOrEqual(m.iw)
          }
        }
      })
    }
  }

  test('theme toggle flips data-theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  })

  test('keyboard-only traversal of Setup', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Describe your mascot' })).toBeVisible()
    await page.getByLabel('What does it look like?').fill('A grey cat in a tiny hat')

    // Walk Tab from the top of the document, recording each stop.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const stops: { label: string; role: string; visible: boolean }[] = []
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const cs = getComputedStyle(el)
        const label =
          el.getAttribute('aria-label') ||
          (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
          el.textContent?.trim().slice(0, 40) ||
          el.tagName
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
        const shadow = cs.boxShadow !== 'none'
        // Hidden radio inputs show focus on their card via :focus-within / :has; accept parent styling.
        const parent = el.closest('label')
        const pcs = parent ? getComputedStyle(parent) : null
        const parentOutline = !!pcs && ((pcs.outlineStyle !== 'none' && parseFloat(pcs.outlineWidth) > 0) || pcs.boxShadow !== 'none')
        return { label, role: el.getAttribute('role') ?? el.tagName.toLowerCase(), visible: outline || shadow || parentOutline }
      })
      stops.push(info)
      if (/I have both images/.test(info.label)) break
    }
    test.info().annotations.push({ type: 'tab-order', description: stops.map((s) => `${s.label}${s.visible ? '' : ' [NO FOCUS RING]'}`).join(' > ') })
    const labels = stops.map((s) => s.label)
    const idx = (re: RegExp): number => labels.findIndex((l) => re.test(l))
    expect(idx(/Skip to content/)).toBeGreaterThanOrEqual(0)
    expect(idx(/Name/)).toBeGreaterThan(-1)
    const describeAt = idx(/What does it look like/)
    expect(describeAt).toBeGreaterThan(-1)
    const styleAt = labels.findIndex((l) => /Colour|Flat|Pixel|Sticker|Watercolou?r|Line|Anime|Chibi|3D|Clay/i.test(l))
    expect(styleAt).toBeGreaterThan(describeAt)
    const copyAt = labels.findIndex((l) => /Copy message/.test(l))
    expect(copyAt).toBeGreaterThan(styleAt)
    expect(labels.filter((l) => /Copy message/.test(l)).length).toBe(2)
    expect(labels[labels.length - 1]).toMatch(/I have both images/)
    const invisible = stops.filter((s) => !s.visible)
    expect(invisible.map((s) => s.label), 'stops without a visible focus indicator').toEqual([])

    // Enter on the final button advances to Upload, and focus moves to the new heading.
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Upload your two images' })).toBeFocused()
  })

  test('axe-core (only if already installed)', async ({ page }) => {
    const require = createRequire(import.meta.url)
    let axePath: string | null = null
    try {
      axePath = require.resolve('axe-core')
    } catch {
      axePath = null
    }
    test.skip(axePath === null || !existsSync(axePath), 'axe-core is not installed; not installing per instructions')
    await happyToExport(page)
    await page.addScriptTag({ path: axePath! })
    const results = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (window as any).axe.run()
      return r.violations.map((v: { id: string; impact: string; nodes: unknown[] }) => `${v.id}:${v.impact}:${v.nodes.length}`)
    })
    expect(results).toEqual([])
  })
})
