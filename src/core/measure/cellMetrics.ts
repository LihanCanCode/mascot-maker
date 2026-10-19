/**
 * Per-cell measurements used by alignment and validation (screen.py + build.py anchor).
 * page-mascot, MIT License, Copyright (c) 2026 Kamran Ahmed.
 */
import { alphaMask, labelComponents, maskArea, maskBounds } from '../raster'
import { ALPHA } from '../types'
import type { AlignOptions, Box, CellMetrics, EdgeContact, RawImage } from '../types'
import { bodyMask, headWidth, robustShoulderWidth, shoulderBox } from './bands'

const EDGE_BAND = 2
const HEAD_BAND = 0.55
const MIN_COMPONENT_AREA = 4
const TRANSLUCENT_LOW = 10
const TRANSLUCENT_HIGH = 245

function countOpaqueIn(img: RawImage, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (img.data[(y * img.width + x) * 4 + 3]! > ALPHA.silhouette) n++
  }
  return n
}

function edgeContact(img: RawImage, edgePixels: number): EdgeContact {
  const { width: w, height: h } = img
  const b = Math.min(EDGE_BAND, w, h)
  return {
    top: countOpaqueIn(img, 0, 0, w, b) > edgePixels,
    bottom: countOpaqueIn(img, 0, h - b, w, h) > edgePixels,
    left: countOpaqueIn(img, 0, 0, b, h) > edgePixels,
    right: countOpaqueIn(img, w - b, 0, w, h) > edgePixels,
  }
}

/** Share of drawn pixels (alpha > 10) inside the box that are only partly opaque. */
function translucentFraction(img: RawImage, box: Box): number {
  let drawn = 0
  let partial = 0
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const a = img.data[(y * img.width + x) * 4 + 3]!
      if (a <= TRANSLUCENT_LOW) continue
      drawn++
      if (a < TRANSLUCENT_HIGH) partial++
    }
  }
  return drawn === 0 ? 0 : partial / drawn
}

function countComponents(img: RawImage): number {
  const labels = labelComponents(alphaMask(img, ALPHA.silhouette), 8)
  return labels.areas.filter((area, id) => id > 0 && area >= MIN_COMPONENT_AREA).length
}

export function measureCell(img: RawImage, align: AlignOptions, edgePixels: number): CellMetrics {
  const body = bodyMask(img, ALPHA.anchor)
  const bodyBox = maskBounds(body)
  const shoulders = shoulderBox(body, img.height * align.shoulderBand)
  const bodyArea = maskArea(body)
  return {
    width: img.width,
    height: img.height,
    isEmpty: bodyBox === null,
    bodyBox,
    contentBox: maskBounds(alphaMask(img, ALPHA.content)),
    shoulderBox: shoulders,
    bodyArea,
    bodyCoverage: bodyArea / (img.width * img.height),
    componentCount: countComponents(img),
    edgeContact: edgeContact(img, edgePixels),
    headWidth: headWidth(body, HEAD_BAND),
    shoulderWidth: shoulders ? robustShoulderWidth(body) : 0,
    translucentFraction: bodyBox ? translucentFraction(img, bodyBox) : 0,
  }
}
