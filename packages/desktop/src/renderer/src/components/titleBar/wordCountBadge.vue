<template>
  <el-tooltip
    :content="`${wordCount[show]} ${HASH[show].full + (wordCount[show] > 1 ? 's' : '')}`"
    placement="bottom-end"
  >
    <template #content>
      <div class="title-item">
        <span class="front">{{ t('menu.counter.words') }}:</span><span class="text">{{ wordCount['word'] }}</span>
      </div>
      <div class="title-item">
        <span class="front">{{ t('menu.counter.characters') }}:</span><span class="text">{{ wordCount['character'] }}</span>
      </div>
      <div class="title-item">
        <span class="front">{{ t('menu.counter.paragraphs') }}:</span><span class="text">{{ wordCount['paragraph'] }}</span>
      </div>
    </template>
    <div
      class="word-count"
      data-testid="word-count"
      @click.stop="cycle"
    >
      <span class="text-center-vertical">{{ `${HASH[show].short} ${wordCount[show]}` }}</span>
    </div>
  </el-tooltip>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileWordCount } from '@shared/types/files'

defineProps<{ wordCount: FileWordCount }>()

const { t } = useI18n()

type CountKind = 'word' | 'paragraph' | 'character' | 'all'

const HASH = {
  word: { short: 'W', full: 'word' },
  character: { short: 'C', full: 'character' },
  paragraph: { short: 'P', full: 'paragraph' },
  all: { short: 'A', full: '(with space)character' }
}

const show = ref<CountKind>('word')

// Click cycles through words, paragraphs, characters and characters with spaces.
const cycle = () => {
  const items: CountKind[] = ['word', 'paragraph', 'character', 'all']
  show.value = items[(items.indexOf(show.value) + 1) % items.length]!
}
</script>

<style scoped>
.word-count {
  -webkit-app-region: no-drag;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--editorColor50);
  text-align: center;
  height: 24px;
  line-height: 22px;
  padding: 0;
  margin: 0 1px;
  box-sizing: border-box;
  white-space: nowrap;
  flex: 0 0 auto;
  & > .text-center-vertical {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 7px;
    border-radius: 6px;
    border: 1px solid var(--editorColor10);
    background: var(--editorColor04);
    box-sizing: border-box;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  &:hover > span {
    background: var(--sideBarBgColor);
    color: var(--editorColor);
    border-color: var(--editorColor30);
  }
}

@media (max-width: 700px) {
  .word-count {
    display: none;
  }
}
</style>

<style>
/* The tooltip content is teleported to <body>, so these cannot be scoped. */
.title-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  height: 24px;
  line-height: 24px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  & .front {
    color: var(--editorColor50);
  }
  & .text {
    margin-left: 10px;
    font-weight: 600;
    color: var(--editorColor);
  }
}
</style>
