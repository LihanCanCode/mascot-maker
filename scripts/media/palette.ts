/**
 * The light-theme values from `src/index.css`, so a rendered frame and a
 * screenshot of the running app are the same colours.
 *
 * Mirrored rather than parsed: these scripts run under node with no CSS engine,
 * and `src/ui/contrast.test.ts` already guards the pairings at the source.
 */
export const PAPER = '#f2f0ff'
export const SURFACE = '#ffffff'
export const SURFACE_2 = '#e8e4ff'
export const INK = '#1b1740'
export const INK_SOFT = '#4a4575'
export const LINE = '#1b1740'
export const VIOLET = '#4a34d8'
export const VIOLET_INK = '#ffffff'
export const SUN = '#ffcf33'
export const SUN_INK = '#1b1740'
export const GOOD = '#0d6b43'
export const GOOD_BG = '#d9f5e6'
export const WARN = '#7a4200'
export const WARN_BG = '#ffecc2'
export const BAD = '#b3261e'
export const BAD_BG = '#ffe0dd'
export const CHECKER_A = '#ffffff'
export const CHECKER_B = '#dcd7f7'

/** The chroma key the prompts ask a chat model for, and the clapper colour. */
export const KEY_GREEN = '#00ff00'
