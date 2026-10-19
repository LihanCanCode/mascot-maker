# Mascot studio (spike)

A deterministic, code-drawn character rig that renders the two sheets the app consumes:
`directions.png` (3x3 head turns) and `reactions.png` (3x3 expressions), 1536x1536 RGBA, 512px cells,
transparent background or flat `#00FF00` for the key-colour path. No dependencies, no external art,
no network. All art is original and drawn by the functions in this folder.

Open `index.html` through any static server (ES modules do not load from `file://`), e.g.
`npx serve spikes/studio` or the Vite dev server.

## Why canvas 2D (not SVG)

Canvas 2D draws straight to pixels, so the output is exactly the RGBA PNG the pipeline wants, with no
rasterise step. SVG would give us resolution independence we do not need (the output is fixed at
512px cells) and costs an `Image` decode per cell. Everything here is `moveTo`/`bezier`/`fill`/`stroke`,
which also maps 1:1 to `OffscreenCanvas` and node-canvas if we ever render on a worker or server.
`rig.js` has no DOM access: callers inject `createCanvas(w, h)`.

## Files

| File | Role |
| --- | --- |
| `rig.js` | config + defaults, rig math (`createRig`), face (eyes, brows, nose, mouth, blush, symbols), `drawCharacter`, `renderSheet` |
| `parts.js` | body, ears, muzzle, hair, headwear, facial hair, glasses |
| `draw.js` | colour tones, smooth paths, the `ink()` outline helper, PRNG |
| `presets.js` | 8 presets: fox, bear, cat, beard guy, bun + glasses, bunny, robot, beanie bob |
| `index.html` | live studio |
| `render.mjs`, `check.mjs`, `pipeline.mjs`, `shot.mjs` | headless tooling (Playwright): render PNGs to `out/`, geometry QA, run PNGs through the real app, screenshot the studio |

```js
import { renderSheet } from './rig.js'
import { PRESETS } from './presets.js'
const make = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
const sheet = renderSheet(PRESETS.fox, 'directions', { createCanvas: make, background: 'transparent' /* or '#00FF00' */ })
```

Config (all optional, see `DEFAULTS`): `skin, muzzle, earInner, earTip, noseColor, hairStyle (none|messy|bob|buzz|bun|ponytail),
hairColor, eyeColor, glasses (none|round|square), glassesColor, facialHair (none|stubble|moustache|beard),
ears (human|cat|bear|fox|bunny|bolt), headShape (round|square), blush, blushColor, headwear (none|cap|beanie|antenna),
headwearColor, shirt, neckline (crew|v|boat|turtle|collar|scarf), shirtDetail (none|stripe|badge), accent, outline, eyeScale`.
Ears other than `human`/`bolt` switch the face to an animal muzzle + nose design.

## The rig math in ten lines

1. A pose is `(dx, dy)` in {-1,0,1}^2 (`dy < 0` is up). `yaw = 0.74*dx`, `pitch = -0.36*dy` radians.
2. The head silhouette is a superellipse (n=2 round, 3.4 square). It shifts `17*dx` px, squashes `8.5%` in x at full turn, `4%` in y.
3. Face features live on a virtual sphere: `proj(theta, phi, depth)` takes longitude/latitude, rotates by yaw then pitch, flattens to the screen.
4. Screen `x = cx + 0.95*rx*depth*x'`, `y = cy - 0.95*ry*depth*y'`. Features therefore move further than the outline (the sphere sits inside it) and bunch up toward the rim.
5. `z'` (facing the viewer) gives the horizontal foreshortening `sx = clamp(0.3 + 0.7*z'^0.8)`: the far eye narrows, the near eye widens, with no per-eye special case.
6. `depth > 1` for protruding things (nose 1.14, muzzle 1.08, glasses 1.1, beard 1.03): they parallax more than the eyes.
7. Parts with `rim = true` that land behind the sphere (z < 0) are clamped to the silhouette, so hair, ears and beards wrap around the head instead of showing through it.
8. Ears draw behind the head, except human ears that turn into view (z > 0.3), which draw in front. Animal ears tilt `+-0.14*dy` with the nod.
9. Body, neck and shoulders take no pose. `renderSheet` rasterises them once and blits that cached layer into all 18 cells, so they are pixel-identical (checked by `check.mjs`).
10. Outlines come from `ink()`: stroke twice, the second pass nudged down-right, so line weight swells on the shadow side. Tones come from `shadeOf`/`hiOf` (darker + hue nudged toward violet, lighter + nudged warm); colours are flat, 2 to 3 per surface.

## Adding a part

* Hair style: add a fringe polyline (`[theta, phi]` points) to `FRINGE` in `parts.js` and pass its outer-arc options in `drawHairFront` (or write a new draw branch). Anything behind the head goes in `drawHairBack`.
* Ear type: add an entry to `EAR_POS` and a branch in `drawAnimalEar` (local coordinates, base at the origin, pointing up; the transform handles placement, outward tilt and foreshortening).
* Headwear / glasses / facial hair: a draw function that calls `R.proj` / `R.pts` for placement and `ink()`/`shadedInk()` for the look. Register it in `drawHeadwearFront`, `drawGlasses` or `drawFacialHair`. Draw order is in `drawCharacter` (`rig.js`).
* Expression: add an entry to `EXPRESSIONS` (per-eye kinds, mouth kind, brow lift, blush, floating symbol). New eye or mouth kinds go in `drawEye` / `drawMouthShape`.
* Preset: add an object to `presets.js`. Avoid pure green skin/shirt/eyes so the `#00FF00` key path stays a fair test.

## Headless checks

```bash
export PLAYWRIGHT_BROWSERS_PATH="D:/tools/playwright" npm_config_store_dir="D:/tools/pnpm-store"
node spikes/studio/render.mjs          # out/<preset>-{directions,reactions}[-green].png
node spikes/studio/check.mjs           # min transparent margin per sheet + body-identity
node spikes/studio/pipeline.mjs fox bun   # through the real app on http://127.0.0.1:5173
node spikes/studio/shot.mjs            # studio screenshots, pointer/reaction/download smoke test
```

Lessons from the real pipeline: floating symbols (heart, sparkle, zzz) enlarge the measured figure;
keep them modest and inside the head's width band or a cell is flagged "different size".
