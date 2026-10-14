import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  clampZoomFactor,
  stepZoomFactor
} from 'common/zoom'

describe('display zoom factors', () => {
  it('steps in 12.5% increments without floating-point drift', () => {
    expect(stepZoomFactor(DEFAULT_ZOOM_FACTOR, 1)).toBe(1.125)
    expect(stepZoomFactor(1.125, -1)).toBe(DEFAULT_ZOOM_FACTOR)
  })

  it('clamps display scaling to the supported range', () => {
    expect(stepZoomFactor(MAX_ZOOM_FACTOR, 1)).toBe(MAX_ZOOM_FACTOR)
    expect(stepZoomFactor(MIN_ZOOM_FACTOR, -1)).toBe(MIN_ZOOM_FACTOR)
    expect(clampZoomFactor(Number.NaN)).toBe(DEFAULT_ZOOM_FACTOR)
  })
})
