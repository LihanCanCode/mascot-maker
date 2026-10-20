/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so the build needs to know
// its prefix. Unset means the root, which is what a local build and the dev
// server want.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two pages: the app and the demo landing page.
      input: { main: 'index.html', demo: 'demo.html' },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Core tests build megapixel synthetic sheets; coverage runs are slower still.
    testTimeout: 60_000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/prompts/**', 'src/embed/**', 'src/ui/state/**', 'src/adapters/fileCheck.ts'],
      exclude: ['**/__fixtures__/**', 'src/core/types.ts', '**/*.test.ts', '**/*.test.tsx'],
      thresholds: { lines: 80, functions: 80, branches: 80 },
    },
  },
})
