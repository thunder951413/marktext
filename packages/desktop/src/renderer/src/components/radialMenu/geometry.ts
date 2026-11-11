export const RADIAL_OUTER_RADIUS = 124
export const RADIAL_INNER_RADIUS = 38
export const RADIAL_DEAD_ZONE_RADIUS = 24
export const RADIAL_SECTOR_GAP_DEG = 2.4
export const RADIAL_VIEWPORT_MARGIN = 14
export const RADIAL_MIN_MOVE_PX = 5
export const RADIAL_HOVER_SHIFT_PX = 2.5

export interface Point2D {
  x: number
  y: number
}

export interface PolarPoint {
  distance: number
  angleDeg: number
}

export interface SectorGeometry {
  index: number
  centerAngleDeg: number
  path: string
  labelX: number
  labelY: number
  shiftX: number
  shiftY: number
  indicatorX: number
  indicatorY: number
}

export interface TriggerEventLike {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const roundCoord = (value: number): number => {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

/**
 * Clamp the radial menu's center origin so the entire outer disc stays within
 * the visible viewport with a comfortable margin.
 */
export const clampMenuOrigin = (
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  outerRadius: number = RADIAL_OUTER_RADIUS,
  margin: number = RADIAL_VIEWPORT_MARGIN
): Point2D => {
  const pad = outerRadius + margin
  const clampedX =
    viewportWidth <= pad * 2
      ? viewportWidth / 2
      : Math.min(Math.max(x, pad), viewportWidth - pad)
  const clampedY =
    viewportHeight <= pad * 2
      ? viewportHeight / 2
      : Math.min(Math.max(y, pad), viewportHeight - pad)

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY)
  }
}

/**
 * Convert polar coordinates (0° = North / 12 o'clock, increasing clockwise)
 * into screen Cartesian coordinates (+x right, +y down).
 */
export const polarToCartesian = (
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): Point2D => {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: roundCoord(cx + radius * Math.sin(rad)),
    y: roundCoord(cy - radius * Math.cos(rad))
  }
}

/**
 * Convert screen Cartesian delta from `(cx, cy)` to `(px, py)` into polar
 * distance and clockwise angle from 12 o'clock `[0, 360)`.
 */
export const cartesianToPolar = (
  cx: number,
  cy: number,
  px: number,
  py: number
): PolarPoint => {
  const dx = px - cx
  const dy = py - cy
  const distance = Math.hypot(dx, dy)
  if (distance === 0) {
    return { distance: 0, angleDeg: 0 }
  }
  const rawDeg = (Math.atan2(dx, -dy) * 180) / Math.PI
  const angleDeg = ((rawDeg % 360) + 360) % 360
  return { distance, angleDeg }
}

/**
 * Resolve which radial sector (`0 .. sectorCount - 1`, clockwise from 12 o'clock)
 * the cursor `(cursorX, cursorY)` falls into relative to `(originX, originY)`.
 * Returns `-1` when inside the central dead-zone (`distance < deadZoneRadius`).
 * Has no outer radius cap so fast directional flicks remain locked to the ray.
 */
export const getSectorIndexAtPoint = (
  originX: number,
  originY: number,
  cursorX: number,
  cursorY: number,
  sectorCount = 8,
  deadZoneRadius: number = RADIAL_DEAD_ZONE_RADIUS
): number => {
  if (sectorCount <= 0) return -1
  const { distance, angleDeg } = cartesianToPolar(originX, originY, cursorX, cursorY)
  if (distance < deadZoneRadius) {
    return -1
  }
  const sectorSpan = 360 / sectorCount
  const shifted = (angleDeg + sectorSpan / 2) % 360
  return Math.floor(shifted / sectorSpan) % sectorCount
}

/**
 * Build SVG annular wedge path and label/hover coordinates for a single sector.
 */
export const buildSectorGeometry = (
  index: number,
  sectorCount: number,
  cx: number,
  cy: number,
  innerRadius: number = RADIAL_INNER_RADIUS,
  outerRadius: number = RADIAL_OUTER_RADIUS,
  gapDeg: number = RADIAL_SECTOR_GAP_DEG
): SectorGeometry => {
  const sectorSpan = 360 / sectorCount
  const centerAngleDeg = index * sectorSpan
  const effectiveGap = Math.min(gapDeg, sectorSpan * 0.4)
  const startDeg = centerAngleDeg - sectorSpan / 2 + effectiveGap / 2
  const endDeg = centerAngleDeg + sectorSpan / 2 - effectiveGap / 2
  const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0

  const outerStart = polarToCartesian(cx, cy, outerRadius, startDeg)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endDeg)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endDeg)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startDeg)

  const path = [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z'
  ].join(' ')

  const midRadius = (innerRadius + outerRadius) / 2 + 1
  const labelPos = polarToCartesian(cx, cy, midRadius, centerAngleDeg)
  const shiftVec = polarToCartesian(0, 0, RADIAL_HOVER_SHIFT_PX, centerAngleDeg)
  const indicatorPos = polarToCartesian(cx, cy, innerRadius - 4, centerAngleDeg)

  return {
    index,
    centerAngleDeg,
    path,
    labelX: labelPos.x,
    labelY: labelPos.y,
    shiftX: shiftVec.x,
    shiftY: shiftVec.y,
    indicatorX: indicatorPos.x,
    indicatorY: indicatorPos.y
  }
}

/**
 * Check whether a mouse event matches the `Cmd + Right-Click` (macOS) or
 * `Ctrl + Right-Click` (Windows/Linux) radial menu trigger without hijacking
 * plain right-click or macOS `Ctrl + Left-Click`.
 */
export const isRadialTriggerMouseEvent = (
  event: TriggerEventLike,
  isMac: boolean
): boolean => {
  if (event.button !== 2 || event.altKey || event.shiftKey) {
    return false
  }
  if (isMac) {
    return event.metaKey && !event.ctrlKey
  }
  return event.ctrlKey || event.metaKey
}
