<template>
  <div class="rename">
    <el-dialog
      v-model="showRename"
      :show-close="false"
      :modal="true"
      class="ag-dialog-table"
      width="410px"
    >
      <template #header>
        <div class="search-wrapper">
          <div class="input-wrapper">
            <input
              ref="search"
              v-model="tempName"
              type="text"
              class="search"
              @keyup.enter="confirm"
            >
            <el-icon
              :size="16"
              class="confirm-icon"
              @click="confirm"
            >
              <Check />
            </el-icon>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import bus from '../../bus'
import { useEditorStore } from '@/store/editor'
import { Check } from '@element-plus/icons-vue'

const showRename = ref(false)
const tempName = ref('')
const search = ref<HTMLInputElement | null>(null)

const editorStore = useEditorStore()

const filename = computed(() => editorStore.currentFile?.filename ?? '')

const handleRename = () => {
  showRename.value = true
  tempName.value = filename.value
  nextTick(() => {
    if (search.value) {
      search.value.focus()
    }
  })
}

const confirm = () => {
  editorStore.RENAME(tempName.value)
  showRename.value = false
}

onMounted(() => {
  bus.on('rename', handleRename)
})

onBeforeUnmount(() => {
  bus.off('rename', handleRename)
})
</script>

<style>
.rename .el-dialog__header {
  box-sizing: border-box;
}
.rename .el-dialog__body {
  display: none;
}
</style>

<style scoped>
.search-wrapper {
  margin-top: 8px;
  z-index: 10000;
  position: relative;
  left: 50%;
  transform: translateX(-50%);
  width: 410px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: none;
  border: none;
  border-radius: 8px;
  margin: 0;
  padding: 4px 10px;

  & .input-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0 6px;
    border-radius: 6px;
    border: 1px solid var(--editorColor10);
    background: var(--inputBgColor);
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    &:focus-within {
      border-color: var(--themeColor);
      box-shadow: 0 0 0 2px var(--themeColor20);
    }
    & input {
      background: transparent;
    }
  }
}
.search {
  width: 100%;
  height: 32px;
  outline: none;
  border: none;
  font-size: 13.5px;
  padding: 0 6px;
  margin: 0;
  color: var(--editorColor);
}
.search-wrapper svg {
  cursor: pointer;
  margin: 0 4px;
  width: 24px;
  height: 24px;
  color: var(--iconColor);
  transition: color 0.15s ease;
}
.search-wrapper svg:hover {
  color: var(--themeColor);
}
</style>
