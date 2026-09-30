import { Transaction } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])(\s+\[[ xX]]\s+|\s+)(.*)$/

interface ListLine {
  indent: string
  marker: string
  gap: string
  body: string
}

function parseListLine(lineText: string): ListLine | null {
  const match = LIST_MARKER.exec(lineText)
  if (!match) return null
  return { indent: match[1], marker: match[2], gap: match[3], body: match[4] }
}

/**
 * Indents each selected line that belongs to a list item by one level.
 * Non-list lines fall back to inserting the plain indent unit at the caret.
 */
export function indentList(view: EditorView): boolean {
  return changeIndent(view, false)
}

/** Removes one indentation level from selected list lines; no-op elsewhere. */
export function unindentList(view: EditorView): boolean {
  return changeIndent(view, true)
}

function changeIndent(view: EditorView, unindent: boolean): boolean {
  const state = view.state
  const indentation = state.facet(indentUnit)
  const changes: Array<{ from: number; to: number; insert?: string }> = []

  for (const range of state.selection.ranges) {
    const firstLine = state.doc.lineAt(range.from).number
    const lastLine = state.doc.lineAt(range.to).number

    for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
      const line = state.doc.line(lineNo)
      const item = parseListLine(line.text)

      if (!item) {
        if (!unindent && range.empty && firstLine === lastLine) {
          changes.push({ from: range.from, to: range.to, insert: indentation })
        }
        continue
      }

      if (unindent) {
        if (!item.indent) continue
        const removed = item.indent.endsWith('\t') ? '\t'.length : Math.min(indentation.length, item.indent.length)
        changes.push({ from: line.from, to: line.from + removed })
      } else {
        changes.push({ from: line.from, to: line.from + item.indent.length, insert: `${item.indent}${indentation}` })
      }
    }
  }

  if (!changes.length) return false

  // Changes apply against the original document, so keep them sorted by
  // position for multi-range selections.
  changes.sort((a, b) => a.from - b.from || a.to - b.to)
  view.dispatch(
    state.update({
      changes,
      scrollIntoView: true,
      annotations: Transaction.userEvent.of(unindent ? 'delete' : 'input')
    })
  )
  return true
}
