/** Registers <page-mascot>. Idempotent; the module also calls it on import. */
export declare function definePageMascot(): void

/** Pure sector picker shared with Mascot.tsx: -1 = centre, otherwise an index into the clockwise table. */
export declare function sectorFor(dx: number, dy: number, current: number): number
