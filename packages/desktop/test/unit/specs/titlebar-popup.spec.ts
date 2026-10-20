import { describe, it, expect } from 'vitest'
import {
  menuPositionBelow,
  placePopover
} from '../../../src/renderer/src/components/titleBar/titlebarPopup'

const WIDTH = 260

describe('placePopover', () => {
  it('opens rightwards from a button in the left toolbar (Windows/Linux)', () => {
    const anchor = { left: 72, right: 98, bottom: 30 }
    const { left, top } = placePopover(anchor, WIDTH, 1200, 800)
    expect(left).toBe(72)
    expect(top).toBe(36)
  })

  it('opens leftwards from a button in the right toolbar (macOS)', () => {
    const anchor = { left: 1050, right: 1076, bottom: 30 }
    expect(placePopover(anchor, WIDTH, 1200, 800).left).toBe(1076 - WIDTH)
  })

  it('never leaves the window, even when the window is narrow', () => {
    for (const anchor of [
      { left: 2, right: 28, bottom: 30 },
      { left: 280, right: 306, bottom: 30 },
      { left: 150, right: 176, bottom: 30 }
    ]) {
      const { left } = placePopover(anchor, WIDTH, 320, 600)
      expect(left).toBeGreaterThanOrEqual(8)
      expect(left + WIDTH).toBeLessThanOrEqual(320 - 8)
    }
  })

  it('caps the height on tall windows and keeps a usable minimum on short ones', () => {
    const anchor = { left: 72, right: 98, bottom: 30 }
    expect(placePopover(anchor, WIDTH, 1200, 1600).maxHeight).toBe(440)
    expect(placePopover(anchor, WIDTH, 1200, 150).maxHeight).toBe(200)
  })

  it('falls back to the top-right corner without an anchor', () => {
    const { left, top } = placePopover(null, WIDTH, 1200, 800)
    expect(left + WIDTH).toBeLessThanOrEqual(1200 - 8)
    expect(top).toBe(6)
  })
})

describe('menuPositionBelow', () => {
  it('converts CSS pixels to DIPs using the zoom factor', () => {
    const anchor = { left: 10, right: 36, bottom: 30 }
    expect(menuPositionBelow(anchor, 1)).toEqual({ x: 10, y: 32 })
    expect(menuPositionBelow(anchor, 1.5)).toEqual({ x: 15, y: 48 })
  })
})
