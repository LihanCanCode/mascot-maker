# Implementation Plan: mascot-maker (client-side mascot sprite-sheet builder)

## Overview
This plan ports the page-mascot pipeline (`key.py`, `build.py --anchor shoulders`, `screen.py`, `verify.py`, `mascot.py` gating, `generate.py` prompts) to pure TypeScript functions that work on `RawImage`. The UI is a 4-step React reducer app. Image work runs in a module Web Worker, and nothing goes over the network. The core does no DOM work and is tested in Node with synthetic fixtures. Browser decode and encode sit in `src/adapters/`.

I read every reference file named in the brief, plus `SKILL.md`, `LICENSE` and the project's `package.json`, `tsconfig` and `vite.config`. A few facts from that reading shape the design:

- The runtime component is at `_ref/page-mascot/src/mascot.tsx`. An identical copy is at `skills/page-mascot/mascot.tsx`.
- `REACTIONS[4]` is `'wink'` in the component, but the expressions prompt draws index 5 (1-based) as "Starstruck". The boop logic only uses blink, heart, sparkle, dizzy and delighted, so this is cosmetic. Keep the runtime names so the API stays the same.
- `mascot.py` treats palette match below **0.22** as a failure. `design-rules.md` says "refuses anything under 40%". The code wins: below 0.22 is an error, below 0.40 is a warning.
- `prompts.md` says "Saying up front that a second matching sheet is coming measurably helps". `generate.py` does not do this. We add the sentence.
- `build.py` resizes twice with Lanczos, once in `align` and again at crop. We collapse the whole chain into one scale+translate per frame and resample once. That is better quality and avoids 18 large canvases.
- `build.py` assumes both sheets have the same resolution. We add a per-sheet pre-scale so a 1024 directions sheet and a 1536 reactions sheet still align.

---

## 1. Directory layout (single responsibility, each file under 400 lines)

```
src/
  core/
    types.ts                      LEAD  shared contracts + defaults (full contents in section 5)
    raster.ts                     LEAD  createImage, crop, alphaMask, labelComponents, largestComponent, maskBounds
    raster.test.ts                LEAD
    pipelineOptions.ts            A     optionsForStyle(): PipelineOptions
    pipeline.ts                   A     runPipeline(): key -> slice -> measure -> gate -> align -> compose -> validate
    pipeline.test.ts              A     (vi.mock B modules until B lands)
    pipeline.integration.test.ts  A     synthetic + reference sheets end to end (enabled by lead after B merges)
    color/
      lab.ts                      A     sRGB LUT -> Lab, deltaE, hex helpers
    keyer/
      background.ts               A     hasExistingAlpha, detectBackground (corner patches, best 3 of 4), isKeyable, noiseTolerance
      checkerboard.ts             A     detectCheckerboard (port of key.py _region_score/_period_score)
      keyOut.ts                   A     Lab ramp alpha, un-premultiply despill, border-connected protection
      spill.ts                    A     suppressSpill (edge ring), featherAlpha (never raises alpha)
      cornerMarks.ts              A     removeCornerMarks (watermark-like blobs in the sheet's outer corners)
      keySheet.ts                 A     orchestrates in key.py order -> KeyResult
      index.ts                    A     barrel
    slicer/
      ruleLines.ts                A     findRuleLines / eraseRuleLines (drawn grid lines)
      grid.ts                     A     detectGrid (projection gutters near 1/3 and 2/3, else equal thirds)
      bleed.ts                    A     dropBleed (port of build.py drop_bleed)
      reorder.ts                  A     swapOuterColumns (fixes mirrored directions sheet)
      slice.ts                    A     sliceSheet -> SliceResult (+ significantBlobCount)
      index.ts                    A
    measure/
      bands.ts                    B     bodyMask, shoulderBox, headWidth, lowerBand, fitBand
      cellMetrics.ts              B     measureCell -> CellMetrics
      index.ts                    B
    aligner/
      transform.ts                B     compose/invert/apply ScaleTranslate
      warp.ts                     B     warpMask (nearest, inverse map), warpMaskQuarter
      withinSheet.ts              B     per-cell shoulder anchoring + clamp (build.py align)
      crossSheet.ts               B     coarse-to-fine scale/shift search on shoulder silhouettes
      settle.ts                   B     per-reaction-frame vertical settle on lower band
      crop.ts                     B     square crop, bottom anchor 0.93, -> unit tile transforms
      align.ts                    B     alignSheets -> AlignOutcome
      index.ts                    B
    composer/
      sample.ts                   B     premultiplied bilinear with supersampling; nearest
      fade.ts                     B     per-frame bottom fade (smoothstep alpha ramp)
      renderTile.ts               B     one source cell + transform -> square tile
      composeSheet.ts             B     9 tiles -> 3x3 RawImage; composeMascot
      index.ts                    B
    validator/
      advice.ts                   B     code -> {message, fix, redo} plain English (single source of copy)
      sheetChecks.ts              B     key/slice/cell checks per sheet
      verifyMetrics.ts            B     verify.py port on composed tiles (shift, overlap, palette, width)
      pairChecks.ts               B     shoulder spread, head/shoulder ratio, alignment + verify thresholds
      validate.ts                 B     validateSheet, validatePair, buildReport (sort, verdict, canExport)
      index.ts                    B
    __fixtures__/
      opaqueSheets.ts             A     key-colour / checkerboard / gradient / white sheets with busts
      alphaCells.ts               B     already-keyed cells: misaligned, scaled, symbols, clipped
  test/
    draw.ts                       LEAD  seeded PRNG, drawBust/drawCircle/drawRect/fill/checkerboard, expectUnchanged
    assets/                       LEAD  2 reference PNGs copied from _ref/characters/fox (MIT, attributed)
  prompts/
    styles.ts                     C     8 style paragraphs + labels/blurbs
    keyColour.ts                  C     pickKeyColour(describe)
    sections.ts                   C     RULES/EXPRESSIONS/tail text with key substitution
    builders.ts                   C     directionsPrompt, referencePrompt, reactionsPrompt, buildPrompts
    describeLint.ts               C     lintDescription
    chatGuides.ts                 C     Gemini / ChatGPT how-to
    index.ts                      C
  mascot/
    Mascot.tsx                    C     standalone port (imports only 'react'); also shipped raw to users
    index.ts                      C
  embed/
    page-mascot.js                C     framework-free <page-mascot> custom element (shipped raw)
    page-mascot.d.ts              C
    escape.ts                     C     escapeHtmlAttr, escapeJsxString, sanitizeBasePath, slugify
    snippets.ts                   C     reactSnippet, htmlSnippet, buildEmbed (uses ?raw sources)
    index.ts                      C
  adapters/
    fileCheck.ts                  D     magic-byte sniff, size/type limits (pure, Node-testable)
    decode.ts                     D     File -> {RawImage, SheetMeta} (createImageBitmap + OffscreenCanvas, fallback canvas)
    encode.ts                     D     RawImage -> webp Blob (PNG fallback when webp unsupported)
    download.ts                   D     triggerDownload(blob, name), object URL helpers
    index.ts                      D
  worker/
    protocol.ts                   D     request/response message types
    pipeline.worker.ts            D     decode in worker, runPipeline, post progress/result
    client.ts                     D     runInWorker() with main-thread fallback
  ui/
    state/appReducer.ts           D     state machine
    state/selectors.ts            D
    hooks/usePipeline.ts          D
    hooks/useObjectUrls.ts        D     create/revoke lifecycle
    hooks/useClipboard.ts         D
    hooks/useTheme.ts             D
    steps/SetupStep.tsx           D
    steps/UploadStep.tsx          D
    steps/ReviewStep.tsx          D     (processing + report)
    steps/ExportStep.tsx          D     (preview + export)
    components/StepNav.tsx, PromptCard.tsx, CopyButton.tsx, ChatHowTo.tsx, StylePicker.tsx,
               DropZone.tsx, RawImageCanvas.tsx, CellGrid.tsx, IssueList.tsx, MirrorCheck.tsx,
               SnippetTabs.tsx, ThemeToggle.tsx, ProgressBar.tsx          D
  App.tsx, main.tsx, index.css    D
  vite-env.d.ts                   LEAD  /// <reference types="vite/client" /> (needed for ?raw and ?worker)
index.html, public/_headers       D     (CSP and security headers for static hosting)
THIRD_PARTY_NOTICES.md            LEAD  page-mascot MIT text + attribution
```

**Immutability rule for all agents:** never mutate an input `RawImage`, `Mask`, array or options object. Allocating a new buffer and filling it inside the same function is allowed and expected for speed. Every core test wraps its call in `expectUnchanged(input, () => fn(input))` from `src/test/draw.ts`.

---

## 2. Module signatures (exact)

### LEAD: `src/core/raster.ts`
```ts
export function createImage(width: number, height: number, fill?: Rgba): RawImage      // throws RangeError if w/h < 1 or non-integer
export function assertImage(img: RawImage): void                                        // data.length === w*h*4
export function cropImage(img: RawImage, box: Box): RawImage                            // box clamped to bounds; empty -> RangeError
export function withAlpha(img: RawImage, alpha: Uint8Array | Uint8ClampedArray): RawImage
export function alphaMask(img: RawImage, threshold: number): Mask                        // alpha > threshold
export function labelComponents(mask: Mask, connectivity: 4 | 8): Labels                 // iterative (explicit Int32Array stack), no recursion
export function largestComponent(labels: Labels): Mask                                   // empty mask when count === 0; ties -> lowest id
export function componentMask(labels: Labels, ids: ReadonlySet<number>): Mask
export function maskBounds(mask: Mask): Box | null
export function maskArea(mask: Mask): number
export function borderTouchingIds(labels: Labels, band: number): ReadonlySet<number>
```
`src/test/draw.ts` (LEAD): `mulberry32(seed)`, `fillImage(w,h,rgba)`, `drawCircle(img,cx,cy,r,rgba,{antialias})`, `drawRect(img,box,rgba)`, `drawBust(img,{cx,headCy,headR,shoulderW,shoulderH,fill,outline,outlinePx})` (head circle joined to a rounded shoulder block, one connected body, shoulders about 0.66 of head width), `drawCheckerboard(w,h,square,c1,c2)`, `expectUnchanged(img, fn)`, `imageHash(img)`. All return new images.

### A: color / keyer / slicer / pipeline
```ts
// color/lab.ts
export function srgbToLab(c: Rgb): Lab
export function labPlanes(img: RawImage): Float32Array        // interleaved L,a,b per pixel; sRGB->linear via 256-entry LUT
export function deltaE(a: Lab, b: Lab): number               // CIE76, same as key.py
export function rgbToHex(c: Rgb): string                     // '#RRGGBB'
// keyer
export function hasExistingAlpha(img: RawImage): boolean     // share(alpha < 10) > 0.05
export function detectBackground(img: RawImage, tolHigh: number): { colour: Rgb; uniformity: number }
export function isKeyable(colour: Rgb, minSaturation: number): boolean
export function noiseTolerance(img: RawImage, colour: Rgb, base: number): number   // max(base, p95 corner deltaE + 2)
export function detectCheckerboard(img: RawImage): { confidence: number; square: number }
export function keyOut(img: RawImage, colour: Rgb, tolLow: number, tolHigh: number): { image: RawImage; keyedFraction: number; protectedFraction: number }
export function removeCornerMarks(img: RawImage): { image: RawImage; removed: number }
export function suppressSpill(img: RawImage, colour: Rgb, radius: number): RawImage
export function featherAlpha(img: RawImage, radius: number): RawImage
export function keySheet(img: RawImage, options: KeyOptions): KeyResult
// slicer
export function findRuleLines(img: RawImage, options: SliceOptions): { columns: readonly number[]; rows: readonly number[] }
export function eraseRuleLines(img: RawImage, lines: { columns: readonly number[]; rows: readonly number[] }): RawImage
export function detectGrid(img: RawImage, options: SliceOptions): GridSpec
export function dropBleed(cell: RawImage, band: number, alphaThreshold: number): { image: RawImage; removed: number }
export function swapOuterColumns<T>(cells: readonly T[]): T[]                 // [2,1,0,5,4,3,8,7,6] order
export function sliceSheet(img: RawImage, kind: SheetKind, options: SliceOptions, swapColumns: boolean): SliceResult
// pipeline
export function optionsForStyle(style: StylePreset, expected: KeyColourName | null, cellSize: number, swapDirectionColumns: boolean): PipelineOptions
export function runPipeline(input: PipelineInput, options: PipelineOptions, onProgress?: ProgressCallback): PipelineResult
```
`swapOuterColumns` must re-assign `index` so position equals index. `sliceSheet` re-creates `Cell` objects with the corrected index.

### B: measure / aligner / composer / validator
```ts
// measure
export function bodyMask(img: RawImage, alphaThreshold: number): Mask
export function shoulderBox(body: Mask, bandPx: number): Box | null
export function headWidth(body: Mask, headBand: number): number              // headBand = 0.55
export function lowerBand(body: Mask, fromFraction: number): Mask             // rows >= top + fraction*(bottom-top)
export function measureCell(img: RawImage, align: AlignOptions, edgePixels: number): CellMetrics
// aligner
export function composeTransforms(first: ScaleTranslate, then: ScaleTranslate): ScaleTranslate
export function invertTransform(t: ScaleTranslate): ScaleTranslate
export function applyTransform(t: ScaleTranslate, x: number, y: number): { x: number; y: number }
export function warpMask(src: Mask, t: ScaleTranslate, outW: number, outH: number): Mask
export function withinSheetTransforms(dirs: readonly Cell[], dirMetrics: readonly CellMetrics[], cells: readonly Cell[], metrics: readonly CellMetrics[], sheetScale: number, o: AlignOptions): { transforms: readonly ScaleTranslate[]; clamped: readonly boolean[]; anchored: readonly boolean[]; anchorNoise: number; scaleClamp: number; canvas: { width: number; height: number } }
export function fitCrossSheet(dirMasks: readonly Mask[], reactMasks: readonly Mask[], canvas: { width: number; height: number }, o: AlignOptions): CrossSheetFit
export function settleFrames(reference: Mask, frames: readonly Mask[], range: number): readonly number[]
export function computeCrop(contentMasks: readonly Mask[], o: AlignOptions, unit: number): { left: number; top: number; side: number }
export function alignSheets(dirs: readonly Cell[], reacts: readonly Cell[], dirMetrics: readonly CellMetrics[], reactMetrics: readonly CellMetrics[], o: AlignOptions): AlignOutcome
// composer
export function renderTile(cell: RawImage, toTile: ScaleTranslate, o: ComposeOptions): RawImage
export function applyBottomFade(tile: RawImage, depth: number): RawImage
export function composeSheet(tiles: readonly RawImage[], cellSize: number): RawImage
export function composeMascot(dirs: readonly Cell[], reacts: readonly Cell[], alignment: AlignResult, o: ComposeOptions): ComposedMascot
// validator
export function adviceFor(code: IssueCode, sheet: SheetKind | null): { fix: string; redo: RedoTarget }
export function makeIssue(code: IssueCode, severity: Severity, blocking: boolean, sheet: SheetKind | null, cellIndex: CellIndex | null, message: string, metric: number | null): Issue
export function validateSheet(analysis: SheetAnalysis, t: ValidationThresholds): readonly Issue[]
export function computeVerifyMetrics(output: ComposedMascot, t: ValidationThresholds): Pick<QualityMetrics, 'boopShiftPx' | 'minBandOverlap' | 'paletteMatch' | 'widthChange'>
export function validatePair(dirs: SheetAnalysis, reacts: SheetAnalysis, alignment: AlignResult | null, output: ComposedMascot | null, t: ValidationThresholds): { issues: readonly Issue[]; metrics: QualityMetrics }
export function buildReport(issues: readonly Issue[], metrics: QualityMetrics): ValidationReport
```

### C: prompts / Mascot / embed
```ts
// prompts
export const STYLE_PARAGRAPHS: Readonly<Record<StylePreset, string>>
export const STYLE_LABELS: Readonly<Record<StylePreset, { label: string; blurb: string }>>
export function pickKeyColour(describe: string): KeyColourName
export function directionsPrompt(brief: CharacterBrief, key: KeyColourName): string
export function referencePrompt(brief: CharacterBrief, key: KeyColourName): string
export function reactionsPrompt(brief: CharacterBrief, key: KeyColourName): string
export function buildPrompts(brief: CharacterBrief): PromptPair
export function lintDescription(describe: string): readonly DescribeWarning[]
export const CHAT_GUIDES: readonly ChatGuide[]
// mascot/Mascot.tsx  (imports ONLY from 'react'; same public API as the reference)
export type MascotProps = { directions: string; reactions: string; size?: number; className?: string; label?: string }
export function Mascot(props: MascotProps): JSX.Element
export function sectorFor(dx: number, dy: number, current: number): number   // -1 = center; pure, exported for tests
// embed
export function slugify(name: string): string                    // [a-z0-9-], max 40, fallback 'mascot'
export function sanitizeBasePath(p: string): string               // ^(\/|\.\/)[A-Za-z0-9/_.\-]*$ and no '//' ; else '/mascots'
export function escapeHtmlAttr(s: string): string
export function escapeJsxString(s: string): string
export function assetNames(slug: string): EmbedAssetNames
export function reactSnippet(o: EmbedOptions): string
export function htmlSnippet(o: EmbedOptions): string
export function buildEmbed(o: EmbedOptions): EmbedBundle          // componentSource via '../mascot/Mascot.tsx?raw', scriptSource via './page-mascot.js?raw'
// embed/page-mascot.d.ts
export declare function definePageMascot(): void                  // idempotent; module also auto-defines on import
```

### D: adapters / worker / UI
```ts
// adapters/fileCheck.ts (pure)
export type FileCheck = { ok: true; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' } | { ok: false; reason: 'too-large' | 'unsupported-type' | 'heic' | 'empty'; message: string }
export function sniffImageType(head: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic' | null
export function checkFile(sizeBytes: number, head: Uint8Array): FileCheck
// adapters/decode.ts
export async function decodeImageFile(file: Blob, fileName: string, maxSide?: number): Promise<{ image: RawImage; meta: SheetMeta }>
// adapters/encode.ts
export async function encodeImage(img: RawImage, quality?: number): Promise<{ blob: Blob; mimeType: 'image/webp' | 'image/png'; usedFallback: boolean }>
// adapters/download.ts
export function triggerDownload(blob: Blob, fileName: string): void
// worker/protocol.ts
export type WorkerRequest = { type: 'run'; id: number; directions: File; reactions: File; options: PipelineOptions }
export type WorkerResponse =
  | { type: 'progress'; id: number; progress: PipelineProgress }
  | { type: 'done'; id: number; result: PipelineResult }
  | { type: 'error'; id: number; message: string }
// worker/client.ts
export function runInWorker(directions: File, reactions: File, options: PipelineOptions, onProgress: ProgressCallback, signal: AbortSignal): Promise<PipelineResult>
// ui/state/appReducer.ts
export type AppState =
  | { step: 'setup'; brief: CharacterBrief; files: Files; options: UiOptions }
  | { step: 'upload'; brief: CharacterBrief; files: Files; options: UiOptions }
  | { step: 'processing'; brief; files; options; progress: PipelineProgress; runId: number }
  | { step: 'review'; brief; files; options; result: PipelineResult }
  | { step: 'export'; brief; files; options; result: Extract<PipelineResult, { ok: true }> }
export type Files = { directions: FileSlot; reactions: FileSlot }
export type FileSlot = { status: 'empty' } | { status: 'ready'; file: File; previewUrl: string } | { status: 'rejected'; message: string }
export type UiOptions = { cellSize: number; swapDirectionColumns: boolean; previewBg: 'light' | 'dark' | 'checker'; previewSize: number }
export type AppAction =
  | { type: 'brief/update'; patch: Partial<CharacterBrief> }
  | { type: 'nav/goto'; step: 'setup' | 'upload' | 'review' | 'export' }
  | { type: 'file/accepted'; sheet: SheetKind; file: File; previewUrl: string }
  | { type: 'file/rejected'; sheet: SheetKind; message: string }
  | { type: 'file/cleared'; sheet: SheetKind }
  | { type: 'run/started'; runId: number }
  | { type: 'run/progress'; runId: number; progress: PipelineProgress }
  | { type: 'run/finished'; runId: number; result: PipelineResult }
  | { type: 'run/failed'; runId: number; message: string }
  | { type: 'options/update'; patch: Partial<UiOptions> }
  | { type: 'reset' }
export function appReducer(state: AppState, action: AppAction): AppState   // invalid transitions return the same state reference
export const initialState: AppState
```

---

## 3. Module specifications

### (a) Prompts (C)
- **Styles.** Port `colour`, `ink`, `sketch`, `riso`, `paper` and `pixel` verbatim from `generate.py` STYLES. Use the `prompts.md` version of `ink`, which adds the "Keep the big-head chibi proportions... Do NOT make it realistic" sentence. Add two new paragraphs written in the same "ask for appeal" register (design-rules: do not use "flat"):
  - `anime`: "Cute chibi anime sticker art: clean confident dark line art with tapered strokes, very large glossy anime eyes each with two white highlights and a soft gradient iris, a tiny simple nose and mouth, soft pink cheek blush, and crisp cel shading with one shadow tone and one highlight per colour. Hair drawn as defined clumps with a sharp highlight band. Bright, clear, saturated colours. Charming and expressive. Keep the big-head chibi proportions -- not realistic, not semi-realistic, no painterly rendering, no 3D."
  - `cartoon`: "Bold modern animated-series cartoon art: thick confident black outlines, simple rounded shapes, big friendly oval eyes each with a white catchlight, soft pink cheek blush, and bright saturated colours each with one soft shadow tone and a highlight. A clean graphic silhouette that reads at a small size. Playful and expressive. No photorealism, no 3D render, no airbrushed gradients."
- **Key route only.** Chat UIs cannot output alpha, so every prompt uses the `rules(key)` and `tail(key)` substitutions. Prompts never contain `transparen` or `alpha channel`; one mention brings the checkerboard back. The reactions prompt adds "Draw it on the same solid {phrase} background described below." The directions and reference prompts add, after the first paragraph: "This is the first of two matching sheets; a second sheet of the same character will follow, so keep the design simple to repeat exactly."
- **Reactions wording for chat.** "The attached image (the sheet you just drew) is a 3x3 head-direction sprite sheet..." Everything else is from `generate.py` reactions_prompt, including the restated description and "Keep the {style} rendering style... exactly" when the style is not `colour`.
- **Reference route** (`usePhoto: true`, the default because the product is "a mascot of yourself"). Port `reference_prompt` and append the brief's describe text. The second message is always `reactionsPrompt`.
- **`pickKeyColour`.** greenish = `/green|lime|emerald|olive|mint|jade|teal|chartreuse/i`; pinkish = `/magenta|pink|purple|violet|fuchsia|lilac|lavender|mauve/i`. Not greenish gives `green`. Greenish but not pinkish gives `magenta`. Both gives `blue`. `brief.key` (user override) takes precedence in `buildPrompts`.
- **`lintDescription`** warns on: fewer than 4 words (`too-short`); no colour word (`no-colours`); `/long|loose|flowing|waist|braid/` with `hair` and without `tied|bun|ponytail|hat|beanie|cap` (`long-hair`, the most common failure per design-rules); `/holding|with a (mug|staff|guitar|sword|phone)/` (`held-prop`); `/wings|headdress|antlers|wide hat/` (`wide-feature`); `/transparen|alpha|png/` (`mentions-transparency`).
- **CHAT_GUIDES.** Gemini and ChatGPT steps:
  1. Open a new chat.
  2. If you use the photo route, attach your photo.
  3. Paste message 1 and wait.
  4. Download the image at full size; do not screenshot it.
  5. Send message 2 in the same chat with that image attached again.
  6. Download it.

  Tips:
  - If you see a grey-and-white checkerboard, start a NEW chat and do not add any words.
  - Do not retry inside the same chat; the model averages its attempts.
  - Free tiers have daily image limits.
  - Your photo goes to that provider under their terms, never to us.

### (b) Keyer (A), a port of key.py with three additions
`keySheet` order:
1. `hasExistingAlpha` returns `mode: 'existing-alpha'` with a copy of the image.
2. `detectCheckerboard`; confidence of 0.5 or more fails with `'checkerboard'`.
3. `detectBackground`: the median of 4 corner patches, `p = min(40, h/4, w/4)`. **Uniformity** is the mean agreement of the best 3 of the 4 corners, so a Gemini corner watermark cannot sink it. Agreement means Lab dE < tolHigh.
4. If `!isKeyable` (spread < 100), fail with `neutral-background`. If uniformity < 0.9, fail with `non-uniform-background`.
5. `noiseTolerance`: tolLow = max(6, p95 corner dE + 2) and tolHigh = max(26, tolLow + 20). This handles JPEG and webp noise, which key.py would otherwise leave as faint haze.
6. `keyOut`:
   - alpha = clamp((d - tolLow)/(tolHigh - tolLow)).
   - For alpha < 1, rgb' = clamp((rgb - (1 - a')*key)/a') with a' = max(a, 0.04).
   - Label candidates (alpha < 0.999, 8-connected). Components not touching the image border get alpha 1 and their original rgb. This is the green-frog protection.
   - If keyedFraction (alpha < 5/255) < 0.2, fail with `too-little-keyed`.
7. `removeCornerMarks`: in each 10% x 10% sheet corner, erase components that lie fully inside the corner and have area < 1.5% of the sheet. This is the watermark sparkle; characters never sit in sheet corners.
8. `suppressSpill(radius 2)`: only in the ring within `radius` px of alpha < 128. The key-dominant channels D are the key channels at 128 or above; O are the rest. s = max(0, min(D) - max(O)); subtract s from D.
9. `featherAlpha(radius 1, or 0 for pixel style)`: alpha' = min(alpha, box average) on edge pixels only, so it never raises alpha and never creates a key-coloured halo.
10. `expectedDeltaE` = dE(detected, KEY_COLOURS[expected]).

`detectCheckerboard` is an exact port:
- Regions: 4 corner squares with m = min(h,w)/8, plus the 4 gutter bands at h/3, 2h/3, w/3 and 2w/3, each m thick.
- Per region: g = mean RGB. Return 0 if min side < 32 or std < 1.5. hp = g - box blur of size `max(3, min/8)|1` (integral image, clamp edges).
- Search p in 6..min(64, min-2) for the best `corr(diag) - (corr(x) + corr(y))/2`.
- confidence = (second-lowest quadrant score at the best p) / 1.6, clamped to 0..1. Halve it if the top-2 of 32 histogram bins hold < 40% of pixels.
- Overall result: the mean confidence of the top 2 regions with score > 0, and the rounded mean of their p.

### (c) Slicer (A)
`sliceSheet`:
1. `findRuleLines`: columns or rows with alpha>100 coverage of 0.85 or more and thickness ≤ 1% of the side. Erase them (alpha 0).
2. `detectGrid` (when `detectGrid` is set):
   - Compute column and row coverage projections.
   - The content span runs from the first to the last column with coverage > `gutterCoverage` (0.002). If the span is under 50% of the width, use the `equal` method.
   - Expected internal cuts are at x0 + span/3 and x0 + 2·span/3. Search ±`gutterSearch` (0.10) × span for the longest run with coverage ≤ 0.002 and cut at the run's centre. If there is no such run, use the argmin column; confidence for that cut = 1 - clamp(minCoverage/0.05).
   - Outer cuts are 0 and width/height, so margins stay inside the outer cells and alignment absorbs them.
   - Cells may be non-square or slightly unequal. Output tiles are always square.
3. `cropImage` each cell, then `dropBleed(cell, 2, 40)`: erase alpha>40 components that touch the 2-px edge band, except the largest (build.py).
4. If `swapColumns` and the kind is `directions`, apply `swapOuterColumns`.
5. `significantBlobCount`: alpha>100 components on the whole keyed sheet with area ≥ 0.5% of the sheet.

### (d) Aligner (B), a port of build.py `--anchor shoulders`, single-resample design
- **Units.** Canvas px = directions source px. H_d is the median directions cell height. sheetScale = 1 for directions and H_d / median reaction cell height for reactions. `unit = H_d/341` scales constants written "At341" (they were tuned on 1024 sheets).
- **Step 1, within sheet.**
  - Targets cx_t, cy_t and w_t are the means of the directions shoulder-box centre and width.
  - Fewer than 5 anchored direction cells returns `{ok:false,'too-few-anchors'}`.
  - noise = (max w - min w)/w_t. clamp = noise > 0.03 ? 0.10 : 0.35.
  - Per cell (both sheets): k = clamp(w_t/(bw·s0), 1 ± clamp); scale = s0·k; tx = PAD + cx_t - bx·scale; ty = PAD + cy_t - by·scale.
  - PAD = round(W/2). Canvas = (W + 2PAD) × (2H_d + 2PAD).
  - A cell with no shoulder box is centred with scale s0 and gets `anchored: false`.
- **Step 2, cross-sheet** (reactions only).
  - Silhouettes are body masks (alpha>100, largest component), warped at quarter resolution. Keep rows from top + 0.86·(bottom-top) down. Average the 9 per sheet into a Float32.
  - Score = Σmin/Σmax.
  - Coarse search: scale 0.80..1.20 step 0.02 × dy -40..40 step 2 (quarter px). Fine search: ±0.02 step 0.005 × ±3 step 1.
  - Scale about the canvas centre. Ties go to |scale-1| then |dy|.
  - Match transform: p' = (p - C)·c + C + (0, 4·dy). Compose it after step 1.
- **Step 3, settle.**
  - Reference = lower band (alpha>120 body, from 0.66 of its height down) of directions frame 4 at full canvas resolution.
  - For each reaction frame, try dy in ±round(26·unit) and take the best IoU, comparing only rows in the union of the band extents. Ties go to the smallest |dy|.
- **Step 4, crop.**
  - Content masks are alpha>8 for all 18 frames.
  - top = min top - 8·unit; left and right = min and max; bottom = max bottom.
  - side = max(right-left + 16·unit, round((bottom-top)/0.93)).
  - cropLeft = round((left+right)/2 - side/2); cropTop = bottom - round(0.93·side).
  - The crop may extend outside the canvas; samples there are transparent.
  - `toTile = compose(T, {scale:1/side, tx:-cropLeft/side, ty:-cropTop/side})`.
- **Memory.** Masks are 1 byte per pixel and the full-resolution canvas masks exist only per step, so no RGBA canvases are created.

### (e) Validator (B)
Each issue below lists its code, its condition, and severity/blocking ("err-block" = error, blocking). The redo target and fix text come from `advice.ts`.

| code | condition | sev | redo |
|---|---|---|---|
| checkerboard | key fail | err-block | directions→both, reactions→reactions |
| neutral-background / non-uniform-background / too-little-keyed | key fail | err-block | same rule |
| key-colour-mismatch | expectedDeltaE > 25 | warning | none (re-pick key if near-key also fires) |
| existing-alpha, corner-marks-removed, rule-lines-removed, fragments-removed, downscaled | stats | info | none |
| lossy-source | mime jpeg | warning | that sheet ("download the PNG") |
| low-resolution | min cell side < 200 | warning | that sheet |
| odd-aspect | max/min side > 1.6 | warning | that sheet |
| grid-uncertain | confidence < 0.5 | warning | that sheet |
| grid-mismatch | significantBlobCount ≠ 9 | error, non-blocking | that sheet |
| empty-cell | bodyCoverage < 0.005 | err-block, cellIndex | that sheet |
| low-coverage / high-coverage | < 0.03 / > 0.6 | error / warning | that sheet |
| touches-edge | top, left or right band > max(6, 15·unit) px | warning, cell | that sheet |
| touches-bottom | bottom contact | warning, cell | that sheet |
| wide-feature | ≥ 4 cells with left/right contact | error, non-blocking | both (describe the wide feature smaller) |
| size-outlier | body height vs sheet median > ±20% | warning, cell | that sheet |
| character-near-key | translucentFraction > 0.08 | warning, cell | both (switch key colour) |
| body-inconsistent | directions shoulder spread ≥ 8% (≥ 3% gives a warning) | error, non-blocking | both (mascot.py: new directions needs new reactions) |
| shoulders-too-wide | head/shoulder ratio ≥ 1.10 (0.95–1.10 gives info) | warning | both |
| unanchored-cell / scale-clamped | from alignment | warning, cell | that sheet |
| boop-shift | verify shift > 2 px at 140 (> 1 gives a warning) | error, non-blocking | reactions |
| width-change | > 0.12 (> 0.08 gives a warning) | error, non-blocking | reactions (tie hair back) |
| palette-mismatch | < 0.22 (< 0.40 gives a warning) | error, non-blocking | reactions |
| check-mirrored | always on directions | info | none (UI swap toggle) |

- **Verify metrics** are computed on composed tiles at cellSize:
  - Band rows are fixed at 0.55 to 0.78 of the tile; search ±round(24·cellSize/360).
  - Shift in px = |dy|·140/cellSize.
  - Palette: 4096-bin histogram over body ∩ alpha>200 across all 9 cells per sheet, compared by intersection.
  - Width: mean over cells of the max row width in the rows from 0.85 of the body height down.
- **Shoulder spread** is computed on keyed source cells using the body mask, not all opaque pixels as screen.py does, so stray specks cannot inflate it.
- **Report.**
  - Sort order: blocking, error, warning, info; then sheet, then cell.
  - `canExport` = no blocking issues.
  - `verdict` = 'redo' if any error, else 'usable-with-warnings' if any warning, else 'ready'.
- **Copy.** All advice text lives in `advice.ts`. Example fix for a reactions checkerboard: "Start a new chat, attach your directions image, and paste Message 2 exactly as given. Don't add words like 'transparent' or 'PNG'."

### (f) Composer (B)
- `renderTile`: for each output pixel centre, take unit coords and map them through `invert(toTile)` into source pixels.
  - `smooth`: premultiplied bilinear with n×n supersampling, n = clamp(ceil(source px per output px), 1, 4).
  - `nearest`: used for the pixel style.
  - Out of bounds is transparent.
- Then `applyBottomFade` (if `fade`): end = last row with alpha > 40; ramp = smoothstep(clamp((y - (end - depth·S))/(depth·S))); alpha ×= 1 - ramp.
- `composeSheet`: 3×3 placement into a new 3S×3S image.
- Cell size presets are 256, 360 (default, the reference TILE) and 512, with 128..1024 allowed. A 1024 tile from a ~341-px source cell is pure upscaling, so the UI warns when cellSize > source cell size × 1.25.

### (g) Browser adapters (D)
- **Decode:** `createImageBitmap(blob, {imageOrientation:'from-image', premultiplyAlpha:'none', colorSpaceConversion:'default'})`. If max side > 2048, decode again with `resizeWidth/resizeHeight, resizeQuality:'high'`. Then draw to `OffscreenCanvas` (`getContext('2d',{willReadFrequently:true, colorSpace:'srgb'})`) and call `getImageData`. Fall back to `document.createElement('canvas')` when OffscreenCanvas is missing. Close the bitmaps afterwards.
- **Encode:** `putImageData` then `convertToBlob({type:'image/webp', quality:0.92})`. If `blob.type !== 'image/webp'` (Safari), re-encode as PNG and set `usedFallback`.
- **File checks:** at most 20 MB; magic bytes only (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF....WEBP`); HEIC gets specific advice; min side 300 and max 8192 after decode.

### (h) Mascot component (C)
Copy `src/mascot.tsx` logic exactly: 9 directions, 9 reactions, CLOCKWISE sectors, HYSTERESIS 0.12, DEAD_ZONE 70, boop blink→payoff at 120 ms→null at 560 ms, dizzy after 4 boops within 1600 ms, squash keyframes, reduced-motion gate, `(hover: hover) and (pointer: fine)` gate, 300% background-size, the reactions layer always mounted.

Changes:
- Quote and escape the `url("...")` value (escape `\` and `"`).
- Extract `sectorFor` as a pure function.
- Add an attribution header.
- The file must import only `react`, because it is shipped raw as the user's `Mascot.tsx`.

### (i) Embed (C)
`page-mascot.js` is an ES2019 vanilla custom element (`customElements.get` guard). It has a shadow DOM button with two spans, the same constants and logic, observed attributes `directions reactions size label`, listener and timer cleanup in `disconnectedCallback`, and a `typeof matchMedia === 'function'` guard.

The two snippets:
- **React:** `import { Mascot } from './Mascot'` plus `<Mascot directions="{base}/{slug}-directions.webp" reactions="…" size={140} label="…" />`.
- **HTML:** `<script type="module" src="{base}/page-mascot.js"></script>` plus `<page-mascot directions="…" reactions="…" size="140" label="…"></page-mascot>`.

Every interpolated value goes through `escapeJsxString` / `escapeHtmlAttr`. `basePath` goes through `sanitizeBasePath`, and size is clamped to 48..512. A one-line attribution comment goes in each snippet.

### (j) App UI flow (D)
- **Setup.** Fields: name, describe (live lint), style picker (8 radio cards), "I'll attach a photo of myself" switch (default on), and a key colour select (Auto shows the resolved colour). Two `PromptCard`s ("Message 1", "Message 2") with copy buttons. `ChatHowTo` tabs (Gemini | ChatGPT). Button: "I have both images".
- **Upload.** Two `DropZone`s: a `<label>` wrapping a visually-hidden `<input type=file accept="image/png,image/jpeg,image/webp">`, plus drag and drop. Each shows a thumbnail, name, dimensions and any error. A persistent privacy line: "Your images are processed on this device and never uploaded." "Process" is enabled when both slots are ready.
- **Review.**
  - While processing: a `ProgressBar` and a stage label in an `aria-live="polite"` region.
  - Results: a verdict banner and two `CellGrid`s of keyed cells over a CSS checker background, with per-cell badges. Focusing or clicking a cell filters the `IssueList`.
  - Each issue shows a "Show prompt" button (back to Setup, scrolled to that card) and "Replace image" (back to Upload).
  - `MirrorCheck` shows cells 3 and 5 side by side ("Does the left one face your left?") with a "Swap left/right columns" toggle that re-runs the pipeline.
  - Non-blocking errors offer "Continue anyway".
- **Export.**
  - Live `Mascot` from object URLs of the encoded webp blobs. Size slider 80–240. Background toggle: light, dark or checker.
  - A cellSize select that re-runs the pipeline.
  - Downloads: `{slug}-directions.webp`, `{slug}-reactions.webp`, `page-mascot.js`, `Mascot.tsx`. `SnippetTabs` for React and HTML. Credit line.
- **Reducer rules.** Every transition is guarded by the current step. `run/*` actions with a stale `runId` are ignored. `reset` revokes object URLs, which `useObjectUrls` handles on change and on unmount.
- **Accessibility and theme.** Step nav is an `<ol>` with `aria-current="step"`. Focus moves to the step `<h2>` on change. Thumbnails get alt text like "Directions cell 3, up-right". Theme: `prefers-color-scheme` plus a manual toggle via `data-theme` on `<html>`, stored in localStorage. Layout is responsive, single column under 720px. CSS custom properties are tokens only; no external fonts or requests.

---

## 4. Test plan

The lead adds `@testing-library/react`, `@testing-library/user-event` and `pngjs` + `@types/pngjs` as devDependencies. Component tests use `// @vitest-environment jsdom`. All fixtures are generated in code from `src/test/draw.ts` with a seeded PRNG. Cells are 120 px (sheet 360) for speed. Every core test asserts its input is unchanged.

**Fixtures.** A owns `opaqueSheets.ts`:
- `greenSheet(opts)`: 9 busts on #00FF00 with antialiased black outlines.
- `magentaSheet`.
- `checkerSheet(square=16, #CCCCCC/#FFFFFF)` with busts.
- `whiteSheet`.
- `gradientSheet`.
- `noisySheet` (±6 per channel noise on the key).
- `frogSheet`: a green-on-green enclosed patch.
- `bleedSheet`: cell 2's bust crosses into cell 1, and cell 5 touches the bottom.
- `marginSheet`: 30-px outer margin and unequal 14/26-px gutters.
- `ruleLineSheet`: 2-px dark grid lines.
- `wideSheet`: 540×360, non-square.
- `watermarkSheet`: a 20-px star in the bottom-right corner.
- `twelveSheet`: a 4×3 grid.

B owns `alphaCells.ts`:
- `alignedCells`.
- `misalignedCells(seed)`: dx/dy ±10 px, scale ±8%.
- `scaledReactions(1.15, +6px)`.
- `heartReactions`: a separate heart blob above the head.
- `noisyBodyCells`: body width varies 25%.
- `clippedCells`.
- `emptyCell`.
- `nearKeyCells`: interior alpha at 150.
- `mixedResolutionPair`: 120-px directions vs 180-px reactions cells.

| Module | Concrete cases |
|---|---|
| raster (LEAD) | create/crop bounds and RangeError; labelComponents 4- vs 8-connectivity on a diagonal pair (2 vs 1 components); a 1000×1000 full mask runs without stack overflow; largestComponent ties; borderTouchingIds |
| lab | white → (100,0,0) ±0.01; #00FF00 → (87.73,-86.18,83.18) ±0.05; dE(x,x)=0; hex round-trip |
| background | green sheet colour within dE 2 of #00FF00 and uniformity > 0.95; watermark corner still ≥ 0.9; gradient < 0.9; white not keyable; spread 99/100 boundary |
| checkerboard | checkerSheet confidence ≥ 0.5 and square 16±1; square 8 and 32 detected; uniform green = 0; white = 0; greenSheet with busts in gutters < 0.2 |
| keyOut | background alpha 0; bust centre 255; keyedFraction within ±2% of analytic background area; edge pixels have g ≤ max(r,b)+8 after despill and spill; frog enclosed patch keeps alpha 255 (protectedFraction > 0); noisySheet leaves 0 background pixels with alpha > 10 after adaptive tol |
| spill/feather | feather never increases alpha; radius 0 is an identity copy (new buffer, equal bytes); spill leaves interior pixels untouched |
| cornerMarks | watermark erased (removed = 1); a bust near but not inside the corner is kept |
| keySheet | each failure reason; existing-alpha passthrough returns an equal but distinct buffer; magenta sheet with expected green gives expectedDeltaE > 25 and ok |
| grid | marginSheet cuts within 3 px of the true gutter centres and confidence 1; equal fallback when detectGrid=false; wideSheet cells 180×120; bleedSheet confidence < 1 |
| ruleLines | ruleLineSheet finds 2+2 lines, erased, and cells have no edge contact |
| bleed | bleedSheet cell 1 fragment removed (removed=1) and cell 2's main body intact |
| slice | 9 cells with indices 0..8 and correct sourceBoxes; swap gives order [2,1,0,…] with indices rewritten; twelveSheet significantBlobCount = 12 |
| measure | shoulderBox width equals drawn shoulder width ±1; heart excluded from bodyBox but in contentBox; edgeContact on clippedCells; translucentFraction > 0.08 on nearKeyCells |
| aligner | after alignment of misalignedCells, the shoulder-centre spread of rendered tiles is ≤ 1 px; scaledReactions fit scale within 1/1.15 ±0.01 and shift recovered ±4 px; heartReactions body placement equals heartless ±1 px; noisyBodyCells use clamp 0.10 and aligned uses 0.35; mixedResolutionPair renders the same shoulder width ±2%; < 5 anchors returns ok:false; transform compose/invert property test (round trip < 1e-9) |
| composer | identity transform reproduces the source (max channel diff ≤ 2); nearest keeps hard edges (no new colours); fade: bottom row alpha 0 and rows above end-depth unchanged; composeSheet places tile k at ((k%3)S,(k/3)S) |
| validator | a fixture issue per code; sorting; canExport false iff blocking; verdicts; aligned synthetic pair: boopShift ≤ 1, paletteMatch > 0.9, widthChange < 0.02; deliberately shifted pair (+8 px) gives a boop-shift error with redo 'reactions'; every IssueCode has non-empty advice |
| pipeline | (mocked B) stage order and progress fractions monotonic; key failure stops before align and returns ok:false with sheet analyses. **Integration:** green synthetic pair gives ok and no errors; checker directions gives a blocking checkerboard; reference fox PNGs composited onto #00FF00 give ok, boopShift ≤ 2, no blocking issues |
| prompts | no prompt matches /transparen\|alpha channel/i; contains the key phrase twice (rules + tail); reactions restates the description and the "same solid" sentence; non-colour style repeats the style name; pickKeyColour table (orange fox→green, Emerald frog→magenta, green dragon with pink spikes→blue, user override wins); lint codes |
| Mascot (jsdom) | aria-label "Boop the {label}"; center '50% 50%'; pointer at (+200,0) gives '100% 50%'; within 70 px gives center; hysteresis keeps the sector at +0.1 rad past the boundary; click with fake timers: blink '0% 0%', heart at 120 ms, null at 560 ms; 4 clicks gives dizzy; reduced motion means `animate` is not called; unmount removes listeners. Raw source has no relative imports |
| page-mascot.js | defines once (double import is safe); attributes reflect into styles; same sector table as `sectorFor` (parity test over 72 angles); disconnect cleans up |
| embed | `"><script>` label escaped in both snippets; slugify ('Tahsan Lihan!'→'tahsan-lihan', ''→'mascot'); basePath 'javascript:x'→'/mascots'; size clamped |
| D | reducer: every action from every step, stale runId ignored, reset; fileCheck magic bytes for png/jpeg/webp/heic/garbage and size limit; IssueList filters by cell; DropZone keyboard activation and reject message; CopyButton announces "Copied" |

Coverage: `vite.config.ts` coverage `include: ['src/core/**','src/prompts/**','src/embed/**','src/ui/state/**','src/adapters/fileCheck.ts']`, `exclude: ['**/__fixtures__/**','src/core/types.ts']`, thresholds of 80 for lines, functions and branches. Browser adapters and the worker are smoke-tested manually in MVP and with Playwright later.

---

## 5. Complete contents of `src/core/types.ts`

```ts
/**
 * mascot-maker shared contracts. Written by the lead; agents import, never edit.
 *
 * Pipeline concepts, thresholds and the runtime component are ported from
 * page-mascot -- MIT License, Copyright (c) 2026 Kamran Ahmed. See THIRD_PARTY_NOTICES.md.
 *
 * Conventions:
 *  - Every shape is readonly. Functions never mutate inputs; they return new objects/buffers.
 *    Filling a buffer you allocated inside the same function is fine.
 *  - Pixel coordinates: origin top-left, x right, y down.
 *  - Constants suffixed `At341` are tuned for 341-px cells (a 1024-px sheet) and are scaled
 *    by (directions cell height / 341) at runtime.
 */

/* ================================================================== raster */

export interface RawImage {
  readonly width: number
  readonly height: number
  /** RGBA8, row-major, straight (non-premultiplied) alpha. length === width * height * 4. */
  readonly data: Uint8ClampedArray
}

export interface Mask {
  readonly width: number
  readonly height: number
  /** One byte per pixel, 0 or 1, row-major. */
  readonly data: Uint8Array
}

export interface Labels {
  readonly width: number
  readonly height: number
  /** 0 = not in mask; 1..count = component id. */
  readonly data: Int32Array
  readonly count: number
  /** areas[id] = pixel count of component id; areas[0] === 0; length === count + 1. */
  readonly areas: readonly number[]
}

/** Half-open rectangle: x0 <= x < x1, y0 <= y < y1. Width = x1 - x0. */
export interface Box {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

export interface Rgba extends Rgb {
  readonly a: number
}

/** CIE L*a*b*, D65. */
export interface Lab {
  readonly l: number
  readonly a: number
  readonly b: number
}

/** Uniform scale + translation: dest = src * scale + (tx, ty). */
export interface ScaleTranslate {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

/* ================================================================== sheets & cells */

export const SHEET_KINDS = ['directions', 'reactions'] as const
export type SheetKind = (typeof SHEET_KINDS)[number]

/** Row-major cell order of the directions sheet. Must match Mascot.tsx and page-mascot.js. */
export const DIRECTION_NAMES = [
  'up-left', 'up', 'up-right',
  'left', 'center', 'right',
  'down-left', 'down', 'down-right',
] as const
export type Direction = (typeof DIRECTION_NAMES)[number]

/**
 * Row-major cell order of the reactions sheet. Must match Mascot.tsx and page-mascot.js.
 * Index 4 is drawn as "starstruck" by the prompt but keeps the upstream runtime name 'wink'
 * (the boop logic never shows it).
 */
export const REACTION_NAMES = [
  'blink', 'heart', 'sparkle',
  'surprised', 'wink', 'bashful',
  'sleepy', 'dizzy', 'delighted',
] as const
export type Reaction = (typeof REACTION_NAMES)[number]

export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export const CELL_INDICES: readonly CellIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export interface SheetMeta {
  readonly fileName: string
  readonly mimeType: string
  readonly originalWidth: number
  readonly originalHeight: number
  /** True when the adapter shrank the image to fit MAX_PROCESS_SIDE. */
  readonly downscaled: boolean
}

export interface SheetInput {
  readonly kind: SheetKind
  readonly image: RawImage
  readonly meta: SheetMeta
}

/* ================================================================== styles & key colours */

export const STYLE_PRESETS = [
  'colour', 'ink', 'sketch', 'riso', 'paper', 'pixel', 'anime', 'cartoon',
] as const
export type StylePreset = (typeof STYLE_PRESETS)[number]

export const KEY_COLOUR_NAMES = ['green', 'magenta', 'blue'] as const
export type KeyColourName = (typeof KEY_COLOUR_NAMES)[number]

export interface KeyColourSpec {
  readonly name: KeyColourName
  readonly rgb: Rgb
  readonly hex: string
  /** Exact wording used inside prompts. */
  readonly phrase: string
}

export const KEY_COLOURS: Readonly<Record<KeyColourName, KeyColourSpec>> = {
  green: { name: 'green', rgb: { r: 0, g: 255, b: 0 }, hex: '#00FF00', phrase: 'pure bright green (#00FF00)' },
  magenta: { name: 'magenta', rgb: { r: 255, g: 0, b: 255 }, hex: '#FF00FF', phrase: 'pure magenta (#FF00FF)' },
  blue: { name: 'blue', rgb: { r: 0, g: 0, b: 255 }, hex: '#0000FF', phrase: 'pure bright blue (#0000FF)' },
}

/* ================================================================== keyer */

export interface KeyOptions {
  /** Colour the prompt asked for; null = auto-detection only. */
  readonly expected: KeyColourName | null
  /** Lab distance at/below which a pixel is pure background (key.py TOL_LOW). Raised for noisy backgrounds. */
  readonly tolLow: number
  /** Lab distance at/above which a pixel is fully kept (key.py TOL_HIGH). */
  readonly tolHigh: number
  /** Minimum max-min channel spread of a keyable colour (key.py SATURATED). */
  readonly minSaturation: number
  /** Minimum share of corner pixels matching the background (key.py UNIFORM). */
  readonly minUniformity: number
  /** Minimum share of the sheet keying must remove. */
  readonly minKeyedFraction: number
  /** Checkerboard confidence at/above which the sheet is rejected. */
  readonly checkerboardReject: number
  /** Width (px) of the edge ring that gets spill suppression; 0 disables. */
  readonly spillRadius: number
  /** Alpha-only edge softening radius (px); 0 disables. Never raises alpha. */
  readonly featherRadius: number
}

export type KeyFailureReason =
  | 'checkerboard'
  | 'neutral-background'
  | 'non-uniform-background'
  | 'too-little-keyed'

export interface KeyStats {
  readonly checkerboardConfidence: number
  /** Detected checker square size in px, 0 if none. */
  readonly checkerboardSquare: number
  /** Best-3-of-4 corner agreement with the detected colour, 0..1. */
  readonly uniformity: number
  /** Share of the sheet with final alpha < 5. */
  readonly keyedFraction: number
  /** Share of key-coloured candidate pixels kept because they are enclosed by the character. */
  readonly protectedFraction: number
  /** Effective tolLow after noise adaptation. */
  readonly tolLowUsed: number
  /** Small corner marks (e.g. watermarks) erased. */
  readonly cornerMarksRemoved: number
}

export interface KeySuccess {
  readonly ok: true
  readonly mode: 'keyed' | 'existing-alpha'
  readonly image: RawImage
  /** Detected background colour; null in existing-alpha mode. */
  readonly colour: Rgb | null
  readonly hex: string | null
  /** CIE76 distance from detected colour to KEY_COLOURS[expected]; null when not applicable. */
  readonly expectedDeltaE: number | null
  readonly stats: KeyStats
}

export interface KeyFailure {
  readonly ok: false
  readonly reason: KeyFailureReason
  readonly colour: Rgb | null
  readonly hex: string | null
  readonly stats: KeyStats
}

export type KeyResult = KeySuccess | KeyFailure

/* ================================================================== slicer */

export interface SliceOptions {
  readonly detectGrid: boolean
  /** Search window around each expected internal cut, as a fraction of the content span. */
  readonly gutterSearch: number
  /** Column/row coverage at/above which it is a drawn grid line, not art. */
  readonly ruleLineCoverage: number
  /** Column/row coverage at/below which it counts as empty gutter. */
  readonly gutterCoverage: number
  /** Edge band in px used by dropBleed. */
  readonly bleedBand: number
  /** Alpha above which a pixel is opaque for dropBleed. */
  readonly bleedAlpha: number
}

export interface GridSpec {
  /** Ascending: 0, c1, c2, width. */
  readonly xCuts: readonly [number, number, number, number]
  /** Ascending: 0, r1, r2, height. */
  readonly yCuts: readonly [number, number, number, number]
  readonly method: 'gutters' | 'equal'
  /** 0..1; 1 = all four internal cuts landed in clean empty gutters. */
  readonly confidence: number
}

export interface Cell {
  readonly sheet: SheetKind
  /** Position in the (possibly column-swapped) 3x3 order. */
  readonly index: CellIndex
  readonly image: RawImage
  /** Region of the keyed sheet this cell came from. */
  readonly sourceBox: Box
  /** Edge-touching fragments erased by dropBleed. */
  readonly fragmentsRemoved: number
}

export interface SliceResult {
  readonly grid: GridSpec
  /** Exactly 9, row-major, cells[i].index === i. */
  readonly cells: readonly Cell[]
  readonly ruleLinesRemoved: number
  /** Components on the whole keyed sheet with area >= 0.5% of it. Expect 9. */
  readonly significantBlobCount: number
}

/* ================================================================== measure */

export interface EdgeContact {
  readonly top: boolean
  readonly bottom: boolean
  readonly left: boolean
  readonly right: boolean
}

export interface CellMetrics {
  readonly width: number
  readonly height: number
  readonly isEmpty: boolean
  /** Largest 8-connected component of alpha > ALPHA.anchor. */
  readonly bodyBox: Box | null
  /** All pixels with alpha > ALPHA.content, floating symbols included. */
  readonly contentBox: Box | null
  /** Body pixels within (shoulderBand * height) px above the body's bottom row. */
  readonly shoulderBox: Box | null
  readonly bodyArea: number
  /** bodyArea / (width * height). */
  readonly bodyCoverage: number
  /** Components of alpha > ALPHA.silhouette with area >= 4. */
  readonly componentCount: number
  readonly edgeContact: EdgeContact
  /** Widest body row within the top 55% of the body. */
  readonly headWidth: number
  /** shoulderBox width; 0 when there is none. */
  readonly shoulderWidth: number
  /** Inside bodyBox: share of pixels with 10 < alpha < 245 (character colour near the key). */
  readonly translucentFraction: number
}

/* ================================================================== aligner */

export interface AlignOptions {
  /** Shoulder band height as a fraction of cell height (build.py SHOULDER_BAND). */
  readonly shoulderBand: number
  /** Per-cell scale clamp when the anchor is noisy (build.py SCALE_CLAMP). */
  readonly scaleClampNoisy: number
  /** Per-cell scale clamp when the anchor is steady. */
  readonly scaleClampSteady: number
  /** Anchor-width noise above which the noisy clamp applies. */
  readonly noiseThreshold: number
  /** Max cross-sheet rescale of the reactions sheet (build.py MATCH_CLAMP). */
  readonly matchClamp: number
  /** Fraction down the body where the cross-sheet fit silhouette starts (build.py FIT_BAND). */
  readonly fitBand: number
  /** Cross-sheet vertical search range in quarter-resolution px. */
  readonly fitShiftQuarterPx: number
  /** Fraction down the body where the settle band starts (build.py lower_band 0.66). */
  readonly settleBand: number
  /** Per-frame settle search range at 341-px cells (build.py SETTLE). */
  readonly settleRangeAt341: number
  /** Where every character's bottom edge lands down the tile (build.py BOTTOM_ANCHOR). */
  readonly bottomAnchor: number
  readonly cropPadTopAt341: number
  readonly cropPadSideAt341: number
}

export interface FrameAlignment {
  readonly sheet: SheetKind
  readonly index: CellIndex
  /** Maps source-cell pixels to the unit tile square [0,1] x [0,1]. */
  readonly toTile: ScaleTranslate
  /** True when the per-cell scale hit the clamp. */
  readonly scaleClamped: boolean
  /** False when the cell had no shoulder box and was centred instead. */
  readonly anchored: boolean
  /** Per-frame vertical settle in canvas px (reactions only; 0 for directions). */
  readonly settleDy: number
}

export interface CrossSheetFit {
  readonly scale: number
  /** Vertical shift in canvas px. */
  readonly shift: number
  /** Soft IoU of the two shoulder silhouettes after the fit, 0..1. */
  readonly overlap: number
}

export interface AlignResult {
  /** 9 entries, index order. */
  readonly directions: readonly FrameAlignment[]
  /** 9 entries, index order. */
  readonly reactions: readonly FrameAlignment[]
  readonly anchorNoise: number
  readonly scaleClamp: number
  readonly crossSheet: CrossSheetFit
  /** Side of the square crop in canvas px. */
  readonly cropSide: number
}

export type AlignOutcome =
  | { readonly ok: true; readonly value: AlignResult }
  | { readonly ok: false; readonly reason: 'too-few-anchors'; readonly anchoredCells: number }

/* ================================================================== composer */

export const CELL_SIZE_PRESETS = [256, 360, 512] as const
export const MIN_CELL_SIZE = 128
export const MAX_CELL_SIZE = 1024

export interface ComposeOptions {
  /** Output tile side in px; each sheet is 3 * cellSize square. */
  readonly cellSize: number
  readonly sampling: 'smooth' | 'nearest'
  readonly fade: boolean
  /** Bottom fade depth as a fraction of the tile (build.py FADE_DEPTH). */
  readonly fadeDepth: number
}

export interface ComposedMascot {
  readonly cellSize: number
  readonly directions: RawImage
  readonly reactions: RawImage
  readonly directionTiles: readonly RawImage[]
  readonly reactionTiles: readonly RawImage[]
}

/* ================================================================== validator */

export type Severity = 'error' | 'warning' | 'info'
export type RedoTarget = 'directions' | 'reactions' | 'both' | 'none'

export type IssueCode =
  | 'checkerboard'
  | 'neutral-background'
  | 'non-uniform-background'
  | 'too-little-keyed'
  | 'key-colour-mismatch'
  | 'existing-alpha'
  | 'corner-marks-removed'
  | 'lossy-source'
  | 'low-resolution'
  | 'odd-aspect'
  | 'downscaled'
  | 'grid-uncertain'
  | 'grid-mismatch'
  | 'rule-lines-removed'
  | 'fragments-removed'
  | 'empty-cell'
  | 'touches-edge'
  | 'touches-bottom'
  | 'wide-feature'
  | 'low-coverage'
  | 'high-coverage'
  | 'size-outlier'
  | 'character-near-key'
  | 'body-inconsistent'
  | 'shoulders-too-wide'
  | 'unanchored-cell'
  | 'scale-clamped'
  | 'boop-shift'
  | 'width-change'
  | 'palette-mismatch'
  | 'check-mirrored'

export interface Issue {
  /** Stable key: `${code}:${sheet ?? 'pair'}:${cellIndex ?? 'all'}`. */
  readonly id: string
  readonly code: IssueCode
  readonly severity: Severity
  /** True = no usable output until fixed. */
  readonly blocking: boolean
  readonly sheet: SheetKind | null
  readonly cellIndex: CellIndex | null
  /** What is wrong, plain English. */
  readonly message: string
  /** What to do, plain English; names the prompt to redo. */
  readonly fix: string
  readonly redo: RedoTarget
  readonly metric: number | null
}

export interface QualityMetrics {
  /** Directions shoulder-width spread across cells, percent (screen.py). */
  readonly shoulderSpreadPct: number | null
  /** Shoulder width / head width on the directions center cell (screen.py). */
  readonly headShoulderRatio: number | null
  /** Worst body movement on boop, px at boopDisplayPx (verify.py). */
  readonly boopShiftPx: number | null
  /** Lowest band IoU between a reaction frame and the directions center frame. */
  readonly minBandOverlap: number | null
  /** Histogram intersection of the two sheets' body colours, 0..1. */
  readonly paletteMatch: number | null
  /** |reactions - directions| shoulder width / directions shoulder width. */
  readonly widthChange: number | null
}

export interface ValidationThresholds {
  readonly shoulderSpreadWarnPct: number
  readonly shoulderSpreadErrorPct: number
  readonly headShoulderMarginal: number
  readonly headShoulderTooWide: number
  readonly boopDisplayPx: number
  readonly boopSearchAt360: number
  readonly boopBandTop: number
  readonly boopBandBottom: number
  readonly boopWarnPx: number
  readonly boopErrorPx: number
  readonly paletteErrorBelow: number
  readonly paletteWarnBelow: number
  readonly widthChangeWarn: number
  readonly widthChangeError: number
  readonly emptyCoverage: number
  readonly lowCoverage: number
  readonly highCoverage: number
  readonly sizeOutlier: number
  readonly edgePixelsAt341: number
  readonly wideFeatureCells: number
  readonly translucentWarn: number
  readonly keyMismatchDeltaE: number
  readonly minCellSide: number
  readonly maxAspect: number
  readonly gridConfidenceWarn: number
}

export interface ValidationReport {
  /** Sorted: blocking errors, errors, warnings, info; then sheet, then cell. */
  readonly issues: readonly Issue[]
  readonly metrics: QualityMetrics
  readonly verdict: 'ready' | 'usable-with-warnings' | 'redo'
  readonly canExport: boolean
}

/* ================================================================== pipeline */

export interface SheetAnalysis {
  readonly kind: SheetKind
  readonly meta: SheetMeta
  readonly key: KeyResult
  /** null when keying failed. */
  readonly slice: SliceResult | null
  /** 9 entries in cell order; empty when slice is null. */
  readonly metrics: readonly CellMetrics[]
}

export interface PipelineInput {
  readonly directions: SheetInput
  readonly reactions: SheetInput
}

export interface PipelineOptions {
  readonly key: KeyOptions
  readonly slice: SliceOptions
  readonly align: AlignOptions
  readonly compose: ComposeOptions
  readonly thresholds: ValidationThresholds
  readonly swapDirectionColumns: boolean
}

export type PipelineStage =
  | 'keying'
  | 'slicing'
  | 'measuring'
  | 'aligning'
  | 'composing'
  | 'validating'
  | 'done'

export interface PipelineProgress {
  readonly stage: PipelineStage
  readonly sheet: SheetKind | null
  /** Overall 0..1, monotonic. */
  readonly fraction: number
}

export type ProgressCallback = (progress: PipelineProgress) => void

export interface PipelineSuccess {
  readonly ok: true
  readonly directions: SheetAnalysis
  readonly reactions: SheetAnalysis
  readonly alignment: AlignResult
  readonly output: ComposedMascot
  readonly report: ValidationReport
}

export interface PipelineFailure {
  readonly ok: false
  readonly directions: SheetAnalysis
  readonly reactions: SheetAnalysis
  readonly report: ValidationReport
}

export type PipelineResult = PipelineSuccess | PipelineFailure

/* ================================================================== prompts */

export interface CharacterBrief {
  /** Used for file names and the screen-reader label. */
  readonly name: string
  /** One sentence: colours plus two or three distinguishing features. */
  readonly describe: string
  readonly style: StylePreset
  /** True = first message uses the REFERENCE (photo) prompt. */
  readonly usePhoto: boolean
  /** User override; null = pickKeyColour(describe). */
  readonly key: KeyColourName | null
}

export interface PromptPair {
  readonly firstKind: 'directions' | 'reference'
  readonly first: string
  readonly second: string
  readonly key: KeyColourName
}

export type DescribeWarningCode =
  | 'too-short'
  | 'no-colours'
  | 'long-hair'
  | 'held-prop'
  | 'wide-feature'
  | 'mentions-transparency'

export interface DescribeWarning {
  readonly code: DescribeWarningCode
  readonly message: string
}

export type ChatProvider = 'gemini' | 'chatgpt'

export interface ChatGuide {
  readonly id: ChatProvider
  readonly name: string
  readonly steps: readonly string[]
  readonly tips: readonly string[]
}

/* ================================================================== embed */

export interface EmbedOptions {
  readonly name: string
  /** Where the user will serve the files, e.g. '/mascots'. Sanitised before use. */
  readonly basePath: string
  /** Rendered size in px; clamped to 48..512. */
  readonly size: number
  readonly label: string
}

export interface EmbedAssetNames {
  readonly directions: string
  readonly reactions: string
  readonly script: 'page-mascot.js'
  readonly component: 'Mascot.tsx'
}

export interface EmbedBundle {
  readonly assetNames: EmbedAssetNames
  readonly react: string
  readonly html: string
  /** Raw source of src/mascot/Mascot.tsx. */
  readonly componentSource: string
  /** Raw source of src/embed/page-mascot.js. */
  readonly scriptSource: string
}

/* ================================================================== defaults */

/** Alpha thresholds used across measure/align/compose/validate (from build.py / verify.py / screen.py). */
export const ALPHA = {
  content: 8,
  fade: 40,
  silhouette: 100,
  band: 120,
  anchor: 128,
  solid: 200,
} as const

export const MAX_PROCESS_SIDE = 2048
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MIN_UPLOAD_SIDE = 300
export const MAX_UPLOAD_SIDE = 8192
export const REFERENCE_CELL = 341

export const DEFAULT_KEY_OPTIONS: KeyOptions = {
  expected: null,
  tolLow: 6,
  tolHigh: 26,
  minSaturation: 100,
  minUniformity: 0.9,
  minKeyedFraction: 0.2,
  checkerboardReject: 0.5,
  spillRadius: 2,
  featherRadius: 1,
}

export const DEFAULT_SLICE_OPTIONS: SliceOptions = {
  detectGrid: true,
  gutterSearch: 0.1,
  ruleLineCoverage: 0.85,
  gutterCoverage: 0.002,
  bleedBand: 2,
  bleedAlpha: 40,
}

export const DEFAULT_ALIGN_OPTIONS: AlignOptions = {
  shoulderBand: 0.05,
  scaleClampNoisy: 0.1,
  scaleClampSteady: 0.35,
  noiseThreshold: 0.03,
  matchClamp: 0.2,
  fitBand: 0.86,
  fitShiftQuarterPx: 40,
  settleBand: 0.66,
  settleRangeAt341: 26,
  bottomAnchor: 0.93,
  cropPadTopAt341: 8,
  cropPadSideAt341: 16,
}

export const DEFAULT_COMPOSE_OPTIONS: ComposeOptions = {
  cellSize: 360,
  sampling: 'smooth',
  fade: true,
  fadeDepth: 0.12,
}

export const DEFAULT_THRESHOLDS: ValidationThresholds = {
  shoulderSpreadWarnPct: 3,
  shoulderSpreadErrorPct: 8,
  headShoulderMarginal: 0.95,
  headShoulderTooWide: 1.1,
  boopDisplayPx: 140,
  boopSearchAt360: 24,
  boopBandTop: 0.55,
  boopBandBottom: 0.78,
  boopWarnPx: 1,
  boopErrorPx: 2,
  paletteErrorBelow: 0.22,
  paletteWarnBelow: 0.4,
  widthChangeWarn: 0.08,
  widthChangeError: 0.12,
  emptyCoverage: 0.005,
  lowCoverage: 0.03,
  highCoverage: 0.6,
  sizeOutlier: 0.2,
  edgePixelsAt341: 15,
  wideFeatureCells: 4,
  translucentWarn: 0.08,
  keyMismatchDeltaE: 25,
  minCellSide: 200,
  maxAspect: 1.6,
  gridConfidenceWarn: 0.5,
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  key: DEFAULT_KEY_OPTIONS,
  slice: DEFAULT_SLICE_OPTIONS,
  align: DEFAULT_ALIGN_OPTIONS,
  compose: DEFAULT_COMPOSE_OPTIONS,
  thresholds: DEFAULT_THRESHOLDS,
  swapDirectionColumns: false,
}
```
`optionsForStyle('pixel', …)` returns `sampling:'nearest'` and `featherRadius:0`. Every other style uses the defaults.

---

## 6. Work split (strictly disjoint ownership)

**Phase 0, LEAD (before agents start, about 2 h):**
- `src/core/types.ts` (above).
- `src/core/raster.ts` + `raster.test.ts`.
- `src/test/draw.ts`.
- `src/vite-env.d.ts`.
- `src/test/assets/fox-directions.png` and `fox-reactions.png`, copied from `_ref/page-mascot/characters/fox/`.
- `THIRD_PARTY_NOTICES.md`.
- `package.json` devDeps: `@testing-library/react`, `@testing-library/user-event`, `pngjs`, `@types/pngjs`.
- `vite.config.ts` coverage block.
- **Stub barrels** with the exact signatures from section 2, bodies `throw new Error('not implemented')`: `src/core/keyer/index.ts`, `slicer/index.ts`, `measure/index.ts`, `aligner/index.ts`, `composer/index.ts`, `validator/index.ts`, `pipeline.ts`, `pipelineOptions.ts`, `src/prompts/index.ts`, `src/embed/index.ts`, `src/mascot/Mascot.tsx`.

  Ownership of each stub passes to the agent listed below once Phase 0 lands. These stubs let all four agents typecheck from minute one. Agents never edit `types.ts`, `raster.ts`, `draw.ts`, `package.json` or `vite.config.ts`; they request changes from the lead.

**Agent A (keyer + slicer + pipeline):** `src/core/color/**`, `src/core/keyer/**`, `src/core/slicer/**`, `src/core/pipeline.ts`, `src/core/pipelineOptions.ts`, `src/core/pipeline.test.ts`, `src/core/pipeline.integration.test.ts`, `src/core/__fixtures__/opaqueSheets.ts`, plus every `*.test.ts` beside those files.

**Agent B (measure + aligner + composer + validator):** `src/core/measure/**`, `src/core/aligner/**`, `src/core/composer/**`, `src/core/validator/**`, `src/core/__fixtures__/alphaCells.ts`, plus their tests.

**Agent C (prompts + Mascot + embed):** `src/prompts/**`, `src/mascot/**`, `src/embed/**`, plus their tests.

**Agent D (adapters + worker + UI):** `index.html`, `public/_headers`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/adapters/**`, `src/worker/**`, `src/ui/**`, plus their tests. D imports only the barrels: `src/core/pipeline`, `src/core/pipelineOptions`, `src/prompts`, `src/embed`, `src/mascot`, `src/core/types`.

Cross-agent imports must go through the barrels (`index.ts`, `pipeline.ts`, `Mascot.tsx`). Agents must not deep-import another agent's files.

**Integration order and how the lead verifies:**
1. After Phase 0: `pnpm typecheck && pnpm test` is green (stubs are never called; raster tests pass).
2. Merge **C** (no dependencies): `pnpm test src/prompts src/embed src/mascot`, then read one generated prompt of each kind by eye against `prompts.md`.
3. Merge **A**. Pipeline unit tests use `vi.mock` for B's barrels; the integration test is `describe.skip` until B lands. Run `pnpm test src/core/keyer src/core/slicer`.
4. Merge **B**. Remove the skip on `pipeline.integration.test.ts` and run `pnpm test:cov`, checking core ≥ 80%. Acceptance:
   - Synthetic green pair gives ok with no errors.
   - Fox reference composited on #00FF00 gives ok with boopShiftPx ≤ 2.
   - Checker sheet gives a blocking checkerboard issue.
5. Merge **D**. Run `pnpm build`, then manual smoke in `pnpm preview` (Chrome, Firefox, Safari):
   - Full flow with the fox fixtures re-saved on green.
   - Keyboard-only pass through all 4 steps.
   - Dark mode.
   - Network tab shows zero requests after load.
   - Two 4096² PNGs process with memory under 600 MB.
   - Webp downloads open.
   - The HTML snippet works in a blank `index.html` with the downloaded `page-mascot.js`.

---

## 7. Risks, edge cases, and the MVP cut line

- **Cells bleed in a 1024 sheet; ears or shoulders clipped.** `dropBleed` removes neighbour slivers. Clipping of the character's own body cannot be recovered; it surfaces as `touches-edge`, `touches-bottom` or `wide-feature` with "shrink the character equally in every cell" advice.
- **Key colour near character colours (skin, clothing).** Mitigations: `pickKeyColour` plus user override; border-connectivity protection (enclosed key colour is kept); the `character-near-key` warning from translucent interiors. Magenta and blue are far from skin tones in Lab. White, grey and black are never offered as key colours.
- **Antialiased fringe and JPEG/webp noise.** Handled by un-premultiply despill, ring spill suppression, an alpha-only feather that never raises alpha, adaptive tolLow, and a `lossy-source` warning.
- **Checkerboard.** Rejected with "new chat, paste unchanged" advice. Prompts never mention transparency, and the describe lint flags it if the user types it.
- **Gemini visible watermark.** `removeCornerMarks` handles it, and best-3-of-4 corner uniformity keeps detection working. Verify against a real Gemini download in step 5 of integration.
- **EXIF and colour profiles.** Decode with `imageOrientation:'from-image'` and `colorSpaceConversion:'default'`; `premultiplyAlpha:'none'` keeps alpha PNGs exact.
- **Huge images and memory on the 15 GB laptop or on phones.**
  - Limits: 20 MB file cap, 8192 px side cap, decode-time downscale to 2048.
  - Masks are 1 byte per pixel, there are no RGBA canvases per frame, and resampling happens once.
  - Work runs in the worker; references are dropped after encode.
  - Cross-sheet search runs at quarter resolution, coarse to fine.
- **Sheets at different resolutions.** Handled by `sheetScale` pre-scale (a fix over `build.py`).
- **Non-square output (1536×1024) or a wrong grid (4×3).** Non-square cells are supported and the output is always square. A `grid-mismatch` error fires when significant blobs ≠ 9.
- **Mirrored directions sheet.** Cannot be measured (design-rules), so there is a manual MirrorCheck and a swap toggle; no redraw is needed.
- **Long hair over the shoulders** (most common failure). Caught by describe lint, and by `width-change` / `boop-shift` errors with "tie the hair back" advice.
- **Safari webp encode.** Falls back to PNG with a notice. The snippets use the actual file extension.
- **Privacy.** No network calls, analytics or fonts. `public/_headers` sets CSP `default-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'` for production only, because the dev server's HMR needs a websocket. The UI states plainly that a photo goes to the user's chat provider, not to us.
- **Performance of ported numpy code in JS.** Checkerboard uses integral-image blur and runs on about 8 regions only. Settle compares only band rows. All of it runs in the worker. Budget: under 4 s for two 1024 sheets on a mid laptop.
- **Licence.** Attribution headers go in every ported file plus `THIRD_PARTY_NOTICES.md`. `Mascot.tsx` and `page-mascot.js` ship to users with the MIT notice line.

**MVP:**
- Key route (green, magenta, blue), existing-alpha passthrough, checkerboard rejection, corner marks.
- Gutter, rule-line and bleed slicing.
- Full alignment: within-sheet, cross-sheet, settle, bottom anchor.
- Alpha-ramp fade; smooth and nearest sampling.
- Every validator check in the table.
- All 8 styles plus the photo route, describe lint, chat guides.
- Mascot plus `<page-mascot>`, React and HTML snippets.
- The 4-step UI with the worker, separate downloads, light/dark, MirrorCheck swap.

**Later:**
- The `build.py` 4-radius premultiplied blur fade.
- Zip export via `fflate`.
- Automatic mirror heuristic.
- Per-cell nudge editor and single-sheet re-upload with cached analysis.
- Advanced tolerance sliders.
- localStorage persistence of the brief.
- Playwright E2E (upload fixtures, expect "Ready", 2 downloads) plus visual regression at 320/768/1440 in both themes.
- PWA offline mode, i18n, GIF/APNG preview export.
