import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { getCM, Vim } from '@replit/codemirror-vim'
import { WysiwygEditor } from '../editor'
import { setVimExHandlers } from '../features/vimEx'

function mountVim(markdown: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const editor = new WysiwygEditor(host, { markdown, vimMode: true, renderTables: false })
  editor.init()
  const view = (editor as unknown as { view: EditorView }).view
  const cm = getCM(view)!
  return { editor, view, cm }
}

const keys = (cm: unknown, sequence: string) => {
  for (const key of sequence) Vim.handleKey(cm as never, key, 'test')
}

afterEach(() => setVimExHandlers(null))

describe('Vim Ex commands', () => {
  it('routes :w, :q, :q!, :wq and :x to the embedder', () => {
    const handlers = { write: vi.fn(), quit: vi.fn(), writeQuit: vi.fn() }
    setVimExHandlers(handlers)
    const { cm, editor } = mountVim('hello')
    Vim.handleEx(cm as never, 'w')
    Vim.handleEx(cm as never, 'write')
    expect(handlers.write).toHaveBeenCalledTimes(2)
    Vim.handleEx(cm as never, 'q')
    Vim.handleEx(cm as never, 'q!')
    expect(handlers.quit.mock.calls).toEqual([[false], [true]])
    Vim.handleEx(cm as never, 'wq')
    Vim.handleEx(cm as never, 'x')
    expect(handlers.writeQuit).toHaveBeenCalledTimes(2)
    editor.destroy()
  })

  it('does nothing harmful without handlers', () => {
    setVimExHandlers(null)
    const { cm, editor } = mountVim('hello')
    expect(() => Vim.handleEx(cm as never, 'wq')).not.toThrow()
    expect(editor.getMarkdown()).toBe('hello')
    editor.destroy()
  })

  it('supports :%s substitution through the built-in command', () => {
    const { cm, editor } = mountVim('foo bar\nfoo baz\n')
    Vim.handleEx(cm as never, '%s/foo/qux/g')
    expect(editor.getMarkdown()).toBe('qux bar\nqux baz\n')
    editor.destroy()
  })

  it('supports marks and named registers', () => {
    // jsdom has no layout, so vertical motions (j/k/G) are unreliable here;
    // place the caret by offset and exercise the mark/register commands.
    const { cm, view, editor } = mountVim('alpha\nbeta\ngamma\n')
    editor.setSelectionRange(6, 6)
    keys(cm, 'ma')
    editor.setSelectionRange(13, 13)
    keys(cm, '`a')
    expect(view.state.selection.main.head).toBe(6)
    keys(cm, '"ayy')
    editor.setSelectionRange(0, 0)
    keys(cm, '"ap')
    expect(editor.getMarkdown()).toBe('alpha\nbeta\nbeta\ngamma\n')
    editor.destroy()
  })
})
