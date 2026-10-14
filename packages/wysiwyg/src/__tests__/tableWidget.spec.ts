import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import {
  livePreviewDomHandlers,
  livePreviewField,
  livePreviewOptions,
  livePreviewUpdateListener,
  requestLivePreviewRebuild
} from '../decorations/livePreview'
import { displayWidth, formatTable, moveTableColumn } from '../features/tables'
import { WysiwygEditor } from '../editor'

const DOC = 'intro\n\n| Name | Score |\n| :--- | ---: |\n| **Ann** | 9 |\n| a\\|b | `x` |\n\noutro'

function makeLiveView(doc: string, anchor = 0, renderTables = true): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc,
      selection: { anchor },
      extensions: [
        livePreviewField,
        livePreviewUpdateListener,
        livePreviewDomHandlers,
        livePreviewOptions.of({ renderTables }),
        createMarkdownLanguage()
      ]
    })
  })
  requestLivePreviewRebuild(view)
  return view
}

describe('rendered tables', () => {
  it('renders a grid with alignment and inline formatting while the caret is outside', () => {
    const view = makeLiveView(DOC, 0)
    const table = view.dom.querySelector('table.wysiwyg-table')
    expect(table).not.toBeNull()
    const headers = Array.from(table!.querySelectorAll('th')).map(th => th.textContent)
    expect(headers).toEqual(['Name', 'Score'])
    const cells = Array.from(table!.querySelectorAll('td'))
    expect(cells.map(td => td.textContent)).toEqual(['Ann', '9', 'a|b', 'x'])
    expect(cells[0].querySelector('.wysiwyg-strong')?.textContent).toBe('Ann')
    expect(cells[3].querySelector('.wysiwyg-inline-code')?.textContent).toBe('x')
    expect((table!.querySelector('th') as HTMLElement).style.textAlign).toBe('left')
    expect(cells[1].style.textAlign).toBe('right')
    // The source text stays the single source of truth.
    expect(view.state.doc.toString()).toBe(DOC)
  })

  it('reveals the source when the caret enters the table lines', () => {
    const view = makeLiveView(DOC, 0)
    const tableStart = DOC.indexOf('| Name')
    view.dispatch({ selection: EditorSelection.cursor(tableStart) })
    expect(view.dom.querySelector('table.wysiwyg-table')).toBeNull()
    view.dispatch({ selection: EditorSelection.cursor(DOC.length) })
    expect(view.dom.querySelector('table.wysiwyg-table')).not.toBeNull()
  })

  it('places the caret in the clicked cell', () => {
    const view = makeLiveView(DOC, 0)
    const td = view.dom.querySelectorAll('table.wysiwyg-table td')[1] as HTMLElement
    td.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    expect(line.text).toBe('| **Ann** | 9 |')
    expect(view.state.sliceDoc(head, head + 1)).toMatch(/\s|9/)
    expect(view.dom.querySelector('table.wysiwyg-table')).toBeNull()
  })

  it('redirects a one-line step over a rendered table into its rows', () => {
    const view = makeLiveView(DOC, 0)
    const lineBefore = view.state.doc.line(2)
    const tableFirst = view.state.doc.line(3)
    const tableLast = view.state.doc.line(6)
    const lineAfter = view.state.doc.line(7)
    view.dispatch({ selection: EditorSelection.cursor(lineBefore.from) })
    // What vertical motion produces when the table is one atomic block.
    view.dispatch({ selection: EditorSelection.cursor(lineAfter.from), userEvent: 'select' })
    expect(view.state.selection.main.head).toBe(tableFirst.from)
    view.dispatch({ selection: EditorSelection.cursor(lineAfter.from) })
    requestLivePreviewRebuild(view)
    view.dispatch({ selection: EditorSelection.cursor(lineBefore.from), userEvent: 'select' })
    expect(view.state.selection.main.head).toBe(tableLast.from)
  })

  it('leaves pointer clicks and longer jumps alone', () => {
    const view = makeLiveView(DOC, 0)
    const lineAfter = view.state.doc.line(7)
    view.dispatch({ selection: EditorSelection.cursor(0) })
    view.dispatch({ selection: EditorSelection.cursor(lineAfter.from), userEvent: 'select' })
    expect(view.state.selection.main.head).toBe(lineAfter.from)
    view.dispatch({ selection: EditorSelection.cursor(view.state.doc.line(2).from) })
    view.dispatch({ selection: EditorSelection.cursor(lineAfter.from), userEvent: 'select.pointer' })
    expect(view.state.selection.main.head).toBe(lineAfter.from)
  })

  it('can be switched off', () => {
    const view = makeLiveView(DOC, 0, false)
    expect(view.dom.querySelector('table.wysiwyg-table')).toBeNull()
    expect(view.dom.querySelector('.wysiwyg-table-line')).not.toBeNull()
  })
})

function makeView(doc: string, anchor: number): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new EditorView({ parent: host, doc, selection: { anchor }, extensions: [createMarkdownLanguage()] })
}

describe('table column commands', () => {
  const TABLE = '| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |'

  it('moves the caret column right and left, alignment included', () => {
    const view = makeView(TABLE, TABLE.indexOf('2'))
    expect(moveTableColumn(view, 1)).toBe(true)
    expect(view.state.doc.toString()).toBe('| A | C | B |\n| :--- | ---: | :---: |\n| 1 | 3 | 2 |')
    // Caret follows the moved cell.
    expect(view.state.sliceDoc(view.state.selection.main.head, view.state.selection.main.head + 1)).toBe('2')
    expect(moveTableColumn(view, -1)).toBe(true)
    expect(moveTableColumn(view, -1)).toBe(true)
    expect(view.state.doc.toString()).toBe('| B | A | C |\n| :---: | :--- | ---: |\n| 2 | 1 | 3 |')
    // At the edge it is a no-op that still consumes the key.
    expect(moveTableColumn(view, -1)).toBe(true)
    expect(view.state.doc.toString()).toBe('| B | A | C |\n| :---: | :--- | ---: |\n| 2 | 1 | 3 |')
  })

  it('returns false outside tables', () => {
    const view = makeView('plain', 2)
    expect(moveTableColumn(view, 1)).toBe(false)
    expect(formatTable(view)).toBe(false)
  })

  it('pads cells so pipes line up, honouring alignment and wide characters', () => {
    const doc = '| Name | 分数 |\n| :-: | --: |\n| Alexander | 9 |\n| 李 | 100 |'
    const view = makeView(doc, doc.indexOf('Alexander'))
    expect(formatTable(view)).toBe(true)
    const lines = view.state.doc.toString().split('\n')
    expect(lines).toEqual([
      '|   Name    | 分数 |',
      '| :-------: | ---: |',
      '| Alexander |    9 |',
      '|    李     |  100 |'
    ])
    const widths = new Set(lines.map(displayWidth))
    expect(widths.size).toBe(1)
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toContain('Alexander')
  })
})

describe('rectangular selection', () => {
  it('allows multiple selection ranges in the engine', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = new WysiwygEditor(host, { markdown: 'abc\ndef' })
    editor.init()
    const view = (editor as unknown as { view: EditorView }).view
    expect(view.state.facet(EditorState.allowMultipleSelections)).toBe(true)
    view.dispatch({ selection: EditorSelection.create([EditorSelection.range(0, 1), EditorSelection.range(4, 5)]) })
    expect(view.state.selection.ranges.length).toBe(2)
    editor.destroy()
  })
})
