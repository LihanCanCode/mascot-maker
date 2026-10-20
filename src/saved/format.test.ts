import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate, formatUsage } from './format'

describe('formatBytes', () => {
  it('reads as bytes, kilobytes or megabytes', () => {
    expect(formatBytes(0)).toBe('0 bytes')
    expect(formatBytes(512)).toBe('512 bytes')
    expect(formatBytes(2048)).toBe('2 kB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('formatUsage', () => {
  it('counts one mascot in the singular', () => {
    expect(formatUsage(1024, 1)).toBe('1 mascot, 1 kB in this browser')
    expect(formatUsage(0, 0)).toBe('0 mascots, 0 bytes in this browser')
  })
})

describe('formatDate', () => {
  it('gives a short readable date', () => {
    expect(formatDate(Date.UTC(2026, 0, 15, 12))).toMatch(/2026/)
  })
})
