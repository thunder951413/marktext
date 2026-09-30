export const MIN_ZOOM_FACTOR = 0.5
export const MAX_ZOOM_FACTOR = 2
export const DEFAULT_ZOOM_FACTOR = 1
export const ZOOM_STEP = 0.125

export const clampZoomFactor = (factor: number): number => {
  if (!Number.isFinite(factor)) return DEFAULT_ZOOM_FACTOR
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, factor))
}

export const stepZoomFactor = (factor: number, direction: -1 | 1): number => {
  const next = clampZoomFactor(factor) + direction * ZOOM_STEP
  return Number.parseFloat(clampZoomFactor(next).toFixed(3))
}
