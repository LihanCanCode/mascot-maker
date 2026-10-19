/**
 * Tiny DOM matchers so component tests do not need an extra dependency (jest-dom).
 * Import this file for its side effect from a jsdom test.
 */
import { expect } from 'vitest'

interface MatcherResult {
  pass: boolean
  message: () => string
}

const result = (pass: boolean, text: string): MatcherResult => ({ pass, message: () => text })

expect.extend({
  toBeInTheDocument(received: Element | null): MatcherResult {
    return result(received !== null && received.ownerDocument.contains(received), 'expected element to be in the document')
  },
  toHaveTextContent(received: Element, expected: string): MatcherResult {
    const text = received.textContent ?? ''
    return result(text.includes(expected), `expected "${text}" to contain "${expected}"`)
  },
  toHaveAttribute(received: Element, name: string, value?: string): MatcherResult {
    const actual = received.getAttribute(name)
    const pass = value === undefined ? actual !== null : actual === value
    return result(pass, `expected attribute ${name} to be ${String(value)}, got ${String(actual)}`)
  },
  toHaveFocus(received: Element): MatcherResult {
    return result(received.ownerDocument.activeElement === received, 'expected element to have focus')
  },
  toBeDisabled(received: HTMLButtonElement): MatcherResult {
    return result(received.disabled, 'expected element to be disabled')
  },
  toBeEmptyDOMElement(received: Element): MatcherResult {
    return result(received.innerHTML === '', 'expected element to be empty')
  },
})

declare module 'vitest' {
  interface Assertion {
    toBeInTheDocument(): void
    toHaveTextContent(text: string): void
    toHaveAttribute(name: string, value?: string): void
    toHaveFocus(): void
    toBeDisabled(): void
    toBeEmptyDOMElement(): void
  }
  interface AsymmetricMatchersContaining {
    toBeInTheDocument(): void
  }
}
