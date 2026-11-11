<template>
  <section class="pref-compound-item">
    <div class="pref-compound-head">
      <slot name="head" />
    </div>
    <div class="pref-compound-body">
      <slot name="children" />
    </div>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  notes?: string
}>()
</script>

<style>
.pref-compound-item {
  font-size: 13.5px;
  user-select: none;
  margin: 18px 0;
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid var(--editorColor10);
  background: var(--editorColor04);
  color: var(--editorColor);

  & .pref-compound-head h6.title {
    margin: 0 0 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--editorColor10);
  }

  & .pref-compound-body {
    padding: 0;
  }

  & .description {
    margin-bottom: 8px;
    & i {
      cursor: pointer;
      opacity: 0.7;
      color: var(--iconColor);
    }
    & i:hover {
      color: var(--themeColor);
    }
  }
}
</style>
