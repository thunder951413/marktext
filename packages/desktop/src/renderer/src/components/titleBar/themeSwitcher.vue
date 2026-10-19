<template>
  <div
    v-if="showTrigger"
    class="theme-switcher"
  >
    <button
      ref="triggerRef"
      type="button"
      class="theme-switcher-trigger"
      :class="{ active: open }"
      data-testid="theme-switcher-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="t('titleBar.themeSwitcher.title')"
      :title="`${t('titleBar.themeSwitcher.title')} (${shortcutLabel})`"
      @click.stop="toggle"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.4-.55 1.4-1.2 0-.7-.5-1-.5-1.65 0-.65.5-1.1 1.2-1.1h1.4a2.2 2.2 0 0 0 2.2-2.2C13.7 4.7 11.2 1.75 8 1.75Z" />
        <circle
          cx="4.9"
          cy="7.6"
          r=".7"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="6.7"
          cy="4.9"
          r=".7"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="10"
          cy="4.7"
          r=".7"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      class="theme-switcher-backdrop"
      @mousedown="cancel"
    />
    <div
      v-if="open"
      class="theme-switcher-panel"
      :style="panelStyle"
      role="dialog"
      :aria-label="t('titleBar.themeSwitcher.title')"
      data-testid="theme-switcher-panel"
      @mouseleave="restoreCurrent"
    >
      <input
        ref="filterRef"
        v-model="query"
        class="theme-switcher-filter"
        type="text"
        spellcheck="false"
        autocomplete="off"
        data-testid="theme-switcher-filter"
        :placeholder="t('titleBar.themeSwitcher.filter')"
        @keydown="onFilterKeydown"
      >
      <div
        v-if="followSystemTheme"
        class="theme-switcher-notice"
      >
        {{ t('titleBar.themeSwitcher.followNotice') }}
      </div>
      <ul
        ref="listRef"
        class="theme-switcher-list"
        role="listbox"
      >
        <template
          v-for="group in groups"
          :key="group.id"
        >
          <li
            class="theme-switcher-group"
            role="presentation"
          >
            {{ group.title }}
          </li>
          <li
            v-for="option in group.options"
            :key="option.id"
            class="theme-switcher-item"
            :class="{ highlighted: option.id === highlightedId, current: option.id === theme }"
            :data-theme-id="option.id"
            role="option"
            :aria-selected="option.id === theme"
            @mouseenter="highlight(option.id)"
            @click="commit(option.id)"
          >
            <span
              class="theme-switcher-chip"
              :style="{ background: chipColor(option.id) }"
            />
            <span class="theme-switcher-label">{{ option.label }}</span>
            <span
              v-if="option.id === theme"
              class="theme-switcher-check"
              aria-hidden="true"
            >✓</span>
          </li>
        </template>
        <li
          v-if="!visibleOptions.length"
          class="theme-switcher-empty"
        >
          {{ t('titleBar.themeSwitcher.noMatch') }}
        </li>
      </ul>
      <div class="theme-switcher-hint">
        {{ t('titleBar.themeSwitcher.hint') }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import { addThemeStyle } from '@/util/theme'
import { isOsx } from '@/util'
import { getThemeBackgroundColor } from 'common/theme'
import { buildThemeOptions, filterThemeOptions, stepIndex } from './themeSwitcherLogic'

withDefaults(defineProps<{ showTrigger?: boolean }>(), { showTrigger: true })

const { t } = useI18n()
const preferencesStore = usePreferencesStore()
const { theme, followSystemTheme } = storeToRefs(preferencesStore)

const open = ref(false)
const query = ref('')
const highlightedId = ref<string | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const filterRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const shortcutLabel = isOsx ? '⌘⌥T' : 'Ctrl+Alt+T'

const allOptions = computed(() =>
  buildThemeOptions((labelKey) => t(`menu.theme.${labelKey}`))
)
const visibleOptions = computed(() => filterThemeOptions(allOptions.value, query.value))
const groups = computed(() =>
  (['light', 'dark'] as const)
    .map((id) => ({
      id,
      title: t(id === 'light' ? 'menu.theme.lightThemes' : 'menu.theme.darkThemes'),
      options: visibleOptions.value.filter((option) => option.group === id)
    }))
    .filter((group) => group.options.length)
)

const chipColor = (id: string): string => getThemeBackgroundColor(id)

const positionPanel = (): void => {
  const rect = triggerRef.value?.getBoundingClientRect()
  const top = (rect ? rect.bottom : 32) + 6
  // Keep the panel inside the window: right-align to the trigger when there is
  // room on its left, otherwise stick to the window edge.
  const right = rect ? Math.max(8, window.innerWidth - rect.right - 8) : 16
  panelStyle.value = {
    top: `${top}px`,
    right: `${right}px`,
    maxHeight: `${Math.max(240, window.innerHeight - top - 16)}px`
  }
}

const preview = (id: string): void => {
  addThemeStyle(id)
}

// Put the page back on the saved theme (hover left the list, or cancelled).
const restoreCurrent = (): void => {
  highlightedId.value = null
  addThemeStyle(theme.value)
}

const highlight = (id: string): void => {
  if (highlightedId.value === id) return
  highlightedId.value = id
  preview(id)
}

const scrollHighlightedIntoView = (): void => {
  nextTick(() => {
    const el = listRef.value?.querySelector('.theme-switcher-item.highlighted')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

const openPanel = (): void => {
  if (open.value) return
  query.value = ''
  highlightedId.value = null
  positionPanel()
  open.value = true
  nextTick(() => {
    filterRef.value?.focus()
    listRef.value?.querySelector('.theme-switcher-item.current')?.scrollIntoView({ block: 'center' })
  })
}

const cancel = (): void => {
  if (!open.value) return
  restoreCurrent()
  open.value = false
}

const toggle = (): void => {
  if (open.value) cancel()
  else openPanel()
}

const commit = (id: string): void => {
  // A manually chosen theme must not be overridden the next time the system
  // switches between light and dark.
  if (followSystemTheme.value) {
    preferencesStore.SET_SINGLE_PREFERENCE({ type: 'followSystemTheme', value: false })
  }
  if (id !== theme.value) {
    preferencesStore.SET_SINGLE_PREFERENCE({ type: 'theme', value: id })
  }
  addThemeStyle(id)
  highlightedId.value = null
  open.value = false
}

const move = (delta: number): void => {
  const list = visibleOptions.value
  const current = list.findIndex((option) => option.id === (highlightedId.value ?? theme.value))
  const next = list[stepIndex(list.length, current, delta)]
  if (next) {
    highlight(next.id)
    scrollHighlightedIntoView()
  }
}

const onFilterKeydown = (event: KeyboardEvent): void => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter': {
      event.preventDefault()
      const id = highlightedId.value ?? visibleOptions.value[0]?.id
      if (id) commit(id)
      break
    }
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      cancel()
      break
    default:
      // Typing narrows the list; drop a highlight that is no longer listed.
      nextTick(() => {
        if (highlightedId.value && !visibleOptions.value.some((o) => o.id === highlightedId.value)) {
          restoreCurrent()
        }
      })
  }
}

const onGlobalKeydown = (event: KeyboardEvent): void => {
  const modifier = isOsx ? event.metaKey : event.ctrlKey
  if (modifier && event.altKey && !event.shiftKey && event.code === 'KeyT') {
    event.preventDefault()
    event.stopPropagation()
    toggle()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown, true)
  window.addEventListener('blur', cancel)
  window.addEventListener('resize', cancel)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown, true)
  window.removeEventListener('blur', cancel)
  window.removeEventListener('resize', cancel)
  // Never leave a hover preview applied when the component goes away.
  if (open.value) addThemeStyle(theme.value)
})

defineExpose({ toggle })
</script>

<style scoped>
.theme-switcher {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  margin: 0 4px;
}

.theme-switcher-trigger {
  -webkit-app-region: no-drag;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--editorColor10);
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor50);
  cursor: pointer;
}

.theme-switcher-trigger:hover,
.theme-switcher-trigger.active {
  color: var(--editorColor);
  background: var(--sideBarBgColor);
}

.theme-switcher-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2999;
}

.theme-switcher-panel {
  position: fixed;
  z-index: 3000;
  width: 260px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 8px;
  background: var(--floatBgColor);
  border: 1px solid var(--floatBorderColor);
  box-shadow: var(--floatShadow, 0 8px 24px rgba(0, 0, 0, 0.18));
  color: var(--editorColor);
  font-size: 13px;
  user-select: none;
}

.theme-switcher-filter {
  width: 100%;
  box-sizing: border-box;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--editorColor10);
  border-radius: 4px;
  outline: none;
  background: transparent;
  color: var(--editorColor);
  font: inherit;
}

.theme-switcher-filter:focus {
  border-color: var(--themeColor);
}

.theme-switcher-notice {
  margin-top: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--themeColor10, var(--editorColor10));
  color: var(--editorColor80, var(--editorColor));
  font-size: 12px;
  line-height: 1.4;
}

.theme-switcher-list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.theme-switcher-group {
  padding: 6px 6px 2px;
  font-size: 11px;
  color: var(--editorColor40);
}

.theme-switcher-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 6px;
  border-radius: 4px;
  cursor: pointer;
}

.theme-switcher-item.highlighted {
  background: var(--sideBarBgColor);
}

.theme-switcher-item.current .theme-switcher-label {
  font-weight: 600;
}

.theme-switcher-chip {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--editorColor30);
  box-sizing: border-box;
}

.theme-switcher-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-switcher-check {
  flex: 0 0 auto;
  color: var(--themeColor);
}

.theme-switcher-empty {
  padding: 12px 6px;
  text-align: center;
  color: var(--editorColor40);
}

.theme-switcher-hint {
  margin-top: 6px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--editorColor40);
}
</style>
