<template>
  <div>
    <!-- Native title bar: no in-app toolbar, but the theme shortcut still works. -->
    <theme-switcher
      v-if="!showTitleBar"
      :show-trigger="false"
    />
    <div
      v-if="showTitleBar"
      class="title-bar-editor-bg"
      :class="{ 'tabs-visible': showTabBar }"
    />
    <div
      v-if="showTitleBar"
      class="title-bar"
      :class="[
        { active: active },
        { 'tabs-visible': showTabBar },
        { frameless: titleBarStyle === 'custom' },
        { isOsx: isOsx }
      ]"
    >
      <div
        v-if="isOsx && !isFullScreen"
        class="osx-traffic-spacer"
        aria-hidden="true"
      />
      <div
        class="title"
        @dblclick.stop="toggleMaxmizeOnMacOS"
      >
        <span
          v-if="!filename"
          class="app-brand"
        >MarkText</span>
        <span
          v-else
          class="title-breadcrumb"
        >
          <span
            v-for="(path, index) of paths"
            :key="index"
            class="path-segment"
          >
            {{ path }}
            <el-icon
              class="path-arrow"
              :size="11"
            >
              <ArrowRight />
            </el-icon>
          </span>
          <span
            class="filename"
            :class="{ isOsx: platform === 'darwin' }"
            @click="rename"
          >
            {{ filename }}
          </span>
          <span
            class="save-dot"
            :class="{ show: !isSaved }"
          />
        </span>
      </div>
      <div :class="showCustomTitleBar ? 'left-toolbar editor-tools title-no-drag' : 'right-toolbar editor-tools'">
        <button
          v-if="showCustomTitleBar"
          ref="menuButtonRef"
          type="button"
          class="titlebar-icon-button title-no-drag"
          :class="{ active: appMenuOpen }"
          data-testid="app-menu"
          aria-haspopup="menu"
          :aria-expanded="appMenuOpen"
          :aria-label="t('titleBar.menu')"
          :title="t('titleBar.menu')"
          @click.stop="handleMenuClick"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.35"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </button>
        <button
          type="button"
          class="titlebar-icon-button title-no-drag"
          :class="{ active: showSideBar }"
          data-testid="sidebar-toggle"
          :aria-pressed="showSideBar"
          :aria-label="t('menu.view.toggleSidebar')"
          :title="`${t('menu.view.toggleSidebar')} (${sidebarShortcutLabel})`"
          @click.stop="toggleSidebar"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.35"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2.5"
              width="12"
              height="11"
              rx="1.8"
            />
            <path d="M6 2.5v11" />
          </svg>
        </button>
        <button
          type="button"
          class="titlebar-icon-button title-no-drag"
          :class="{ active: tocActive }"
          data-testid="toc-toggle"
          :aria-pressed="tocActive"
          :aria-label="t('sideBar.toc.title')"
          :title="`${t('sideBar.toc.title')} (${tocShortcutLabel})`"
          @click.stop="toggleToc"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.35"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 3.5h11M5.5 6.5h8M5.5 9.5h8M2.5 12.5h11" />
          </svg>
        </button>
        <button
          v-if="canToggleSourceCode"
          type="button"
          class="titlebar-icon-button title-no-drag"
          :class="{ active: sourceCode }"
          data-testid="source-mode-toggle"
          :aria-pressed="sourceCode"
          :aria-label="t('menu.view.sourceCodeMode')"
          :title="`${t('menu.view.sourceCodeMode')} (${sourceShortcutLabel})`"
          @click.stop="toggleSourceCodeMode"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.35"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5.25 4.75 2 8l3.25 3.25M10.75 4.75 14 8l-3.25 3.25M9 3.5 7 12.5" />
          </svg>
        </button>
        <theme-switcher />
        <div class="view-scale-cluster title-no-drag">
          <div
            class="font-size-controls title-no-drag"
            role="group"
            :aria-label="fontSizeLabel"
          >
            <button
              type="button"
              data-testid="font-size-decrease"
              :aria-label="t('titleBar.fontSizeDecrease')"
              :title="`${fontSizeLabel}: ${t('titleBar.fontSizeDecrease')}`"
              :disabled="!currentFile || activeFontSize <= 12"
              @click.stop="changeFontSize(-1)"
            >
              A−
            </button>
            <button
              type="button"
              class="font-size-value"
              data-testid="font-size-reset"
              :aria-label="t('titleBar.fontSizeReset', { size: defaultFontSize })"
              :title="`${fontSizeLabel}: ${t('titleBar.fontSizeReset', { size: defaultFontSize })}`"
              :disabled="!currentFile"
              @click.stop="setFontSize(defaultFontSize)"
            >
              {{ activeFontSize }} px
            </button>
            <button
              type="button"
              data-testid="font-size-increase"
              :aria-label="t('titleBar.fontSizeIncrease')"
              :title="`${fontSizeLabel}: ${t('titleBar.fontSizeIncrease')}`"
              :disabled="!currentFile || activeFontSize >= maxFontSize"
              @click.stop="changeFontSize(1)"
            >
              A+
            </button>
          </div>
          <span
            class="scale-divider"
            aria-hidden="true"
          />
          <div class="zoom-controls title-no-drag">
            <button
              type="button"
              data-testid="zoom-out"
              :aria-label="t('commands.window.zoomOut')"
              :title="t('commands.window.zoomOut')"
              :disabled="zoom <= MIN_ZOOM_FACTOR"
              @click.stop="changeZoom(-1)"
            >
              −
            </button>
            <button
              type="button"
              class="zoom-value"
              data-testid="zoom-reset"
              :aria-label="t('commands.view.actualSize')"
              :title="t('commands.view.actualSize')"
              @click.stop="resetDisplayZoom"
            >
              {{ zoomPercent }}%
            </button>
            <button
              type="button"
              data-testid="zoom-in"
              :aria-label="t('commands.window.zoomIn')"
              :title="t('commands.window.zoomIn')"
              :disabled="zoom >= MAX_ZOOM_FACTOR"
              @click.stop="changeZoom(1)"
            >
              +
            </button>
          </div>
        </div>
        <!-- Frameless Windows/Linux keep the count on the right (below); elsewhere it stays in this toolbar. -->
        <word-count-badge
          v-if="wordCount && !showCustomTitleBar"
          :word-count="wordCount"
        />
      </div>
      <div
        v-if="wordCount && showCustomTitleBar"
        class="word-count-slot title-no-drag"
        :class="{ 'with-window-controls': windowControlsVisible }"
      >
        <word-count-badge :word-count="wordCount" />
      </div>
      <div
        v-if="windowControlsVisible"
        class="right-toolbar"
        :class="[{ 'title-no-drag': titleBarStyle === 'custom' }]"
      >
        <div
          class="frameless-titlebar-button frameless-titlebar-close"
          @click.stop="handleCloseClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconClose" />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-toggle"
          @click.stop="handleMaximizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path
                v-show="!isMaximized"
                :d="windowIconMaximize"
              />
              <path
                v-show="isMaximized"
                :d="windowIconRestore"
              />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-minimize"
          @click.stop="handleMinimizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconMinimize" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/store/preferences.js'
import { useLayoutStore } from '@/store/layout.js'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { minimizePath, restorePath, maximizePath, closePath } from '../../assets/window-controls.js'
import { PATH_SEPARATOR } from '../../config'
import { isOsx as isOsxPlatform } from '@/util'
import { shouldShowInAppTitleBar } from './visibility'
import { useEditorStore } from '@/store/editor'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import { ArrowRight } from '@element-plus/icons-vue'
import ThemeSwitcher from './themeSwitcher.vue'
import WordCountBadge from './wordCountBadge.vue'
import { menuPositionBelow } from './titlebarPopup'
import { isTextDocument } from 'common/textDocument'
import type { FileWordCount } from '@shared/types/files'
import {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  stepZoomFactor
} from 'common/zoom'

interface ProjectInfo {
  name?: string
  [key: string]: unknown
}

const props = defineProps<{
  project?: ProjectInfo | null
  filename?: string
  pathname?: string
  active?: boolean
  wordCount?: FileWordCount | null
  platform?: string
  isSaved?: boolean
}>()

const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const editorStore = useEditorStore()
const { t } = useI18n()

const isOsx = isOsxPlatform
const windowIconMinimize = minimizePath
const windowIconRestore = restorePath
const windowIconMaximize = maximizePath
const windowIconClose = closePath

const isFullScreen = ref(false)
const isMaximized = ref(false)

onMounted(async () => {
  try {
    const [fs, max] = await Promise.all([
      window.electron.windowControl.isFullScreen(),
      window.electron.windowControl.isMaximized()
    ])
    isFullScreen.value = !!fs
    isMaximized.value = !!max
  } catch {}
})

const { titleBarStyle, zoom, fontSize, codeFontSize, sourceCode } = storeToRefs(preferencesStore)
const { showTabBar, showSideBar, rightColumn } = storeToRefs(layoutStore)

const { currentFile } = storeToRefs(editorStore)
const usesCodeFont = computed(() => !!currentFile.value && (isTextDocument(currentFile.value) || sourceCode.value))
const activeFontSize = computed(() => usesCodeFont.value ? codeFontSize.value : fontSize.value)
const defaultFontSize = computed(() => usesCodeFont.value ? 14 : 16)
const maxFontSize = computed(() => usesCodeFont.value ? 28 : 32)
const fontSizeLabel = computed(() => t(usesCodeFont.value ? 'titleBar.codeFontSize' : 'titleBar.markdownFontSize'))
const setFontSize = (value: number) => {
  if (!currentFile.value) return
  preferencesStore.SET_SINGLE_PREFERENCE({
    type: usesCodeFont.value ? 'codeFontSize' : 'fontSize',
    value: Math.min(maxFontSize.value, Math.max(12, value))
  })
}
const changeFontSize = (direction: -1 | 1) => setFontSize(activeFontSize.value + direction)

const zoomPercent = computed(() => Math.round(zoom.value * 100))

// The table of contents (heading navigation) lives in the left side bar.
const tocActive = computed(() => showSideBar.value && rightColumn.value === 'toc')
const sidebarShortcutLabel = isOsx ? '⌘J' : 'Ctrl+J'
const tocShortcutLabel = isOsx ? '⌘K' : 'Ctrl+K'
const sourceShortcutLabel = isOsx ? '⌘E' : 'Ctrl+E'
const canToggleSourceCode = computed(() => !!currentFile.value && !isTextDocument(currentFile.value))

const toggleSidebar = () => {
  bus.emit('view:toggle-layout-entry', 'showSideBar')
}

const toggleSourceCodeMode = () => {
  bus.emit('view:toggle-view-entry', 'sourceCode')
}

const toggleToc = () => {
  if (tocActive.value) {
    layoutStore.SET_LAYOUT({ showSideBar: false })
  } else {
    layoutStore.SET_LAYOUT({ showSideBar: true, rightColumn: 'toc' })
  }
  layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
}

const changeZoom = (direction: -1 | 1) => {
  editorStore.EDIT_ZOOM(stepZoomFactor(zoom.value, direction))
}

const resetDisplayZoom = () => {
  editorStore.EDIT_ZOOM(DEFAULT_ZOOM_FACTOR)
}

const paths = computed(() => {
  if (!props.pathname) return []
  const pathnameToken = props.pathname.split(PATH_SEPARATOR).filter((i) => i)
  return pathnameToken.slice(0, pathnameToken.length - 1).slice(-3)
})

const showCustomTitleBar = computed(() => {
  return titleBarStyle.value === 'custom' && !isOsx
})

// The minimize / maximize / close buttons are drawn only on a frameless window.
const windowControlsVisible = computed(
  () => titleBarStyle.value === 'custom' && !isFullScreen.value && !isOsx
)

const showTitleBar = computed(() => {
  return shouldShowInAppTitleBar(titleBarStyle.value, isOsx)
})

watch(
  () => props.filename,
  (value) => {
    // Set filename when hover on dock
    const hasOpenFolder = !!(props.project && props.project.name)
    const projectName = props.project?.name ?? ''
    let title = ''
    if (value) {
      title = hasOpenFolder ? `${value} - ${projectName}` : `${value}`
    } else {
      title = hasOpenFolder ? projectName : ''
    }

    document.title = title ? `${title} - MarkText` : 'MarkText'
  }
)

const handleCloseClick = () => {
  window.electron.windowControl.close()
}

const handleMaximizeClick = async () => {
  if (isFullScreen.value) {
    window.electron.windowControl.setFullScreen(false)
    return
  }
  if (isMaximized.value) window.electron.windowControl.unmaximize()
  else window.electron.windowControl.maximize()
}

const toggleMaxmizeOnMacOS = () => {
  if (isOsx) {
    handleMaximizeClick()
  }
}

const handleMinimizeClick = () => {
  window.electron.windowControl.minimize()
}

const menuButtonRef = ref<HTMLElement | null>(null)
const appMenuOpen = ref(false)

const handleMenuClick = () => {
  const rect = menuButtonRef.value?.getBoundingClientRect()
  const position = rect ? menuPositionBelow(rect, zoom.value) : { x: 10, y: 30 }
  appMenuOpen.value = true
  window.electron.windowControl.popupApplicationMenu(position)
}

const onApplicationMenuClosed = () => {
  appMenuOpen.value = false
}

const rename = () => {
  if (props.platform === 'darwin') {
    editorStore.RESPONSE_FOR_RENAME()
  }
}

const onMaximize = () => {
  isMaximized.value = true
}
const onUnmaximize = () => {
  isMaximized.value = false
}
const onEnterFullScreen = () => {
  isFullScreen.value = true
}
const onLeaveFullScreen = () => {
  isFullScreen.value = false
}

const offMaximize = window.electron.ipcRenderer.on('mt::window-maximize', onMaximize)
const offUnmaximize = window.electron.ipcRenderer.on('mt::window-unmaximize', onUnmaximize)
const offEnterFullScreen = window.electron.ipcRenderer.on(
  'mt::window-enter-full-screen',
  onEnterFullScreen
)
const offLeaveFullScreen = window.electron.ipcRenderer.on(
  'mt::window-leave-full-screen',
  onLeaveFullScreen
)
const offApplicationMenuClosed = window.electron.ipcRenderer.on(
  'mt::menu::application-closed',
  onApplicationMenuClosed
)

onBeforeUnmount(() => {
  offMaximize()
  offUnmaximize()
  offEnterFullScreen()
  offLeaveFullScreen()
  offApplicationMenuClosed()
})
</script>

<style scoped>
.title-bar-editor-bg {
  height: var(--titleBarHeight);
  background: var(--editorBgColor);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
}
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
  background: transparent;
  height: var(--titleBarHeight);
  box-sizing: border-box;
  color: var(--editorColor50);
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.25s ease, background-color 0.25s ease;
  cursor: default;
}
.active {
  color: var(--editorColor);
}
.osx-traffic-spacer {
  order: 1;
  flex: 0 0 74px;
  height: 100%;
}
img {
  height: 90%;
  margin-top: 1px;
  vertical-align: top;
}
.title {
  order: 2;
  flex: 1 1 0;
  min-width: 0;
  padding: 0 8px;
  height: 100%;
  line-height: var(--titleBarHeight);
  font-size: 13px;
  text-align: center;
  overflow: hidden;
  transition: color 0.2s ease;
  & .app-brand {
    font-weight: 600;
    letter-spacing: 0.02em;
    opacity: 0.75;
  }
  & .title-breadcrumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: top;
  }
  & .path-segment {
    display: inline-flex;
    align-items: center;
    color: var(--editorColor40);
    font-size: 12px;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  & .path-arrow {
    margin: 0 3px;
    opacity: 0.65;
    flex-shrink: 0;
  }
  & .filename {
    font-weight: 500;
    color: var(--editorColor80);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s ease;
  }
}

.title-bar .title .filename.isOsx {
  cursor: pointer;
}

.title-bar .title .filename.isOsx:hover {
  color: var(--themeColor);
}

.save-dot {
  margin-left: 6px;
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  display: inline-block;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  opacity: 0;
  transform: scale(0.6);
  visibility: hidden;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.active .save-dot.show,
.save-dot.show {
  opacity: 0.85;
  transform: scale(1);
  visibility: visible;
}
.title:hover {
  color: var(--sideBarTitleColor);
}

.left-toolbar {
  order: 1;
  flex: 0 0 auto;
  padding-left: 8px;
  height: 100%;
  align-items: center;
  gap: 3px;
  display: flex;
  flex-direction: row;
}
.right-toolbar {
  order: 4;
  flex: 0 0 138px;
  height: 100%;
  width: 138px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  & .item {
    margin-right: 10px;
  }
}

/* macOS: keep the same left-to-right order as the Windows/Linux toolbar
   (Sidebar, TOC, Source, Theme, Scale, Word count) instead of the reversed window-button order. */
.right-toolbar.editor-tools {
  order: 3;
  flex: 0 0 auto;
  width: auto;
  padding-right: 10px;
  gap: 3px;
  box-sizing: border-box;
  flex-direction: row;
  justify-content: flex-end;
}

.word-count-slot {
  order: 3;
  flex: 0 0 auto;
  padding-right: 8px;
  height: 100%;
  display: flex;
  align-items: center;
}

.word-count-slot.with-window-controls {
  padding-right: 4px;
}

.titlebar-icon-button {
  -webkit-app-region: no-drag;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  align-self: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--editorColor10);
  border-radius: 6px;
  background: var(--editorColor04);
  color: var(--editorColor60);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.titlebar-icon-button:hover,
.titlebar-icon-button.active {
  color: var(--editorColor);
  background: var(--sideBarBgColor);
  border-color: var(--editorColor30);
}

.titlebar-icon-button.active {
  color: var(--themeColor);
  border-color: var(--themeColor40);
  background: var(--themeColor10);
}

.view-scale-cluster {
  height: 24px;
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  border: 1px solid var(--editorColor10);
  border-radius: 6px;
  background: var(--editorColor04);
  overflow: hidden;
  opacity: 0.8;
  transition: opacity 0.15s ease, border-color 0.15s ease;

  &:hover {
    opacity: 1;
    border-color: var(--editorColor30);
  }

  & .scale-divider {
    width: 1px;
    background: var(--editorColor10);
    flex: 0 0 1px;
  }
}

.font-size-controls,
.zoom-controls {
  height: 100%;
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;

  & button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--editorColor60);
    min-width: 19px;
    padding: 0 4px;
    cursor: pointer;
    font: inherit;
    font-size: 10.5px;
    line-height: 22px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  & button:hover:not(:disabled) {
    color: var(--editorColor);
    background: var(--sideBarBgColor);
  }

  & button:disabled {
    opacity: 0.32;
    cursor: default;
  }

  & .font-size-value,
  & .zoom-value {
    min-width: 39px;
    padding: 0 4px;
    border-left: 1px solid var(--editorColor04);
    border-right: 1px solid var(--editorColor04);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 620px) {
  .title .path-segment {
    display: none;
  }
}

.title-no-drag {
  -webkit-app-region: no-drag;
}
/* frameless window controls */
.frameless-titlebar-button {
  position: relative;
  display: block;
  width: 46px;
  height: var(--titleBarHeight);
  color: var(--editorColor60);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.frameless-titlebar-button > div {
  position: absolute;
  display: inline-flex;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
}
.frameless-titlebar-close:hover {
  background-color: rgb(228, 79, 79);
  color: #ffffff;
}
.frameless-titlebar-minimize:hover,
.frameless-titlebar-toggle:hover {
  background-color: var(--sideBarItemHoverBgColor);
  color: var(--editorColor);
}
.frameless-titlebar-button svg {
  fill: currentColor;
}
.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}
</style>
