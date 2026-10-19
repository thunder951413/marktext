import { beforeEach, describe, expect, it, vi } from 'vitest'

// The directory watcher must skip git internals (a checkout floods it with
// events) and must follow the `watcherUsePolling` preference on every
// platform instead of forcing polling on macOS.

const watchMock = vi.fn()

function fakeWatcher(): Record<string, ReturnType<typeof vi.fn>> {
  const w: Record<string, ReturnType<typeof vi.fn>> = {}
  w.on = vi.fn(() => w)
  w.close = vi.fn()
  w.add = vi.fn()
  w.unwatch = vi.fn()
  return w
}

vi.mock('chokidar', () => ({
  default: {
    watch: (...args: unknown[]) => {
      watchMock(...args)
      return fakeWatcher()
    }
  }
}))
vi.mock('ced', () => ({ default: () => 'UTF-8' }))
vi.mock('electron', () => ({}))

import Watcher from 'main_renderer/filesystem/watcher'

type Ignored = (pathname: string, info?: { isDirectory: () => boolean }) => boolean

function lastOptions(): { ignored: Ignored; usePolling: boolean } {
  const calls = watchMock.mock.calls
  return calls[calls.length - 1][1] as { ignored: Ignored; usePolling: boolean }
}

describe('watcher ignore rules and polling', () => {
  const win = { id: 1, webContents: { send: vi.fn() } }
  const dir = { isDirectory: () => true }
  const file = { isDirectory: () => false }
  let getItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    watchMock.mockClear()
    getItem = vi.fn((key: string) => (key === 'treePathExcludePatterns' ? [] : false))
    new Watcher({ getItem } as never).watch(win as never, '/project', 'dir')
  })

  it('ignores .git, node_modules and asar archives', () => {
    const { ignored } = lastOptions()
    expect(ignored('/project/.git', dir)).toBe(true)
    expect(ignored('/project/.git/objects/ab/cdef', file)).toBe(true)
    expect(ignored('C:\\project\\.git\\HEAD', file)).toBe(true)
    expect(ignored('/project/node_modules/x/readme.md', file)).toBe(true)
    expect(ignored('/app/resources/app.asar/readme.md', file)).toBe(true)
  })

  it('keeps similarly named paths and markdown files', () => {
    const { ignored } = lastOptions()
    expect(ignored('/project/.github', dir)).toBe(false)
    expect(ignored('/project/.gitbook/intro.md', file)).toBe(false)
    expect(ignored('/project/notes.md', file)).toBe(false)
    expect(ignored('/project/image.png', file)).toBe(true)
  })

  it('takes polling from the preference only', () => {
    expect(lastOptions().usePolling).toBe(false)
    getItem.mockImplementation((key: string) => (key === 'watcherUsePolling' ? true : []))
    new Watcher({ getItem } as never).watch(win as never, '/project', 'dir')
    expect(lastOptions().usePolling).toBe(true)
  })
})
