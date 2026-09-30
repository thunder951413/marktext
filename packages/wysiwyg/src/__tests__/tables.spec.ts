import { type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import {
  applyPipeEscape,
  createTable,
  deleteTableColumn,
  deleteTableRow,
  enterInTable,
  goToNextCell,
  insertTableColumn,
  insertTableRow,
  parseTableAt,
  setTableColumnAlignment,
  smartShiftTab,
  smartTab
} from '../features/tables'

const TABLE = '| A | B |\n| --- | :---: |\n| 1 | 2 |\n| 3 | 4 |'

function makeView(doc: string, cursor: number, extraExtensions: Extension[] = []): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  // parseTableAt reads the syntax tree, so the markdown language must be present.
  return new EditorView({
    parent: host,
    doc,
    selection: { anchor: cursor },
    extensions: [createMarkdownLanguage(), ...extraExtensions]
  })
}

/** Cursor position of the first character of a cell in `row,col` (0-based rows incl. header). */
function cellPos(doc: string, row: number, col: number): number {
  const lines = doc.split('\n')
  const lineStart = lines.slice(0, row).join('\n').length + (row > 0 ? 1 : 0)
  const segments = lines[row].split('|')
  let offset = lineStart
  for (let i = 0; i <= col; i++) {
    offset += segments[i].length + 1
  }
  return offset + (segments[col + 1]?.startsWith(' ') ? 1 : 0)
}

describe('table navigation', () => {
  it('moves forward through cells with Tab', () => {
    const view = makeView(TABLE, cellPos(TABLE, 0, 0))
    expect(smartTab(view)).toBe(true)
    const table = parseTableAt(view.state, view.state.selection.main.head)!
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(table.header.lineNo)
    view.destroy()
  })

  it('wraps from the last column to the next row', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 1))
    goToNextCell(view)
    const head = view.state.selection.main.head
    expect(view.state.doc.lineAt(head).text).toBe('| 3 | 4 |')
    view.destroy()
  })

  it('appends an empty row when tabbing past the last body cell', () => {
    const view = makeView(TABLE, cellPos(TABLE, 3, 1))
    goToNextCell(view)
    expect(view.state.doc.toString()).toBe(`${TABLE}\n|  |  |`)
    view.destroy()
  })

  it('walks backward with Shift-Tab without creating rows', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 0))
    smartShiftTab(view)
    const head = view.state.selection.main.head
    expect(view.state.doc.lineAt(head).text).toBe('| A | B |')
    expect(view.state.doc.toString()).toBe(TABLE)
    view.destroy()
  })

  it('Enter moves down one row in the same column', () => {
    const view = makeView(TABLE, cellPos(TABLE, 0, 1))
    enterInTable(view)
    const head = view.state.selection.main.head
    // Header col 1 → delimiter row is skipped by the parser; lands on first body row.
    expect(view.state.doc.lineAt(head).text).toBe('| 1 | 2 |')
    view.destroy()
  })

  it('falls back to list indentation outside tables', () => {
    const doc = '- item'
    const view = makeView(doc, 6)
    expect(smartTab(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('  - item')
    view.destroy()
  })
})

describe('row and column operations', () => {
  it('inserts a row below the current one', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 0))
    expect(insertTableRow(view, true)).toBe(true)
    const lines = view.state.doc.toString().split('\n')
    expect(lines[3]).toBe('|  |  |')
    expect(lines[4]).toBe('| 3 | 4 |')
    view.destroy()
  })

  it('deletes the current row and removes the whole table when empty', () => {
    const small = '| A |\n| --- |'
    const view = makeView(small, cellPos(small, 0, 0))
    expect(deleteTableRow(view)).toBe(true)
    expect(view.state.doc.toString().trim()).not.toContain('| A |')
    view.destroy()

    const view2 = makeView(TABLE, cellPos(TABLE, 3, 0))
    deleteTableRow(view2)
    expect(view2.state.doc.toString()).toBe('| A | B |\n| --- | :---: |\n| 1 | 2 |')
    view2.destroy()
  })

  it('inserts a column before the caret column, keeping other alignments', () => {
    // Caret in the second column of a body row (not the delimiter line).
    const view = makeView(TABLE, cellPos(TABLE, 2, 1))
    insertTableColumn(view, false)
    const lines = view.state.doc.toString().split('\n')
    expect(lines[0]).toBe('| A |  | B |')
    expect(lines[1]).toBe('| --- |  | :---: |')
    expect(lines[2]).toBe('| 1 |  | 2 |')
    view.destroy()
  })

  it('deletes a column across every line', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 0))
    deleteTableColumn(view)
    const lines = view.state.doc.toString().split('\n')
    expect(lines[0]).toBe('| B |')
    expect(lines[2]).toBe('| 2 |')
    view.destroy()
  })

  it('sets column alignment by rewriting the delimiter cell only', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 0))
    expect(setTableColumnAlignment(view, 'right')).toBe(true)
    const lines = view.state.doc.toString().split('\n')
    expect(lines[1]).toBe('| ---: | :---: |')
    // Body content untouched.
    expect(lines[2]).toBe('| 1 | 2 |')
    view.destroy()
  })
})

describe('createTable', () => {
  it('starts a new line for the table when the caret is mid-content', () => {
    const view = makeView('hello ', 6)
    expect(createTable(view, { rows: 2, columns: 3 })).toBe(true)
    const lines = view.state.doc.toString().split('\n')
    expect(lines[0]).toBe('hello ')
    expect(lines[1]).toBe('|  |  |  |')
    expect(lines[2]).toBe('| --- | --- | --- |')
    expect(lines[3]).toBe('|  |  |  |')
    // The caret sits in the first header cell of the freshly parsed table.
    expect(parseTableAt(view.state, view.state.selection.main.head)).not.toBeNull()
    view.destroy()
  })
})

describe('pipe escaping inside cells', () => {
  it('escapes typed pipes within a table but not outside', () => {
    const view = makeView(TABLE, cellPos(TABLE, 2, 0))
    const at = view.state.selection.main.head
    // Range replaces the existing cell character, like typing over a selection.
    expect(applyPipeEscape(view, at, at + 1, 'a|b')).toBe(true)
    expect(view.state.doc.line(3).text).toBe('| a\\|b | 2 |')
    view.destroy()

    const plain = makeView('paragraph ', 10)
    expect(applyPipeEscape(plain, 10, 10, 'x|y')).toBe(false)
    plain.destroy()
  })
})
