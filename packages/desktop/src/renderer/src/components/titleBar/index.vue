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
        class="title"
        @dblclick.stop="toggleMaxmizeOnMacOS"
      >
        <span v-if="!filename">MarkText</span>
        <span v-else>
          <span
            v-for="(path, index) of paths"
            :key="index"
          >
            {{ path }}
            <el-icon
              class="path-arrow"
              :size="12"
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
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
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
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 3.5h11M5.5 6.5h8M5.5 9.5h8M2.5 12.5h11" />
          </svg>
        </button>
        <theme-switcher />
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
import { ArrowRight } from '@element-plus/icons-vue'
import ThemeSwitcher from './themeSwitcher.vue'
import WordCountBadge from './wordCountBadge.vue'
import { menuPositionBelow } from './titlebarPopup'
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

const { titleBarStyle, zoom } = storeToRefs(preferencesStore)
const { showTabBar, showSideBar, rightColumn } = storeToRefs(layoutStore)

const zoomPercent = computed(() => Math.round(zoom.value * 100))

// The table of contents (heading navigation) lives in the left side bar.
const tocActive = computed(() => showSideBar.value && rightColumn.value === 'toc')
const tocShortcutLabel = isOsx ? '⌘K' : 'Ctrl+K'

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
  transition: color 0.4s ease-in-out;
  cursor: default;
}
.active {
  color: var(--editorColor);
}
img {
  height: 90%;
  margin-top: 1px;
  vertical-align: top;
}
.title {
  padding: 0 270px;
  height: 100%;
  line-height: var(--titleBarHeight);
  font-size: 14px;
  text-align: center;
  transition: all 0.25s ease-in-out;
  & .filename {
    transition: all 0.25s ease-in-out;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    height: 1px;
    width: 100%;
    z-index: 1;
    -webkit-app-region: no-drag;
  }
}
div.title > span {
  /* Workaround for GH#339 */
  display: block;
  direction: rtl;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.title-bar .title .filename.isOsx:hover {
  color: var(--themeColor);
}

.active .save-dot {
  margin-right: 0.25rem;
  width: 8px;
  height: 8px;
  display: inline-block;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  opacity: 0.7;
  visibility: hidden;
}
.active .save-dot.show {
  visibility: visible;
}
.title:hover {
  color: var(--sideBarTitleColor);
}

.left-toolbar {
  padding: 0 10px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  align-items: center;
  width: auto; /* grows with the buttons; + 2*10px padding */
  display: flex;
  flex-direction: row;
}
.right-toolbar {
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  width: 138px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  & .item {
    margin-right: 10px;
  }
}

/* macOS: keep the same left-to-right order as the Windows/Linux toolbar
   (TOC, theme, zoom, word count) instead of the reversed window-button order. */
.right-toolbar.editor-tools {
  width: 270px;
  padding-right: 8px;
  box-sizing: border-box;
  flex-direction: row;
  justify-content: flex-end;
}

.word-count-slot {
  position: absolute;
  top: 0;
  right: 12px;
  height: 100%;
  display: flex;
  align-items: center;
}

/* Sit just left of the minimize / maximize / close buttons (3 x 46px). */
.word-count-slot.with-window-controls {
  right: 146px;
}

.titlebar-icon-button {
  -webkit-app-region: no-drag;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  align-self: center;
  width: 26px;
  height: 24px;
  margin: 0 4px;
  padding: 0;
  border: 1px solid var(--editorColor10);
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor50);
  cursor: pointer;
}

.titlebar-icon-button:hover,
.titlebar-icon-button.active {
  color: var(--editorColor);
  background: var(--sideBarBgColor);
}

.zoom-controls {
  height: 24px;
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  border: 1px solid var(--editorColor10);
  border-radius: 4px;
  overflow: hidden;
  margin: 0 4px;

  & button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--editorColor50);
    min-width: 23px;
    padding: 0 5px;
    cursor: pointer;
    font: inherit;
    line-height: 22px;
  }

  & button:hover:not(:disabled) {
    color: var(--editorColor);
    background: var(--sideBarBgColor);
  }

  & button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  & .zoom-value {
    min-width: 48px;
    border-left: 1px solid var(--editorColor10);
    border-right: 1px solid var(--editorColor10);
    font-size: 12px;
  }
}

@media (max-width: 700px) {
  .title {
    display: none;
  }

  .word-count-slot {
    display: none;
  }

  .right-toolbar.editor-tools {
    width: 195px;
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
}
.frameless-titlebar-minimize:hover,
.frameless-titlebar-toggle:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
.frameless-titlebar-button svg {
  fill: #000000;
}
.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}

</style>
