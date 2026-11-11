<template>
  <div class="search-result-item">
    <div
      class="search-result"
      :title="searchResult.filePath"
    >
      <el-icon
        class="icon-arrow"
        :class="{ fold: !showSearchMatches }"
        :size="12"
        @click.stop="toggleSearchMatches()"
      >
        <ArrowRight />
      </el-icon>
      <div
        class="file-info"
        @click.stop="toggleSearchMatches()"
      >
        <div class="title">
          <span class="filename">
            <span class="name">{{ filename }}</span><span class="extension">{{ extension }}</span>
          </span>
          <span class="match-count">{{ matchCount }}</span>
        </div>
        <!-- <div class="folder-path">
            <span>{{ dirname }}</span>
          </div> -->
      </div>
    </div>
    <div
      v-if="showSearchMatches"
      class="matches"
    >
      <ul>
        <li
          v-for="(searchMatch, index) of getMatches"
          :key="index"
          class="text-overflow"
          :title="searchMatch.lineText"
          @click="handleSearchResultClick(searchMatch)"
        >
          <!-- <span class="line-number">{{ searchMatch.range[0][0] }}</span> -->
          <span>{{
            ellipsisText(searchMatch.lineText.substring(0, searchMatch.range[0][1]))
          }}</span>
          <span class="highlight">{{
            searchMatch.lineText.substring(searchMatch.range[0][1], searchMatch.range[1][1])
          }}</span>
          <span>{{ searchMatch.lineText.substring(searchMatch.range[1][1]) }}</span>
        </li>
      </ul>
      <div v-if="!allMatchesShown">
        <div
          class="button tiny"
          @click="handleShowMoreMatches"
        >
          {{ t('sideBar.search.showMoreMatches') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import type { SearchResult, SearchMatch } from './types'

const { t } = useI18n()

const props = defineProps<{
  searchResult: SearchResult
}>()

const editorStore = useEditorStore()

const showSearchMatches = ref(props.searchResult.matches.length <= 20)
const allMatchesShown = ref(props.searchResult.matches.length <= 10)
const shownMatches = ref(10)

const { tabs, currentFile } = storeToRefs(editorStore)

const getMatches = computed<SearchMatch[]>(() => {
  if (props.searchResult.matches.length === 0 || allMatchesShown.value) {
    return props.searchResult.matches
  }
  return props.searchResult.matches.slice(0, shownMatches.value)
})

const filename = computed<string>(() => {
  return window.path.basename(
    props.searchResult.filePath,
    window.path.extname(props.searchResult.filePath)
  )
})

const matchCount = computed<number>(() => {
  return props.searchResult.matches.length
})

const extension = computed<string>(() => {
  return window.path.extname(props.searchResult.filePath)
})

const toggleSearchMatches = (): void => {
  showSearchMatches.value = !showSearchMatches.value
}

const handleShowMoreMatches = (event: MouseEvent): void => {
  shownMatches.value += 15
  if (event.ctrlKey || event.metaKey || shownMatches.value >= props.searchResult.matches.length) {
    allMatchesShown.value = true
  }
}

const ellipsisText = (text: string): string => {
  const len = text.length
  const MAX_PRETEXT_LEN = 6
  return len > MAX_PRETEXT_LEN ? `...${text.substring(len - MAX_PRETEXT_LEN)}` : text
}

const handleSearchResultClick = (searchMatch: SearchMatch): void => {
  const { range } = searchMatch
  const { filePath } = props.searchResult

  const openedTab = tabs.value.find((file) =>
    window.fileUtils.isSamePathSync(file.pathname, filePath)
  )
  const cursor = {
    isCollapsed: range[0][0] !== range[1][0],
    anchor: {
      line: range[0][0],
      ch: range[0][1]
    },
    focus: {
      line: range[1][0],
      ch: range[1][1]
    }
  }

  if (openedTab) {
    openedTab.cursor = cursor
    if (currentFile.value !== openedTab) {
      editorStore.UPDATE_CURRENT_FILE(openedTab)
    } else {
      // Re-emitting the tab's markdown must not revert an edit still pending
      // in the engine.
      editorStore.flushActiveEditor()
      const { id, markdown, history } = currentFile.value
      bus.emit('file-changed', {
        id,
        markdown,
        cursor: currentFile.value.cursor,
        renderCursor: true,
        history
      })
    }
  } else {
    window.electron.ipcRenderer.send('mt::open-file', filePath, {
      cursor
    })
  }
}
</script>

<style scoped>
.search-result-item {
  position: relative;
  user-select: none;
  padding: 2px 8px 6px 8px;
  color: var(--sideBarColor);
  font-size: 13px;
}
.search-result-item > .search-result {
  display: flex;
  align-items: center;
  height: 26px;
  padding: 0 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  &:hover {
    background: var(--sideBarItemHoverBgColor);
  }
}
.search-result-item > .search-result > svg:first-child {
  margin-right: 4px;
}
.search-result-item > .search-result > .file-info {
  flex: 1;
  overflow: hidden;
}
.search-result-item .title .filename {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--sideBarTitleColor);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  padding-right: 8px;
}
.search-result-item .matches ul {
  padding-left: 0;
  margin: 2px 0 0;
  list-style-type: none;
}
.search-result-item .matches ul li {
  display: block;
  padding: 3px 8px 3px 16px;
  border-radius: 4px;
  cursor: pointer;
  /* Hide space between inline spans */
  font-size: 0;
  transition: background-color 0.12s ease;
}
.search-result-item .matches ul li .highlight {
  background: var(--highlightColor);
  line-height: 16px;
  height: 16px;
  padding: 0 2px;
  display: inline-block;
  color: var(--sideBarTitleColor);
  font-weight: 600;
  border-radius: 2px;
}
.search-result-item .matches ul li:hover {
  background: var(--sideBarItemHoverBgColor);
}
.search-result-item .matches ul li span {
  font-size: 12.5px;
  white-space: pre;
}
.search-result-item .matches .button {
  width: 130px;
  margin: 4px auto 0;
  text-align: center;
}
.search-result-item.active {
  font-weight: 600;
}
.search-result-item.active .title {
  color: var(--themeColor);
}
.search-result-item.active::before {
  height: 100%;
}
.title {
  display: flex;
  align-items: center;
  color: var(--sideBarTextColor);
}
.title .filename {
  flex: 1;
}
.title .filename .extension {
  color: var(--sideBarTextColor);
  font-size: 12px;
  font-weight: 400;
}
.title .match-count {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  text-align: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--editorColor10);
  color: var(--sideBarColor);
}

.folder-path {
  font-size: 12px;
}

.folder-path > span,
.matches {
  width: 100%;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sideBarTextColor);
}

.icon-arrow {
  margin-right: 4px;
  transition: transform 0.2s ease-out;
  transform: rotate(90deg);
  color: var(--sideBarTextColor);
  cursor: pointer;
}
.icon-arrow.fold {
  transform: rotate(0);
}
</style>
