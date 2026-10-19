// Writes prompts.json next to this file from the project's real prompt builders.
// Run from the project root:  node spikes/puter/dump-prompts.mjs
// Bundles src/prompts/index.ts with the esbuild already installed for vite (no new deps).
import { writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Use the project's own vite (already installed) to load the TS prompt builders; no new deps.
const { createServer } = await import(pathToFileURL(join(root, 'node_modules/vite/dist/node/index.js')).href)
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } })
try {
  const { directionsPrompt, referencePrompt, reactionsPrompt } = await server.ssrLoadModule('/src/prompts/index.ts')
  const D = 'ZZDESCRIBEZZ' // swapped for the user's description in the page
  const key = 'green'
  const styles = {}
  for (const style of ['colour', 'anime', 'cartoon']) {
    const brief = { name: 'spike', describe: D, style, usePhoto: false, key }
    styles[style] = {
      directions: directionsPrompt(brief, key),
      reference: referencePrompt({ ...brief, usePhoto: true }, key),
      reactions: reactionsPrompt(brief, key),
    }
  }
  writeFileSync(join(root, 'spikes/puter/prompts.json'), JSON.stringify({ placeholder: D, key, styles }, null, 2))
  console.log('wrote spikes/puter/prompts.json')
} finally {
  await server.close()
}
