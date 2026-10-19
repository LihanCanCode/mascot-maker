// One full character cell in 512x512 design space: layer order lives here.
import { ink } from './draw'
import { createRig, DESIGN } from './rig'
import type { CanvasLike, Ctx, Pose, Rig, StudioConfig } from './types'
import { drawBody } from './parts/body'
import { drawEarsBack, drawEarsFront } from './parts/ears'
import { drawBlush, drawBrows, drawEyes, eyeGeom } from './parts/eyes'
import { drawFacialHair } from './parts/facialHair'
import { drawCheekTufts, drawEyePatches, drawHeadFill } from './parts/faceShape'
import { drawGlasses } from './parts/glasses'
import { drawHairBack, drawHairCastShadow, drawHairFront } from './parts/hair'
import { drawHeadwearBack, drawHeadwearCastShadow, drawHeadwearFront } from './parts/headwear'
import { drawMouth } from './parts/mouth'
import { drawMuzzlePads, drawNose, drawWhiskers } from './parts/muzzle'
import { drawSymbol } from './parts/symbols'

/** Things painted on the face skin, clipped to the head outline. */
function drawFaceSurface(ctx: Ctx, R: Rig): void {
  ctx.save(); ctx.beginPath(); R.head(ctx); ctx.clip()
  drawEyePatches(ctx, R)
  if (R.animal) drawMuzzlePads(ctx, R)
  drawBlush(ctx, R)
  drawFacialHair(ctx, R, 'under')
  drawHairCastShadow(ctx, R)
  drawHeadwearCastShadow(ctx, R)
  ctx.restore()
}

function drawFace(ctx: Ctx, R: Rig): void {
  drawWhiskers(ctx, R)
  drawFacialHair(ctx, R, 'over')
  drawNose(ctx, R)
  drawFacialHair(ctx, R, 'gap')
  drawMouth(ctx, R)
  drawEyes(ctx, R)
  drawBrows(ctx, R)
  drawGlasses(ctx, R, eyeGeom(R))
}

/**
 * Draw one cell. The body takes no pose, so it is identical by construction; sheets additionally
 * blit one cached raster of it (`bodyLayer`) so antialiasing cannot differ between cells either.
 */
export function drawCharacter(ctx: Ctx, cfg: StudioConfig, pose: Pose, bodyLayer: CanvasLike | null): void {
  const R = createRig(cfg, pose)
  drawHairBack(ctx, R); drawHeadwearBack(ctx, R)
  drawEarsBack(ctx, R); drawCheekTufts(ctx, R)
  if (bodyLayer) ctx.drawImage(bodyLayer as unknown as CanvasImageSource, 0, 0, DESIGN, DESIGN)
  else drawBody(ctx, R.pal, cfg)
  drawHeadFill(ctx, R)
  drawFaceSurface(ctx, R)
  ink(ctx, (c) => R.head(c), { line: cfg.outline, w: 8, swell: 0.7 })
  drawEarsFront(ctx, R)
  drawFace(ctx, R)
  drawHairFront(ctx, R); drawHeadwearFront(ctx, R)
  drawSymbol(ctx, cfg, R.ex.symbol)
}
