// Static server for dist/ that applies the production headers from public/_headers. Usage: node csp-server.mjs <port>
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const port = Number(process.argv[2] ?? 4392)

/** Parse the indented header lines of the `/*` block of the Netlify/Cloudflare-style _headers file. */
function parseHeaders(text) {
  const headers = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(' ') && !line.startsWith('\t')) continue
    const i = line.indexOf(':')
    if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return headers
}
const headers = parseHeaders(readFileSync(join(root, 'public', '_headers'), 'utf8'))
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let file = normalize(join(dist, decodeURIComponent(url.pathname)))
  if (!file.startsWith(dist)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
  res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(port, '127.0.0.1', () => console.log(`csp server on ${port}`))
