import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVimExHandlers, type VimExStore } from '@/util/vim/exCommands'

const makeStore = (isSaved: boolean) => {
  const file = { id: 'tab-1', isSaved }
  const store: VimExStore = {
    currentFile: file,
    tabs: [file],
    FILE_SAVE: vi.fn(),
    CLOSE_TAB: vi.fn(),
    FORCE_CLOSE_TAB: vi.fn()
  }
  return { store, file }
}

describe('Vim Ex command handlers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it(':w saves and :q / :q! close with and without the unsaved guard', () => {
    const { store, file } = makeStore(false)
    const handlers = createVimExHandlers(store)
    handlers.write()
    expect(store.FILE_SAVE).toHaveBeenCalledTimes(1)
    handlers.quit(false)
    expect(store.CLOSE_TAB).toHaveBeenCalledTimes(1)
    expect(store.FORCE_CLOSE_TAB).not.toHaveBeenCalled()
    handlers.quit(true)
    expect(store.FORCE_CLOSE_TAB).toHaveBeenCalledWith(file)
  })

  it(':wq closes a saved tab immediately', () => {
    const { store, file } = makeStore(true)
    createVimExHandlers(store).writeQuit()
    expect(store.FILE_SAVE).not.toHaveBeenCalled()
    expect(store.FORCE_CLOSE_TAB).toHaveBeenCalledWith(file)
  })

  it(':wq saves first and closes once the save lands', () => {
    const { store, file } = makeStore(false)
    createVimExHandlers(store, { pollMs: 50 }).writeQuit()
    expect(store.FILE_SAVE).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    expect(store.FORCE_CLOSE_TAB).not.toHaveBeenCalled()
    file.isSaved = true
    vi.advanceTimersByTime(60)
    expect(store.FORCE_CLOSE_TAB).toHaveBeenCalledWith(file)
  })

  it(':wq keeps the tab when the save never completes (cancelled dialog)', () => {
    const { store } = makeStore(false)
    createVimExHandlers(store, { pollMs: 50, saveTimeoutMs: 500 }).writeQuit()
    vi.advanceTimersByTime(5_000)
    expect(store.FORCE_CLOSE_TAB).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
