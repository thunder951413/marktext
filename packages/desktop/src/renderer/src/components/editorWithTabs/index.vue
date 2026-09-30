<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px)` }"
  >
    <tabs v-show="showTabBar" />
    <div class="container">
      <editor
        :markdown="markdown"
        :cursor="cursor"
        :text-direction="textDirection"
        :platform="platform"
      />
      <source-code
        v-if="sourceCode"
        :markdown="markdown"
        :muya-index-cursor="muyaIndexCursor"
        :text-direction="textDirection"
      />
    </div>
    <div
      v-if="vimEnabled"
      class="vim-status"
      data-testid="vim-status"
      :class="`mode-${vimMode}`"
    >
      <span>{{ vimModeLabel }}</span>
      <span
        v-if="vimPending"
        class="vim-pending"
      >{{ vimPending }}</span>
    </div>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import { useLayoutStore } from '@/store/layout'
import { useVimStore } from '@/store/vim'
import bus from '@/bus'
import { isVimModeEnabled } from '@/util/vim/enabled'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue'
import Tabs from './tabs.vue'
import MuyaEditor from './editor.vue'
import TabNotifications from './notifications.vue'

// Source mode carries CodeMirror and its language descriptions. Most sessions
// never open it, so keep that work out of the WYSIWYG startup path.
const SourceCode = defineAsyncComponent(() => import('./sourceCode.vue'))
const Editor = window.electron.process.env.MARKTEXT_EDITOR_ENGINE === 'codemirror'
  ? defineAsyncComponent(() => import('./codemirrorEditor.vue'))
  : MuyaEditor

defineProps<{
  markdown: string
  // `cursor` originates as `IFileState.cursor` which is `unknown`
  // (see src/shared/types/files.ts); align here instead of forcing every
  // caller to widen.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()

const { effectiveSideBarWidth } = storeToRefs(useLayoutStore())
const vimStore = useVimStore()
const { mode: vimMode, pending: vimPending } = storeToRefs(vimStore)
const vimModeLabel = computed(() => vimMode.value.replace('-', ' ').toUpperCase())
const vimEnabled = isVimModeEnabled()
const handleVimModeChange = (mode: unknown) => vimStore.SET_MODE(mode as typeof vimMode.value)

onMounted(() => bus.on('vim-mode-change', handleVimModeChange))
onBeforeUnmount(() => bus.off('vim-mode-change', handleVimModeChange))
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;

  overflow: hidden;
  background: var(--editorBgColor);
  & > .container {
    flex: 1;
    overflow: hidden;
  }

  & > .vim-status {
    box-sizing: border-box;
    height: 24px;
    flex: 0 0 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    border-top: 1px solid var(--floatBorderColor);
    background: var(--editorBgColor);
    color: var(--editorColor);
    font-family: var(--codeFontFamily, monospace);
    font-size: 11px;
    user-select: none;

    &.mode-insert {
      color: var(--primaryColor);
    }

    &.mode-visual,
    &.mode-visual-line {
      color: var(--warningColor, #d97706);
    }

    & .vim-pending {
      opacity: 0.7;
    }
  }
}
</style>
