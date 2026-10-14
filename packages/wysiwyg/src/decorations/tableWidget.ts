import type { EditorState } from '@codemirror/state'
import { WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { renderMathToString } from '../features/math'
import { tableAlignmentsFromDelimiter, type TableAlignment } from '../features/tables'

/**
 * Rendered GFM table shown while the caret is outside the table. The model is
 * derived from the Lezer tree at build time so toDOM never touches editor
 * state; cell offsets are relative to the table start because the widget can
 * be reused after edits above it shift absolute positions.
 */
interface InlinePart {
  text: string
  classes?: string[]
  math?: boolean
}

interface CellModel {
  /** Offset of the cell content relative to the table start. */
  offset: number
  parts: InlinePart[]
}

export interface TableModel {
  header: CellModel[]
  rows: CellModel[][]
  alignments: TableAlignment[]
}

const STYLE_BY_NODE: Record<string, string> = {
  Emphasis: 'wysiwyg-em',
  StrongEmphasis: 'wysiwyg-strong',
  Strikethrough: 'wysiwyg-del',
  Highlight: 'wysiwyg-highlight',
  InlineCode: 'wysiwyg-inline-code',
  Link: 'wysiwyg-link'
}

const HIDDEN_IN_CELLS = new Set([
  'EmphasisMark',
  'StrongEmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'LinkMark',
  'URL',
  'LinkTitle',
  'LinkLabel'
])

function collectParts(state: EditorState, node: SyntaxNode, from: number, to: number, classes: string[], out: InlinePart[]): void {
  let pos = from
  const pushText = (end: number) => {
    if (end > pos) out.push({ text: state.sliceDoc(pos, end), classes: classes.length ? classes : undefined })
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue
    pushText(child.from)
    pos = Math.max(pos, child.to)
    if (HIDDEN_IN_CELLS.has(child.name)) continue
    if (child.name === 'Escape') {
      out.push({ text: state.sliceDoc(child.from + 1, child.to), classes: classes.length ? classes : undefined })
      continue
    }
    if (child.name === 'InlineMath') {
      out.push({ text: state.sliceDoc(child.from + 1, child.to - 1), math: true })
      continue
    }
    if (child.name === 'Image') {
      const alt = /^!\[([^\]]*)\]/.exec(state.sliceDoc(child.from, child.to))
      out.push({ text: alt ? alt[1] : '', classes: [...classes, 'wysiwyg-table-image-alt'] })
      continue
    }
    const cls = STYLE_BY_NODE[child.name]
    // The custom `==highlight==` node has no mark children; trim its fences.
    const inset = child.name === 'Highlight' ? 2 : 0
    collectParts(state, child, child.from + inset, child.to - inset, cls ? [...classes, cls] : classes, out)
  }
  pushText(to)
}

function cellModel(state: EditorState, cell: SyntaxNode, tableFrom: number): CellModel {
  const parts: InlinePart[] = []
  collectParts(state, cell, cell.from, cell.to, [], parts)
  // Cell text keeps the source's padding spaces; trim the visible ends.
  if (parts.length) {
    parts[0] = { ...parts[0], text: parts[0].text.replace(/^\s+/, '') }
    const last = parts.length - 1
    parts[last] = { ...parts[last], text: parts[last].text.replace(/\s+$/, '') }
  }
  return { offset: cell.from - tableFrom, parts }
}

function rowCells(state: EditorState, row: SyntaxNode, tableFrom: number): CellModel[] {
  const cells: CellModel[] = []
  for (let child = row.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableCell') cells.push(cellModel(state, child, tableFrom))
  }
  return cells
}

/** Builds the render model; returns null for malformed tables (render as text). */
export function buildTableModel(state: EditorState, table: SyntaxNode, tableFrom: number): TableModel | null {
  let header: CellModel[] | null = null
  let delimiter = ''
  const rows: CellModel[][] = []
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') header = rowCells(state, child, tableFrom)
    else if (child.name === 'TableDelimiter') delimiter = state.doc.lineAt(child.from).text
    else if (child.name === 'TableRow') rows.push(rowCells(state, child, tableFrom))
  }
  if (!header || !delimiter) return null
  return { header, rows, alignments: tableAlignmentsFromDelimiter(delimiter) }
}

export class TableWidget extends WidgetType {
  readonly kind = 'table'
  constructor(readonly source: string, readonly model: TableModel) {
    super()
  }

  override eq(other: TableWidget) {
    return other.source === this.source
  }

  override ignoreEvent() {
    return false
  }

  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'wysiwyg-table-wrap'
    const table = document.createElement('table')
    table.className = 'wysiwyg-table'
    const columnCount = Math.max(this.model.header.length, this.model.alignments.length)
    const appendRow = (parent: HTMLElement, cells: CellModel[], tag: 'th' | 'td') => {
      const tr = document.createElement('tr')
      for (let i = 0; i < columnCount; i++) {
        const cell = document.createElement(tag)
        const align = this.model.alignments[i]
        if (align && align !== 'none') cell.style.textAlign = align
        const model = cells[i]
        if (model) {
          cell.dataset.offset = String(model.offset)
          for (const part of model.parts) cell.appendChild(renderPart(part))
        }
        tr.appendChild(cell)
      }
      parent.appendChild(tr)
    }
    const thead = document.createElement('thead')
    appendRow(thead, this.model.header, 'th')
    table.appendChild(thead)
    if (this.model.rows.length) {
      const tbody = document.createElement('tbody')
      for (const row of this.model.rows) appendRow(tbody, row, 'td')
      table.appendChild(tbody)
    }
    wrap.appendChild(table)
    return wrap
  }
}

function renderPart(part: InlinePart): Node {
  if (part.math) {
    const span = document.createElement('span')
    span.className = 'wysiwyg-math-inline'
    span.innerHTML = renderMathToString(part.text, false)
    return span
  }
  if (!part.classes) return document.createTextNode(part.text)
  const span = document.createElement('span')
  span.className = part.classes.join(' ')
  span.textContent = part.text
  return span
}
