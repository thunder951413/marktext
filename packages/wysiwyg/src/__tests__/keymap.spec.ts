import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import { indentList, unindentList } from '../keymap'

function makeView(doc: string, cursor: number): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new EditorView({
    parent: host,
    doc,
    selection: { anchor: cursor },
    extensions: [createMarkdownLanguage()]
  })
}

describe('list indentation commands', () => {
  it('indents a list line on Tab', () => {
    const view = makeView('- item one\n- item two', 5)
    expect(indentList(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('  - item one\n- item two')
    view.destroy()
  })

  it('unindents a list line on Shift-Tab', () => {
    const view = makeView('  - deep item', 8)
    expect(unindentList(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('- deep item')
    view.destroy()
  })

  it('does not unindent a top-level list line', () => {
    const view = makeView('- item', 3)
    expect(unindentList(view)).toBe(false)
    expect(view.state.doc.toString()).toBe('- item')
    view.destroy()
  })

  it('falls back to inserting an indent unit on non-list lines', () => {
    const view = makeView('plain text', 10)
    expect(indentList(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('plain text  ')
    view.destroy()
  })

  it('indents every selected list line in a range', () => {
    const view = makeView('- a\n- b', 0)
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
    expect(indentList(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('  - a\n  - b')
    view.destroy()
  })

  it('handles ordered and task list markers', () => {
    const taskView = makeView('- [ ] ship it', 6)
    expect(taskView.state.doc.sliceString(2, 4)).toBe('[ ')
    indentList(taskView)
    expect(taskView.state.doc.toString().startsWith('  - [ ]')).toBe(true)
    taskView.destroy()

    const orderedView = makeView('1. first', 4)
    indentList(orderedView)
    expect(orderedView.state.doc.toString()).toBe('  1. first')
    orderedView.destroy()
  })
})
