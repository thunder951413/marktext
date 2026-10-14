import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import { formatToolbar, formatToolbarField, isFormatActive } from '../features/formatToolbar'
import { WysiwygEditor } from '../editor'

function makeView(doc: string, config: Parameters<typeof formatToolbar>[0] = {}) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({
    state: EditorState.create({ doc, extensions: [createMarkdownLanguage(), formatToolbar(config)] }),
    parent
  })
}

const visible = (view: EditorView) => view.state.field(formatToolbarField).visible

describe('floating format toolbar', () => {
  it('appears for a non-empty selection and hides when it collapses', () => {
    const view = makeView('hello world')
    expect(visible(view)).toBe(false)
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select' })
    expect(visible(view)).toBe(true)
    view.dispatch({ selection: EditorSelection.cursor(2), userEvent: 'select' })
    expect(visible(view)).toBe(false)
  })

  it('renders buttons that apply inline formats to the selection', () => {
    const view = makeView('hello world')
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select.pointer' })
    const bold = view.dom.querySelector<HTMLButtonElement>('.wysiwyg-format-button[data-format="strong"]')
    expect(bold).not.toBeNull()
    bold!.click()
    expect(view.state.doc.toString()).toBe('**hello** world')
    // The selection is re-wrapped, so the toolbar stays and reports bold active.
    expect(visible(view)).toBe(true)
    expect(isFormatActive(view.state, 'strong')).toBe(true)
    expect(view.dom.querySelector('.wysiwyg-format-button[data-format="strong"]')?.classList.contains('active')).toBe(true)
    // Toggling again unwraps.
    view.dom.querySelector<HTMLButtonElement>('.wysiwyg-format-button[data-format="strong"]')!.click()
    expect(view.state.doc.toString()).toBe('hello world')
  })

  it('stays hidden inside fenced code', () => {
    const view = makeView('```js\nconst a = 1\n```\n')
    view.dispatch({ selection: EditorSelection.range(6, 11), userEvent: 'select.pointer' })
    expect(visible(view)).toBe(false)
  })

  it('in pointer-only mode ignores keyboard selections', () => {
    const view = makeView('hello world', { pointerOnly: true })
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select' })
    expect(visible(view)).toBe(false)
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select.pointer' })
    expect(visible(view)).toBe(true)
  })

  it('can be disabled and dismissed', () => {
    const disabled = makeView('hello', { enabled: false })
    disabled.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select' })
    expect(visible(disabled)).toBe(false)

    const view = makeView('hello')
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select' })
    view.dispatch({ selection: view.state.selection, userEvent: 'select.dismiss-toolbar' })
    expect(visible(view)).toBe(false)
    expect(view.state.selection.main.empty).toBe(false)
  })

  it('distinguishes emphasis from strong', () => {
    const view = makeView('**bold** *em*')
    view.dispatch({ selection: EditorSelection.range(2, 6) })
    expect(isFormatActive(view.state, 'strong')).toBe(true)
    expect(isFormatActive(view.state, 'em')).toBe(false)
    view.dispatch({ selection: EditorSelection.range(10, 12) })
    expect(isFormatActive(view.state, 'em')).toBe(true)
  })

  it('is wired into WysiwygEditor and honours hideAllFloatTools/options', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = new WysiwygEditor(host, { markdown: 'some text' })
    editor.init()
    const view = (editor as unknown as { view: EditorView }).view
    // Programmatic selections (search, cursor restore) never open it.
    editor.setSelectionRange(0, 4)
    expect(host.querySelector('.wysiwyg-format-toolbar')).toBeNull()
    view.dispatch({ selection: EditorSelection.range(0, 4), userEvent: 'select.pointer' })
    expect(host.querySelector('.wysiwyg-format-toolbar')).not.toBeNull()
    editor.hideAllFloatTools()
    expect(host.querySelector('.wysiwyg-format-toolbar')).toBeNull()
    editor.setOptions({ formatToolbar: false })
    view.dispatch({ selection: EditorSelection.range(0, 5), userEvent: 'select.pointer' })
    expect(host.querySelector('.wysiwyg-format-toolbar')).toBeNull()
    editor.destroy()
  })
})
