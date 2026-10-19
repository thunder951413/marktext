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
  font-size: 14px;
  color: var(--editorColor30);
  text-align: center;
  line-height: 24px;
  padding: 0 5px;
  box-sizing: border-box;
  /* Keep "W 123" on one line; it used to wrap, dropping the number below. */
  white-space: nowrap;
  flex: 0 0 auto;
  transition: all 0.25s ease-in-out;
  & > .text-center-vertical {
    display: inline-block;
    vertical-align: middle;
    line-height: normal;
    padding: 2px 5px;
    border-radius: 3px;
  }
  &:hover > span {
    background: var(--sideBarBgColor);
    color: var(--sideBarTitleColor);
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
  height: 28px;
  line-height: 28px;
  & .front {
    opacity: 0.7;
  }
  & .text {
    margin-left: 10px;
  }
}
</style>
