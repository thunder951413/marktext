import { syntaxTree } from '@codemirror/language'
import {
  EditorSelection,
  Facet,
  type EditorState,
  RangeSet,
  StateEffect,
  StateField
} from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import type { Tree } from '@lezer/common'
import { renderMathToString } from '../features/math'
import { toggleTaskAt } from '../features/tasks'
import {
  DEFAULT_OPTIONS,
  DIAGRAM_LANGUAGES,
  type DiagramRenderer,
  type LivePreviewOptions
} from '../features/types'

/** Mark characters hidden unless the caret touches their parent element. */
const HIDDEN_MARK_NODES = new Set([
  'EmphasisMark',
  'StrongEmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'LinkMark',
  'HeaderMark',
  'QuoteMark'
])

const INLINE_STYLE_CLASSES: Record<string, string> = {
  Emphasis: 'wysiwyg-em',
  StrongEmphasis: 'wysiwyg-strong',
  Strikethrough: 'wysiwyg-del',
  Highlight: 'wysiwyg-highlight',
  InlineCode: 'wysiwyg-inline-code',
  Link: 'wysiwyg-link'
}

const HEADING_CLASSES: Record<string, string> = {
  ATXHeading1: 'wysiwyg-h1',
  ATXHeading2: 'wysiwyg-h2',
  ATXHeading3: 'wysiwyg-h3',
  ATXHeading4: 'wysiwyg-h4',
  ATXHeading5: 'wysiwyg-h5',
  ATXHeading6: 'wysiwyg-h6'
}

// Feature options live in a module-level config rather than a Facet: the
// embedder (editor.ts) reconfigures them rarely, and this avoids
// compartment/facet resolution quirks while keeping the plugin rebuildable
// via relayoutEffect.
export const livePreviewOptions = Facet.define<LivePreviewOptions, LivePreviewOptions>({
  combine: values => Object.assign({}, ...values)
})

export const relayoutEffect = StateEffect.define<null>()

interface BaseEntry {
  from: number
  to: number
}
type HideEntry = BaseEntry
interface MarkEntry extends BaseEntry {
  cls: string
}
interface WidgetEntry extends BaseEntry {
  widget: WidgetType
}
interface LineEntry {
  pos: number
  spec: { class?: string; attributes?: Record<string, string> }
}

abstract class KindWidget extends WidgetType {
  abstract readonly kind: string
}

class MathWidget extends KindWidget {
  readonly kind = 'math'
  constructor(
    readonly tex: string,
    readonly displayMode: boolean,
    readonly block: boolean
  ) {
    super()
  }

  override eq(other: MathWidget) {
    return other.tex === this.tex && other.displayMode === this.displayMode
  }

  override ignoreEvent() {
    return false
  }

  toDOM() {
    const el = document.createElement(this.block ? 'div' : 'span')
    el.className = this.block ? 'wysiwyg-math-block' : 'wysiwyg-math-inline'
    el.innerHTML = renderMathToString(this.tex, this.displayMode)
    return el
  }
}

class DiagramWidget extends KindWidget {
  readonly kind = 'diagram'
  constructor(
    readonly code: string,
    readonly lang: string,
    private readonly renderer: DiagramRenderer
  ) {
    super()
  }

  override eq(other: DiagramWidget) {
    return other.code === this.code && other.lang === this.lang
  }

  override ignoreEvent() {
    return false
  }

  toDOM() {
    const el = document.createElement('div')
    el.className = 'wysiwyg-diagram'
    el.textContent = 'Rendering diagram…'
    this.renderer(this.code, this.lang, el).catch((error: unknown) => {
      console.error('diagram render failed', error)
      el.textContent = '< Invalid Diagram >'
    })
    return el
  }
}

class ImageWidget extends KindWidget {
  readonly kind = 'image'
  constructor(
    readonly src: string,
    readonly alt: string
  ) {
    super()
  }

  override eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt
  }

  override ignoreEvent() {
    return false
  }

  toDOM() {
    if (!this.src) {
      const fallback = document.createElement('span')
      fallback.className = 'wysiwyg-image-placeholder'
      fallback.textContent = `🖼 ${this.alt}`
      return fallback
    }
    const img = document.createElement('img')
    img.className = 'wysiwyg-image'
    img.src = this.src
    img.alt = this.alt
    img.draggable = false
    return img
  }
}

class TaskCheckboxWidget extends KindWidget {
  readonly kind = 'task'
  constructor(readonly checked: boolean) {
    super()
  }

  override eq(other: TaskCheckboxWidget) {
    return other.checked === this.checked
  }

  override ignoreEvent() {
    // Clicks are handled by the plugin's mousedown handler.
    return true
  }

  toDOM() {
    const box = document.createElement('span')
    box.className = 'wysiwyg-task-checkbox'
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    box.setAttribute('aria-label', 'task item')
    box.textContent = this.checked ? '☑' : '☐'
    return box
  }
}

class HtmlPreviewWidget extends KindWidget {
  readonly kind = 'html'
  constructor(
    readonly raw: string,
    private readonly sanitize: (input: string) => string
  ) {
    super()
  }

  override eq(other: HtmlPreviewWidget) {
    return other.raw === this.raw
  }

  toDOM() {
    const el = document.createElement('div')
    el.className = 'wysiwyg-html-preview'
    el.innerHTML = this.sanitize(this.raw)
    return el
  }
}

class HorizontalRuleWidget extends KindWidget {
  readonly kind = 'hr'

  override eq() {
    return true
  }

  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'wysiwyg-hr'
    return hr
  }
}

function selectionTouches(selection: EditorSelection, from: number, to: number): boolean {
  return selection.ranges.some(
    r =>
      (r.from <= from && r.to >= to) ||
      (r.from >= from && r.from <= to) ||
      (r.to >= from && r.to <= to)
  )
}

function overlapsAny(entry: BaseEntry, blocks: Array<{ from: number; to: number }>): boolean {
  return blocks.some(b => entry.from < b.to && entry.to > b.from)
}

/**
 * Block widgets stay rendered while the caret sits on their delimiter/fence
 * lines; only entering the inner content lines reveals the raw source.
 */
function caretInInnerContent(state: EditorState, from: number, to: number): boolean {
  const head = state.selection.main.head
  const firstLine = state.doc.lineAt(from)
  const lastLine = state.doc.lineAt(Math.max(from, to - 1))
  const innerFrom = firstLine.to + 1
  const innerTo = lastLine.from
  if (innerTo <= innerFrom) return head > from && head < to
  return head >= innerFrom && head < innerTo
}

/**
 * Detects `$$`-delimited display-math regions outside fenced code. Scanning
 * lines instead of adding a custom block parser keeps the lezer grammar
 * untouched; fences are excluded via the syntax tree.
 */
function findMathBlocks(state: EditorState, fenced: Array<[number, number]>): Array<BaseEntry> {
  const inFence = (pos: number) => fenced.some(([a, b]) => pos >= a && pos < b)
  const blocks: Array<BaseEntry> = []
  let openStart = -1

  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo++) {
    const line = state.doc.line(lineNo)
    if (inFence(line.from)) continue
    if (line.text.trim() !== '$$') continue
    if (openStart < 0) {
      openStart = line.from
    } else {
      blocks.push({ from: openStart, to: line.to })
      openStart = -1
    }
  }
  return blocks
}

/** Extracts the TeX source between the opening and closing `$$` lines. */
function sliceBetweenDelims(regionText: string): string {
  const lines = regionText.split('\n')
  return lines.slice(1, -1).join('\n').trim()
}

export interface LivePreviewResult {
  decorations: DecorationSet
  atomicRanges: DecorationSet
}

export function buildLivePreviewDecorations(
  state: EditorState,
  tree: Tree,
  composing: boolean,
  partialOpts: LivePreviewOptions = {}
): LivePreviewResult {
  const opts = { ...DEFAULT_OPTIONS, ...partialOpts }
  const docLength = state.doc.length
  const selection = state.selection
  const reveal = composing || !!opts.revealAll

  const fenced: Array<[number, number]> = []
  tree.iterate({
    enter: node => {
      if (node.name === 'FencedCode') {
        fenced.push([node.from, node.to])
        return false
      }
      return undefined
    }
  })

  const mathBlocks = opts.mathEnabled ? findMathBlocks(state, fenced) : []

  const hides: HideEntry[] = []
  const marks: MarkEntry[] = []
  const widgets: WidgetEntry[] = []
  const lines: LineEntry[] = []
  const blocks: WidgetEntry[] = []

  // Front matter styling: the leading `---` block through its closing fence.
  if (state.doc.lines >= 2 && state.doc.line(1).text.trim() === '---') {
    for (let lineNo = 1; lineNo <= Math.min(state.doc.lines, 200); lineNo++) {
      lines.push({
        pos: state.doc.line(lineNo).from,
        spec: { class: 'wysiwyg-frontmatter' }
      })
      const text = state.doc.line(lineNo).text.trim()
      if (lineNo > 1 && (text === '---' || text === '...')) break
    }
  }

  let codeLineCounter = 0

  tree.iterate({
    enter: node => {
      const { name } = node

      if (name === 'FencedCode') {
        if (opts.codeBlockLineNumbers) {
          const firstContentLine = state.doc.lineAt(node.from).number + 1
          const lastContentLine = state.doc.lineAt(Math.max(node.from, node.to - 1)).number - 1
          codeLineCounter = 0
          for (let lineNo = firstContentLine; lineNo <= lastContentLine; lineNo++) {
            const line = state.doc.line(lineNo)
            lines.push({
              pos: line.from,
              spec: { class: 'wysiwyg-code-line', attributes: { 'data-lineno': String(++codeLineCounter) } }
            })
          }
        }
        return undefined
      }

      if (name === 'TaskMarker') {
        if (!reveal && !selectionTouches(selection, node.from, node.to)) {
          const flag = state.doc.sliceString(node.from + 1, node.to - 1)
          widgets.push({ from: node.from, to: node.to, widget: new TaskCheckboxWidget(/[xX]/.test(flag)) })
        }
        return false
      }

      if (name === 'InlineMath') {
        if (opts.mathEnabled && !reveal && !selectionTouches(selection, node.from, node.to)) {
          const tex = state.doc.sliceString(node.from + 1, node.to - 1)
          widgets.push({ from: node.from, to: node.to, widget: new MathWidget(tex, false, false) })
          return false
        }
        return undefined
      }

      if (name === 'Image' && !reveal && !selectionTouches(selection, node.from, node.to)) {
        const urlNode = node.node.getChild('URL')
        const src = urlNode ? state.doc.sliceString(urlNode.from, urlNode.to) : ''
        const altMatch = /^!\[([^\]]*)\]/.exec(state.doc.sliceString(node.from, node.to))
        widgets.push({
          from: node.from,
          to: Math.min(node.to, docLength),
          widget: new ImageWidget(src, altMatch ? altMatch[1] : '')
        })
        return false
      }

      if (name === 'HTMLBlock' && opts.htmlPreviewEnabled && opts.sanitizeHtml && !reveal) {
        const from = state.doc.lineAt(node.from).from
        const to = state.doc.lineAt(Math.max(node.from, node.to - 1)).to
        if (!caretInInnerContent(state, from, to)) {
          blocks.push({
            from,
            to,
            widget: new HtmlPreviewWidget(state.doc.sliceString(node.from, node.to), opts.sanitizeHtml)
          })
        }
        return false
      }

      if (name === 'HorizontalRule' && !reveal && !selectionTouches(selection, node.from, node.to)) {
        widgets.push({ from: node.from, to: Math.min(node.to, docLength), widget: new HorizontalRuleWidget() })
        return false
      }

      // Diagrams: fenced code whose info string names a diagram renderer.
      if (opts.diagramRenderer && name === 'CodeInfo' && !reveal) {
        const parent = node.node.parent
        if (
          parent &&
          parent.name === 'FencedCode' &&
          !caretInInnerContent(state, parent.from, parent.to)
        ) {
          const lang = state.doc.sliceString(node.from, node.to).trim().toLowerCase()
          if (DIAGRAM_LANGUAGES.has(lang)) {
            const bodyFrom = node.to + 1
            const bodyTo = Math.max(bodyFrom, state.doc.lineAt(Math.max(parent.from, parent.to - 1)).from)
            blocks.push({
              from: state.doc.lineAt(parent.from).from,
              to: state.doc.lineAt(Math.max(parent.from, parent.to - 1)).to,
              widget: new DiagramWidget(state.doc.sliceString(bodyFrom, bodyTo), lang, opts.diagramRenderer)
            })
            return false
          }
        }
        return undefined
      }

      if (name === 'Table') {
        for (let lineNo = state.doc.lineAt(node.from).number; lineNo <= state.doc.lineAt(node.to - 1).number; lineNo++) {
          lines.push({ pos: state.doc.line(lineNo).from, spec: { class: 'wysiwyg-table-line' } })
        }
        return false
      }

      if (name === 'Blockquote') {
        const firstLine = state.doc.lineAt(node.from).number
        const lastLine = state.doc.lineAt(Math.max(node.from, node.to - 1)).number
        for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
          lines.push({ pos: state.doc.line(lineNo).from, spec: { class: 'wysiwyg-quote-line' } })
        }
        return undefined
      }

      if (name === 'BulletList' || name === 'OrderedList') {
        const firstLine = state.doc.lineAt(node.from).number
        const lastLine = state.doc.lineAt(Math.max(node.from, node.to - 1)).number
        for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
          lines.push({ pos: state.doc.line(lineNo).from, spec: { class: 'wysiwyg-list-line' } })
        }
        // Keep descending: TaskMarker widgets for task lists live inside.
        return undefined
      }

      if (HEADING_CLASSES[name]) {
        lines.push({
          pos: state.doc.lineAt(node.from).from,
          spec: { class: `wysiwyg-line-${HEADING_CLASSES[name]}` }
        })
      }

      if (HIDDEN_MARK_NODES.has(name) && !reveal) {
        const owner = node.node.parent
        const ownerFrom = owner ? owner.from : node.from
        const ownerTo = owner ? Math.min(owner.to, docLength) : node.to
        if (!selectionTouches(selection, ownerFrom, ownerTo)) {
          const from = node.from
          // Keep fenced-code info strings readable: hide only the backticks,
          // never the language tag that follows them.
          const width =
            name === 'CodeMark' && state.doc.sliceString(node.from, node.from + 3) === '```'
              ? 3
              : node.to - node.from
          const to = Math.min(node.from + width, docLength)
          if (to > from) hides.push({ from, to })
          return false
        }
      }

      // Hide the raw URL of a link while keeping its label visible.
      if (name === 'Link' && !reveal && !selectionTouches(selection, node.from, node.to)) {
        const url = node.node.getChild('URL')
        if (url && url.to > url.from) hides.push({ from: url.from, to: url.to })
      }

      const cls = INLINE_STYLE_CLASSES[name]
      if (cls) {
        let innerFrom = node.from
        let innerTo = node.to
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (!child.name.endsWith('Mark')) continue
          if (child.from === innerFrom) innerFrom = child.to
          else if (child.to === innerTo) innerTo = child.from
        }
        if (innerTo > innerFrom) marks.push({ from: innerFrom, to: innerTo, cls })
      }
      return undefined
    }
  })

  // Display-math widgets replace their whole region; drop any tree-derived
  // decorations that would land underneath them.
  const keptWidgets = widgets.filter(w => !overlapsAny(w, mathBlocks))

  for (const block of mathBlocks) {
    if (caretInInnerContent(state, block.from, block.to)) continue
    blocks.push({
      from: block.from,
      to: block.to,
      widget: new MathWidget(sliceBetweenDelims(state.doc.sliceString(block.from, block.to)), true, true)
    })
  }

  return {
    decorations: assembleSet(hides, marks, keptWidgets, lines, blocks),
    atomicRanges: assembleAtomicSet(hides, [...keptWidgets, ...blocks])
  }
}

function assembleSet(
  hides: HideEntry[],
  marks: MarkEntry[],
  widgets: WidgetEntry[],
  lines: LineEntry[],
  blocks: WidgetEntry[]
): DecorationSet {
  const ranges = [
    ...hides.map(h => Decoration.replace({}).range(h.from, h.to)),
    ...marks.map(m => Decoration.mark({ class: m.cls }).range(m.from, m.to)),
    ...widgets.map(w => Decoration.replace({ widget: w.widget }).range(w.from, w.to)),
    // Block replacements must sit on line boundaries; HTML previews and math
    // blocks are collected with aligned ranges above.
    ...blocks.map(b => Decoration.replace({ widget: b.widget, block: true }).range(b.from, b.to))
  ]
  const seenLines = new Set<number>()
  for (const { pos, spec } of lines) {
    if (seenLines.has(pos)) continue
    seenLines.add(pos)
    ranges.push(Decoration.line(spec).range(pos))
  }
  return RangeSet.of(ranges, true)
}

function assembleAtomicSet(hides: HideEntry[], widgets: WidgetEntry[]): DecorationSet {
  const entries = [...hides, ...widgets]
    .filter(h => h.to > h.from)
    .sort((a, b) => a.from - b.from)
    .map(h => Decoration.replace({}).range(h.from, h.to))
  return RangeSet.of(entries, true)
}

interface LivePreviewFieldValue {
  decorations: DecorationSet
  atomicRanges: DecorationSet
}

export const setLivePreviewEffect = StateEffect.define<LivePreviewFieldValue>()

/**
 * Block decorations (math/html/diagram replacements) are illegal from
 * ViewPlugins, so the computed sets live in a StateField. The listener below
 * recomputes after each update and dispatches the result as an effect.
 */
export const livePreviewField = StateField.define<LivePreviewFieldValue>({
  create: () => ({ decorations: Decoration.none, atomicRanges: Decoration.none }),
  update(value, tr) {
    let next = value
    for (const effect of tr.effects) {
      if (effect.is(setLivePreviewEffect)) next = effect.value
    }
    // Fresh effect payloads are computed against the post-change document, so
    // only map pre-existing sets through unrelated doc changes.
    if (tr.docChanged && next === value && value.decorations !== Decoration.none) {
      next = {
        decorations: value.decorations.map(tr.changes),
        atomicRanges: value.atomicRanges.map(tr.changes)
      }
    }
    return next
  },
  provide: field => [
    // Block decorations MUST come from a field (plugin-provided ones throw);
    // this is also what puts the computed sets onto the view.
    EditorView.decorations.from(field, value => value.decorations),
    EditorView.atomicRanges.of(view => {
      const value = view.state.field(field, false)
      return value ? value.atomicRanges : Decoration.none
    })
  ]
})

// Per-view recomputation state; the engine is instantiated per window but the
// module-level config is shared, so cache keyed by view instance.
interface TriggerCache {
  doc: EditorState['doc']
  selection: EditorState['selection']
  options: LivePreviewOptions
  tree: unknown
  composing: boolean
}

const triggerCaches = new WeakMap<EditorView, TriggerCache>()

function shouldRecompute(view: EditorView): boolean {
  const composing = view.composing
  const tree = syntaxTree(view.state)
  const previous = triggerCaches.get(view)
  const { doc, selection } = view.state
  const options = view.state.facet(livePreviewOptions)
  if (previous && previous.doc === doc && previous.selection.eq(selection) &&
      previous.tree === tree && previous.composing === composing && previous.options === options) return false
  triggerCaches.set(view, { doc, selection, options, tree, composing })
  return true
}

export const livePreviewUpdateListener = EditorView.updateListener.of(update => {
  const view = update.view
  if (!shouldRecompute(view)) return
  dispatchRecompute(view)
})

/** Deterministic recompute+dispatch, safe outside an update pass. */
export function requestLivePreviewRebuild(view: EditorView): void {
  triggerCaches.delete(view)
  dispatchRecompute(view)
}

function dispatchRecompute(view: EditorView): void {
  const result = buildLivePreviewDecorations(
    view.state,
    syntaxTree(view.state),
    view.composing,
    view.state.facet(livePreviewOptions)
  )
  view.dispatch({ effects: setLivePreviewEffect.of(result) })
}

/** Click-to-toggle for task checkboxes; bound alongside the field. */
export const livePreviewDomHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null
    // Block widgets are atomic (the caret cannot enter by arrow keys), so a
    // click lands the caret on the block itself — the context/menu state then
    // classifies it as math/html/diagram/hr.
    const widget = target?.closest?.(
      '.wysiwyg-hr, .wysiwyg-math-block, .wysiwyg-html-preview, .wysiwyg-diagram'
    )
    if (widget instanceof HTMLElement) {
      const pos = view.posAtDOM(widget)
      view.dispatch({ selection: EditorSelection.single(pos) })
      event.preventDefault()
      return true
    }
    const box = target?.closest?.('.wysiwyg-task-checkbox')
    if (!(box instanceof HTMLElement)) return false
    const handled = toggleTaskAt(view, view.posAtDOM(box))
    if (handled) event.preventDefault()
    return handled
  }
})
