import type { EditorView } from '@codemirror/view'

const TASK_MARKER = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+)\[([ xX])]/

/**
 * Flips the `[ ]` / `[x]` marker of the task list item at `pos`. Returns
 * false when the position is not inside a task marker line.
 */
export function toggleTaskAt(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos)
  const match = TASK_MARKER.exec(line.text)
  if (!match) return false
  const bracketFrom = line.from + match[1].length + 1
  const nextChar = match[2] === ' ' ? 'x' : ' '
  view.dispatch({
    changes: { from: bracketFrom, to: bracketFrom + 1, insert: nextChar }
  })
  return true
}
