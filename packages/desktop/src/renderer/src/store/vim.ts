import { defineStore } from 'pinia'

export type VimMode = 'normal' | 'insert' | 'visual' | 'visual-line' | 'search'

export const useVimStore = defineStore('vim', {
  state: () => ({
    mode: 'normal' as VimMode,
    pending: ''
  }),
  actions: {
    SET_MODE(mode: VimMode) {
      this.mode = mode
      if (mode !== 'normal') this.pending = ''
    },
    SET_PENDING(pending: string) {
      this.pending = pending
    },
    RESET() {
      this.mode = 'normal'
      this.pending = ''
    }
  }
})
