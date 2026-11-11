<template>
  <div class="import-dialog">
    <el-dialog
      v-model="showImport"
      :show-close="false"
      :modal="true"
      class="ag-dialog-table"
      width="450px"
    >
      <div class="body">
        <div
          class="drop-container"
          :class="{ active: isOver }"
          @dragenter.prevent="dragOverHandler"
          @dragover.prevent="dragOverHandler"
          @dragleave="dragLeaveHandler"
          @drop.prevent="dropHandler"
        >
          <div class="img-wrapper">
            <img
              :src="`${importIcon.url}`"
              alt="import file"
            >
          </div>
          <div>{{ t('import.title') }}</div>
          <p>{{ t('import.description') }}</p>
        </div>
        <div class="file-list">
          <div>.md</div>
          <div>.txt</div>
          <div>.docx</div>
          <div>.log</div>
          <div>.json</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import bus from '@/bus'
import importIconUrl from '@/assets/icons/import_file.svg?url'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const importIcon = ref({ url: importIconUrl })
const showImport = ref(false)
const isOver = ref(false)

const showDialog = (value: unknown) => {
  const boolean = Boolean(value)
  if (boolean !== showImport.value) {
    showImport.value = boolean
  }
}

const dragOverHandler = () => {
  isOver.value = true
}

const dragLeaveHandler = () => {
  isOver.value = false
}

const dropHandler = (e: DragEvent) => {
  const fileList: string[] = []
  e.preventDefault()
  if (!e.dataTransfer) return
  if (e.dataTransfer.files.length > 0) {
    for (const file of Array.from(e.dataTransfer.files)) {
      fileList.push(window.electron.webUtils.getPathForFile(file))
    }
  } else {
    for (const file of Array.from(e.dataTransfer.items)) {
      if (file.kind === 'file') {
        const asFile = file.getAsFile()
        if (asFile) {
          fileList.push(window.electron.webUtils.getPathForFile(asFile))
        }
      }
    }
  }
  showImport.value = false
  window.electron.ipcRenderer.send('mt::window::drop', fileList)
}

onMounted(() => {
  bus.on('importDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('importDialog', showDialog)
})
</script>

<style scoped>
.drop-container {
  border-radius: 8px;
  padding: 16px;
  color: var(--sideBarColor);
  border: 1.5px dashed var(--editorColor30);
  background: var(--editorColor04);
  transition: border-color 0.15s ease, background-color 0.15s ease;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  & div,
  & p {
    text-align: center;
  }
  &.active {
    border: 1.5px dashed var(--themeColor);
    background-color: var(--themeColor10);
  }
}
.img-wrapper {
  width: 50px;
  height: 70px;
  margin: 24px auto 8px auto;
  & img {
    width: 100%;
    height: 100%;
  }
}
.file-list {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  & div {
    flex: 1;
    height: 54px;
    border: 1px solid var(--editorColor10);
    background: var(--editorColor04);
    border-radius: 6px;
    text-align: center;
    font-family: var(--codeFontFamily, monospace);
    font-size: 14px;
    font-weight: 500;
    line-height: 54px;
    color: var(--sideBarTitleColor);
  }
}
</style>
