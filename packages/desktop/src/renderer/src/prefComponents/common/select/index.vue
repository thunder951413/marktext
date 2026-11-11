<template>
  <section
    class="pref-select-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      v-if="description"
      class="description"
    >
      <span>{{ description }}</span>
      <LinkIcon
        v-if="more"
        :size="14"
        class="link-icon"
        @click="handleMoreClick"
      />
    </div>
    <el-select
      v-model="selectValue"
      :disabled="disable"
      @change="select"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps, PrefSelectOption } from '../types'

type SelectValue = string | number | boolean

interface SelectProps extends PrefControlBaseProps {
  notes?: string
  value: SelectValue
  options: ReadonlyArray<PrefSelectOption<SelectValue>>
  onChange: (value: SelectValue) => void
}

const props = withDefaults(defineProps<SelectProps>(), {
  description: '',
  notes: '',
  more: '',
  disable: false
})

const selectValue = ref<SelectValue>(props.value)

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

const select = (value: SelectValue) => {
  props.onChange(value)
}
</script>

<style>
.pref-select-item {
  margin: 14px 0;
  font-size: 13.5px;
  color: var(--editorColor);
  & .el-select {
    width: 100%;
  }
  & .el-select__wrapper {
    min-height: 34px;
    border-radius: 6px;
    background-color: var(--editorColor04);
    box-shadow: 0 0 0 1px var(--editorColor10) inset;
    transition: box-shadow 0.15s ease, background-color 0.15s ease;
  }
  & .el-select__wrapper:hover {
    box-shadow: 0 0 0 1px var(--editorColor30) inset;
  }
  & .el-select__wrapper.is-focused {
    background-color: var(--editorBgColor);
    box-shadow: 0 0 0 1px var(--themeColor) inset, 0 0 0 3px var(--themeColor10);
  }
  & .el-select__selected-item,
  & .el-select__placeholder {
    color: var(--editorColor);
  }
}
.pref-select-item .description {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--editorColor80);
  & svg {
    cursor: pointer;
    opacity: 0.65;
    color: var(--iconColor);
    transition: color 0.15s ease, opacity 0.15s ease;
  }
  & svg:hover {
    opacity: 1;
    color: var(--themeColor);
  }
}
li.el-select-dropdown__item {
  color: var(--editorColor);
  height: 32px;
  line-height: 32px;
  border-radius: 5px;
  margin: 1px 4px;
  padding: 0 10px;
}
li.el-select-dropdown__item.hover,
li.el-select-dropdown__item.is-hovering,
li.el-select-dropdown__item:hover {
  background: var(--floatHoverColor);
}
li.el-select-dropdown__item.selected,
li.el-select-dropdown__item.is-selected {
  color: var(--themeColor);
  background: var(--themeColor10);
  font-weight: 500;
}
div.el-select-dropdown {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  border-radius: 8px;
  padding: 4px 0;
  & .popper__arrow,
  & .el-popper__arrow {
    display: none;
  }
}
</style>
