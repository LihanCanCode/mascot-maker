import { expect, test } from '@playwright/test'
import { build, fillSetup, gotoUpload, uploadFoxes } from './helpers'

test('f) build timing and JS heap with the fox sheets', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.goto('/')
  await fillSetup(page)
  await gotoUpload(page)
  await uploadFoxes(page)

  const before = await cdp.send('Performance.getMetrics')
  const heap0 = before.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0
  let peak = heap0
  const sampler = setInterval(() => {
    void cdp
      .send('Performance.getMetrics')
      .then((r) => {
        peak = Math.max(peak, r.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0)
      })
      .catch(() => undefined)
  }, 50)
  const ms = await build(page)
  clearInterval(sampler)
  const after = await cdp.send('Performance.getMetrics')
  const heap1 = after.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0
  peak = Math.max(peak, heap1)
  const mb = (n: number): string => (n / 1048576).toFixed(1)
  const line = `build=${ms}ms main-thread JSHeapUsed before=${mb(heap0)}MB peak=${mb(peak)}MB after=${mb(heap1)}MB (worker heap not visible to page CDP)`
  console.log(`PERF ${line}`)
  test.info().annotations.push({ type: 'perf', description: line })
  expect(ms).toBeLessThan(30_000)
})
