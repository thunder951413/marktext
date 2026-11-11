<template>
  <div
    class="text-editor"
    data-testid="text-editor"
  >
    <div
      v-if="currentFile?.decodingWarning"
      class="text-warning"
      role="alert"
    >
      {{ currentFile.decodingWarning }}
    </div>
    <div
      ref="container"
      class="text-editor-content"
    />
    <div class="text-status">
      <span>{{ position }}</span>
      <button @click="find">
        {{ t('menu.edit.find') }}
      </button>
      <button
        :class="{ active: wrapping }"
        @click="toggleWrapping"
      >
        {{ labels.wrap }}
      </button>
      <label>{{ labels.encoding }}
        <select
          v-model="encodingChoice"
          :disabled="busy"
          aria-label="Encoding"
        >
          <option
            v-for="(name, key) in ENCODING_NAME_MAP"
            :key="key"
            :value="key"
          >{{ name }}</option>
        </select>
      </label>
      <button
        :disabled="busy || !currentFile?.pathname"
        @click="reopen"
      >
        {{ labels.reopen }}
      </button>
      <button
        :disabled="busy"
        @click="convertEncoding"
      >
        {{ labels.convert }}
      </button>
      <label><input
        type="checkbox"
        :checked="currentFile?.encoding.isBom"
        :disabled="!unicodeEncoding"
        @change="toggleBom"
      >BOM</label>
      <select
        :value="currentFile?.isMixedLineEndings ? 'mixed' : currentFile?.lineEnding"
        aria-label="Line endings"
        @change="changeLineEnding"
      >
        <option
          disabled
          value="mixed"
        >
          Mixed
        </option>
        <option value="lf">
          LF
        </option><option value="crlf">
          CRLF
        </option><option value="cr">
          CR
        </option>
      </select>
      <span>{{ getEncodingName(currentFile?.encoding ?? { encoding: 'utf8' }) }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { StateEffect, type EditorState as CachedEditorState } from '@codemirror/state'
// Keep undo and selection when switching between text and Markdown tabs.

const savedTexts = new Map<string, { text: string; encoding: string; lineEnding: string; endings: string[] }>()
const textStates = new Map<string, { state: CachedEditorState; scrollTop: number; pathname: string }>()
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, invertedEffects, redo, selectAll, undo } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel, findNext, findPrevious, gotoLine } from '@codemirror/search'
import { bracketMatching, defaultHighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { getCM, vim } from '@replit/codemirror-vim'
import { isVimModeEnabled } from '@/util/vim/enabled'
import { installVimExCommands } from '@/util/vim/exCommands'
import { usePreferencesStore } from '@/store/preferences'
import { DEFAULT_CODE_FONT_FAMILY } from '@/config'
import { useEditorStore } from '@/store/editor'
import { debouncedSendBufferedState } from '@/store/bufferedState'
import { ENCODING_NAME_MAP, getEncodingName } from 'common/encoding'
import { isTextDocument } from 'common/textDocument'
import type { IFileState } from '@shared/types/files'
import bus from '@/bus'
import { defaultTextLineEnding, endingsField, replaceEndings } from '@/util/textLineEndings'
import { t, getCurrentLanguage } from '@/i18n'

const editorStore = useEditorStore()
const { currentFile } = storeToRefs(editorStore)
const { codeFontSize, codeFontFamily } = storeToRefs(usePreferencesStore())
const container = ref<HTMLDivElement>()
const wrapping = ref(false)
const encodingChoice = ref('utf8')
const busy = ref(false)
const position = ref('Ln 1, Col 1')
const labels = computed(() => getCurrentLanguage().startsWith('zh')
  ? {
      wrap: '自动换行', encoding: '编码', reopen: '按此编码重开', convert: '以此编码保存'
    }
  : { wrap: 'Wrap lines', encoding: 'Encoding', reopen: 'Reopen with encoding', convert: 'Save with encoding' })
const unicodeEncoding = computed(() => /^utf(?:8|16le|16be|32le|32be)$/.test(currentFile.value?.encoding.encoding ?? ''))
const selectedLineEnding = () => currentFile.value?.lineEnding === 'crlf' ? '\r\n' : currentFile.value?.lineEnding === 'cr' ? '\r' : '\n'
const lineEndingMode = new Compartment()
const wrapMode = new Compartment()
const languageMode = new Compartment()
const editable = new Compartment()
const typography = new Compartment()
let view: EditorView | undefined
let activeId = ''
let activePathname = ''
let languageRevision = 0
let commitTimer: ReturnType<typeof setTimeout> | undefined

const snapshotSavedText = (tab: IFileState) => {
  savedTexts.set(tab.id, { text: tab.markdown, encoding: JSON.stringify(tab.encoding), lineEnding: tab.lineEnding, endings: tab.textLineEndings ?? [] })
}
watch(() => currentFile.value?.isSaved, saved => {
  if (saved && currentFile.value && isTextDocument(currentFile.value)) snapshotSavedText(currentFile.value)
}, { flush: 'sync' })
const activeTab = () => editorStore.tabs.find(tab => tab.id === activeId)
const flush = () => {
  const tab = activeTab()
  if (!view || !tab) return
  if (commitTimer) clearTimeout(commitTimer)
  commitTimer = undefined
  tab.textLineEndings = view.state.field(endingsField)
  tab.isMixedLineEndings = new Set(tab.textLineEndings).size > 1
  const cursor = view.state.selection.main
  const at = view.state.doc.lineAt(cursor.head)
  position.value = `Ln ${at.number}, Col ${cursor.head - at.from + 1}`
  tab.cursor = { anchor: cursor.anchor, head: cursor.head }
  editorStore.LISTEN_FOR_CONTENT_CHANGE({ id: activeId, markdown: view.state.doc.toString() })
  const saved = savedTexts.get(tab.id)
  if (!tab.notifications.some(notification => notification.exclusiveType === 'file_changed') && saved && saved.text === tab.markdown && saved.encoding === JSON.stringify(tab.encoding) && saved.lineEnding === tab.lineEnding && saved.endings.length === tab.textLineEndings.length && saved.endings.every((ending, i) => ending === tab.textLineEndings?.[i])) tab.isSaved = true
}
const remember = () => {
  if (view && activeId) textStates.set(activeId, { state: view.state, scrollTop: view.scrollDOM.scrollTop, pathname: activePathname })
  for (const id of textStates.keys()) if (!editorStore.tabs.some(tab => tab.id === id)) textStates.delete(id)
  for (const id of savedTexts.keys()) if (!editorStore.tabs.some(tab => tab.id === id)) savedTexts.delete(id)
}
const loadLanguage = async (tab: IFileState) => {
  const revision = ++languageRevision
  if (!view) return
  view.dispatch({ effects: languageMode.reconfigure([]) })
  if (tab.markdown.length > 1024 * 1024) return
  const language = LanguageDescription.matchFilename(languages, tab.filename)
  if (!language) return
  try {
    const extension = await language.load()
    if (view && revision === languageRevision) view.dispatch({ effects: languageMode.reconfigure(extension) })
  } catch (error) { console.warn('Could not load syntax highlighting', error) }
}
const textTypography = () => EditorView.theme({
  '&': { fontSize: `${codeFontSize.value}px` },
  '.cm-scroller': { fontFamily: `${codeFontFamily.value}, ${DEFAULT_CODE_FONT_FAMILY}` }
})
watch([codeFontSize, codeFontFamily], () => {
  view?.dispatch({ effects: typography.reconfigure(textTypography()) })
  view?.requestMeasure()
})
const extensions = () => [
  typography.of(textTypography()),
  ...(isVimModeEnabled() ? [vim()] : []),
  EditorState.phrases.of(getCurrentLanguage().startsWith('zh') ? { Find: '查找', Replace: '替换', next: '下一处', previous: '上一处', all: '全选', 'match case': '区分大小写', regexp: '正则表达式', 'by word': '全字匹配', replace: '替换', 'replace all': '全部替换', close: '关闭' } : {}),
  history(), lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(),
  bracketMatching(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  search({ top: true }), keymap.of([{ key: 'Mod-s', run: () => { editorStore.FILE_SAVE(); return true } }, { key: 'Mod-Shift-s', run: () => { editorStore.FILE_SAVE_AS(); return true } }, ...searchKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab, { key: 'Mod-l', run: gotoLine }]),
  wrapMode.of(wrapping.value ? EditorView.lineWrapping : []), languageMode.of([]),
  editable.of(EditorView.editable.of(true)), endingsField,
  lineEndingMode.of(defaultTextLineEnding.of(selectedLineEnding())),
  invertedEffects.of(tr => tr.docChanged ? [replaceEndings.of(tr.startState.field(endingsField))] : []),
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      if (commitTimer) clearTimeout(commitTimer)
      commitTimer = setTimeout(flush, 100)
    }
    if (update.docChanged || update.selectionSet) {
      const cursor = update.state.selection.main
      const line = update.state.doc.lineAt(cursor.head)
      position.value = `Ln ${line.number}, Col ${cursor.head - line.from + 1}`
      const tab = activeTab()
      if (tab) tab.cursor = { anchor: cursor.anchor, head: cursor.head }
    }
  }),
  EditorView.theme({
    '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--editorColor)' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { padding: '12px 0' },
    '.cm-gutters': { backgroundColor: 'var(--editorBgColor)', color: 'var(--iconColor)', border: 'none' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--floatHoverColor)' },
    '.cm-panels': { backgroundColor: 'var(--editorBgColor)', color: 'inherit', fontSize: '13px' },
    '.cm-search': { padding: '8px 12px' },
    '.cm-button, .cm-textfield': { background: 'var(--editorBgColor)', color: 'inherit', border: '1px solid var(--floatBorderColor)', borderRadius: '3px', padding: '3px 6px' },
    '.cm-cursor': { borderLeftColor: 'var(--editorColor)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--selectionBgColor, #80808055)' }
  })
]
const revealSearchCursor = (tab: IFileState) => {
  const cursor = tab.cursor as { anchor?: { line: number; ch: number }; focus?: { line: number; ch: number } } | undefined
  if (!view || !cursor?.anchor || typeof cursor.anchor !== 'object' || !cursor.focus) return
  const offset = (point: { line: number; ch: number }) => {
    const line = view!.state.doc.line(Math.min(view!.state.doc.lines, Math.max(1, point.line + 1)))
    return line.from + Math.min(line.length, Math.max(0, point.ch))
  }
  view.dispatch({ selection: { anchor: offset(cursor.anchor), head: offset(cursor.focus) }, scrollIntoView: true })
}
const activate = () => {
  const tab = currentFile.value
  if (!view || !tab || !isTextDocument(tab)) return
  if (activeId === tab.id && view.state.doc.toString() === tab.markdown) {
    // Reloading only an encoding/BOM/newline change must update the backing
    // separators too, even when the normalized editor text is unchanged.
    if (tab.isSaved) snapshotSavedText(tab)
    if (tab.textLineEndings) view.dispatch({ effects: [replaceEndings.of(tab.textLineEndings), lineEndingMode.reconfigure(defaultTextLineEnding.of(selectedLineEnding()))] })
    if (activePathname !== tab.pathname) loadLanguage(tab).catch(console.error)
    activePathname = tab.pathname
    revealSearchCursor(tab)
    return
  }
  if (activeId !== tab.id) remember()
  if (tab.isSaved) snapshotSavedText(tab)
  activeId = tab.id
  activePathname = tab.pathname
  const cached = textStates.get(tab.id)
  if (cached && cached.pathname === tab.pathname && cached.state.doc.toString() === tab.markdown) {
    // Reconfigure to the current component's compartments/listeners after remount.
    const endings = cached.state.field(endingsField, false) ?? tab.textLineEndings ?? []
    view.setState(cached.state.update({ effects: StateEffect.reconfigure.of(extensions()) }).state)
    view.dispatch({ effects: replaceEndings.of(endings) })
  } else {
    const rawCursor = tab.cursor as { anchor?: number | { line: number; ch: number }; head?: number; focus?: { line: number; ch: number } } | undefined
    const doc = EditorState.create({ doc: tab.markdown }).doc
    const offset = (value: number | { line: number; ch: number } | undefined) => {
      if (typeof value === 'number' || !value) return value
      const line = doc.line(Math.min(doc.lines, Math.max(1, value.line + 1)))
      return line.from + Math.min(line.length, value.ch)
    }
    const cursor = { anchor: offset(rawCursor?.anchor), head: offset(rawCursor?.head ?? rawCursor?.focus) }
    const bounded = (offset: number | undefined) => Math.min(Math.max(offset ?? 0, 0), tab.markdown.length)
    view.setState(EditorState.create({
      doc: tab.markdown,
      extensions: extensions(),
      selection: { anchor: bounded(cursor?.anchor), head: bounded(cursor?.head) }
    }))
    view.dispatch({ effects: replaceEndings.of(tab.textLineEndings ?? Array(tab.markdown.split('\n').length - 1).fill(tab.lineEnding === 'crlf' ? '\r\n' : tab.lineEnding === 'cr' ? '\r' : '\n')) })
  }
  if (isVimModeEnabled()) {
    getCM(view)?.on('vim-mode-change', (event: { mode?: string; subMode?: string }) => {
      bus.emit('vim-mode-change', event.mode === 'insert' ? 'insert' : event.mode === 'visual' ? (event.subMode === 'linewise' ? 'visual-line' : 'visual') : 'normal')
    })
    bus.emit('vim-mode-change', 'normal')
  }
  revealSearchCursor(tab)
  encodingChoice.value = tab.encoding.encoding
  editorStore.UPDATE_TOC([])
  view.scrollDOM.scrollTop = cached?.scrollTop ?? tab.scrollTop ?? 0
  loadLanguage(tab).catch(console.error)
  view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) })
  view.focus()
}
const find = () => { if (view) openSearchPanel(view) }
const next = () => { if (view) findNext(view) }
const prev = () => { if (view) findPrevious(view) }
const select = () => { if (view?.hasFocus) selectAll(view) }
const undoEdit = () => { if (view) undo(view) }
const redoEdit = () => { if (view) redo(view) }
const toggleWrapping = () => {
  wrapping.value = !wrapping.value
  view?.dispatch({ effects: wrapMode.reconfigure(wrapping.value ? EditorView.lineWrapping : []) })
}
const changeLineEnding = (event: Event) => {
  const ending = (event.target as HTMLSelectElement).value
  editorStore.SET_LINE_ENDING(ending)
}
watch(() => [currentFile.value?.lineEnding, currentFile.value?.textLineEndings === undefined], () => {
  const tab = currentFile.value
  if (view && tab?.id === activeId && !tab.textLineEndings) {
    view.dispatch({ effects: [replaceEndings.of(Array(view.state.doc.lines - 1).fill(selectedLineEnding())), lineEndingMode.reconfigure(defaultTextLineEnding.of(selectedLineEnding()))] })
    flush()
  }
})
const convertEncoding = () => {
  const tab = currentFile.value
  if (!tab) return
  flush()
  tab.encoding = { encoding: encodingChoice.value, isBom: tab.encoding.encoding === encodingChoice.value && tab.encoding.isBom }
  tab.isSaved = false
  debouncedSendBufferedState()
  editorStore.FILE_SAVE()
}
const toggleBom = (event: Event) => {
  const tab = currentFile.value
  if (!tab) return
  tab.encoding.isBom = (event.target as HTMLInputElement).checked
  tab.isSaved = false
  debouncedSendBufferedState()
}
const reopen = async () => {
  const tab = currentFile.value
  if (!tab?.pathname || busy.value) return
  flush()
  busy.value = true
  view?.dispatch({ effects: editable.reconfigure(EditorView.editable.of(false)) })
  try {
    textStates.delete(tab.id)
    await editorStore.REOPEN_WITH_ENCODING(encodingChoice.value)
  } finally {
    busy.value = false
    view?.dispatch({ effects: editable.reconfigure(EditorView.editable.of(true)) })
  }
}
const handleFile = () => activate()
watch(() => [currentFile.value?.id, currentFile.value?.pathname], () => activate(), { flush: 'post' })
watch(() => currentFile.value?.encoding.encoding, value => { if (value) encodingChoice.value = value })
const events = { 'flush-active-editor': flush, 'file-changed': handleFile, 'file-loaded': handleFile, find, replace: find, findNext: next, findPrev: prev, undo: undoEdit, redo: redoEdit, selectAll: select }
onMounted(() => {
  if (!container.value) return
  if (isVimModeEnabled()) installVimExCommands(editorStore)
  view = new EditorView({ parent: container.value, state: EditorState.create({ extensions: extensions() }) })
  activate()
  for (const [name, handler] of Object.entries(events)) bus.on(name, handler)
})
onBeforeUnmount(() => {
  flush()
  remember()
  languageRevision++
  for (const [name, handler] of Object.entries(events)) bus.off(name, handler)
  view?.destroy()
  view = undefined
})
</script>

<style scoped>
.text-editor { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.text-editor-content { flex: 1; min-height: 0; overflow: hidden; }
.text-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 6px 12px; font-size: 12px; border-top: 1px solid var(--floatBorderColor); }
.text-status button, .text-status select { color: inherit; background: var(--editorBgColor); border: 1px solid var(--floatBorderColor); border-radius: 3px; padding: 3px 5px; }
.text-status select { max-width: 180px; }
.text-status label { display: inline-flex; align-items: center; gap: 4px; }
.text-status .active { background: var(--floatHoverColor); }
.text-warning { padding: 8px 12px; background: #a66b1922; }
</style>
