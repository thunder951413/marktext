<template>
  <div class="about-dialog">
    <el-dialog
      v-model="showAboutDialog"
      :show-close="false"
      :modal="true"
      class="ag-dialog-table"
      width="380px"
    >
      <div class="about-card">
        <img
          class="logo"
          :src="MarkTextLogo"
          alt="MarkText"
        >
        <h3 class="title">
          {{ name }}
        </h3>
        <span class="version-pill">{{ store.appVersion }}</span>
        <div class="copyright-group">
          <div class="text">
            {{ copyright }}
          </div>
          <div class="text contributors">
            {{ copyrightContributors }}
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '@/store'
import bus from '../../bus'
import MarkTextLogo from '../../assets/images/logo.png'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const name = 'MarkText'
const copyright = t('about.copyright', { year: new Date().getFullYear() })
const copyrightContributors = t('about.copyrightContributors')
const showAboutDialog = ref(false)

const store = useMainStore()

const showDialog = () => {
  showAboutDialog.value = true
  bus.emit('editor-blur')
}

onMounted(() => {
  bus.on('aboutDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('aboutDialog', showDialog)
})
</script>

<style scoped>
.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 4px;
  text-align: center;
  user-select: none;
}

.logo {
  width: 72px;
  height: 72px;
  margin-bottom: 12px;
}

.title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--floatFontColor);
}

.version-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--editorColor04);
  border: 1px solid var(--editorColor10);
  color: var(--editorColor80);
  font-family: var(--codeFontFamily, monospace);
  font-size: 12px;
  margin-bottom: 16px;
}

.copyright-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 14px;
  width: 100%;
  border-top: 1px solid var(--editorColor10);
}

.text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--editorColor60);
}

.contributors {
  color: var(--editorColor50);
}
</style>
