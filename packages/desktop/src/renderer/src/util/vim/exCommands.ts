// Subpath import: source mode must not pull the whole WYSIWYG engine in.
import { setVimExHandlers, type VimExHandlers } from '@marktext/wysiwyg/src/features/vimEx'

/** The slice of the editor store the Ex commands drive. */
export interface VimExStore {
  currentFile: { id: string; isSaved: boolean } | null
  tabs: Array<{ id: string; isSaved: boolean }>
  FILE_SAVE(): void
  CLOSE_TAB(): void
  FORCE_CLOSE_TAB(file: never): void
}

export interface VimExOptions {
  /** How long `:wq` waits for the save to land before giving up. */
  saveTimeoutMs?: number
  pollMs?: number
}

/**
 * `:w` saves like Cmd/Ctrl+S, `:q` closes the tab (asking about unsaved
 * changes, like Vim's E37 guard), `:q!` discards them, and `:wq`/`:x` close
 * only after the save reports success — an untitled file whose Save dialog is
 * cancelled stays open.
 */
export function createVimExHandlers(store: VimExStore, options: VimExOptions = {}): VimExHandlers {
  const saveTimeoutMs = options.saveTimeoutMs ?? 30_000
  const pollMs = options.pollMs ?? 100
  return {
    write: () => store.FILE_SAVE(),
    quit: force => {
      const file = store.currentFile
      if (!file) return
      if (force) store.FORCE_CLOSE_TAB(file as never)
      else store.CLOSE_TAB()
    },
    writeQuit: () => {
      const file = store.currentFile
      if (!file) return
      if (file.isSaved) {
        store.FORCE_CLOSE_TAB(file as never)
        return
      }
      const id = file.id
      store.FILE_SAVE()
      const deadline = Date.now() + saveTimeoutMs
      const check = () => {
        const tab = store.tabs.find(t => t.id === id)
        if (!tab) return
        if (tab.isSaved) {
          store.FORCE_CLOSE_TAB(tab as never)
          return
        }
        if (Date.now() < deadline) setTimeout(check, pollMs)
      }
      setTimeout(check, pollMs)
    }
  }
}

/** Points the shared codemirror-vim Ex registry at the editor store. */
export function installVimExCommands(store: VimExStore): void {
  setVimExHandlers(createVimExHandlers(store))
}
