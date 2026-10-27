import type { EditorView } from '@codemirror/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LARGE_DOCUMENT_THRESHOLD } from '../decorations/livePreview'
import { CONTENT_CHANGE_IDLE_MS, CONTENT_CHANGE_MAX_WAIT_MS, WysiwygEditor } from '../editor'

const LARGE = 'line of text\n'.repeat(Math.ceil(LARGE_DOCUMENT_THRESHOLD / 13) + 10)

function mount(markdown: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const editor = new WysiwygEditor(host, { markdown })
  editor.init()
  const view = (editor as unknown as { view: EditorView }).view
  const handler = vi.fn()
  editor.on('content-change', handler)
  const type = (text: string) => view.dispatch({ changes: { from: 0, insert: text }, userEvent: 'input.type' })
  return { editor, handler, type }
}

describe('content-change on large documents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays synchronous on documents at or below the threshold', () => {
    const { editor, handler, type } = mount('small')
    type('x')
    expect(handler).toHaveBeenCalledWith({ markdown: 'xsmall' })
    editor.destroy()
  })

  it('emits once typing pauses, with the latest text', () => {
    const { editor, handler, type } = mount(LARGE)
    type('a')
    type('b')
    expect(handler).not.toHaveBeenCalled()
    vi.advanceTimersByTime(CONTENT_CHANGE_IDLE_MS)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenLastCalledWith({ markdown: `ba${LARGE}` })
    editor.destroy()
  })

  it('still emits at the max wait during continuous typing', () => {
    const { editor, handler, type } = mount(LARGE)
    const step = CONTENT_CHANGE_IDLE_MS / 2
    for (let elapsed = 0; elapsed < CONTENT_CHANGE_MAX_WAIT_MS; elapsed += step) {
      type('k')
      vi.advanceTimersByTime(step)
    }
    expect(handler).toHaveBeenCalledTimes(1)
    editor.destroy()
  })

  it('flush emits the pending change at once and cancels the timer', () => {
    const { editor, handler, type } = mount(LARGE)
    type('z')
    editor.flush()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenLastCalledWith({ markdown: `z${LARGE}` })
    vi.advanceTimersByTime(CONTENT_CHANGE_MAX_WAIT_MS)
    expect(handler).toHaveBeenCalledTimes(1)
    editor.destroy()
  })

  it('keeps setContent synchronous so tab loads and reloads are seen at once', () => {
    const { editor, handler } = mount('small')
    editor.setContent(`${LARGE}tail`)
    expect(handler).toHaveBeenCalledWith({ markdown: `${LARGE}tail` })
    editor.destroy()
  })

  it('emits a pending change before destroy', () => {
    const { editor, handler, type } = mount(LARGE)
    type('q')
    editor.destroy()
    expect(handler).toHaveBeenCalledWith({ markdown: `q${LARGE}` })
  })
})
