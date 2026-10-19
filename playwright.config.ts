import { defineConfig, devices } from '@playwright/test'

/** Ports are fixed and uncommon; both servers use strictPort so a clash fails loudly. */
const PLAIN_PORT = 4391
const CSP_PORT = 4392

// Browsers must live on D: (PLAYWRIGHT_BROWSERS_PATH=D:/tools/playwright). Run `pnpm e2e`, which builds first.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './e2e/test-results',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }], ['junit', { outputFile: 'e2e/results.xml' }], ['json', { outputFile: 'e2e/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PLAIN_PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `pnpm exec vite preview --host 127.0.0.1 --port ${PLAIN_PORT} --strictPort`,
      url: `http://127.0.0.1:${PLAIN_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node e2e/csp-server.mjs ${CSP_PORT}`,
      url: `http://127.0.0.1:${CSP_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
