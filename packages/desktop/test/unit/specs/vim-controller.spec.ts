import { describe, expect, it, vi } from 'vitest'
import { VimController, type VimEditorAdapter } from '@/util/vim/controller'

const key = (value: string, options: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: value, ...options })

const setup = () => {
  const adapter: VimEditorAdapter = {
    move: vi.fn(),
    enterInsert: vi.fn(),
    leaveInsert: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    search: vi.fn(),
    findNext: vi.fn(),
    removeCharacters: vi.fn(),
    operate: vi.fn(),
    operateLine: vi.fn(),
    operateSelection: vi.fn(),
    paste: vi.fn(),
    findCharacter: vi.fn(),
    repeatCharacterFind: vi.fn(),
    beginVisual: vi.fn(),
    collapseSelection: vi.fn()
  }
  const modes: string[] = []
  const pending: string[] = []
  const controller = new VimController({
    adapter,
    onModeChange: mode => modes.push(mode),
    onPendingChange: value => pending.push(value)
  })
  return { adapter, controller, modes, pending }
}

describe('VimController', () => {
  it('starts in normal mode and maps standard hjkl motions', () => {
    const { adapter, controller, modes } = setup()
    for (const value of ['h', 'j', 'k', 'l']) expect(controller.handle(key(value))).toBe(true)
    expect(modes[0]).toBe('normal')
    expect(adapter.move).toHaveBeenNthCalledWith(1, 'left', 1, false)
    expect(adapter.move).toHaveBeenNthCalledWith(2, 'down', 1, false)
    expect(adapter.move).toHaveBeenNthCalledWith(3, 'up', 1, false)
    expect(adapter.move).toHaveBeenNthCalledWith(4, 'right', 1, false)
  })

  it('supports counts, word motions and document boundaries', () => {
    const { adapter, controller } = setup()
    controller.handle(key('5'))
    controller.handle(key('j'))
    controller.handle(key('g'))
    controller.handle(key('g'))
    controller.handle(key('G'))
    expect(adapter.move).toHaveBeenNthCalledWith(1, 'down', 5, false)
    expect(adapter.move).toHaveBeenNthCalledWith(2, 'document-start', 1, false)
    expect(adapter.move).toHaveBeenNthCalledWith(3, 'document-end', 1, false)
  })

  it('enters Insert with i/a/I/A/o/O and leaves with Escape', () => {
    const placements = ['before', 'after', 'line-start', 'line-end', 'line-below', 'line-above'] as const
    const keys = ['i', 'a', 'I', 'A', 'o', 'O']
    for (let index = 0; index < keys.length; index += 1) {
      const { adapter, controller, modes } = setup()
      const commandKey = keys[index]
      if (!commandKey) throw new Error('Missing Vim insert command fixture')
      controller.handle(key(commandKey))
      expect(adapter.enterInsert).toHaveBeenCalledWith(placements[index])
      expect(modes.at(-1)).toBe('insert')
      expect(controller.handle(key('x'))).toBe(false)
      expect(controller.handle(key('Escape'))).toBe(true)
      expect(adapter.leaveInsert).toHaveBeenCalledOnce()
      expect(modes.at(-1)).toBe('normal')
    }
  })

  it('parses operator-motion, doubled operators and dgg', () => {
    const { adapter, controller } = setup()
    controller.handle(key('2'))
    controller.handle(key('d'))
    controller.handle(key('w'))
    controller.handle(key('y'))
    controller.handle(key('y'))
    controller.handle(key('d'))
    controller.handle(key('g'))
    controller.handle(key('g'))
    expect(adapter.operate).toHaveBeenNthCalledWith(1, 'delete', 'word-forward', 2)
    expect(adapter.operateLine).toHaveBeenCalledWith('yank', 1)
    expect(adapter.operate).toHaveBeenNthCalledWith(2, 'delete', 'document-start', 1)
  })

  it('supports Visual and Visual Line selection operators', () => {
    const { adapter, controller, modes } = setup()
    controller.handle(key('v'))
    controller.handle(key('w'))
    controller.handle(key('y'))
    controller.handle(key('V'))
    controller.handle(key('d'))
    expect(adapter.beginVisual).toHaveBeenNthCalledWith(1, false)
    expect(adapter.move).toHaveBeenCalledWith('word-forward', 1, true)
    expect(adapter.operateSelection).toHaveBeenNthCalledWith(1, 'yank', false)
    expect(adapter.beginVisual).toHaveBeenNthCalledWith(2, true)
    expect(adapter.operateSelection).toHaveBeenNthCalledWith(2, 'delete', true)
    expect(modes.at(-1)).toBe('normal')
  })

  it('routes undo, redo, search, paste and character-find commands', () => {
    const { adapter, controller, modes } = setup()
    controller.handle(key('u'))
    controller.handle(key('r', { ctrlKey: true }))
    controller.handle(key('p'))
    controller.handle(key('f'))
    controller.handle(key('x'))
    controller.handle(key('/'))
    expect(adapter.undo).toHaveBeenCalledOnce()
    expect(adapter.redo).toHaveBeenCalledOnce()
    expect(adapter.paste).toHaveBeenCalledWith('after', 1)
    expect(adapter.findCharacter).toHaveBeenCalledWith('x', 'forward', false, 1, false)
    expect(adapter.search).toHaveBeenCalledWith('forward')
    expect(modes.at(-1)).toBe('search')
    controller.finishSearch()
    expect(modes.at(-1)).toBe('normal')
  })

  it('leaves application shortcuts untouched in Normal mode', () => {
    const { controller } = setup()
    expect(controller.handle(key('s', { metaKey: true }))).toBe(false)
    expect(controller.handle(key('n', { ctrlKey: true }))).toBe(false)
  })
})
