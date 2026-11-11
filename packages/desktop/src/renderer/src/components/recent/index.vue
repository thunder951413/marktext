<template>
  <div class="recent-files-projects">
    <div class="centered-group">
      <div
        class="welcome-emblem"
        aria-hidden="true"
      >
        <svg
          width="42"
          height="42"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect
            x="8"
            y="6"
            width="32"
            height="36"
            rx="5"
          />
          <path d="M16 16v10l4-4 4 4V16" />
          <path d="M30 18v8m-3-3 3 3 3-3" />
          <path d="M16 33h16" />
        </svg>
      </div>
      <div class="welcome-title">
        {{ t('recent.noTabsOpen') }}
      </div>
      <div class="welcome-actions">
        <el-button
          text
          bg
          type="primary"
          @click="newFile"
        >
          {{ t('recent.newFile') }}
        </el-button>
        <button
          type="button"
          class="secondary-action"
          @click="openFolder"
        >
          {{ t('sideBar.tree.openFolder') }}
        </button>
      </div>

      <section
        v-if="recentItems.length > 0"
        class="recent-section"
        data-testid="recent-documents"
      >
        <div class="recent-header">
          <span class="recent-heading">{{ t('menu.file.openRecent') }}</span>
          <button
            type="button"
            class="recent-clear"
            @click="clearRecent"
          >
            {{ t('menu.file.clearRecentlyUsed') }}
          </button>
        </div>
        <ul class="recent-list">
          <li
            v-for="item in recentItems"
            :key="item.pathname"
            :title="item.pathname"
            @click="openRecent(item.pathname)"
          >
            <span
              class="recent-icon"
              aria-hidden="true"
            >
              <svg
                v-if="item.isDirectory"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1.75 4.25a1.5 1.5 0 0 1 1.5-1.5h2.6l1.4 1.5h5.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" />
              </svg>
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 2h5.5L13 5.5v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                <path d="M9.25 2v3.75H13" />
              </svg>
            </span>
            <span class="recent-name">{{ item.name }}</span>
            <span class="recent-dir">{{ item.dir }}</span>
          </li>
        </ul>
      </section>

      <ul
        class="shortcut-list"
        :aria-label="t('recent.shortcutsAriaLabel')"
      >
        <li @click="newFile">
          <span class="shortcut-label">{{ t('recent.newFile') }}</span>
          <span class="shortcut-keys">
            <kbd>{{ modKey }}</kbd><kbd>N</kbd>
          </span>
        </li>
        <li @click="openFolder">
          <span class="shortcut-label">{{ t('sideBar.tree.openFolder') }}</span>
          <span class="shortcut-keys">
            <kbd>{{ modKey }}</kbd><kbd>O</kbd>
          </span>
        </li>
        <li @click="openCommandPalette">
          <span class="shortcut-label">{{ t('commandPalette.placeholder') }}</span>
          <span class="shortcut-keys">
            <kbd>{{ modKey }}</kbd><kbd>{{ shiftKey }}</kbd><kbd>P</kbd>
          </span>
        </li>
        <li @click="openPreferences">
          <span class="shortcut-label">{{ t('menu.marktext.preferences') }}</span>
          <span class="shortcut-keys">
            <kbd>{{ modKey }}</kbd><kbd>,</kbd>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { isOsx } from '@/util'
import bus from '@/bus'
import { PATH_SEPARATOR } from '../../config'
import { t } from '../../i18n'

interface RecentEntryView {
  pathname: string
  name: string
  dir: string
  isDirectory: boolean
}

const editorStore = useEditorStore()
const projectStore = useProjectStore()

const modKey = isOsx ? '⌘' : 'Ctrl'
const shiftKey = isOsx ? '⇧' : 'Shift'
const recentItems = ref<RecentEntryView[]>([])

const formatRecentEntry = (pathname: string, isDirectory: boolean): RecentEntryView => {
  const parts = pathname.split(PATH_SEPARATOR).filter(Boolean)
  const name = parts[parts.length - 1] ?? pathname
  const parentParts = parts.slice(0, -1).slice(-2)
  const dir = parentParts.length > 0 ? parentParts.join('/') : ''
  return { pathname, name, dir, isDirectory }
}

const loadRecentDocuments = async () => {
  try {
    const raw = await window.electron?.ipcRenderer?.invoke?.('mt::get-recently-used-documents')
    if (Array.isArray(raw)) {
      recentItems.value = raw
        .slice(0, 6)
        .map((entry) => formatRecentEntry(entry.pathname, entry.isDirectory))
    }
  } catch {
    recentItems.value = []
  }
}

onMounted(() => {
  loadRecentDocuments()
})

const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

const openFolder = () => {
  projectStore.ASK_FOR_OPEN_PROJECT()
}

const openRecent = (pathname: string) => {
  window.electron?.ipcRenderer?.send?.('mt::open-recently-used-document', pathname)
}

const clearRecent = () => {
  window.electron?.ipcRenderer?.send?.('mt::clear-recently-used-documents')
  recentItems.value = []
}

const openCommandPalette = () => {
  bus.emit('show-command-palette')
}

const openPreferences = () => {
  window.electron?.ipcRenderer?.send?.('mt::open-setting-window')
}
</script>

<style scoped>
.recent-files-projects {
  background: var(--editorBgColor);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  user-select: none;
  padding: 24px;
  box-sizing: border-box;
  overflow-y: auto;
  & .centered-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 420px;
    width: 100%;
    color: var(--editorColor);
    & .welcome-emblem {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: var(--editorColor04);
      border: 1px solid var(--editorColor10);
      color: var(--themeColor);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }
    & .welcome-title {
      font-size: 15px;
      font-weight: 500;
      color: var(--editorColor80);
    }
    & .welcome-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
    }
    & .el-button {
      margin: 0;
      height: 34px;
      padding: 0 18px;
      border-radius: 6px;
      font-weight: 500;
    }
    & .el-button.is-text.is-has-bg {
      background-color: var(--buttonPrimaryBgColor);
      color: var(--buttonPrimaryFontColor);
      border-color: transparent;
    }
    & .el-button.is-text.is-has-bg:hover,
    & .el-button.is-text.is-has-bg:focus {
      background-color: var(--buttonPrimaryBgColorHover);
      color: var(--buttonPrimaryFontColorHover);
    }
    & .secondary-action {
      height: 34px;
      padding: 0 16px;
      border-radius: 6px;
      border: 1px solid var(--editorColor10);
      background: var(--editorColor04);
      color: var(--editorColor80);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    & .secondary-action:hover {
      background: var(--sideBarBgColor);
      border-color: var(--editorColor30);
      color: var(--editorColor);
    }

    & .recent-section {
      width: 100%;
      margin-top: 26px;
      padding-top: 14px;
      border-top: 1px solid var(--editorColor10);
    }
    & .recent-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 6px;
    }
    & .recent-heading {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--editorColor50);
    }
    & .recent-clear {
      border: none;
      background: transparent;
      color: var(--editorColor40);
      font-size: 11.5px;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease;
    }
    & .recent-clear:hover {
      color: var(--editorColor80);
      background: var(--editorColor04);
    }
    & .recent-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    & .recent-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    & .recent-list li:hover {
      background: var(--editorColor04);
    }
    & .recent-icon {
      display: inline-flex;
      align-items: center;
      color: var(--themeColor);
      opacity: 0.85;
      flex-shrink: 0;
    }
    & .recent-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--editorColor80);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 55%;
    }
    & .recent-list li:hover .recent-name {
      color: var(--editorColor);
    }
    & .recent-dir {
      margin-left: auto;
      font-size: 11.5px;
      color: var(--editorColor40);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 40%;
    }

    & .shortcut-list {
      list-style: none;
      margin: 20px 0 0;
      padding: 12px 0 0;
      width: 100%;
      border-top: 1px solid var(--editorColor10);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    & .shortcut-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12.5px;
      color: var(--editorColor50);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    & .shortcut-list li:hover {
      background: var(--editorColor04);
      color: var(--editorColor80);
    }
    & .shortcut-keys {
      display: inline-flex;
      gap: 4px;
    }
    & .shortcut-keys kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 4px;
      border: 1px solid var(--editorColor10);
      background: var(--editorColor04);
      color: var(--editorColor60);
      font-family: var(--codeFontFamily, monospace);
      font-size: 11px;
      box-sizing: border-box;
    }
  }
}
</style>
