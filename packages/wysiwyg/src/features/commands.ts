import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/** Inline format types supported by editor.format(), mirroring muya labels. */
export type InlineFormatType =
  | 'strong'
  | 'em'
  | 'u'
  | 'del'
  | 'mark'
  | 'inline_code'
  | 'inline_math'
  | 'link'
  | 'image'
  | 'clear'

const WRAPPERS: Record<string, { open: string; close: string }> = {
  strong: { open: '**', close: '**' },
  em: { open: '*', close: '*' },
  u: { open: '<u>', close: '</u>' },
  del: { open: '~~', close: '~~' },
  mark: { open: '==', close: '==' },
  inline_code: { open: '`', close: '`' },
  inline_math: { open: '$', close: '$' }
}

const ALL_MARKERS = ['**', '*', '~~', '==', '`', '$']

function dispatchReplace(view: EditorView, from: number, to: number, insert: string, cursorAt?: number): void {
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(cursorAt ?? from + insert.length),
    userEvent: 'input.format'
  })
}

/**
 * Toggles an inline wrapper over the selection. With a collapsed caret the
 * pair is inserted and the caret placed between the markers.
 */
export function applyInlineFormat(view: EditorView, type: InlineFormatType): boolean {
  const range = view.state.selection.main
  const text = view.state.sliceDoc(range.from, range.to)

  if (type === 'clear') return clearInlineFormats(view)

  if (type === 'link' || type === 'image') {
    const prefix = type === 'image' ? '!' : ''
    const insert = `${prefix}[${text || 'link'}](https://)`
    const cursor = range.from + prefix.length + 1 + text.length
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: range.empty
        ? EditorSelection.cursor(range.from + prefix.length + 1)
        : EditorSelection.range(range.from + prefix.length + 1, cursor),
      userEvent: 'input.format'
    })
    return true
  }

  const wrapper = WRAPPERS[type]
  if (!wrapper) return false

  // Unwrap when the selection sits exactly inside one wrapper pair.
  const outerFrom = range.from - wrapper.open.length
  const outerTo = range.to + wrapper.close.length
  if (
    !range.empty &&
    outerFrom >= 0 &&
    view.state.sliceDoc(outerFrom, range.from) === wrapper.open &&
    view.state.sliceDoc(range.to, outerTo) === wrapper.close
  ) {
    const innerLen = range.to - range.from
    // Delete the marker pairs themselves; plain point-inserts are no-ops.
    view.dispatch({
      changes: [
        { from: outerFrom, to: outerFrom + wrapper.open.length, insert: '' },
        { from: outerTo - wrapper.close.length, to: outerTo, insert: '' }
      ],
      selection: EditorSelection.range(outerFrom, outerFrom + innerLen),
      userEvent: 'delete'
    })
    return true
  }

  if (range.empty) {
    const insert = `${wrapper.open}${wrapper.close}`
    dispatchReplace(view, range.from, range.to, insert, range.from + wrapper.open.length)
    return true
  }

  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: `${wrapper.open}${text}${wrapper.close}`
    },
    selection: EditorSelection.range(
      range.from + wrapper.open.length,
      range.from + wrapper.open.length + text.length
    ),
    userEvent: 'input.format'
  })
  return true
}

function clearInlineFormats(view: EditorView): boolean {
  const range = view.state.selection.main
  let text = view.state.sliceDoc(range.from, range.to)
  if (!text) return false
  for (const marker of ALL_MARKERS) {
    while (text.includes(marker)) text = text.replace(marker, '')
  }
  dispatchReplace(view, range.from, range.to, text, range.from + text.length)
  return true
}

export interface BlockRange {
  from: number
  to: number
  startLine: number
  endLine: number
}

/** The blank-line-delimited paragraph (or fenced/delimited block) at the caret. */
export function blockRangeAt(view: EditorView): BlockRange {
  const { state } = view
  const blockNames = new Set([
    'ATXHeading1', 'ATXHeading2', 'ATXHeading3', 'ATXHeading4', 'ATXHeading5', 'ATXHeading6',
    'SetextHeading1', 'SetextHeading2',
    'FencedCode', 'HTMLBlock', 'BlockQuote', 'BulletList', 'OrderList', 'Table', 'FrontMatter', 'MathBlock'
  ])
  let cursorNode = syntaxTree(state).resolveInner(state.selection.main.head, -1)
  while (cursorNode.parent && !blockNames.has(cursorNode.name)) {
    if (cursorNode.parent.name === 'Document') break
    cursorNode = cursorNode.parent
  }

  let from: number
  let to: number
  if (blockNames.has(cursorNode.name) && cursorNode.name !== 'Paragraph') {
    from = cursorNode.from
    to = cursorNode.to
  } else {
    // Blank-line-delimited expansion for plain paragraphs / loose lists.
    const headLine = state.doc.lineAt(state.selection.main.head).number
    let startLine = headLine
    let endLine = headLine
    while (startLine > 1 && state.doc.line(startLine - 1).text.trim() !== '') startLine--
    while (endLine < state.doc.lines && state.doc.line(endLine + 1).text.trim() !== '') endLine++
    from = state.doc.line(startLine).from
    to = state.doc.line(endLine).to
    return { from, to, startLine, endLine }
  }
  return {
    from,
    to,
    startLine: state.doc.lineAt(from).number,
    endLine: state.doc.lineAt(Math.max(from, to - 1)).number
  }
}

const LIST_PREFIX = /^(\s*)(?:[-*+]\s\[[ xX]]\s|[-*+]\s|\d{1,9}[.)]\s|>\s)/
const HEADING_PREFIX = /^#{1,6}\s/

/** Converts the block at the caret between paragraph/list/quote/code/math shapes. */
export function updateParagraph(view: EditorView, label: string): boolean {
  const { state } = view
  const block = blockRangeAt(view)
  const original = state.sliceDoc(block.from, block.to)
  const lines = original.split('\n')

  const stripAll = (line: string): string =>
    line.replace(LIST_PREFIX, '').replace(/^#{1,6}\s/, '')

  let out: string[] = lines.map(stripAll)

  switch (label) {
    case 'reset-to-paragraph':
      break
    default: {
      const heading = /^heading (\d)$/.exec(label)
      if (heading) {
        out = out.map(l => `${'#'.repeat(Number(heading[1]))} ${l.replace(HEADING_PREFIX, '')}`)
        break
      }
      const prefixes: Record<string, string> = {
        'ul-bullet': '- ',
        'ul-task': '- [ ] ',
        blockquote: '> '
      }
      if (prefixes[label]) {
        out = out.map(l => `${prefixes[label]}${l}`)
        break
      }
      if (label === 'ol-numeric') {
        out = out.map((l, i) => `${i + 1}. ${l}`)
        break
      }
      if (label === 'pre') {
        out = ['```', ...out, '```']
        break
      }
      if (label === 'mathblock') {
        out = ['$$', ...out, '$$']
        break
      }
      return false
    }
  }

  const rebuilt = out.join('\n')
  if (rebuilt === original) return true
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: rebuilt },
    selection: EditorSelection.cursor(block.from + Math.min(rebuilt.length, state.selection.main.head - block.from)),
    userEvent: 'input.convert'
  })
  return true
}

/** Copies the block at the caret and inserts the copy directly below it. */
export function duplicateBlock(view: EditorView): boolean {
  const block = blockRangeAt(view)
  const text = view.state.sliceDoc(block.from, block.to)
  view.dispatch({
    changes: { from: block.to, to: block.to, insert: `\n${text}` },
    scrollIntoView: true,
    userEvent: 'input.copy'
  })
  return true
}

/** Inserts an empty paragraph after the block at the caret. */
export function insertParagraphAfter(view: EditorView): boolean {
  const block = blockRangeAt(view)
  view.dispatch({
    changes: { from: block.to, to: block.to, insert: '\n\n' },
    selection: EditorSelection.cursor(block.to + 2),
    scrollIntoView: true,
    userEvent: 'input'
  })
  return true
}

/** Removes the block at the caret without stranding blank lines. */
export function deleteBlock(view: EditorView): boolean {
  const { state } = view
  const block = blockRangeAt(view)
  const isLast = block.endLine >= state.doc.lines
  if (isLast && block.startLine === 1) {
    // Only block in the document: clear its content.
    view.dispatch({
      changes: { from: block.from, to: block.to },
      selection: EditorSelection.cursor(block.from),
      userEvent: 'delete'
    })
    return true
  }
  // Consume the newline before the block when it is the last line, so no
  // dangling blank line survives.
  const from = isLast ? state.doc.line(block.startLine - 1).to : block.from
  const to = isLast ? state.doc.length : Math.min(block.to + 1, state.doc.length)
  view.dispatch({
    changes: { from, to },
    selection: EditorSelection.cursor(from),
    userEvent: 'delete'
  })
  return true
}

/**
 * Replaces the first occurrence of `word` that ends at or before the caret
 * on the current line — the spellcheck correction path.
 */
export function replaceCurrentWordInlineUnsafe(
  view: EditorView,
  word: string,
  replacement: string
): boolean {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const upToCaret = line.text.slice(0, pos - line.from)
  const idx = upToCaret.lastIndexOf(word)
  if (idx < 0) return false
  const from = line.from + idx
  view.dispatch({
    changes: { from, to: from + word.length, insert: replacement },
    selection: EditorSelection.cursor(from + replacement.length),
    userEvent: 'delete'
  })
  return true
}
