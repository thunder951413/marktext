import { describe, it, expect } from 'vitest'
import {
  RADIAL_DEAD_ZONE_RADIUS,
  RADIAL_INNER_RADIUS,
  RADIAL_OUTER_RADIUS,
  buildSectorGeometry,
  cartesianToPolar,
  clampMenuOrigin,
  getSectorIndexAtPoint,
  isRadialTriggerMouseEvent,
  polarToCartesian
} from '../../../src/renderer/src/components/radialMenu/geometry'
import {
  buildRadialMenu,
  resolveRadialMenuMode,
  type RadialContextSnapshot
} from '../../../src/renderer/src/components/radialMenu/items'

const baseContext = (overrides: Partial<RadialContextSnapshot> = {}): RadialContextSnapshot => ({
  hasCurrentFile: true,
  isPlainText: false,
  sourceCode: false,
  showSideBar: false,
  hasSelection: false,
  isCodeFences: false,
  isDisabled: false,
  isTaskList: false,
  activeFormats: {},
  ...overrides
})

describe('radialMenu geometry & hit-testing', () => {
  it('matches Cmd+Right-Click on macOS without hijacking plain right-click or Ctrl+Left-Click', () => {
    // Valid macOS trigger: Cmd + Right-Click
    expect(
      isRadialTriggerMouseEvent(
        { button: 2, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
        true
      )
    ).toBe(true)

    // Plain right-click must NOT trigger
    expect(
      isRadialTriggerMouseEvent(
        { button: 2, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false },
        true
      )
    ).toBe(false)

    // macOS Ctrl + Left-Click (native context menu) must NOT trigger
    expect(
      isRadialTriggerMouseEvent(
        { button: 0, metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        true
      )
    ).toBe(false)

    // macOS Ctrl + Right-Click without Cmd must NOT trigger
    expect(
      isRadialTriggerMouseEvent(
        { button: 2, metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        true
      )
    ).toBe(false)

    // Windows / Linux: Ctrl + Right-Click triggers
    expect(
      isRadialTriggerMouseEvent(
        { button: 2, metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        false
      )
    ).toBe(true)
  })

  it('returns -1 inside the center dead-zone and resolves all 8 compass sectors outside it', () => {
    const cx = 400
    const cy = 300

    // Inside dead-zone (< 24px)
    expect(getSectorIndexAtPoint(cx, cy, cx, cy)).toBe(-1)
    expect(getSectorIndexAtPoint(cx, cy, cx + 12, cy - 12)).toBe(-1)
    expect(getSectorIndexAtPoint(cx, cy, cx, cy - (RADIAL_DEAD_ZONE_RADIUS - 1))).toBe(-1)

    // Just outside dead-zone (30px movement) in all 8 directions clockwise from North
    const step = 30
    const diag = 24 // hypot(24, 24) ≈ 33.94 >= 24
    expect(getSectorIndexAtPoint(cx, cy, cx, cy - step)).toBe(0) // N
    expect(getSectorIndexAtPoint(cx, cy, cx + diag, cy - diag)).toBe(1) // NE
    expect(getSectorIndexAtPoint(cx, cy, cx + step, cy)).toBe(2) // E
    expect(getSectorIndexAtPoint(cx, cy, cx + diag, cy + diag)).toBe(3) // SE
    expect(getSectorIndexAtPoint(cx, cy, cx, cy + step)).toBe(4) // S
    expect(getSectorIndexAtPoint(cx, cy, cx - diag, cy + diag)).toBe(5) // SW
    expect(getSectorIndexAtPoint(cx, cy, cx - step, cy)).toBe(6) // W
    expect(getSectorIndexAtPoint(cx, cy, cx - diag, cy - diag)).toBe(7) // NW
  })

  it('supports infinite radial ray selection and accurate ±22.5° sector boundaries', () => {
    const cx = 500
    const cy = 500

    // Fast flick far beyond outer radius (350px) stays locked to sector
    const farEast = polarToCartesian(cx, cy, 350, 90)
    expect(getSectorIndexAtPoint(cx, cy, farEast.x, farEast.y)).toBe(2)

    // Angular boundary around North: [-22°, +22°] -> sector 0; +23° -> sector 1; 337° -> sector 7
    const northLeftEdge = polarToCartesian(cx, cy, 80, 338)
    const northRightEdge = polarToCartesian(cx, cy, 80, 22)
    const northEastStart = polarToCartesian(cx, cy, 80, 23)
    const northWestEnd = polarToCartesian(cx, cy, 80, 337)

    expect(getSectorIndexAtPoint(cx, cy, northLeftEdge.x, northLeftEdge.y)).toBe(0)
    expect(getSectorIndexAtPoint(cx, cy, northRightEdge.x, northRightEdge.y)).toBe(0)
    expect(getSectorIndexAtPoint(cx, cy, northEastStart.x, northEastStart.y)).toBe(1)
    expect(getSectorIndexAtPoint(cx, cy, northWestEnd.x, northWestEnd.y)).toBe(7)
  })

  it('clamps menu origin inside viewport bounds so the circle never clips off-screen', () => {
    const clampedTopLeft = clampMenuOrigin(10, 15, 1280, 800, 124, 14)
    expect(clampedTopLeft).toEqual({ x: 138, y: 138 })

    const clampedBottomRight = clampMenuOrigin(1275, 790, 1280, 800, 124, 14)
    expect(clampedBottomRight).toEqual({ x: 1142, y: 662 })

    const centered = clampMenuOrigin(640, 400, 1280, 800, 124, 14)
    expect(centered).toEqual({ x: 640, y: 400 })
  })

  it('builds closed annular SVG sector paths and outward hover shift vectors', () => {
    const north = buildSectorGeometry(0, 8, 132, 132, RADIAL_INNER_RADIUS, RADIAL_OUTER_RADIUS)
    expect(north.path.startsWith('M ')).toBe(true)
    expect(north.path.endsWith(' Z')).toBe(true)
    expect(north.shiftX).toBe(0)
    expect(north.shiftY).toBeLessThan(0) // shifts upward for North
    expect(north.labelY).toBeLessThan(132)

    const east = buildSectorGeometry(2, 8, 132, 132, RADIAL_INNER_RADIUS, RADIAL_OUTER_RADIUS)
    expect(east.shiftX).toBeGreaterThan(0) // shifts rightward for East
    expect(east.shiftY).toBe(0)
    const polar = cartesianToPolar(132, 132, east.labelX, east.labelY)
    expect(polar.angleDeg).toBeCloseTo(90, 1)
  })
})

describe('radialMenu context-aware item evaluation', () => {
  it('resolves 8 formatting actions with live active flags when prose text is selected in WYSIWYG', () => {
    const ctx = baseContext({
      hasSelection: true,
      activeFormats: { strong: true, inline_code: true }
    })
    expect(resolveRadialMenuMode(ctx)).toBe('markdown-selection')

    const menu = buildRadialMenu(ctx)
    expect(menu.items).toHaveLength(8)
    expect(menu.items.map((i) => i.id)).toEqual([
      'format-strong',
      'format-emphasis',
      'format-inline-code',
      'format-hyperlink',
      'format-highlight',
      'format-strike',
      'format-clear',
      'command-palette'
    ])
    expect(menu.items[0]?.active).toBe(true)
    expect(menu.items[1]?.active).toBe(false)
    expect(menu.items[2]?.active).toBe(true)
  })

  it('falls back to markdown-default when selection is inside a code fence or disabled block', () => {
    const inCodeFence = baseContext({ hasSelection: true, isCodeFences: true })
    expect(resolveRadialMenuMode(inCodeFence)).toBe('markdown-default')

    const inDisabled = baseContext({ hasSelection: true, isDisabled: true })
    expect(resolveRadialMenuMode(inDisabled)).toBe('markdown-default')
  })

  it('provides 8 high-frequency editing, block, view, and export actions in default Markdown mode', () => {
    const menu = buildRadialMenu(baseContext({ showSideBar: true, isTaskList: true }))
    expect(menu.mode).toBe('markdown-default')
    expect(menu.items).toHaveLength(8)
    expect(menu.items.map((i) => i.id)).toEqual([
      'command-palette',
      'toggle-source',
      'insert-code-fence',
      'insert-table',
      'insert-task-list',
      'edit-find',
      'toggle-sidebar',
      'export-pdf'
    ])
    expect(menu.items[4]?.active).toBe(true) // task list active
    expect(menu.items[6]?.active).toBe(true) // sidebar active
  })

  it('adapts cleanly to Source Code mode, Plain Text mode, and Empty Workspace launchpad', () => {
    const sourceMenu = buildRadialMenu(baseContext({ sourceCode: true, hasSelection: true }))
    expect(sourceMenu.mode).toBe('markdown-source')
    expect(sourceMenu.items).toHaveLength(8)
    expect(sourceMenu.items[1]?.id).toBe('toggle-source')
    expect(sourceMenu.items[1]?.active).toBe(true)

    const plainTextMenu = buildRadialMenu(baseContext({ isPlainText: true }))
    expect(plainTextMenu.mode).toBe('plain-text')
    expect(plainTextMenu.items).toHaveLength(8)
    expect(plainTextMenu.items.some((i) => i.id === 'insert-table')).toBe(false)

    const emptyMenu = buildRadialMenu(baseContext({ hasCurrentFile: false }))
    expect(emptyMenu.mode).toBe('empty')
    expect(emptyMenu.items).toHaveLength(8)
    expect(emptyMenu.items.map((i) => i.id)).toContain('open-file')
    expect(emptyMenu.items.map((i) => i.id)).toContain('open-folder')
  })
})
