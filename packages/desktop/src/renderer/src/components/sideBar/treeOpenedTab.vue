<template>
  <div
    class="opened-file"
    :title="file.pathname"
    :class="[{ active: currentFile?.id === file.id, unsaved: !file.isSaved }]"
    @click="selectFile(file)"
  >
    <el-icon
      class="close-icon"
      :size="10"
      @click.stop="removeFileInTab(file)"
    >
      <Close />
    </el-icon>
    <span class="name">{{ file.filename }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { Close } from '@element-plus/icons-vue'
import type { TabDescriptor } from './types'

defineProps<{
  file: TabDescriptor
}>()

const editorStore = useEditorStore()

const { currentFile } = storeToRefs(editorStore)

const selectFile = (file: TabDescriptor): void => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: TabDescriptor): void => {
  const { isSaved } = file
  if (isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}
</script>

<style scoped>
.opened-file {
  display: flex;
  align-items: center;
  user-select: none;
  height: 28px;
  line-height: 28px;
  padding: 0 12px 0 32px;
  position: relative;
  font-size: 13px;
  color: var(--sideBarColor);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  & > .close-icon {
    display: none;
    position: absolute;
    top: 7px;
    left: 10px;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: pointer;
  }
  &:hover > .close-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  &:hover {
    background: var(--sideBarItemHoverBgColor);
  }
  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.opened-file.active {
  color: var(--highlightThemeColor);
  background: var(--themeColor10);
  font-weight: 500;
}
.unsaved.opened-file::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  position: absolute;
  top: 10.5px;
  left: 13px;
}
.unsaved.opened-file:hover::before {
  content: none;
}
</style>
