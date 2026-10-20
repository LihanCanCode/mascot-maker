import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

/**
 * jsdom's Blob and File have no `arrayBuffer()` or `text()`, which every real browser
 * has and the store and the importer both need. Node's versions do. Import this for its
 * side effect from a jsdom test that touches saved mascots.
 */
if (typeof new Blob([]).arrayBuffer !== 'function') {
  globalThis.Blob = NodeBlob as unknown as typeof Blob
}
if (typeof new File([], 'x').text !== 'function') {
  globalThis.File = NodeFile as unknown as typeof File
}
