/**
 * Mascot studio contracts: the config, its option unions, and the rig/pose shapes shared by
 * every drawing module. DOM-free: canvases are injected through `CanvasFactory`.
 */

/** The 2D context surface the rig uses (structurally satisfied by DOM, Offscreen and node canvases). */
export type Ctx = CanvasRenderingContext2D

export interface CanvasLike {
  width: number
  height: number
  getContext(id: '2d'): Ctx | null
}
export type CanvasFactory = (width: number, height: number) => CanvasLike

export type Build = (c: Ctx) => void

export const FACE_SHAPES = ['round', 'oval', 'square', 'heart'] as const
export const EAR_TYPES = ['human', 'cat', 'bear', 'fox', 'bunny', 'bolt'] as const
export const CHEEK_FLUFFS = ['none', 'ruff', 'fluff'] as const
export const EYE_PATCHES = ['none', 'oval'] as const
export const HAIR_STYLES = ['none', 'messy', 'bob', 'buzz', 'bun', 'ponytail', 'curly'] as const
export const GLASSES = ['none', 'round', 'square'] as const
export const FACIAL_HAIRS = ['none', 'stubble', 'moustache', 'beard'] as const
export const HEADWEARS = ['none', 'cap', 'beanie', 'antenna', 'hijab'] as const
export const NECKLINES = ['crew', 'v', 'boat', 'turtle', 'collar', 'scarf'] as const
export const SHIRT_DETAILS = ['none', 'stripe', 'badge'] as const
export const EYE_SIZES = ['small', 'medium', 'large'] as const
export const LASHES = ['none', 'soft', 'long'] as const
export const LIDS = ['normal', 'heavy', 'sleepy'] as const
export const BROW_STYLES = ['soft', 'bold', 'thin', 'arched'] as const

export type FaceShape = (typeof FACE_SHAPES)[number]
export type EarType = (typeof EAR_TYPES)[number]
export type CheekFluff = (typeof CHEEK_FLUFFS)[number]
export type EyePatch = (typeof EYE_PATCHES)[number]
export type HairStyle = (typeof HAIR_STYLES)[number]
export type GlassesStyle = (typeof GLASSES)[number]
export type FacialHair = (typeof FACIAL_HAIRS)[number]
export type Headwear = (typeof HEADWEARS)[number]
export type Neckline = (typeof NECKLINES)[number]
export type ShirtDetail = (typeof SHIRT_DETAILS)[number]
export type EyeSize = (typeof EYE_SIZES)[number]
export type Lashes = (typeof LASHES)[number]
export type Lids = (typeof LIDS)[number]
export type BrowStyle = (typeof BROW_STYLES)[number]

/** Every colour is a `#rrggbb` string after `normaliseConfig`. */
export interface StudioConfig {
  readonly skin: string
  readonly muzzle: string
  readonly earInner: string
  readonly earTip: string
  /** Outer ear colour for bear ears; null = same as skin (panda uses black). */
  readonly earColor: string | null
  readonly noseColor: string
  readonly faceShape: FaceShape
  readonly ears: EarType
  readonly cheekFluff: CheekFluff
  readonly eyePatch: EyePatch
  readonly patchColor: string
  readonly hairStyle: HairStyle
  readonly hairColor: string
  /** null = derive a lighter tone from `hairColor` so dark beards do not merge with the outline. */
  readonly facialHairColor: string | null
  readonly facialHair: FacialHair
  readonly eyeColor: string
  readonly eyeSize: EyeSize
  readonly lashes: Lashes
  readonly lids: Lids
  readonly brows: BrowStyle
  readonly glasses: GlassesStyle
  readonly glassesColor: string
  readonly blush: boolean
  readonly blushColor: string
  readonly headwear: Headwear
  readonly headwearColor: string
  readonly shirt: string
  readonly neckline: Neckline
  readonly shirtDetail: ShirtDetail
  readonly accent: string
  readonly outline: string
}

export type EyeKind = 'open' | 'closed' | 'wide' | 'star' | 'wink' | 'happy' | 'spiral' | 'shy'
export type MouthKind = 'smile' | 'smallsmile' | 'tiny' | 'wavy' | 'o' | 'open' | 'grin'
export type SymbolKind = 'heart' | 'sparkle' | 'zzz'

export interface Expression {
  /** Per-eye kind: [viewer-left, viewer-right]. */
  readonly eyes: readonly [EyeKind, EyeKind]
  readonly mouth: MouthKind
  readonly brow: number
  /** Inner brow ends raised (worried / shy) when > 0. */
  readonly worry?: number
  readonly blush?: boolean
  readonly hatch?: boolean
  readonly shine?: boolean
  readonly symbol?: SymbolKind
}

export type ExpressionName =
  | 'neutral' | 'blink' | 'heart' | 'sparkle' | 'surprised'
  | 'starstruck' | 'bashful' | 'sleepy' | 'dizzy' | 'delighted'

/** dx, dy in {-1,0,1}; dy < 0 is up. */
export interface Pose {
  readonly dx: number
  readonly dy: number
  readonly expr: ExpressionName
}

export interface Pt {
  readonly x: number
  readonly y: number
}
/** z > 0 faces the viewer; sx is the horizontal foreshortening. */
export interface ProjPt extends Pt {
  readonly z: number
  readonly sx: number
}
/** [theta, phi, optionalDepth] on the virtual face sphere. */
export type SpherePt = readonly [number, number, number?]

export interface Palette {
  readonly line: string
  readonly skin: string
  readonly skinShade: string
  readonly skinHi: string
  readonly skinDeep: string
  readonly hair: string
  readonly hairShade: string
  readonly hairHi: string
  readonly beard: string
  readonly beardShade: string
  readonly beardHi: string
  readonly shirt: string
  readonly shirtShade: string
  readonly shirtHi: string
  readonly accent: string
  readonly accentShade: string
  readonly muzzle: string
  readonly muzzleShade: string
  readonly hat: string
  readonly hatShade: string
  readonly hatHi: string
  readonly eye: string
  readonly eyeShade: string
  readonly eyeHi: string
  readonly lidFill: string
  readonly blush: string
  readonly mouthIn: string
  readonly tongue: string
}

export interface Rig {
  readonly cfg: StudioConfig
  readonly pal: Palette
  readonly animal: boolean
  readonly dx: number
  readonly dy: number
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  readonly ex: Expression
  /** Point on the head silhouette; t is a canvas angle (PI = left, 1.5 PI = top). */
  sil(t: number, s?: number, ox?: number, oy?: number): Pt
  /** Closed head path (no begin/fill). */
  head(ctx: Ctx, s?: number, ox?: number, oy?: number): void
  proj(theta: number, phi: number, depth?: number, rim?: boolean): ProjPt
  pts(list: readonly SpherePt[], depth?: number, rim?: boolean): ProjPt[]
  /** Run `fn` in a transform placed at P (rotation, horizontal foreshortening). */
  at(ctx: Ctx, P: ProjPt, rot: number, fn: () => void, sx?: number): void
}

export type SheetBackground = 'transparent' | 'green'
export type SheetKind = 'directions' | 'reactions'

export interface RenderOptions {
  /** Cell edge in px (default 512). */
  readonly cell?: number
  readonly background?: SheetBackground
  readonly createCanvas: CanvasFactory
}
