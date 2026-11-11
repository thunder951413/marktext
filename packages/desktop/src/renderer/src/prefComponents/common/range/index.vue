<template>
  <section
    class="pref-range-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div class="description">
      <span>{{ description }}</span>
      <div class="value-group">
        <span
          v-if="selectValue !== undefined"
          class="value"
        >{{ selectValue }}<span v-if="unit"> {{ unit }}</span></span>
        <LinkIcon
          v-if="more"
          :size="14"
          class="link-icon"
          @click="handleMoreClick"
        />
      </div>
    </div>
    <el-slider
      v-model="selectValue"
      :min="min"
      :max="max"
      :format-tooltip="(value: number) => value + (unit ? unit : '')"
      :step="step"
      @change="select"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps } from '../types'

interface RangeProps extends PrefControlBaseProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  unit?: string
  step?: number
}

const props = withDefaults(defineProps<RangeProps>(), {
  description: '',
  more: '',
  unit: '',
  disable: false
})

const selectValue = ref(props.value)

watch(
  () => props.value,
  (value, oldValue) => {
    if (value !== oldValue) {
      selectValue.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const select = (value: number | number[]) => {
  // el-slider may emit number[] in range mode; this control is single-value only.
  if (typeof value === 'number') {
    props.onChange(value)
  }
}
</script>

<style scoped>
.pref-range-item {
  margin: 14px 0;
  font-size: 13.5px;
  color: var(--editorColor);
  width: 100%;
  --el-slider-main-bg-color: var(--themeColor);
  --el-slider-runway-bg-color: var(--editorColor10);
  --el-slider-button-size: 14px;

  & .description {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    color: var(--editorColor80);
  }

  & .value-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  & .value {
    padding: 1px 7px;
    border-radius: 5px;
    background: var(--editorColor04);
    border: 1px solid var(--editorColor10);
    color: var(--editorColor);
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  & :deep(.el-slider) {
    width: 100%;
  }
  & :deep(.el-slider__runway),
  & :deep(.el-slider__bar) {
    height: 4px;
    border-radius: 2px;
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
