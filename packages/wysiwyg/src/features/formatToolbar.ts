import { type EditorState, Facet, StateField, type Transaction } from '@codemirror/state'
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { applyInlineFormat, type InlineFormatType } from './commands'

/**
 * Floating inline-format toolbar shown above a non-empty selection — the
 * CodeMirror counterpart of Muya's InlineFormatToolbar. Buttons dispatch the
 * same `applyInlineFormat` commands as the Format menu, so behaviour (toggle,
 * unwrap, caret placement) is shared.
 */
export interface FormatToolbarConfig {
  enabled: boolean
  /**
   * Show only for pointer-made selections. Used with Vim mode so that `v`,
   * `V` and operator motions do not pop a toolbar over the text.
   */
  pointerOnly: boolean
  /** Button titles keyed by format type (localised by the embedder). */
  labels: Partial<Record<InlineFormatType, string>>
}

export const formatToolbarConfig = Facet.define<Partial<FormatToolbarConfig>, FormatToolbarConfig>({
  combine: values => {
    const merged = Object.assign({ enabled: true, pointerOnly: false, labels: {} }, ...values)
    return merged as FormatToolbarConfig
  }
})

interface ButtonSpec {
  type: InlineFormatType
  glyph: string
  className?: string
  title: string
}

export const FORMAT_TOOLBAR_BUTTONS: readonly ButtonSpec[] = [
  { type: 'strong', glyph: 'B', className: 'is-strong', title: 'Bold' },
  { type: 'em', glyph: 'I', className: 'is-em', title: 'Italic' },
  { type: 'u', glyph: 'U', className: 'is-u', title: 'Underline' },
  { type: 'del', glyph: 'S', className: 'is-del', title: 'Strikethrough' },
  { type: 'mark', glyph: 'H', className: 'is-mark', title: 'Highlight' },
  { type: 'inline_code', glyph: '</>', title: 'Inline code' },
  { type: 'inline_math', glyph: '∑', title: 'Inline math' },
  { type: 'link', glyph: '🔗', title: 'Link' },
  { type: 'clear', glyph: '⌫', title: 'Clear format' }
]

const WRAPPER_MARKERS: Partial<Record<InlineFormatType, [string, string]>> = {
  strong: ['**', '**'],
  em: ['*', '*'],
  u: ['<u>', '</u>'],
  del: ['~~', '~~'],
  mark: ['==', '=='],
  inline_code: ['`', '`'],
  inline_math: ['$', '$']
}

/** True when the selection sits exactly inside the markers of `type`. */
export function isFormatActive(state: EditorState, type: InlineFormatType): boolean {
  const markers = WRAPPER_MARKERS[type]
  const range = state.selection.main
  if (!markers || range.empty) return false
  const [open, close] = markers
  if (range.from < open.length) return false
  if (state.sliceDoc(range.from - open.length, range.from) !== open) return false
  if (state.sliceDoc(range.to, range.to + close.length) !== close) return false
  // `**x**` also matches the `*` probe; only report em when it is not strong.
  if (type === 'em' && state.sliceDoc(range.from - 2, range.from) === '**' &&
      state.sliceDoc(range.from - 3, range.from) !== '***') return false
  return true
}

function selectionInCode(state: EditorState): boolean {
  const { from, to } = state.selection.main
  for (const pos of [from, to]) {
    for (let node: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']> | null =
      syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') return true
    }
  }
  return false
}

function wantsToolbar(state: EditorState, tr: Transaction | null, previous: boolean): boolean {
  const config = state.facet(formatToolbarConfig)
  const range = state.selection.main
  if (!config.enabled || range.empty || state.selection.ranges.length > 1) return false
  if (selectionInCode(state)) return false
  if (!tr) return !config.pointerOnly
  if (tr.isUserEvent('select.dismiss-toolbar')) return false
  if (!tr.selection && !tr.docChanged) return previous
  if (tr.isUserEvent('select.pointer')) return true
  // Re-wrapping the selection through a toolbar/menu command keeps it open.
  if (tr.isUserEvent('input.format') || tr.isUserEvent('delete')) return previous
  if (tr.isUserEvent('select')) return !config.pointerOnly
  // Programmatic selections (find/replace, cursor restore, TOC jumps) do not
  // summon the toolbar.
  return false
}

function createToolbarDom(view: EditorView): HTMLElement {
  const config = view.state.facet(formatToolbarConfig)
  const dom = document.createElement('div')
  dom.className = 'wysiwyg-format-toolbar'
  dom.setAttribute('role', 'toolbar')
  for (const spec of FORMAT_TOOLBAR_BUTTONS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `wysiwyg-format-button ${spec.className ?? ''}`.trim()
    button.dataset.format = spec.type
    button.textContent = spec.glyph
    const title = config.labels[spec.type] ?? spec.title
    button.title = title
    button.setAttribute('aria-label', title)
    // mousedown would move the DOM selection out of the editor first.
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', event => {
      event.preventDefault()
      applyInlineFormat(view, spec.type)
      view.focus()
    })
    dom.appendChild(button)
  }
  return dom
}

function syncActive(dom: HTMLElement, state: EditorState): void {
  for (const button of Array.from(dom.querySelectorAll<HTMLButtonElement>('.wysiwyg-format-button'))) {
    button.classList.toggle('active', isFormatActive(state, button.dataset.format as InlineFormatType))
  }
}

function toolbarTooltip(state: EditorState): Tooltip {
  const range = state.selection.main
  return {
    pos: range.from,
    end: range.to,
    above: true,
    strictSide: false,
    arrow: false,
    create: view => {
      const dom = createToolbarDom(view)
      syncActive(dom, view.state)
      return {
        dom,
        offset: { x: 0, y: 6 },
        update: update => syncActive(dom, update.state)
      }
    }
  }
}

interface ToolbarState {
  visible: boolean
  tooltip: Tooltip | null
}

export const formatToolbarField = StateField.define<ToolbarState>({
  create: state => {
    const visible = wantsToolbar(state, null, false)
    return { visible, tooltip: visible ? toolbarTooltip(state) : null }
  },
  update(value, tr) {
    const visible = wantsToolbar(tr.state, tr, value.visible)
    if (!visible) return value.visible ? { visible: false, tooltip: null } : value
    if (value.tooltip && !tr.selection && !tr.docChanged) return value
    const range = tr.state.selection.main
    const prev = value.tooltip
    if (prev && prev.pos === range.from && prev.end === range.to) return value
    return { visible: true, tooltip: toolbarTooltip(tr.state) }
  },
  provide: field => showTooltip.compute([field], state => state.field(field).tooltip)
})

/** Escape dismisses the toolbar without collapsing the selection. */
const dismissOnEscape = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key !== 'Escape' || !view.state.field(formatToolbarField).visible) return false
    view.dispatch({ selection: view.state.selection, userEvent: 'select.dismiss-toolbar' })
    return false
  }
})

export function formatToolbar(config: Partial<FormatToolbarConfig> = {}) {
  return [formatToolbarConfig.of(config), formatToolbarField, dismissOnEscape]
}
