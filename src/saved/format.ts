const KB = 1024
const MB = KB * 1024

/** Rounded to something a person can read; the exact byte count helps nobody. */
export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} bytes`
  if (bytes < MB) return `${Math.round(bytes / KB)} kB`
  return `${(bytes / MB).toFixed(1)} MB`
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatUsage(bytes: number, count: number): string {
  const mascots = count === 1 ? '1 mascot' : `${count} mascots`
  return `${mascots}, ${formatBytes(bytes)} in this browser`
}
