import { describe, expect, it, vi } from 'vitest'
import { WysiwygEditor } from '../editor'

function mount(markdown: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const editor = new WysiwygEditor(host, { markdown })
  editor.init()
  return { editor, host }
}

describe('WysiwygEditor API', () => {
  it('round-trips the document exactly (source of truth is the text)', () => {
    const markdown = '# Title\n\n- a\n- b\n\n| x | y |\n| --- | --- |\n| 1 | 2 |'
    const { editor, host } = mount(markdown)
    expect(editor.getMarkdown()).toBe(markdown)
    editor.destroy()
    expect(host.className).not.toContain('wysiwyg-container')
  })

  it('emits content-change on setContent', () => {
    const { editor } = mount('first')
    const handler = vi.fn()
    editor.on('content-change', handler)
    editor.setContent('second document')
    expect(handler).toHaveBeenCalledWith({ markdown: 'second document' })
    expect(editor.getMarkdown()).toBe('second document')
    editor.destroy()
  })

  it('reports and restores line/ch cursors', () => {
    const { editor } = mount('# Heading\n\nbody line')
    editor.setCursorByOffset({ anchor: { line: 0, ch: 3 }, focus: { line: 0, ch: 5 } })
    expect(editor.getCursorOffset()).toEqual({
      anchor: { line: 0, ch: 3 },
      focus: { line: 0, ch: 5 }
    })
    // Out-of-range positions clamp to the nearest valid spot.
    editor.setCursorByOffset({ anchor: { line: 99, ch: 0 }, focus: { line: 99, ch: 999 } })
    expect(editor.getCursorOffset()?.anchor.line).toBe(2)
    editor.destroy()
  })

  it('emits selection-change when the caret moves', () => {
    const { editor } = mount('# Heading\n\nbody line')
    const handler = vi.fn()
    editor.on('selection-change', handler)
    editor.setCursorByOffset({ anchor: { line: 0, ch: 1 }, focus: { line: 0, ch: 1 } })
    expect(handler).toHaveBeenCalled()
    editor.destroy()
  })

  it('toggles focus mode class and flushes pending changes', () => {
    const { editor, host } = mount('text')
    editor.setFocusMode(true)
    expect(host.classList.contains('wysiwyg-focus-mode')).toBe(true)
    editor.setFocusMode(false)
    expect(host.classList.contains('wysiwyg-focus-mode')).toBe(false)

    const handler = vi.fn()
    editor.on('content-change', handler)
    editor.flush()
    expect(handler).toHaveBeenCalledWith({ markdown: 'text' })
    editor.destroy()
  })

  it('buffers markdown set before init()', () => {
    const editor = new WysiwygEditor(document.createElement('div'))
    editor.setContent('pre-init value')
    expect(editor.getMarkdown()).toBe('pre-init value')
  })
})
