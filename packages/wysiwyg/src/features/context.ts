import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Muya-compatible cursor context derived from the Lezer tree. The desktop's
 * menu-state factory keys off `affiliation` entries (`ul`/`ol` with
 * `listType`, `pre` with `functionType`, `figure` tables, `h1`-`h6`, `p`,
 * `blockquote`, `li`) plus per-block text/functionType on the endpoints.
 */
export interface AffiliationEntry {
  type: string
  functionType?: string
  listType?: string
  isLooseListItem?: boolean
}

export interface CursorContext {
  affiliation: AffiliationEntry[]
  formats: Array<{ type: string; tag?: string }>
  anchor: {
    key: string
    offset: number
    text: string
    functionType?: string
    type?: string
  }
  focus: {
    key: string
    offset: number
    text: string
    functionType?: string
    type?: string
  }
  hasFrontMatter: boolean
}

const HEADING_NODE_TYPES: Record<string, string> = {
  ATXHeading1: 'h1',
  ATXHeading2: 'h2',
  ATXHeading3: 'h3',
  ATXHeading4: 'h4',
  ATXHeading5: 'h5',
  ATXHeading6: 'h6',
  SetextHeading1: 'h1',
  SetextHeading2: 'h2'
}

const INLINE_FORMAT_BY_NODE: Record<string, { type: string; tag?: string }> = {
  StrongEmphasis: { type: 'strong' },
  Emphasis: { type: 'em' },
  InlineCode: { type: 'inline_code' },
  Strikethrough: { type: 'del' },
  Highlight: { type: 'html_tag', tag: 'mark' },
  InlineMath: { type: 'inline_math' },
  Link: { type: 'link' }
}

function endpointOf(state: EditorState, pos: number) {
  const line = state.doc.lineAt(pos)
  return {
    key: `L${line.number}`,
    offset: pos - line.from,
    text: line.text
  }
}

function functionTypeForNode(state: EditorState, pos: number): string | undefined {
  // "codeContent" mirrors muya: the caret inside a fenced/math/html block
  // body marks the endpoint as content of that container.
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node.parent) {
    if (node.name === 'FencedCode' || node.name === 'CodeText') return 'codeContent'
    if (node.name === 'HTMLBlock') return 'html'
    if (node.name === 'Comment') return 'multiplemath'
    node = node.parent
  }
  return undefined
}

export function getCursorContext(view: EditorView): CursorContext {
  const state = view.state
  const head = state.selection.main.head
  const anchorPos = state.selection.main.anchor
  const anchor = endpointOf(state, anchorPos)
  const focus = endpointOf(state, head)

  const affiliation: AffiliationEntry[] = []
  const formats: Array<{ type: string; tag?: string }> = []

  let node = syntaxTree(state).resolveInner(head, 1)
  let sawTaskList = false
  const seen = new Set<string>()
  while (node.parent) {
    const name = node.name
    const heading = HEADING_NODE_TYPES[name]
    if (heading && !seen.has(heading)) {
      affiliation.unshift({ type: heading })
      seen.add(heading)
    } else if (name === 'Paragraph' && !seen.has('p')) {
      affiliation.unshift({ type: 'p' })
      seen.add('p')
    } else if (name === 'BulletList' && !seen.has('ul')) {
      affiliation.unshift({
        type: 'ul',
        listType: sawTaskList ? 'task' : 'bullet',
        isLooseListItem: isLooseRange(state, node.from, node.to)
      })
      seen.add('ul')
    } else if (name === 'OrderedList' && !seen.has('ol')) {
      affiliation.unshift({
        type: 'ol',
        isLooseListItem: isLooseRange(state, node.from, node.to)
      })
      seen.add('ol')
    } else if (name === 'Task' || name === 'TaskList' || name === 'TaskMarker') {
      sawTaskList = true
    } else if (name === 'ListItem' && !seen.has('li')) {
      affiliation.unshift({ type: 'li' })
      seen.add('li')
    } else if (name === 'Blockquote' && !seen.has('blockquote')) {
      affiliation.unshift({ type: 'blockquote' })
      seen.add('blockquote')
    } else if (name === 'FencedCode' && !seen.has('pre')) {
      affiliation.unshift({ type: 'pre', functionType: 'code' })
      seen.add('pre')
    } else if (name === 'HTMLBlock' && !seen.has('pre')) {
      affiliation.unshift({ type: 'pre', functionType: 'html' })
      seen.add('pre')
    } else if (name === 'Table' && !seen.has('figure')) {
      affiliation.unshift({ type: 'figure', functionType: 'table' })
      seen.add('figure')
    } else if (name === 'HorizontalRule' && !seen.has('hr')) {
      affiliation.unshift({ type: 'hr' })
      seen.add('hr')
    }

    const inlineFormat = INLINE_FORMAT_BY_NODE[name]
    if (inlineFormat) {
      const key = inlineFormat.tag ?? inlineFormat.type
      if (!formats.some(f => (f.tag ?? f.type) === key)) formats.push(inlineFormat)
    }
    node = node.parent
  }

  // Empty lines have no Paragraph node; muya always reported a block kind, and
  // an empty affiliation disables every paragraph menu item in the main
  // process — so fall back to a plain paragraph.
  if (!affiliation.length) affiliation.push({ type: 'p' })

  // Display math blocks are detected by line scanning (no parser node).
  if (!affiliation.some(a => a.type === 'pre')) {
    const inMath = isInDisplayMath(state, head)
    if (inMath) affiliation.unshift({ type: 'pre', functionType: 'multiplemath' })
  }
  if (isInFrontMatter(state, head)) {
    affiliation.unshift({ type: 'pre', functionType: 'frontmatter' })
  }

  const hasFrontMatter =
    state.doc.lines >= 2 &&
    state.doc.line(1).text.trim() === '---' &&
    state.doc.line(2).text.trim() !== ''

  const anchorFunctionType = functionTypeForNode(state, anchorPos)
  const focusFunctionType = functionTypeForNode(state, head)

  return {
    affiliation,
    formats,
    anchor: {
      ...anchor,
      functionType: anchorFunctionType,
      type: anchorFunctionType === 'codeContent' ? 'span' : undefined
    },
    focus: {
      ...focus,
      functionType: focusFunctionType,
      type: focusFunctionType === 'codeContent' ? 'span' : undefined
    },
    hasFrontMatter
  }
}

/** A list is loose when a blank line separates any two of its items. */
function isLooseRange(state: EditorState, from: number, to: number): boolean {
  const text = state.sliceDoc(from, to)
  return /\n[ \t]*\n[ \t]*(?=[-*+]|\d+[.)])/.test(text)
}

/** True when `pos` lies inside the leading `--- ... ---` front-matter block. */
function isInFrontMatter(state: EditorState, pos: number): boolean {
  if (state.doc.lines < 2 || state.doc.line(1).text.trim() !== '---') return false
  const line = state.doc.lineAt(pos)
  if (line.number === 1) return true
  for (let lineNo = 2; lineNo <= Math.min(state.doc.lines, 200); lineNo++) {
    const text = state.doc.line(lineNo).text.trim()
    if (text === '---' || text === '...') return line.number <= lineNo
  }
  return false
}

/** True when `pos` sits between a `$$` pair outside fenced code. */
function isInDisplayMath(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos)
  let open = false
  for (let lineNo = 1; lineNo <= line.number; lineNo++) {
    const text = state.doc.line(lineNo).text.trim()
    if (text === '```' || text.startsWith('```')) {
      // Skip fenced region.
      let line2 = lineNo + 1
      while (line2 <= state.doc.lines && !state.doc.line(line2).text.trim().startsWith('```')) line2++
      lineNo = line2
      continue
    }
    if (text === '$$') {
      if (lineNo === line.number) return true
      open = !open
    }
  }
  return open
}
