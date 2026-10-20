/**
 * A static server for `dist/`, so the capture scripts photograph the same
 * production build a visitor would get rather than the dev server's transforms.
 *
 * In-process rather than a spawned `vite preview`: one less child to leave
 * running, and the port is known the moment `listen` resolves.
 */
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

/** Strip leading separators, which would otherwise make `resolve` escape the served root. */
function unrooted(path: string): string {
  let at = 0
  while (at < path.length && (path[at] === '/' || path[at] === sep)) at += 1
  return path.slice(at)
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

export interface Serving {
  readonly origin: string
  stop(): Promise<void>
}

async function fileFor(root: string, urlPath: string): Promise<string | null> {
  const asked = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const clean = unrooted(normalize(asked))
  const target = resolve(root, clean === '' ? 'index.html' : clean)
  if (target !== root && !target.startsWith(root + sep)) return null
  try {
    const info = await stat(target)
    return info.isDirectory() ? join(target, 'index.html') : target
  } catch {
    return null
  }
}

export async function serve(root: string, port: number): Promise<Serving> {
  const base = resolve(root)
  const server: Server = createServer((request, response) => {
    void (async () => {
      const file = await fileFor(base, request.url ?? '/')
      if (file === null) {
        response.writeHead(404).end('not found')
        return
      }
      try {
        const body = await readFile(file)
        response.writeHead(200, {
          'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        }).end(body)
      } catch {
        response.writeHead(404).end('not found')
      }
    })()
  })
  await new Promise<void>((done, fail) => {
    server.once('error', fail)
    server.listen(port, '127.0.0.1', done)
  })
  return {
    origin: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((done) => server.close(() => done())),
  }
}
