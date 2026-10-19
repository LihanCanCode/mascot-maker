// Bundles src/studio (TypeScript) into plain ESM under spikes/studio/out/.bundle so node scripts and
// Playwright pages can import it. Output stays inside the project (D:), never the system temp dir.
import { build } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const outDir = join(root, 'spikes', 'studio', 'out')

/** Bundle `src/studio/<entry>` for node (ssr) and return the absolute path of the emitted module. */
export async function bundleStudio(entry = 'index.ts', name = 'studio-node') {
  const dir = join(outDir, '.bundle', name)
  await build({
    root,
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: join(root, 'src', 'studio', entry),
      outDir: dir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
    },
    ssr: { noExternal: true },
  })
  return join(dir, 'index.mjs')
}

export async function loadStudio() {
  const file = await bundleStudio()
  return import(`${pathToFileURL(file).href}?t=${Date.now()}`)
}
