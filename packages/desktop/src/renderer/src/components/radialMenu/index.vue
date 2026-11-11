<template>
  <Teleport to="body">
    <Transition name="ag-radial-pop">
      <div
        v-if="visible"
        class="ag-radial-overlay"
        data-testid="radial-menu-overlay"
        @mousedown.prevent
        @contextmenu.prevent
      >
        <div
          class="ag-radial-menu"
          role="menu"
          :aria-label="t('radialMenu.ariaLabel')"
          :style="{
            left: `${menuOrigin.x}px`,
            top: `${menuOrigin.y}px`,
            width: `${svgSize}px`,
            height: `${svgSize}px`
          }"
        >
          <div class="ag-radial-backdrop" />

          <svg
            class="ag-radial-svg"
            :width="svgSize"
            :height="svgSize"
            :viewBox="`0 0 ${svgSize} ${svgSize}`"
            aria-hidden="true"
          >
            <g
              v-for="(sector, idx) in sectors"
              :key="menuState.items[idx]?.id ?? idx"
              class="ag-radial-sector-group"
              :class="{
                'is-hovered': activeIndex === idx,
                'is-toggled': isItemToggled(menuState.items[idx])
              }"
              :style="{
                transform:
                  activeIndex === idx
                    ? `translate(${sector.shiftX}px, ${sector.shiftY}px)`
                    : 'translate(0px, 0px)'
              }"
            >
              <path
                class="ag-radial-wedge"
                :d="sector.path"
              />
            </g>

            <circle
              v-if="activeSector"
              class="ag-radial-direction-dot"
              :cx="activeSector.indicatorX"
              :cy="activeSector.indicatorY"
              r="2.5"
            />
          </svg>

          <div
            v-for="(item, idx) in menuState.items"
            :key="item.id"
            class="ag-radial-item-label"
            role="menuitem"
            :data-testid="`radial-item-${item.id}`"
            :aria-label="t(item.labelKey)"
            :class="{
              'is-hovered': activeIndex === idx,
              'is-toggled': isItemToggled(item)
            }"
            :style="{
              left: `${sectors[idx]?.labelX ?? svgCenter}px`,
              top: `${sectors[idx]?.labelY ?? svgCenter}px`,
              transform:
                activeIndex === idx
                  ? `translate(calc(-50% + ${sectors[idx]?.shiftX ?? 0}px), calc(-50% + ${sectors[idx]?.shiftY ?? 0}px))`
                  : 'translate(-50%, -50%)'
            }"
          >
            <span class="ag-radial-icon-wrap">
              <!-- Command Palette -->
              <svg
                v-if="item.icon === 'command'"
                viewBox="0 0 24 24"
              >
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>

              <!-- Source Code Mode -->
              <svg
                v-else-if="item.icon === 'source'"
                viewBox="0 0 24 24"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
                <line
                  x1="14"
                  y1="4"
                  x2="10"
                  y2="20"
                />
              </svg>

              <!-- Code Block -->
              <svg
                v-else-if="item.icon === 'code-block'"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2.5"
                />
                <polyline points="9.5 9.5 7 12 9.5 14.5" />
                <polyline points="14.5 9.5 17 12 14.5 14.5" />
              </svg>

              <!-- Insert Table -->
              <svg
                v-else-if="item.icon === 'table'"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                />
                <line
                  x1="3"
                  y1="9.5"
                  x2="21"
                  y2="9.5"
                />
                <line
                  x1="3"
                  y1="14.5"
                  x2="21"
                  y2="14.5"
                />
                <line
                  x1="9"
                  y1="4"
                  x2="9"
                  y2="20"
                />
                <line
                  x1="15"
                  y1="4"
                  x2="15"
                  y2="20"
                />
              </svg>

              <!-- Task List -->
              <svg
                v-else-if="item.icon === 'task-list'"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3.5"
                  y="4.5"
                  width="6"
                  height="6"
                  rx="1.2"
                />
                <path d="M5 7.6l1.3 1.3L8.5 6.5" />
                <line
                  x1="13"
                  y1="7.5"
                  x2="20.5"
                  y2="7.5"
                />
                <rect
                  x="3.5"
                  y="13.5"
                  width="6"
                  height="6"
                  rx="1.2"
                />
                <line
                  x1="13"
                  y1="16.5"
                  x2="20.5"
                  y2="16.5"
                />
              </svg>

              <!-- Find -->
              <svg
                v-else-if="item.icon === 'find'"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                />
                <line
                  x1="16"
                  y1="16"
                  x2="21"
                  y2="21"
                />
              </svg>

              <!-- Search in Folder -->
              <svg
                v-else-if="item.icon === 'folder-search'"
                viewBox="0 0 24 24"
              >
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" />
                <path d="M3 7v10a2 2 0 0 0 2 2h5" />
                <circle
                  cx="16.5"
                  cy="16.5"
                  r="3.2"
                />
                <line
                  x1="19"
                  y1="19"
                  x2="21.5"
                  y2="21.5"
                />
              </svg>

              <!-- Sidebar -->
              <svg
                v-else-if="item.icon === 'sidebar'"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2.5"
                />
                <line
                  x1="9"
                  y1="4"
                  x2="9"
                  y2="20"
                />
              </svg>

              <!-- Export PDF -->
              <svg
                v-else-if="item.icon === 'export-pdf'"
                viewBox="0 0 24 24"
              >
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="14 3 14 9 20 9" />
                <path d="M12 17v-6" />
                <polyline points="9.5 13.5 12 11 14.5 13.5" />
              </svg>

              <!-- Bold -->
              <svg
                v-else-if="item.icon === 'bold'"
                viewBox="0 0 24 24"
              >
                <path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7z" />
                <path d="M7 12h7.5a3.5 3.5 0 0 1 0 7H7z" />
              </svg>

              <!-- Italic -->
              <svg
                v-else-if="item.icon === 'italic'"
                viewBox="0 0 24 24"
              >
                <line
                  x1="19"
                  y1="5"
                  x2="10"
                  y2="5"
                />
                <line
                  x1="14"
                  y1="19"
                  x2="5"
                  y2="19"
                />
                <line
                  x1="14.5"
                  y1="5"
                  x2="9.5"
                  y2="19"
                />
              </svg>

              <!-- Inline Code -->
              <svg
                v-else-if="item.icon === 'inline-code'"
                viewBox="0 0 24 24"
              >
                <polyline points="8 7 3 12 8 17" />
                <polyline points="16 7 21 12 16 17" />
              </svg>

              <!-- Hyperlink -->
              <svg
                v-else-if="item.icon === 'link'"
                viewBox="0 0 24 24"
              >
                <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.93" />
                <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19.07" />
              </svg>

              <!-- Highlight -->
              <svg
                v-else-if="item.icon === 'highlight'"
                viewBox="0 0 24 24"
              >
                <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z" />
                <line
                  x1="4"
                  y1="21"
                  x2="20"
                  y2="21"
                />
              </svg>

              <!-- Strikethrough -->
              <svg
                v-else-if="item.icon === 'strike'"
                viewBox="0 0 24 24"
              >
                <path d="M16 6.5A4 4 0 0 0 12 5c-2.5 0-4 1.2-4 3 0 1.5 1 2.4 3 3" />
                <path d="M8 17.5A4 4 0 0 0 12 19c2.7 0 4.5-1.3 4.5-3.2 0-1.1-.5-2-1.6-2.6" />
                <line
                  x1="4"
                  y1="12"
                  x2="20"
                  y2="12"
                />
              </svg>

              <!-- Clear Format -->
              <svg
                v-else-if="item.icon === 'clear-format'"
                viewBox="0 0 24 24"
              >
                <path d="M6 5h13" />
                <path d="M13 5l-3.5 14" />
                <line
                  x1="4"
                  y1="4"
                  x2="20"
                  y2="20"
                />
              </svg>

              <!-- New Tab / File -->
              <svg
                v-else-if="item.icon === 'new-tab'"
                viewBox="0 0 24 24"
              >
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="14 3 14 9 20 9" />
                <line
                  x1="12"
                  y1="11.5"
                  x2="12"
                  y2="17.5"
                />
                <line
                  x1="9"
                  y1="14.5"
                  x2="15"
                  y2="14.5"
                />
              </svg>

              <!-- Save -->
              <svg
                v-else-if="item.icon === 'save'"
                viewBox="0 0 24 24"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>

              <!-- Save As -->
              <svg
                v-else-if="item.icon === 'save-as'"
                viewBox="0 0 24 24"
              >
                <path d="M17 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v5" />
                <polyline points="7 3 7 8 14 8" />
                <path d="M16 19h6" />
                <path d="M19 16v6" />
              </svg>

              <!-- Open File -->
              <svg
                v-else-if="item.icon === 'open-file'"
                viewBox="0 0 24 24"
              >
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="14 3 14 9 20 9" />
              </svg>

              <!-- Open Folder -->
              <svg
                v-else-if="item.icon === 'open-folder'"
                viewBox="0 0 24 24"
              >
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>

              <!-- Import -->
              <svg
                v-else-if="item.icon === 'import'"
                viewBox="0 0 24 24"
              >
                <path d="M12 3v12" />
                <polyline points="8 11 12 15 16 11" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>

              <!-- Undo -->
              <svg
                v-else-if="item.icon === 'undo'"
                viewBox="0 0 24 24"
              >
                <polyline points="9 14 4 9 9 4" />
                <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
              </svg>

              <!-- Font Size (Scrollable) -->
              <svg
                v-else-if="item.icon === 'font-size'"
                viewBox="0 0 24 24"
              >
                <path d="M3.5 18L8 6l4.5 12" />
                <line
                  x1="5.2"
                  y1="14"
                  x2="10.8"
                  y2="14"
                />
                <line
                  x1="18"
                  y1="6.5"
                  x2="18"
                  y2="17.5"
                />
                <polyline points="15.8 8.8 18 6.5 20.2 8.8" />
                <polyline points="15.8 15.2 18 17.5 20.2 15.2" />
              </svg>

              <!-- Settings -->
              <svg
                v-else
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>

              <span
                v-if="isItemToggled(item)"
                class="ag-radial-active-dot"
              />
            </span>
            <span class="ag-radial-text">{{ t(item.labelKey) }}</span>
          </div>

          <div
            class="ag-radial-center"
            :class="{ 'is-active': !!activeItem }"
          >
            <template v-if="activeItem?.action.kind === 'font-size'">
              <span
                class="ag-radial-center-value"
                data-testid="radial-font-size-value"
              >{{ activeFontSize }} px</span>
              <kbd class="ag-radial-center-kbd">{{
                activeFontSize !== defaultFontSize
                  ? `↺ ${defaultFontSize}px`
                  : t('radialMenu.wheelHint')
              }}</kbd>
            </template>
            <template v-else-if="activeItem">
              <span class="ag-radial-center-title">{{ t(activeItem.labelKey) }}</span>
              <kbd
                v-if="activeShortcut"
                class="ag-radial-center-kbd"
              >{{ activeShortcut }}</kbd>
            </template>
            <template v-else>
              <span class="ag-radial-center-mode">{{ t(menuState.modeLabelKey) }}</span>
              <span class="ag-radial-center-hint">{{
                hasLeftDeadZone ? t('radialMenu.cancel') : 'ESC'
              }}</span>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isTextDocument } from 'common/textDocument'
import bus from '@/bus'
import { isOsx } from '@/util'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { useLayoutStore } from '@/store/layout'
import { useCommandCenterStore } from '@/store/commandCenter'
import { editorSelectionState } from '@/util/editorSelectionState'
import {
  RADIAL_DEAD_ZONE_RADIUS,
  RADIAL_DEFAULT_CODE_FONT_SIZE,
  RADIAL_DEFAULT_MARKDOWN_FONT_SIZE,
  RADIAL_INNER_RADIUS,
  RADIAL_MAX_CODE_FONT_SIZE,
  RADIAL_MAX_MARKDOWN_FONT_SIZE,
  RADIAL_MIN_FONT_SIZE,
  RADIAL_MIN_MOVE_PX,
  RADIAL_OUTER_RADIUS,
  buildSectorGeometry,
  cartesianToPolar,
  clampMenuOrigin,
  consumeFontWheelDelta,
  getSectorIndexAtPoint,
  isRadialTriggerMouseEvent,
  type Point2D
} from './geometry'
import {
  buildRadialMenu,
  type RadialActionItem,
  type ResolvedRadialMenu
} from './items'

const { t } = useI18n()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const commandCenterStore = useCommandCenterStore()

const svgPadding = 8
const svgSize = (RADIAL_OUTER_RADIUS + svgPadding) * 2
const svgCenter = svgSize / 2

const visible = ref(false)
const menuOrigin = ref<Point2D>({ x: 0, y: 0 })
const activeIndex = ref(-1)
const hasLeftDeadZone = ref(false)
const menuState = ref<ResolvedRadialMenu>(
  buildRadialMenu({
    hasCurrentFile: false,
    isPlainText: false,
    sourceCode: false,
    showSideBar: false,
    hasSelection: false,
    isCodeFences: false,
    isDisabled: false,
    isTaskList: false,
    activeFormats: {}
  })
)

let isRightButtonHeld = false
let hasMovedFromPress = false
let hasAdjustedFontInSession = false
let wheelRemainder = 0
let pressRawPoint: Point2D = { x: 0, y: 0 }
let suppressContextMenuUntil = 0

const usesCodeFont = computed(
  () =>
    !!editorStore.currentFile &&
    (isTextDocument(editorStore.currentFile) || !!preferencesStore.sourceCode)
)

const activeFontSize = computed(() =>
  usesCodeFont.value ? preferencesStore.codeFontSize : preferencesStore.fontSize
)

const defaultFontSize = computed(() =>
  usesCodeFont.value ? RADIAL_DEFAULT_CODE_FONT_SIZE : RADIAL_DEFAULT_MARKDOWN_FONT_SIZE
)

const maxFontSize = computed(() =>
  usesCodeFont.value ? RADIAL_MAX_CODE_FONT_SIZE : RADIAL_MAX_MARKDOWN_FONT_SIZE
)

const setFontSize = (nextSize: number): void => {
  if (!editorStore.currentFile) return
  const clamped = Math.min(maxFontSize.value, Math.max(RADIAL_MIN_FONT_SIZE, Math.round(nextSize)))
  if (clamped === activeFontSize.value) return
  preferencesStore.SET_SINGLE_PREFERENCE({
    type: usesCodeFont.value ? 'codeFontSize' : 'fontSize',
    value: clamped
  })
}

const stepFontSize = (delta: -1 | 1): void => {
  setFontSize(activeFontSize.value + delta)
}

const resetFontSize = (): void => {
  setFontSize(defaultFontSize.value)
}

const isItemToggled = (item: RadialActionItem | undefined): boolean => {
  if (!item) return false
  if (item.action.kind === 'font-size') {
    return activeFontSize.value !== defaultFontSize.value
  }
  return !!item.active
}

const sectors = computed(() => {
  const count = menuState.value.items.length
  return menuState.value.items.map((_, index) =>
    buildSectorGeometry(
      index,
      count,
      svgCenter,
      svgCenter,
      RADIAL_INNER_RADIUS,
      RADIAL_OUTER_RADIUS
    )
  )
})

const activeItem = computed<RadialActionItem | null>(() => {
  if (activeIndex.value < 0 || activeIndex.value >= menuState.value.items.length) {
    return null
  }
  return menuState.value.items[activeIndex.value] ?? null
})

const activeSector = computed(() => {
  if (activeIndex.value < 0 || activeIndex.value >= sectors.value.length) {
    return null
  }
  return sectors.value[activeIndex.value] ?? null
})

const formatTokensForBadge = (tokens: string[]): string => {
  if (isOsx) {
    return tokens
      .map((token) => {
        switch (token.toLowerCase()) {
          case 'cmd':
          case 'command':
          case 'meta':
          case 'cmdorctrl':
            return '⌘'
          case 'shift':
            return '⇧'
          case 'alt':
          case 'option':
            return '⌥'
          case 'ctrl':
          case 'control':
            return '⌃'
          default:
            return token.length === 1 ? token.toUpperCase() : token
        }
      })
      .join('')
  }
  return tokens.join('+')
}

const activeShortcut = computed<string>(() => {
  const item = activeItem.value
  if (!item) return ''

  if (item.commandId) {
    const registered = commandCenterStore.rootCommand.subcommands.find(
      (cmd) => cmd.id === item.commandId
    )
    if (registered?.shortcut && registered.shortcut.length > 0) {
      return formatTokensForBadge(registered.shortcut)
    }
  }

  return (isOsx ? item.defaultShortcutMac : item.defaultShortcutOther) ?? ''
})

const hasLiveEditorSelection = (): boolean => {
  const activeEl = document.activeElement
  if (
    activeEl instanceof HTMLElement &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
    !activeEl.closest('.editor-wrapper')
  ) {
    return false
  }
  if (editorSelectionState.hasSelection) {
    return true
  }
  const domSelection = window.getSelection()
  if (
    domSelection &&
    !domSelection.isCollapsed &&
    domSelection.toString().trim().length > 0 &&
    domSelection.anchorNode?.parentElement?.closest('.editor-wrapper')
  ) {
    return true
  }
  return false
}

const snapshotCurrentMenu = (): ResolvedRadialMenu => {
  const currentFile = editorStore.currentFile
  const hasCurrentFile = !!currentFile && !!(currentFile.id || currentFile.pathname)
  const isPlainText = !!currentFile && isTextDocument(currentFile)

  return buildRadialMenu({
    hasCurrentFile,
    isPlainText,
    sourceCode: !!preferencesStore.sourceCode,
    showSideBar: !!layoutStore.showSideBar,
    hasSelection: hasLiveEditorSelection(),
    isCodeFences: editorSelectionState.isCodeFences,
    isDisabled: editorSelectionState.isDisabled,
    isTaskList: editorSelectionState.isTaskList,
    activeFormats: { ...editorSelectionState.activeFormats }
  })
}

const openMenuAt = (clientX: number, clientY: number): void => {
  menuState.value = snapshotCurrentMenu()
  menuOrigin.value = clampMenuOrigin(
    clientX,
    clientY,
    window.innerWidth,
    window.innerHeight,
    RADIAL_OUTER_RADIUS
  )
  pressRawPoint = { x: clientX, y: clientY }
  activeIndex.value = -1
  hasLeftDeadZone.value = false
  hasMovedFromPress = false
  hasAdjustedFontInSession = false
  wheelRemainder = 0
  isRightButtonHeld = true
  suppressContextMenuUntil = Date.now() + 1200
  visible.value = true
}

const closeMenu = (): void => {
  visible.value = false
  activeIndex.value = -1
  hasLeftDeadZone.value = false
  hasMovedFromPress = false
  hasAdjustedFontInSession = false
  wheelRemainder = 0
  isRightButtonHeld = false
}

const executeItem = (item: RadialActionItem | undefined): void => {
  if (!item) {
    closeMenu()
    return
  }
  const { action } = item
  if (action.kind === 'font-size') {
    resetFontSize()
    wheelRemainder = 0
    return
  }
  closeMenu()

  requestAnimationFrame(() => {
    if (action.kind === 'ipc') {
      window.electron.ipcRenderer.send(action.channel)
      return
    }

    if (action.focusEditor) {
      bus.emit('editor-focus')
    }
    if (action.payload !== undefined) {
      bus.emit(action.event, action.payload)
    } else {
      bus.emit(action.event)
    }
  })
}

const handleWindowMouseDown = (event: MouseEvent): void => {
  if (isRadialTriggerMouseEvent(event, isOsx)) {
    event.preventDefault()
    event.stopPropagation()
    openMenuAt(event.clientX, event.clientY)
    return
  }

  if (!visible.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  if (event.button === 2) {
    suppressContextMenuUntil = Date.now() + 500
  }

  const { distance } = cartesianToPolar(
    menuOrigin.value.x,
    menuOrigin.value.y,
    event.clientX,
    event.clientY
  )

  if (distance >= RADIAL_DEAD_ZONE_RADIUS && distance <= RADIAL_OUTER_RADIUS + 18) {
    const sectorIdx = getSectorIndexAtPoint(
      menuOrigin.value.x,
      menuOrigin.value.y,
      event.clientX,
      event.clientY,
      menuState.value.items.length,
      RADIAL_DEAD_ZONE_RADIUS
    )
    if (sectorIdx >= 0) {
      executeItem(menuState.value.items[sectorIdx])
      return
    }
  }

  closeMenu()
}

const handleWindowMouseMove = (event: MouseEvent): void => {
  if (!visible.value) return

  if (!hasMovedFromPress) {
    const moveDelta = Math.hypot(
      event.clientX - pressRawPoint.x,
      event.clientY - pressRawPoint.y
    )
    if (moveDelta < RADIAL_MIN_MOVE_PX) {
      return
    }
    hasMovedFromPress = true
  }

  const { distance } = cartesianToPolar(
    menuOrigin.value.x,
    menuOrigin.value.y,
    event.clientX,
    event.clientY
  )

  if (!isRightButtonHeld && distance > RADIAL_OUTER_RADIUS + 26) {
    activeIndex.value = -1
    return
  }

  const sectorIdx = getSectorIndexAtPoint(
    menuOrigin.value.x,
    menuOrigin.value.y,
    event.clientX,
    event.clientY,
    menuState.value.items.length,
    RADIAL_DEAD_ZONE_RADIUS
  )
  if (sectorIdx !== activeIndex.value) {
    wheelRemainder = 0
  }
  activeIndex.value = sectorIdx
  if (sectorIdx >= 0) {
    hasLeftDeadZone.value = true
  }
}

const handleWindowMouseUp = (event: MouseEvent): void => {
  if (!visible.value || !isRightButtonHeld || event.button !== 2) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  isRightButtonHeld = false
  suppressContextMenuUntil = Date.now() + 350

  if (activeIndex.value >= 0) {
    const hovered = menuState.value.items[activeIndex.value]
    if (hovered?.action.kind === 'font-size') {
      // If the user already scrolled the wheel while holding right-click,
      // releasing finishes the gesture cleanly; otherwise keep the disc open
      // so they can comfortably roll the wheel with fingers relaxed.
      if (hasAdjustedFontInSession) {
        closeMenu()
      }
      return
    }
    executeItem(hovered)
    return
  }

  if (hasLeftDeadZone.value) {
    closeMenu()
  }
}

const handleWindowWheel = (event: WheelEvent): void => {
  if (!visible.value) return

  // Always prevent underlying document scroll and Cmd+Wheel window zoom while
  // the radial HUD is active; adjust font size live when hovering the sector.
  event.preventDefault()
  event.stopPropagation()

  if (activeItem.value?.action.kind !== 'font-size') {
    return
  }

  const { step, nextRemainder } = consumeFontWheelDelta(
    event.deltaY,
    event.deltaX,
    event.deltaMode,
    wheelRemainder
  )
  wheelRemainder = nextRemainder
  if (step !== 0) {
    hasAdjustedFontInSession = true
    stepFontSize(step)
  }
}

const handleWindowContextMenu = (event: MouseEvent): void => {
  if (
    visible.value ||
    isRightButtonHeld ||
    Date.now() < suppressContextMenuUntil ||
    isRadialTriggerMouseEvent(event, isOsx)
  ) {
    event.preventDefault()
    event.stopPropagation()
  }
}

const handleWindowKeyDown = (event: KeyboardEvent): void => {
  if (!visible.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    return
  }

  if (activeItem.value?.action.kind === 'font-size') {
    if (event.key === 'ArrowUp' || event.key === '+' || event.key === '=') {
      event.preventDefault()
      event.stopPropagation()
      hasAdjustedFontInSession = true
      stepFontSize(1)
      return
    }
    if (event.key === 'ArrowDown' || event.key === '-') {
      event.preventDefault()
      event.stopPropagation()
      hasAdjustedFontInSession = true
      stepFontSize(-1)
      return
    }
    if (event.key === '0') {
      event.preventDefault()
      event.stopPropagation()
      resetFontSize()
      return
    }
  }

  if ((event.key === 'Enter' || event.key === ' ') && activeIndex.value >= 0) {
    event.preventDefault()
    event.stopPropagation()
    executeItem(menuState.value.items[activeIndex.value])
    return
  }

  if (/^[1-8]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const idx = Number(event.key) - 1
    if (idx >= 0 && idx < menuState.value.items.length) {
      event.preventDefault()
      event.stopPropagation()
      executeItem(menuState.value.items[idx])
    }
  }
}

const handleWindowDismiss = (): void => {
  if (visible.value) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleWindowMouseDown, true)
  window.addEventListener('mousemove', handleWindowMouseMove, { passive: true })
  window.addEventListener('mouseup', handleWindowMouseUp, true)
  window.addEventListener('wheel', handleWindowWheel, { capture: true, passive: false })
  window.addEventListener('contextmenu', handleWindowContextMenu, true)
  window.addEventListener('keydown', handleWindowKeyDown, true)
  window.addEventListener('blur', handleWindowDismiss)
  window.addEventListener('resize', handleWindowDismiss)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleWindowMouseDown, true)
  window.removeEventListener('mousemove', handleWindowMouseMove)
  window.removeEventListener('mouseup', handleWindowMouseUp, true)
  window.removeEventListener('wheel', handleWindowWheel, true)
  window.removeEventListener('contextmenu', handleWindowContextMenu, true)
  window.removeEventListener('keydown', handleWindowKeyDown, true)
  window.removeEventListener('blur', handleWindowDismiss)
  window.removeEventListener('resize', handleWindowDismiss)
})
</script>

<style scoped>
.ag-radial-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: auto;
  user-select: none;
}

.ag-radial-menu {
  position: fixed;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.ag-radial-backdrop {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--floatBgColor) 84%, transparent);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--floatBorderColor);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.24),
    0 2px 10px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.ag-radial-svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.ag-radial-sector-group {
  transition: transform 0.14s cubic-bezier(0.16, 1, 0.3, 1);
}

.ag-radial-wedge {
  fill: var(--editorColor04);
  stroke: var(--editorColor10);
  stroke-width: 1px;
  stroke-linejoin: round;
  transition:
    fill 0.12s ease,
    stroke 0.12s ease,
    stroke-width 0.12s ease;
}

.ag-radial-sector-group.is-toggled .ag-radial-wedge {
  fill: var(--themeColor10);
  stroke: var(--themeColor40);
}

.ag-radial-sector-group.is-hovered .ag-radial-wedge {
  fill: var(--themeColor20);
  stroke: var(--themeColor);
  stroke-width: 1.4px;
}

.ag-radial-direction-dot {
  fill: var(--themeColor);
  transition: cx 0.1s ease, cy 0.1s ease;
}

.ag-radial-item-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 64px;
  text-align: center;
  color: var(--editorColor80);
  pointer-events: none;
  transition:
    transform 0.14s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.12s ease;
}

.ag-radial-item-label.is-toggled {
  color: var(--themeColor);
}

.ag-radial-item-label.is-hovered {
  color: var(--themeColor);
}

.ag-radial-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.ag-radial-icon-wrap svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.85;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.14s cubic-bezier(0.16, 1, 0.3, 1);
}

.ag-radial-item-label.is-hovered .ag-radial-icon-wrap svg {
  transform: scale(1.1);
  stroke-width: 2.05;
}

.ag-radial-active-dot {
  position: absolute;
  top: 0;
  right: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--themeColor);
  box-shadow: 0 0 0 1.5px var(--floatBgColor);
}

.ag-radial-text {
  max-width: 62px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ag-radial-item-label.is-hovered .ag-radial-text {
  font-weight: 600;
}

.ag-radial-center {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 68px;
  height: 68px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--floatBgColor);
  border: 1px solid var(--floatBorderColor);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px;
  box-sizing: border-box;
  text-align: center;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}

.ag-radial-center.is-active {
  border-color: var(--themeColor40);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}

.ag-radial-center-title {
  max-width: 56px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--editorColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ag-radial-center-value {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--themeColor);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ag-radial-center-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--editorColor04);
  border: 1px solid var(--editorColor10);
  color: var(--themeColor);
  font-family: var(--codeFontFamily, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.ag-radial-center-mode {
  max-width: 56px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--editorColor80);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ag-radial-center-hint {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--editorColor50);
}

.ag-radial-pop-enter-active {
  transition: opacity 0.13s cubic-bezier(0.16, 1, 0.3, 1);
}

.ag-radial-pop-leave-active {
  transition: opacity 0.09s ease-out;
}

.ag-radial-pop-enter-active .ag-radial-menu {
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.ag-radial-pop-leave-active .ag-radial-menu {
  transition: transform 0.09s ease-out;
}

.ag-radial-pop-enter-from,
.ag-radial-pop-leave-to {
  opacity: 0;
}

.ag-radial-pop-enter-from .ag-radial-menu {
  transform: translate(-50%, -50%) scale(0.84);
}

.ag-radial-pop-leave-to .ag-radial-menu {
  transform: translate(-50%, -50%) scale(0.94);
}
</style>
