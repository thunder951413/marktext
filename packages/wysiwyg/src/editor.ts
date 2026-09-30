import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { EditorView, highlightActiveLine, keymap } from '@codemirror/view'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'
import { markdownKeymap } from '@codemirror/lang-markdown'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { getCM, vim } from '@replit/codemirror-vim'
import DOMPurify from 'dompurify'
import { createMarkdownLanguage } from './markdown'
import { syntaxTree } from '@codemirror/language'
import {
  livePreviewOptions,
  livePreviewDomHandlers,
  requestLivePreviewRebuild,
  livePreviewField,
  livePreviewUpdateListener,
  relayoutEffect
} from './decorations/livePreview'
import { createDefaultDiagramRenderer } from './features/diagrams'
import type { DiagramRenderer, LivePreviewOptions } from './features/types'
import {
  createTable as createTableCmd,
  deleteTableColumn,
  deleteTableRow,
  enterInTable,
  insertTableColumn,
  insertTableRow,
  setTableColumnAlignment,
  smartShiftTab,
  smartTab,
  tablePipeEscapeInput,
  type TableAlignment
} from './features/tables'
import {
  type ClipboardHooks,
  consumePastePayload,
  createClipboardHandlers
} from './features/clipboard'
import {
  computeMatches,
  searchField,
  searchHighlightPlugin,
  setSearchEffect
} from './features/search'
import type { SearchMatch, SearchOptions } from './features/search'
import { getTocItems as extractTocItems, scrollToTocItem } from './features/toc'
import type { TocItem } from './features/toc'
import { getCursorContext } from './features/context'
import type { CursorContext } from './features/context'
import {
  applyInlineFormat,
  deleteBlock,
  duplicateBlock,
  insertParagraphAfter,
  replaceCurrentWordInlineUnsafe as replaceCurrentWordCmd,
  updateParagraph as updateParagraphCmd,
  type InlineFormatType
} from './features/commands'
import { Emitter } from './emitter'
import './styles/wysiwyg.css'

export interface LineChCursor {
  anchor: { line: number; ch: number }
  focus: { line: number; ch: number }
}

export interface WysiwygOptions extends ClipboardHooks {
  markdown?: string
  fontSize?: number
  lineHeight?: number
  editorFontFamily?: string
  autoPairBracket?: boolean
  autoPairQuote?: boolean
  focusMode?: boolean
  placeholder?: string
  /** Render `$...$` / `$$...$$` via KaTeX. Default true. */
  mathEnabled?: boolean
  /** Render sanitized previews for HTML blocks. Default true. */
  htmlPreviewEnabled?: boolean
  /** Line numbers inside fenced code blocks. Default false. */
  codeBlockLineNumbers?: boolean
  /** Overrides the built-in diagram renderer (muya loaders). */
  diagramRenderer?: DiagramRenderer
  /** PlantUML server passed to the default diagram renderer. */
  plantumlServer?: string
  /** Engine-side storage for muya locale dictionaries (UI floats consume them). */
  localeDict?: unknown
  /** Enable modal editing via @replit/codemirror-vim. Default false. */
  vimMode?: boolean
  /** Toggles the native spellcheck attribute on the editable surface. */
  spellcheckEnabled?: boolean
  spellcheckHideMarks?: boolean
  tabSize?: number
  listIndentation?: number
  wrapCodeBlocks?: boolean
  codeFontSize?: number
  codeFontFamily?: string
}

export type WysiwygEvents = {
  'content-change': { markdown: string }
  'selection-change': {
    anchor: number
    focus: number
    /** Lezer-derived block/format context driving the desktop menu state. */
    context?: CursorContext
  }
  focus: undefined
  blur: undefined
  /** Ctrl/Cmd-click on a link; data carries the raw href. */
  'format-click': { event: MouseEvent; formatType: string; data: unknown }
  /** Click on a rendered image widget; data is the image src. */
  'preview-image': { data: string }
  'vim-mode-change': 'normal' | 'insert' | 'visual' | 'visual-line'
}

/** Muya-shaped selection: doc offsets plus optional (unused) block paths. */
export interface CompatSelection {
  anchor: { offset: number }
  focus: { offset: number }
  anchorPath?: Array<string | number>
  focusPath?: Array<string | number>
}

/**
 * CodeMirror 6 live-preview WYSIWYG editor. The markdown source is the single
 * source of truth; rendering happens through decorations derived from the
 * Lezer syntax tree. Public API intentionally mirrors the shapes the desktop
 * renderer consumes from @muyajs/core (line/ch cursors, content-change events)
 * so editor.vue can swap engines with minimal churn.
 */
export class WysiwygEditor {
  private emitter = new Emitter()
  private view: EditorView | null = null
  private container: HTMLElement
  private options: WysiwygOptions
  private themeCompartment = new Compartment()
  private autoPairCompartment = new Compartment()
  private vimCompartment = new Compartment()
  private featureCompartment = new Compartment()
  private indentationCompartment = new Compartment()

  constructor(container: HTMLElement, options: WysiwygOptions = {}) {
    this.container = container
    this.options = { ...options }
  }

  init(): void {
    if (this.view) return

    this.container.classList.add('wysiwyg-container')
    const exts = [
      history(),
      keymap.of([
        { key: 'Tab', run: smartTab },
        { key: 'Shift-Tab', run: smartShiftTab },
        // Must precede markdownKeymap so Enter inside tables moves rows
        // instead of splitting the paragraph.
        { key: 'Enter', run: enterInTable },
        ...closeBracketsKeymap,
        ...markdownKeymap,
        ...historyKeymap,
        ...defaultKeymap
      ]),
      tablePipeEscapeInput,
      createClipboardHandlers({
        imageAction: this.options.imageAction,
        htmlToMarkdown: this.options.htmlToMarkdown,
        clipboardHtml: this.options.clipboardHtml,
        htmlPasteEnabled: this.options.htmlPasteEnabled
      }),
      EditorView.domEventHandlers({
        click: (event, view) => this.handleClick(event, view)
      }),
      livePreviewField,
      searchField,
      searchHighlightPlugin,
      livePreviewUpdateListener,
      livePreviewDomHandlers,
      createMarkdownLanguage(),
      highlightActiveLine(),
      this.autoPairCompartment.of(this.autoPairConfig()),
      this.vimCompartment.of(this.vimConfig()),
      this.themeCompartment.of(this.buildTheme()),
      this.featureCompartment.of(livePreviewOptions.of(this.buildFeatureFacet())),
      this.indentationCompartment.of(this.indentationConfig()),
      EditorView.lineWrapping,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          this.emitter.emit('content-change', { markdown: this.getMarkdown() })
        }
        if (update.selectionSet || update.docChanged) {
          const sel = update.state.selection.main
          this.emitter.emit('selection-change', {
            anchor: sel.anchor,
            focus: sel.head,
            context: getCursorContext(update.view)
          })
        }
        if (update.focusChanged) {
          this.emitter.emit(update.view.hasFocus ? 'focus' : 'blur')
        }
      })
    ]
    const state = EditorState.create({
      doc: this.options.markdown ?? '',
      extensions: exts
    })

    this.view = new EditorView({ state, parent: this.container })
    this.attachVimModeListener()
    // Fire one update post-mount so the live-preview listener builds the first
    // decoration set even when the document never changes.
    // Build the first decoration set explicitly: a fresh document never fires
    // a transaction, and a no-op selection dispatch is skipped by CM6.
    requestLivePreviewRebuild(this.view)
    if (this.options.spellcheckEnabled !== undefined) {
      this.view.contentDOM.spellcheck = this.options.spellcheckEnabled
    }
    this.view.contentDOM.classList.toggle('wysiwyg-hide-spelling', Boolean(this.options.spellcheckHideMarks))
    if (this.options.focusMode) {
      this.container.classList.add('wysiwyg-focus-mode')
    }
  }

  destroy(): void {
    this.view?.destroy()
    this.view = null
    this.container.classList.remove('wysiwyg-container', 'wysiwyg-focus-mode')
    this.emitter.clear()
  }

  get domNode(): HTMLElement {
    if (!this.view) throw new Error('WysiwygEditor not initialized; call init() first')
    return this.view.dom
  }

  /** The element that actually scrolls (.cm-scroller), for scroll persistence. */
  get scrollContainer(): HTMLElement {
    if (!this.view) throw new Error('WysiwygEditor not initialized; call init() first')
    return this.view.scrollDOM
  }

  getMarkdown(): string {
    return this.view ? this.view.state.doc.toString() : (this.options.markdown ?? '')
  }

  /** Replaces the document as a single undo boundary (muya replaceContent). */
  setContent(markdown: string): void {
    if (!this.view) {
      this.options.markdown = markdown
      return
    }
    this.view.dispatch(
      this.view.state.update({
        changes: { from: 0, to: this.view.state.doc.length, insert: markdown }
      })
    )
  }

  /** Muya signature; the pre-source selection has no text-model equivalent. */
  replaceContent(markdown: string): boolean {
    this.setContent(markdown)
    return true
  }

  setListIndentation(value: number): void {
    this.setOptions({ listIndentation: value })
  }

  private handleClick(event: MouseEvent, view: EditorView): boolean {
    const target = event.target as HTMLElement | null
    if (!target) return false

    const image = target.closest('.wysiwyg-image') as HTMLImageElement | null
    if (image) {
      this.emitter.emit('preview-image', { data: image.getAttribute('src') ?? '' })
      return false
    }

    const ctrlOrMeta = event.metaKey || event.ctrlKey
    const link = target.closest('.wysiwyg-link')
    if (link && ctrlOrMeta) {
      const pos = view.posAtDOM(link)
      let href = ''
      let node = syntaxTree(view.state).resolveInner(pos, -1)
      while (node && node.name !== 'Link' && node.parent) node = node.parent
      if (node?.name === 'Link') {
        const url = node.getChild('URL')
        if (url) href = view.state.sliceDoc(url.from, url.to)
      }
      this.emitter.emit('format-click', { event, formatType: 'link', data: { href } })
    }
    return false
  }

  getCursorOffset(): LineChCursor | null {
    if (!this.view) return null
    return toLineCh(this.view.state)
  }

  /** Muya-shaped selection consumed by the desktop's serializeCursor(). */
  getSelection(): CompatSelection | null {
    if (!this.view) return null
    const main = this.view.state.selection.main
    return {
      anchor: { offset: main.anchor },
      focus: { offset: main.head }
    }
  }

  /** Sets the selection by document offsets. */
  setSelectionRange(from: number, to: number): void {
    const len = this.view?.state.doc.length ?? 0
    const safeFrom = Math.max(0, Math.min(from, len))
    const safeTo = Math.max(0, Math.min(to, len))
    // No scrollIntoView here: jsdom cannot measure client rects.
    this.view?.dispatch({ selection: EditorSelection.range(safeFrom, safeTo) })
  }

  /** Accepts block-key cursors; only the doc offset is meaningful in the text model. */
  setCursor(value: unknown): void {
    if (!this.view) return
    const cursor = value as Partial<CompatSelection> | null
    if (!cursor || !Number.isFinite(cursor.anchor?.offset)) return
    const anchor = Math.max(0, Math.min(cursor.anchor?.offset ?? 0, this.view.state.doc.length))
    const focus = Math.max(0, Math.min(cursor.focus?.offset ?? anchor, this.view.state.doc.length))
    this.view.dispatch({ selection: EditorSelection.single(anchor, focus), scrollIntoView: true })
  }

  setCursorByOffset(cursor: LineChCursor): boolean {
    if (!this.view) return false
    const state = this.view.state
    const anchor = clampToDoc(state, cursor.anchor.line, cursor.anchor.ch)
    const focus = clampToDoc(state, cursor.focus.line, cursor.focus.ch)
    this.view.dispatch({
      selection: EditorSelection.single(anchor, focus),
      scrollIntoView: true
    })
    return true
  }

  focus(): void {
    this.view?.focus()
  }

  blur(): void {
    ;(this.view?.contentDOM as HTMLDivElement | null)?.blur()
  }

  hasFocus(): boolean {
    return this.view?.hasFocus ?? false
  }

  undo(): void {
    if (this.view) undo(this.view)
  }

  redo(): void {
    if (this.view) redo(this.view)
  }

  flush(): void {
    if (!this.view) return
    this.emitter.emit('content-change', { markdown: this.getMarkdown() })
  }

  createTable(spec: { rows: number; columns: number }): boolean {
    return this.view ? createTableCmd(this.view, spec) : false
  }

  insertTableRow(below = true): boolean {
    return this.view ? insertTableRow(this.view, below) : false
  }

  insertTableColumn(after = true): boolean {
    return this.view ? insertTableColumn(this.view, after) : false
  }

  deleteTableRow(): boolean {
    return this.view ? deleteTableRow(this.view) : false
  }

  deleteTableColumn(): boolean {
    return this.view ? deleteTableColumn(this.view) : false
  }

  setTableColumnAlignment(align: TableAlignment): boolean {
    return this.view ? setTableColumnAlignment(this.view, align) : false
  }

  // ---- Search (muya-compatible search/find/replace surface) ----

  private lastSearch: { value: string; opts: SearchOptions } | null = null

  /** Builds the match set; returns the match count. */
  search(value: string, opts: SearchOptions = {}): number {
    if (!this.view) return 0
    this.lastSearch = { value, opts }
    const matches = computeMatches(this.view.state.doc.toString(), value, opts)
    const cursorPos = this.view.state.selection.main.head
    const active = matches.findIndex(m => m.to > cursorPos)
    this.dispatchSearch({ matches, active: active >= 0 ? active : matches.length - 1 })
    return matches.length
  }

  find(dir: 'next' | 'prev'): boolean {
    if (!this.view) return false
    const state = this.view.state.field(searchField)
    if (!state.matches.length) return false
    const delta = dir === 'next' ? 1 : -1
    const active = (state.active + delta + state.matches.length) % state.matches.length
    this.dispatchSearch({ ...state, active }, true)
    return true
  }

  /** Replaces the active match (isSingle) or every match; re-searches after, like muya. */
  replace(value: string, opts: { isSingle?: boolean } & SearchOptions = {}): number {
    if (!this.view) return 0
    const field = this.view.state.field(searchField)
    if (!field.matches.length) return 0

    let replaced = 0
    if (opts.isSingle) {
      const target = field.matches[field.active]
      if (!target) return 0
      this.view.dispatch({
        changes: { from: target.from, to: target.to, insert: value },
        userEvent: 'delete'
      })
      replaced = 1
    } else {
      const changes = [...field.matches]
        .sort((a, b) => b.from - a.from)
        .map(m => ({ from: m.from, to: m.to, insert: value }))
      if (changes.length) {
        this.view.dispatch({ changes, userEvent: 'delete' })
        replaced = changes.length
      }
    }
    // muya semantics: the match set is recomputed after replacing.
    if (this.lastSearch) this.search(this.lastSearch.value, this.lastSearch.opts)
    return replaced
  }

  clearSearch(): void {
    this.lastSearch = null
    this.dispatchSearch({ matches: [], active: -1 })
  }

  getSearchState(): { matches: SearchMatch[]; index: number; value: string } {
    const field = this.view?.state.field(searchField) ?? { matches: [], active: -1 }
    return { matches: field.matches, index: field.active, value: this.lastSearch?.value ?? '' }
  }

  private dispatchSearch(next: { matches: SearchMatch[]; active: number }, scroll = false): void {
    if (!this.view) return
    const effects = [setSearchEffect.of(next)]
    const active = next.matches[next.active]
    if (active) {
      // Muya parity: the active match stays selected so closing the bar (or
      // Escape) leaves the caret on the word for continued editing.
      this.view.dispatch({
        effects,
        selection: EditorSelection.range(active.from, active.to),
        scrollIntoView: scroll
      })
      return
    }
    this.view.dispatch({ effects })
  }

  // ---- TOC ----

  getTOC(): TocItem[] {
    return this.view ? extractTocItems(this.view) : []
  }

  scrollToHeading(slug: string, opts?: { scroll?: boolean }): boolean {
    if (!this.view) return false
    const item = extractTocItems(this.view).find(i => i.slug === slug)
    if (!item) return false
    scrollToTocItem(this.view, item, opts)
    return true
  }

  // ---- Clipboard conveniences (muya method names) ----

  async copyAsMarkdown(): Promise<boolean> {
    if (!this.view || !navigator.clipboard) return false
    const range = this.view.state.selection.main
    const text = this.view.state.sliceDoc(range.from, range.to)
    await navigator.clipboard.writeText(text)
    return true
  }

  async copyAsHtml(): Promise<boolean> {
    if (!this.view || !navigator.clipboard || !this.options.clipboardHtml) return false
    const range = this.view.state.selection.main
    const markdown = viewSlice(this.view, range.from, range.to)
    const html = this.options.clipboardHtml(markdown)
    await navigator.clipboard.writeText(html)
    return true
  }

  async copyAsRich(): Promise<boolean> {
    if (!this.view || !navigator.clipboard || !this.options.clipboardHtml) return false
    const range = this.view.state.selection.main
    const markdown = viewSlice(this.view, range.from, range.to)
    const html = DOMPurify.sanitize(this.options.clipboardHtml(markdown))
    await navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob([markdown], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' })
    })])
    return true
  }

  async pasteAsPlainText(): Promise<boolean> {
    if (!this.view || !navigator.clipboard?.readText) return false
    const text = await navigator.clipboard.readText()
    if (!text) return false
    consumePastePayload(this.view, { text }, {})
    return true
  }

  /** Inserts a finished image link (muya's insertImage / pasteImage path). */
  insertImage(src: string): void {
    if (!this.view) return
    const range = this.view.state.selection.main
    const insert = `![](${src})`
    this.view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.cursor(range.from + insert.length),
      userEvent: 'input.paste'
    })
  }

  pasteImage(src: string): void {
    this.insertImage(src)
  }

  // ---- muya contract: formatting & block commands ----

  format(type: string): boolean {
    if (!this.view) return false
    return applyInlineFormat(this.view, type as InlineFormatType)
  }

  updateParagraph(label: string): boolean {
    if (!this.view) return false
    return updateParagraphCmd(this.view, label)
  }

  duplicate(): boolean {
    return this.view ? duplicateBlock(this.view) : false
  }

  /** Muya signature (location, text, isSplit); only the default path is used. */
  insertParagraph(location = 'after'): boolean {
    if (!this.view || location !== 'after') return false
    return insertParagraphAfter(this.view)
  }

  deleteParagraph(): boolean {
    return this.view ? deleteBlock(this.view) : false
  }

  selectAll(): void {
    this.view?.dispatch({
      selection: EditorSelection.range(0, this.view.state.doc.length),
      userEvent: 'select'
    })
  }

  /**
   * Replaces the first occurrence of `word` ending at the caret — the
   * spellcheck correction entry point.
   */
  replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean {
    return this.view ? replaceCurrentWordCmd(this.view, word, replacement) : false
  }

  // ---- muya contract: history / misc tokens ----

  /**
   * Opaque in-memory token carrying the full CM6 state (undo history
   * included). Desktop stashes it per tab and hands it back on switch, so
   * undo survives tab round-trips without any serialization.
   */
  getHistory(): unknown {
    if (!this.view) return null
    return { __wysiwygStateToken: true as const, state: this.view.state }
  }

  setHistory(token: unknown): void {
    const candidate = token as { __wysiwygStateToken?: boolean; state?: EditorState } | null
    if (!candidate?.__wysiwygStateToken || !candidate.state || !this.view) return
    this.view.setState(candidate.state)
    this.attachVimModeListener()
  }

  /** The text-model engine has no JSON block tree; consumers treat it as optional. */
  getState(): null {
    return null
  }

  /** Accepts and stores muya locale dictionaries; UI floats consume them later. */
  locale(localeObj: unknown): void {
    this.options.localeDict = localeObj
  }

  hideAllFloatTools(): void {
    /* No engine-owned floats yet; kept for contract parity. */
  }

  invalidateImageCache(): void {
    /* Images are plain widgets; nothing to invalidate. */
  }

  setFocusMode(enabled: boolean): void {
    this.options.focusMode = enabled
    this.container.classList.toggle('wysiwyg-focus-mode', enabled)
  }

  setOptions(options: Partial<WysiwygOptions>): void {
    Object.assign(this.options, options)
    if (!this.view) return
    // relayoutEffect makes the live-preview plugin rebuild with the new
    // options; the theme/auto-pair compartments reconfigure directly.
    this.view.dispatch({
      effects: [
        this.themeCompartment.reconfigure(this.buildTheme()),
        this.autoPairCompartment.reconfigure(this.autoPairConfig()),
        this.featureCompartment.reconfigure(livePreviewOptions.of(this.buildFeatureFacet())),
        this.indentationCompartment.reconfigure(this.indentationConfig()),
        ...(options.vimMode !== undefined ? [this.vimCompartment.reconfigure(this.vimConfig())] : []),
        relayoutEffect.of(null)
      ]
    })
    if (options.focusMode !== undefined) this.setFocusMode(options.focusMode)
    if (options.spellcheckEnabled !== undefined) {
      this.view.contentDOM.spellcheck = options.spellcheckEnabled
    }
    if (options.spellcheckHideMarks !== undefined) {
      this.view.contentDOM.classList.toggle('wysiwyg-hide-spelling', options.spellcheckHideMarks)
    }
    if (options.vimMode !== undefined) this.attachVimModeListener()
  }

  on<K extends keyof WysiwygEvents>(event: K, handler: (payload: WysiwygEvents[K]) => void): void {
    this.emitter.on(event, handler)
  }

  off<K extends keyof WysiwygEvents>(event: K, handler: (payload: WysiwygEvents[K]) => void): void {
    this.emitter.off(event, handler)
  }

  private vimConfig() {
    // Lazy: the vim keymap only loads when modal editing is enabled.
    return this.options.vimMode ? vim() : []
  }

  private readonly vimEditors = new WeakSet<object>()

  private attachVimModeListener(): void {
    if (!this.view || !this.options.vimMode) return
    const cm = getCM(this.view)
    if (!cm || this.vimEditors.has(cm)) return
    this.vimEditors.add(cm)
    cm.on('vim-mode-change', (event: { mode?: string; subMode?: string }) => {
      this.emitter.emit('vim-mode-change', event.mode === 'insert'
        ? 'insert'
        : event.mode === 'visual'
          ? event.subMode === 'linewise' ? 'visual-line' : 'visual'
          : 'normal')
    })
  }

  private buildFeatureFacet(): LivePreviewOptions {
    const opts = this.options
    return {
      mathEnabled: opts.mathEnabled,
      htmlPreviewEnabled: opts.htmlPreviewEnabled,
      sanitizeHtml: html => DOMPurify.sanitize(html),
      codeBlockLineNumbers: opts.codeBlockLineNumbers,
      diagramRenderer: opts.diagramRenderer ?? createDefaultDiagramRenderer(opts.plantumlServer)
    }
  }

  private autoPairConfig() {
    // markdownKeymap already wires Enter/Backspace list behaviors; this only
    // controls bracket/quote auto-closing.
    const bracket = this.options.autoPairBracket !== false
    const quote = this.options.autoPairQuote !== false
    return bracket || quote
      ? [
        closeBrackets(),
        EditorState.languageData.of(() => [{
          closeBrackets: {
            brackets: [...(bracket ? ['(', '[', '{'] : []), ...(quote ? ['"', "'"] : [])]
          }
        }])
      ]
      : []
  }

  private indentationConfig() {
    const width = Math.max(1, Math.min(8, this.options.tabSize ?? 2))
    const listWidth = Math.max(1, Math.min(8, this.options.listIndentation ?? width))
    return [EditorState.tabSize.of(width), indentUnit.of(' '.repeat(listWidth))]
  }

  private buildTheme() {
    const opts = this.options
    return EditorView.theme({
      '&': {
        ...(opts.fontSize ? { fontSize: `${opts.fontSize}px` } : {}),
        ...(opts.editorFontFamily ? { fontFamily: opts.editorFontFamily } : {}),
        height: '100%'
      },
      '.cm-content': {
        caretColor: 'currentColor',
        ...(opts.lineHeight != null ? { lineHeight: String(opts.lineHeight) } : {})
      },
      '.wysiwyg-code-line': {
        whiteSpace: opts.wrapCodeBlocks ? 'pre-wrap' : 'pre',
        ...(opts.codeFontFamily ? { fontFamily: opts.codeFontFamily } : {}),
        ...(opts.codeFontSize ? { fontSize: `${opts.codeFontSize}px` } : {})
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { overflowY: 'auto' }
    })
  }
}

function toLineCh(state: EditorState, posAnchor?: number, posFocus?: number): LineChCursor {
  const main = state.selection.main
  const anchorPos = posAnchor ?? main.anchor
  const focusPos = posFocus ?? main.head
  const anchorLine = state.doc.lineAt(anchorPos)
  const focusLine = state.doc.lineAt(focusPos)
  return {
    anchor: { line: anchorLine.number - 1, ch: anchorPos - anchorLine.from },
    focus: { line: focusLine.number - 1, ch: focusPos - focusLine.from }
  }
}

function clampToDoc(state: EditorState, line: number, ch: number): number {
  const lineInfo = state.doc.line(Math.max(1, Math.min(line + 1, state.doc.lines)))
  return Math.max(lineInfo.from, Math.min(lineInfo.from + ch, lineInfo.to))
}

function viewSlice(view: EditorView, from: number, to: number): string {
  return view.state.sliceDoc(from, to)
}
