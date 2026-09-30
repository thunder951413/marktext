import { EditorSelection, type EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { indentList, unindentList } from '../keymap'

export type TableAlignment = 'left' | 'center' | 'right' | 'none'

interface CellSpan {
  /** Content range inside the cell, excluding padding spaces. */
  from: number
  to: number
  text: string
}

interface RowInfo {
  lineNo: number
  cells: CellSpan[]
}

export interface TableStructure {
  from: number
  to: number
  header: RowInfo
  delimiterLineNo: number
  rows: RowInfo[]
  alignments: TableAlignment[]
  columnCount: number
}

const DELIM_CELL = /^:?-+:?$/

function splitRowCells(lineText: string): { texts: string[]; spans: Array<[number, number]> } {
  // Split on unescaped pipes; `\|` stays part of the cell content (#4850).
  const texts: string[] = []
  const spans: Array<[number, number]> = []
  let depthStart = -1
  let buf = ''
  for (let i = 0; i < lineText.length; i++) {
    const ch = lineText[i]
    if (ch === '\\' && lineText[i + 1] === '|') {
      buf += '\\|'
      i++
      continue
    }
    if (ch === '|') {
      const rest = lineText.slice(i + 1)
      if (depthStart >= 0) {
        // A pipe with only whitespace after it closes the last cell; return
        // early so the trailing-content guard below cannot re-push it.
        if (rest.trim() === '') {
          pushCell(buf, depthStart, i)
          return { texts, spans }
        }
        pushCell(buf, depthStart, i)
      }
      depthStart = i + 1
      buf = ''
      continue
    }
    buf += ch
  }
  if (depthStart >= 0 && buf.trim().length > 0) {
    pushCell(buf, depthStart, lineText.length)
  }

  function pushCell(raw: string, from: number, to: number) {
    const lead = raw.length - raw.trimStart().length
    const trail = raw.length - raw.trimEnd().length
    texts.push(raw.trim())
    spans.push([from + lead, to - trail])
  }
  return { texts, spans }
}

function parseAlignments(delimiterTexts: string[]): TableAlignment[] {
  return delimiterTexts.map(t => {
    if (/^:-+:$/.test(t)) return 'center'
    if (/^:-+$/.test(t)) return 'left'
    if (/^-+:$/.test(t)) return 'right'
    return 'none'
  })
}

function delimCellFor(align: TableAlignment): string {
  switch (align) {
    case 'left':
      return ':---'
    case 'center':
      return ':---:'
    case 'right':
      return '---:'
    default:
      return '---'
  }
}

/**
 * Parses the GFM table containing `pos`, using the syntax tree only to find
 * the block boundary and plain-text splitting for cells so escaped pipes and
 * inline markup survive round-trips.
 */
export function parseTableAt(state: EditorState, pos: number): TableStructure | null {
  // Collect through the callback; a plain `let` assigned inside iterate() is
  // narrowed to null by TS control-flow analysis.
  const found: Array<{ from: number; to: number }> = []
  syntaxTree(state).iterate({
    enter: node => {
      if (node.name === 'Table' && pos >= node.from && pos <= node.to) {
        found.push({ from: node.from, to: node.to })
        return false
      }
      return undefined
    }
  })
  if (!found.length) return null
  const range = found[0]

  const firstLine = state.doc.lineAt(range.from).number
  const lastLine = state.doc.lineAt(range.to - 1).number

  const header: RowInfo | null = buildRow(state, firstLine)
  const delimiterLineNo = firstLine + 1
  const delimTexts = splitRowCells(state.doc.line(delimiterLineNo).text).texts
  if (!header || delimTexts.length === 0 || !delimTexts.every(t => DELIM_CELL.test(t))) return null

  const rows: RowInfo[] = []
  for (let lineNo = delimiterLineNo + 1; lineNo <= lastLine; lineNo++) {
    const row = buildRow(state, lineNo)
    if (row) rows.push(row)
  }

  const columnCount = header.cells.length
  return {
    from: range.from,
    to: range.to,
    header,
    delimiterLineNo,
    rows,
    alignments: parseAlignments(delimTexts),
    columnCount
  }
}

function buildRow(state: EditorState, lineNo: number): RowInfo | null {
  const line = state.doc.line(lineNo)
  if (!line.text.trim()) return null
  const { texts, spans } = splitRowCells(line.text)
  if (spans.length === 0) return null
  // splitRowCells works on the line text, so translate spans to absolute
  // document positions.
  return {
    lineNo,
    cells: spans.map(([from, to], i) => ({ from: from + line.from, to: to + line.from, text: texts[i] }))
  }
}

function locateCell(
  view: EditorView
): { table: TableStructure; rowIndex: number; colIndex: number } | null {
  const { state } = view
  const table = parseTableAt(state, state.selection.main.head)
  if (!table) return null

  const pos = state.selection.main.head
  const lineNo = state.doc.lineAt(pos).number

  const allRows: Array<{ row: RowInfo; index: number; isBody: boolean }> = [
    { row: table.header, index: 0, isBody: false },
    ...table.rows.map((row, i) => ({ row, index: i + 1, isBody: true }))
  ]
  for (const entry of allRows) {
    if (entry.row.lineNo !== lineNo) continue
    const colIndex = entry.row.cells.findIndex(c => pos >= c.from - 2 && pos <= c.to + 2)
    if (colIndex >= 0) return { table, rowIndex: entry.index, colIndex }
  }
  // Cursor on the delimiter row: treat as column 0 of the header.
  return { table, rowIndex: 0, colIndex: 0 }
}

function selectCell(view: EditorView, cell: CellSpan): void {
  const pos = Math.min(cell.from, cell.to)
  view.dispatch({
    selection: EditorSelection.single(pos),
    scrollIntoView: true
  })
}

/** Tab inside a table walks cells forward, appending a row at the end. */
export function goToNextCell(view: EditorView): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, rowIndex, colIndex } = located

  const rowCells = rowCellsOf(table, rowIndex)
  if (colIndex + 1 < rowCells.length) {
    selectCell(view, rowCells[colIndex + 1])
    return true
  }
  if (rowIndex < table.rows.length) {
    selectCell(view, rowCellsOf(table, rowIndex + 1)[0])
    return true
  }
  // Last body cell: append a row and enter its first cell.
  appendRow(view, table, table.rows.length)
  const fresh = parseTableAt(view.state, view.state.selection.main.head)
  if (!fresh) return true
  selectCell(view, fresh.rows[fresh.rows.length - 1].cells[0])
  return true
}

/** Shift-Tab walks cells backward without creating anything. */
export function goToPrevCell(view: EditorView): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, rowIndex, colIndex } = located

  if (colIndex > 0) {
    selectCell(view, rowCellsOf(table, rowIndex)[colIndex - 1])
    return true
  }
  if (rowIndex > 0) {
    const prev = rowCellsOf(table, rowIndex - 1)
    selectCell(view, prev[prev.length - 1])
    return true
  }
  return true
}

function rowCellsOf(table: TableStructure, rowIndex: number): CellSpan[] {
  return rowIndex === 0 ? table.header.cells : table.rows[rowIndex - 1].cells
}

/** Enter inside a table moves to the next row, same column. */
export function enterInTable(view: EditorView): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, rowIndex, colIndex } = located

  if (rowIndex < table.rows.length) {
    selectCell(view, rowCellsOf(table, rowIndex + 1)[colIndex])
    return true
  }
  appendRow(view, table, table.rows.length)
  const fresh = parseTableAt(view.state, view.state.selection.main.head)
  if (!fresh || !fresh.rows.length) return true
  const target = fresh.rows[fresh.rows.length - 1].cells[Math.min(colIndex, fresh.columnCount - 1)]
  selectCell(view, target)
  return true
}

function renderRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

function appendRow(view: EditorView, table: TableStructure, afterBodyIndex: number): void {
  const anchorRow =
    afterBodyIndex > 0 ? table.rows[afterBodyIndex - 1] : table.header
  const line = view.state.doc.line(anchorRow.lineNo)
  const empty = renderRow(new Array(table.columnCount).fill(''))
  view.dispatch({
    changes: { from: line.to, to: line.to, insert: `\n${empty}` }
  })
}

export function insertTableRow(view: EditorView, below = true): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, rowIndex } = located
  const { state } = view

  // "Above" the header becomes the first body row (after the delimiter),
  // because a GFM table must start with its header line.
  const anchorLineNo =
    rowIndex === 0
      ? table.delimiterLineNo
      : below
        ? table.rows[rowIndex - 1].lineNo
        : (table.rows[rowIndex - 2]?.lineNo ?? table.delimiterLineNo)
  const line = state.doc.line(anchorLineNo)
  const newRow = renderRow(new Array(table.columnCount).fill(''))
  // Splice after the anchor line's newline so the new row lands on its own line.
  view.dispatch({ changes: { from: line.to, to: line.to, insert: `\n${newRow}` } })
  return true
}

export function deleteTableRow(view: EditorView): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, rowIndex } = located
  const { state } = view

  if (table.rows.length === 0) {
    // Header + delimiter only: removing either empties the table, so drop it.
    view.dispatch({
      changes: { from: table.from, to: Math.min(table.to + 1, state.doc.length) }
    })
    return true
  }

  const lineNo = rowIndex === 0 ? table.header.lineNo : table.rows[rowIndex - 1].lineNo
  const line = state.doc.line(lineNo)
  // Deleting the last line would strand its preceding newline, so consume
  // the newline before it instead of the one after.
  const from = lineNo === state.doc.lines ? state.doc.line(lineNo - 1).to : line.from
  view.dispatch({ changes: { from, to: Math.min(line.to + 1, state.doc.length) } })
  return true
}

export function insertTableColumn(view: EditorView, after = true): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, colIndex } = located
  const insertAt = after ? colIndex + 1 : colIndex
  const changes: Array<{ from: number; to: number; insert: string }> = []

  applyToLines(table, (lineNo, cells) => {
    const line = view.state.doc.line(lineNo)
    const next = [...cells]
    next.splice(insertAt, 0, '')
    const rebuilt = renderRow(next)
    changes.push({ from: line.from, to: line.to, insert: rebuilt })
  })
  view.dispatch({ changes })
  return true
}

export function deleteTableColumn(view: EditorView): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, colIndex } = located
  if (table.columnCount <= 1) {
    view.dispatch({
      changes: { from: table.from, to: Math.min(table.to + 1, view.state.doc.length) }
    })
    return true
  }
  const changes: Array<{ from: number; to: number; insert: string }> = []
  applyToLines(table, (lineNo, cells) => {
    const line = view.state.doc.line(lineNo)
    const next = cells.filter((_, i) => i !== colIndex)
    changes.push({ from: line.from, to: line.to, insert: renderRow(next) })
  })
  view.dispatch({ changes })
  return true
}

export function setTableColumnAlignment(view: EditorView, align: TableAlignment): boolean {
  const located = locateCell(view)
  if (!located) return false
  const { table, colIndex } = located
  const line = view.state.doc.line(table.delimiterLineNo)
  const { texts } = splitRowCells(line.text)
  if (colIndex >= texts.length) return false
  const rebuilt = renderRow(texts.map((t, i) => (i === colIndex ? delimCellFor(align) : t)))
  view.dispatch({ changes: { from: line.from, to: line.to, insert: rebuilt } })
  return true
}

export function createTable(view: EditorView, spec: { rows: number; columns: number }): boolean {
  const rows = Math.max(1, Math.min(spec.rows, 50))
  const columns = Math.max(1, Math.min(spec.columns, 30))
  const lines = [
    renderRow(new Array(columns).fill('')),
    renderRow(new Array(columns).fill('---')),
    ...Array.from({ length: rows }, () => renderRow(new Array(columns).fill('')))
  ]
  const pos = view.state.selection.main.head
  // GFM tables must start on their own line, so break first when the caret
  // sits inside existing content.
  const prefix = view.state.doc.lineAt(pos).text.length === 0 ? '' : '\n'
  const insert = `${prefix}${lines.join('\n')}\n`
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: EditorSelection.single(pos + prefix.length + 2),
    scrollIntoView: true
  })
  return true
}

function applyToLines(
  table: TableStructure,
  fn: (lineNo: number, cells: string[]) => void
): void {
  fn(table.header.lineNo, table.header.cells.map(c => c.text))
  fn(table.delimiterLineNo, table.alignments.map(delimCellFor))
  for (const row of table.rows) fn(row.lineNo, row.cells.map(c => c.text))
}

/**
 * Tab / Shift-Tab / Enter dispatch to table navigation when the caret is in
 * a table and fall through to the list-edit commands otherwise.
 */
export function smartTab(view: EditorView): boolean {
  if (parseTableAt(view.state, view.state.selection.main.head)) return goToNextCell(view)
  return indentList(view)
}

export function smartShiftTab(view: EditorView): boolean {
  if (parseTableAt(view.state, view.state.selection.main.head)) return goToPrevCell(view)
  return unindentList(view)
}

/** Escapes pipes in typed text so they stay cell content of one row. */
export function applyPipeEscape(
  view: EditorView,
  from: number,
  to: number,
  insert: string
): boolean {
  if (!insert.includes('|')) return false
  if (!parseTableAt(view.state, from)) return false
  view.dispatch({
    changes: { from, to, insert: insert.replace(/\|/g, '\\|') },
    userEvent: 'input.type'
  })
  return true
}

/** CM6 input hook routing typed pipes through applyPipeEscape. */
export const tablePipeEscapeInput = EditorView.inputHandler.of((view, from, to, insert) =>
  applyPipeEscape(view, from, to, insert)
)
