import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { redo, redoDepth, selectAll, undo, undoDepth } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  defaultHighlightStyle,
  ensureSyntaxTree,
  syntaxHighlighting
} from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import {
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField
} from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { getCM, vim } from '@replit/codemirror-vim'
import type { VimMode } from '@/store/vim'
import './index.css'

export interface SourcePosition {
  line: number
  ch: number
}

export interface SourceSelection {
  anchor: SourcePosition
  focus: SourcePosition
}

type CursorName = 'anchor' | 'head' | 'focus' | 'from' | 'to' | 'start' | 'end'
type SourceEditorEvent = 'cursorActivity' | 'contextmenu'
type SourceEditorListener = (editor: SourceEditor, event: Event) => void

export interface SourceEditorConfig {
  value?: string
  autofocus?: boolean
  direction?: string
  lineWrapping?: boolean
  theme?: string
  vimMode?: boolean
  onVimModeChange?: (mode: VimMode) => void
}

export interface SourceEditor {
  destroy(): void
  execCommand(command: 'redo' | 'selectAll' | 'undo'): void
  focus(): void
  getCursor(name?: CursorName): SourcePosition
  getLine(line: number): string
  getScrollerElement(): HTMLElement
  getTokenAt(position: SourcePosition, precise?: boolean): object
  getValue(): string
  hasFocus(): boolean
  heightAtLine(line: number, mode?: 'local' | 'page' | 'div'): number
  invalidateImageCache(): void
  lastLine(): number
  lineCount(): number
  on(event: SourceEditorEvent, listener: SourceEditorListener): void
  redoDepth(): number
  replaceRange(text: string, from: SourcePosition, to?: SourcePosition): void
  replaceSelection(text: string): void
  scrollTo(x: number | null, y: number | null): void
  setCursor(position: SourcePosition | number, ch?: number | null, options?: { scroll?: boolean }): void
  setOption(option: 'direction' | 'mode' | 'theme', value: unknown): void
  setSelection(anchor: SourcePosition, focus?: SourcePosition, options?: { scroll?: boolean }): void
  setValue(value: string): void
  undoDepth(): number
}

interface SourceEditorElement extends HTMLElement {
  CodeMirror?: SourceEditor
}

const inlineMath = new MatchDecorator({
  // Currency-like `$5 ... $10` is deliberately excluded. It must not turn the
  // remainder of a Markdown document into an unterminated math expression.
  regexp: /(?<!\$)\$(?![\s\d$])(?:\\.|[^$\n])+\$(?![\d$])/g,
  decoration: Decoration.mark({ class: 'cm-math-inline' })
})

const mathDecorationPlugin = (matcher: MatchDecorator) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view)
      }

      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations)
      }
    },
    { decorations: value => value.decorations }
  )

const buildBlockMathDecorations = (state: EditorState): DecorationSet => {
  const ranges = []
  const markdown = state.doc.toString()
  const expression = /\$\$[\s\S]*?\$\$/g
  let match: RegExpExecArray | null
  while ((match = expression.exec(markdown))) {
    ranges.push(Decoration.mark({ class: 'cm-math-block' }).range(
      match.index,
      match.index + match[0].length
    ))
  }
  return Decoration.set(ranges, true)
}

const replaceBlockMathDecorations = StateEffect.define<DecorationSet>()
const blockMathField = StateField.define<DecorationSet>({
  create: buildBlockMathDecorations,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(replaceBlockMathDecorations)) next = effect.value
    }
    return next
  },
  provide: field => EditorView.decorations.from(field)
})

const blockMathRefreshPlugin = ViewPlugin.fromClass(
  class {
    private timer: ReturnType<typeof setTimeout> | null = null

    constructor(private readonly view: EditorView) {}

    update(update: ViewUpdate) {
      if (!update.docChanged) return
      if (this.timer) clearTimeout(this.timer)
      // Mapping existing ranges is cheap and happens in blockMathField. Parse
      // newly typed delimiters after the input burst so large documents never
      // pay a full-text scan on every keystroke.
      this.timer = setTimeout(() => {
        this.timer = null
        this.view.dispatch({
          effects: replaceBlockMathDecorations.of(buildBlockMathDecorations(this.view.state))
        })
      }, 100)
    }

    destroy() {
      if (this.timer) clearTimeout(this.timer)
    }
  }
)

class CodeMirror6Adapter implements SourceEditor {
  private readonly direction = new Compartment()
  private readonly theme = new Compartment()
  private readonly listeners = new Map<SourceEditorEvent, Set<SourceEditorListener>>()
  private readonly extensions
  private readonly view: EditorView
  private readonly config: SourceEditorConfig

  constructor(parent: HTMLElement, config: SourceEditorConfig) {
    this.config = config
    this.extensions = [
      ...(config.vimMode ? [vim()] : []),
      minimalSetup,
      lineNumbers({
        formatNumber: line => (line === 1 || line % 10 === 0 ? String(line) : '')
      }),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      closeBrackets(),
      bracketMatching(),
      keymap.of(closeBracketsKeymap),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      blockMathField,
      blockMathRefreshPlugin,
      mathDecorationPlugin(inlineMath),
      this.direction.of(EditorView.contentAttributes.of({
        dir: config.direction === 'rtl' ? 'rtl' : 'ltr'
      })),
      this.theme.of(EditorView.editorAttributes.of({
        class: `CodeMirror ${this.themeClass(config.theme)}`
      })),
      EditorView.updateListener.of(update => {
        if (update.docChanged || update.selectionSet) this.emit('cursorActivity')
      }),
      EditorView.theme({
        '&': { backgroundColor: 'transparent', height: 'auto' },
        '.cm-content': { caretColor: 'currentColor' },
        '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--floatHoverColor)' }
      })
    ]

    if (config.lineWrapping !== false) this.extensions.push(EditorView.lineWrapping)

    const state = this.createState(config.value ?? '')
    this.view = new EditorView({ state, parent })
    this.attachVimModeListener(config)
    const root = this.view.dom as SourceEditorElement
    root.CodeMirror = this
    root.addEventListener('contextmenu', this.handleContextMenu)

    if (config.autofocus) queueMicrotask(() => this.focus())
  }

  private attachVimModeListener(config: SourceEditorConfig) {
    if (!config.vimMode) return
    const cm = getCM(this.view)
    config.onVimModeChange?.('normal')
    cm?.on('vim-mode-change', (event: { mode?: string; subMode?: string }) => {
      const mode = event.mode === 'insert'
        ? 'insert'
        : event.mode === 'visual'
          ? event.subMode === 'linewise' ? 'visual-line' : 'visual'
          : 'normal'
      config.onVimModeChange?.(mode)
    })
  }

  private createState(doc: string) {
    return EditorState.create({ doc, extensions: this.extensions })
  }

  private emit(event: SourceEditorEvent, domEvent?: Event) {
    const emittedEvent = domEvent ?? new Event(event)
    for (const listener of this.listeners.get(event) ?? []) listener(this, emittedEvent)
  }

  private readonly handleContextMenu = (event: Event) => {
    this.emit('contextmenu', event)
  }

  private themeClass(theme?: unknown) {
    return theme === 'one-dark'
      ? 'cm-s-one-dark'
      : theme === 'railscasts'
        ? 'cm-s-railscasts'
        : 'cm-s-default'
  }

  private positionToOffset(position: SourcePosition): number {
    const lineNumber = Math.min(Math.max(position.line + 1, 1), this.view.state.doc.lines)
    const line = this.view.state.doc.line(lineNumber)
    return line.from + Math.min(Math.max(position.ch, 0), line.length)
  }

  private offsetToPosition(offset: number): SourcePosition {
    const bounded = Math.min(Math.max(offset, 0), this.view.state.doc.length)
    const line = this.view.state.doc.lineAt(bounded)
    return { line: line.number - 1, ch: bounded - line.from }
  }

  destroy() {
    const root = this.view.dom as SourceEditorElement
    root.removeEventListener('contextmenu', this.handleContextMenu)
    delete root.CodeMirror
    this.listeners.clear()
    this.view.destroy()
  }

  execCommand(command: 'redo' | 'selectAll' | 'undo') {
    if (command === 'undo') undo(this.view)
    else if (command === 'redo') redo(this.view)
    else selectAll(this.view)
  }

  focus() {
    this.view.focus()
  }

  getCursor(name: CursorName = 'head') {
    const range = this.view.state.selection.main
    let offset = range.head
    if (name === 'anchor') offset = range.anchor
    else if (name === 'from' || name === 'start') offset = range.from
    else if (name === 'to' || name === 'end') offset = range.to
    return this.offsetToPosition(offset)
  }

  getLine(line: number) {
    if (line < 0 || line >= this.view.state.doc.lines) return ''
    return this.view.state.doc.line(line + 1).text
  }

  getScrollerElement() {
    return this.view.scrollDOM
  }

  getTokenAt(position: SourcePosition) {
    const offset = this.positionToOffset(position)
    ensureSyntaxTree(this.view.state, offset, 100)
    return { start: position.ch, end: position.ch, string: '', type: null }
  }

  getValue() {
    return this.view.state.doc.toString()
  }

  hasFocus() {
    return this.view.hasFocus
  }

  heightAtLine(line: number) {
    return this.view.lineBlockAt(this.positionToOffset({ line, ch: 0 })).top
  }

  invalidateImageCache() {
    // Source mode renders text only; kept as part of the cross-editor contract.
  }

  lastLine() {
    return this.view.state.doc.lines - 1
  }

  lineCount() {
    return this.view.state.doc.lines
  }

  on(event: SourceEditorEvent, listener: SourceEditorListener) {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(event, listeners)
    }
    listeners.add(listener)
  }

  redoDepth() {
    return redoDepth(this.view.state)
  }

  replaceRange(text: string, from: SourcePosition, to = from) {
    this.view.dispatch({
      changes: { from: this.positionToOffset(from), to: this.positionToOffset(to), insert: text },
      userEvent: 'input'
    })
  }

  replaceSelection(text: string) {
    this.view.dispatch(this.view.state.replaceSelection(text), {
      scrollIntoView: true,
      userEvent: 'input'
    })
  }

  scrollTo(x: number | null, y: number | null) {
    this.view.scrollDOM.scrollTo({
      left: x ?? this.view.scrollDOM.scrollLeft,
      top: y ?? this.view.scrollDOM.scrollTop
    })
  }

  setCursor(position: SourcePosition | number, ch?: number | null, options?: { scroll?: boolean }) {
    const target = typeof position === 'number' ? { line: position, ch: ch ?? 0 } : position
    this.setSelection(target, target, options)
  }

  setOption(option: 'direction' | 'mode' | 'theme', value: unknown) {
    if (option === 'direction') {
      this.view.dispatch({
        effects: this.direction.reconfigure(EditorView.contentAttributes.of({
          dir: value === 'rtl' ? 'rtl' : 'ltr'
        }))
      })
    } else if (option === 'theme') {
      this.view.dispatch({
        effects: this.theme.reconfigure(EditorView.editorAttributes.of({
          class: `CodeMirror ${this.themeClass(value)}`
        }))
      })
    }
    // Markdown is the only source-document mode. `mode` remains accepted for
    // compatibility with the old CodeMirror 5 integration.
  }

  setSelection(anchor: SourcePosition, focus = anchor, options?: { scroll?: boolean }) {
    this.view.dispatch({
      selection: EditorSelection.single(
        this.positionToOffset(anchor),
        this.positionToOffset(focus)
      ),
      scrollIntoView: options?.scroll !== false
    })
  }

  setValue(value: string) {
    // A file reload is a new undo boundary. Recreating immutable CM6 state is
    // both cheaper and safer than retaining history that points into old text.
    this.view.setState(this.createState(value))
    this.attachVimModeListener(this.config)
    this.emit('cursorActivity')
  }

  undoDepth() {
    return undoDepth(this.view.state)
  }
}

export const setCursorAtLastLine = (editor: SourceEditor): void => {
  const line = editor.lastLine()
  editor.focus()
  editor.setCursor(line, editor.getLine(line).length)
}

export const isCursorAtFirstLine = (editor: SourceEditor): boolean => {
  const { line, ch } = editor.getCursor()
  return line === 0 && ch === 0
}

export const isCursorAtLastLine = (editor: SourceEditor): boolean => {
  return editor.getCursor().line === editor.lastLine()
}

export const isCursorAtBegin = isCursorAtFirstLine

export const onlyHaveOneLine = (editor: SourceEditor): boolean => editor.lineCount() === 1

export const isCursorAtEnd = (editor: SourceEditor): boolean => {
  const cursor = editor.getCursor()
  return cursor.line === editor.lastLine() && cursor.ch === editor.getLine(cursor.line).length
}

export const getBeginPosition = () => ({
  anchor: { line: 0, ch: 0 },
  head: { line: 0, ch: 0 }
})

export const getEndPosition = (editor: SourceEditor) => {
  const line = editor.lastLine()
  const position = { line, ch: editor.getLine(line).length }
  return { anchor: position, head: position }
}

export const setCursorAtFirstLine = (editor: SourceEditor): void => {
  editor.focus()
  editor.setCursor(0, 0)
}

export const setMode = async(_editor: SourceEditor, name: string) => {
  if (!name) throw new Error("You'd better provide a language mode")
  return { name, mode: { name: 'markdown' } }
}

export const setTextDirection = (editor: SourceEditor, textDirection: string): void => {
  editor.setOption('direction', textDirection)
}

export default (parent: HTMLElement, config: SourceEditorConfig = {}): SourceEditor =>
  new CodeMirror6Adapter(parent, config)
