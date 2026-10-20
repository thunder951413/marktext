export interface AnchorRect {
  left: number
  right: number
  bottom: number
}

export interface PopoverPlacement {
  left: number
  top: number
  maxHeight: number
}

const EDGE_MARGIN = 8
const ANCHOR_GAP = 6
const MIN_HEIGHT = 200
const MAX_HEIGHT = 440

/**
 * Where to put a `width`-wide popover under a title-bar button so it never
 * leaves the window. A button on the left half (Windows/Linux frameless
 * toolbar) opens rightwards from its left edge; one on the right half (macOS
 * toolbar) opens leftwards from its right edge. Without an anchor (native
 * title bar, opened by shortcut) the popover sits in the top-right corner.
 */
export function placePopover(
  anchor: AnchorRect | null,
  width: number,
  viewportWidth: number,
  viewportHeight: number
): PopoverPlacement {
  const top = (anchor ? anchor.bottom : 0) + ANCHOR_GAP
  let left: number
  if (!anchor) {
    left = viewportWidth - width - EDGE_MARGIN * 2
  } else if ((anchor.left + anchor.right) / 2 < viewportWidth / 2) {
    left = anchor.left
  } else {
    left = anchor.right - width
  }
  const maxLeft = viewportWidth - width - EDGE_MARGIN
  left = Math.max(EDGE_MARGIN, Math.min(left, maxLeft))
  const room = viewportHeight - top - EDGE_MARGIN * 2
  return {
    left: Math.round(left),
    top: Math.round(top),
    maxHeight: Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, room)))
  }
}

/**
 * Electron's `Menu.popup` takes window coordinates in DIPs, while
 * getBoundingClientRect() is in CSS pixels, which `webFrame.setZoomFactor`
 * scales. Convert so the native menu opens right under the button at any zoom.
 */
export function menuPositionBelow(anchor: AnchorRect, zoomFactor: number): { x: number; y: number } {
  const factor = zoomFactor > 0 ? zoomFactor : 1
  return {
    x: Math.round(anchor.left * factor),
    y: Math.round((anchor.bottom + 2) * factor)
  }
}
