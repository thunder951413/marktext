<template>
  <section
    class="pref-text-box-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div class="description">
      <span>{{ description }}</span>
      <LinkIcon
        v-if="more"
        :size="14"
        class="link-icon"
        @click="handleMoreClick"
      />
    </div>
    <el-input
      v-model="inputText"
      class="input"
      :class="{ error: invalidInput }"
      :placeholder="defaultValue"
      size="small"
      clearable
      @input="handleInput"
    />
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps } from '../types'

interface TextBoxProps extends PrefControlBaseProps {
  notes?: string
  input: string
  onChange: (value: string) => void
  defaultValue?: string
  emitTime?: number
  regexValidator?: RegExp
}

const props = withDefaults(defineProps<TextBoxProps>(), {
  description: '',
  notes: '',
  more: '',
  disable: false,
  defaultValue: '',
  emitTime: 800,
  regexValidator: () => /(.*?)/
})

let inputTimer: ReturnType<typeof setTimeout> | null = null
const inputText = ref(props.input)
const invalidInput = ref(false)

watch(
  () => props.input,
  (value, oldValue) => {
    if (value !== oldValue) {
      inputText.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const handleInput = (value: string) => {
  const result = props.regexValidator.test(value)
  invalidInput.value = !result

  if (result) {
    if (inputTimer) {
      clearTimeout(inputTimer)
    }

    if (props.emitTime === 0) {
      props.onChange(value)
      return
    }

    inputTimer = setTimeout(() => {
      inputTimer = null
      props.onChange(value)
    }, props.emitTime)
  }
}

onBeforeUnmount(() => {
  if (inputTimer) {
    clearTimeout(inputTimer)
    inputTimer = null
  }
})
</script>

<style scoped>
.pref-text-box-item {
  font-size: 13.5px;
  user-select: none;
  margin: 14px 0;
  color: var(--editorColor);
  width: 100%;

  & .description {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    color: var(--editorColor80);
  }

  & .input {
    width: 100%;
  }

  & :deep(.el-input__wrapper) {
    min-height: 34px;
    border-radius: 6px;
    background-color: var(--editorColor04);
    box-shadow: 0 0 0 1px var(--editorColor10) inset;
    transition: box-shadow 0.15s ease, background-color 0.15s ease;
  }

  & :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--editorColor30) inset;
  }

  & :deep(.el-input__wrapper.is-focus) {
    background-color: var(--editorBgColor);
    box-shadow: 0 0 0 1px var(--themeColor) inset, 0 0 0 3px var(--themeColor10);
  }

  & :deep(.el-input__inner) {
    height: 32px;
    color: var(--editorColor);
    &::placeholder {
      color: var(--editorColor30);
    }
  }

  & :deep(.el-input.error .el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--deleteColor, #ef4444) inset;
  }

  & :deep(.el-input.error .el-input__inner) {
    color: var(--deleteColor, #ef4444);
  }

  & :deep(svg) {
    cursor: pointer;
    opacity: 0.65;
    color: var(--iconColor);
    transition: color 0.15s ease, opacity 0.15s ease;
  }

  & :deep(svg:hover) {
    opacity: 1;
    color: var(--themeColor);
  }
}
</style>
