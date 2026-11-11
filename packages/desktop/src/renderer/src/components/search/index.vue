<template>
  <div
    v-show="showSearch"
    class="search-bar"
    @click.stop="noop"
  >
    <div
      class="left-arrow"
      @click="toggleSearchType"
    >
      <el-icon
        :size="14"
        :class="{ 'arrow-right': type === 'search' }"
      >
        <ArrowDown />
      </el-icon>
    </div>
    <div class="right-controls">
      <section class="search">
        <div
          class="input-wrapper"
          :class="{ error: !!searchErrorMsg }"
        >
          <input
            ref="search"
            v-model="searchValue"
            type="text"
            :placeholder="t('search.searchPlaceholder')"
            @keyup="handleEnterKey"
          >
          <div class="controls">
            <span class="search-result">{{ highlightIndex + 1 }} /
              {{ highlightCount }}
            </span>
            <span
              :title="t('search.caseSensitive')"
              class="is-case-sensitive"
              :class="{ active: isCaseSensitive }"
              @click.stop="toggleCtrl('isCaseSensitive')"
            >
              <FindCaseIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.wholeWord')"
              class="is-whole-word"
              :class="{ active: isWholeWord }"
              @click.stop="toggleCtrl('isWholeWord')"
            >
              <FindWordIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.useRegex')"
              class="is-regex"
              :class="{ active: isRegexp }"
              @click.stop="toggleCtrl('isRegexp')"
            >
              <FindRegexIcon aria-hidden="true" />
            </span>
          </div>
          <div
            v-if="searchErrorMsg"
            class="error-msg"
          >
            {{ searchErrorMsg }}
          </div>
        </div>
        <div class="button-group">
          <button
            class="button right"
            @click="find('prev')"
          >
            <el-icon :size="14">
              <ArrowUp />
            </el-icon>
          </button>
          <button
            class="button"
            @click="find('next')"
          >
            <el-icon :size="14">
              <ArrowDown />
            </el-icon>
          </button>
        </div>
      </section>
      <section
        v-if="type === 'replace'"
        class="replace"
      >
        <div class="input-wrapper replace-input">
          <input
            v-model="replaceValue"
            type="text"
            :placeholder="t('search.replacementPlaceholder')"
          >
        </div>
        <div class="button-group">
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceAll')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="button right"
              @click="replace(false)"
            >
              <el-icon :size="14">
                <RefreshRight />
              </el-icon>
            </button>
          </el-tooltip>
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceSingle')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="button"
              @click="replace(true)"
            >
              <el-icon :size="14">
                <Switch />
              </el-icon>
            </button>
          </el-tooltip>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import bus from '../../bus'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import debounce from 'lodash/debounce'
import { ArrowDown, ArrowUp, RefreshRight, Switch } from '@element-plus/icons-vue'

const { t } = useI18n()

const editorStore = useEditorStore()

const showSearch = ref(false)
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const type = ref('search')
const searchValue = ref('')
const replaceValue = ref('')
const searchErrorMsg = ref('')
const search = ref<HTMLInputElement | null>(null)

const { currentFile } = storeToRefs(editorStore)
const searchMatches = computed(() => currentFile.value?.searchMatches)

watch(searchValue, () => {
  if (!showSearch.value) return // make sure search box is actually open
  debouncedSearchFn()
})

watch(searchMatches, (newValue, oldValue) => {
  // Once the search bar is open it owns the query. Ignore editor
  // selection-changes while open — notably the spurious selection-change the
  // engine emits when the bar steals editor focus, which would otherwise
  // clobber the just-prefilled value (e.g. leaving a stale single character).
  if (showSearch.value) return
  if (!newValue || !oldValue) return
  const { value } = newValue
  if (value !== oldValue.value) {
    searchValue.value = value
  }
})

// Seed the find input from the current selection synchronously, before the bar
// opens and steals focus. Relying on the reactive `searchMatches` watch alone
// races with the focus-steal selection-change and can drop the prefill.
const prefillFromSelection = () => {
  const selected = searchMatches.value?.value
  if (selected) {
    searchValue.value = selected
  }
}

const highlightIndex = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.index
  } else {
    return -1
  }
})

const highlightCount = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.matches.length
  } else {
    return 0
  }
})

onMounted(() => {
  bus.on('find', listenFind)
  bus.on('replace', listenReplace)
  bus.on('findNext', listenFindNext)
  bus.on('findPrev', listenFindPrev)
  document.addEventListener('click', docClick)
  document.addEventListener('keyup', docKeyup)
  bus.on('search-blur', blurSearch)
})

onBeforeUnmount(() => {
  bus.off('find', listenFind)
  bus.off('replace', listenReplace)
  bus.off('findNext', listenFindNext)
  bus.off('findPrev', listenFindPrev)
  document.removeEventListener('click', docClick)
  document.removeEventListener('keyup', docKeyup)
  bus.off('search-blur', blurSearch)
})

const toggleCtrl = (ctrl: 'isCaseSensitive' | 'isWholeWord' | 'isRegexp') => {
  switch (ctrl) {
    case 'isCaseSensitive':
      isCaseSensitive.value = !isCaseSensitive.value
      break
    case 'isWholeWord':
      isWholeWord.value = !isWholeWord.value
      break
    case 'isRegexp':
      isRegexp.value = !isRegexp.value
      break
  }
  searchFn()
}

const listenFind = () => {
  prefillFromSelection()
  showSearch.value = true
  type.value = 'search'
  nextTick(() => {
    search.value?.focus()
    // Select the existing term so re-opening Find types over it instead of
    // appending to the previous query (#3458).
    search.value?.select()
    if (searchValue.value) {
      searchFn()
    }
  })
}

const listenReplace = () => {
  prefillFromSelection()
  showSearch.value = true
  type.value = 'replace'
}

const listenFindNext = () => {
  find('next')
}

const listenFindPrev = () => {
  find('prev')
}

const docKeyup = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emptySearch(true)
  }
}

const docClick = () => {
  if (!showSearch.value) return
  emptySearch(true)
}

const blurSearch = () => {
  emptySearch(true)
}

const emptySearch = (selectHighlight = false) => {
  showSearch.value = false
  searchValue.value = ''
  replaceValue.value = ''
  bus.emit('searchValue', { value: searchValue.value, opt: { selectHighlight } })
  bus.emit('vim-search-finished')
  // Hand focus back so the engine syncs its (match-anchored) selection into
  // the DOM — the hidden input otherwise leaves the document selection empty.
  bus.emit('editor-focus')
}

const toggleSearchType = () => {
  type.value = type.value === 'search' ? 'replace' : 'search'
}

/**
 * Find the previous or next search result.
 * action: prev or next
 */
const find = (action: 'prev' | 'next') => {
  bus.emit('find-action', action)
}

const handleEnterKey = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    find('next')
  }
}

const searchFn = () => {
  if (isRegexp.value) {
    // Handle invalid regexp.
    try {
      RegExp(searchValue.value)
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.invalidRegex', { pattern: searchValue.value })
      return
    }
    // Handle match empty string, no need to search.
    try {
      const SEARCH_REG = new RegExp(searchValue.value)
      if (searchValue.value && SEARCH_REG.test('')) {
        throw new Error()
      }
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.regexMatchEmpty', { pattern: searchValue.value })
      return
    }
  }

  bus.emit('searchValue', {
    value: searchValue.value,
    opt: {
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const debouncedSearchFn = debounce(searchFn, 150)

const replace = (isSingle = true) => {
  bus.emit('replaceValue', {
    value: replaceValue.value,
    opt: {
      isSingle,
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const noop = () => {}
</script>

<style scoped>
.search-bar {
  position: absolute;
  width: 410px;
  padding: 6px;
  top: 8px;
  right: 20px;
  z-index: 100;
  border-radius: 8px;
  border: 1px solid var(--floatBorderColor);
  box-shadow: var(--floatShadow);
  background: var(--floatBgColor);
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
}
.search-bar .left-arrow {
  width: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  cursor: pointer;
  color: var(--sideBarIconColor);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.search-bar .left-arrow:hover {
  background: var(--floatHoverColor);
  color: var(--editorColor);
}
.search-bar .left-arrow svg {
  height: 12px;
  width: 12px;
  transition: transform 0.18s ease;
}
.search-bar .left-arrow .arrow-right {
  transform: rotate(-90deg);
}

.search-bar .right-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.search,
.replace {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 2px 0 4px;
  margin: 0;
}

.search-bar .button {
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  height: 28px;
  width: 28px;
  text-align: center;
  padding: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: var(--sideBarIconColor);
  &.left {
    margin-right: 8px;
  }
  &.right {
    margin-left: 8px;
  }
}
.button.active {
  color: var(--themeColor);
}
.search-bar .button > svg {
  width: 15px;
  height: 15px;
}
.search-bar .button:active {
  opacity: 0.6;
}
.input-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  height: 28px;
  position: relative;
  border: 1px solid var(--editorColor10);
  background: var(--inputBgColor);
  border-radius: 6px;
  box-sizing: border-box;
  overflow: visible;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  &:focus-within {
    border-color: var(--themeColor);
    box-shadow: 0 0 0 2px var(--themeColor20);
  }
}
.input-wrapper.error {
  border: 1px solid var(--notificationErrorBg);
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}
.input-wrapper .controls {
  position: absolute;
  top: 3px;
  right: 6px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--editorColor50);
  & > span.search-result {
    height: 20px;
    margin-right: 4px;
    line-height: 20px;
  }
  & > span:not(.search-result) {
    cursor: pointer;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
    &:hover {
      background: var(--floatHoverColor);
      color: var(--sideBarIconColor);
    }
    &.active {
      background: var(--themeColor10);
    }
    & > svg {
      width: 14px;
      height: 14px;
      fill: var(--sideBarIconColor);
      &:hover {
        fill: var(--highlightThemeColor);
      }
    }
    &.active svg {
      fill: var(--highlightThemeColor);
    }
  }
}

.input-wrapper .error-msg {
  position: absolute;
  top: 27px;
  width: calc(100% + 2px);
  height: 28px;
  left: -1px;
  padding: 0 8px;
  box-sizing: border-box;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background: var(--notificationErrorBg);
  line-height: 28px;
  color: #ffffff;
  font-size: 12.5px;
  z-index: 1;
}

.input-wrapper input {
  flex: 1;
  padding: 0 8px;
  height: 26px;
  outline: none;
  border: none;
  box-sizing: border-box;
  font-size: 13px;
  color: var(--editorColor);
  background: transparent;
}
</style>
