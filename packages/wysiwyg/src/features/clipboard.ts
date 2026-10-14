import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface ImagePayload {
  src: string
  alt: string
  title: string
}

export interface ClipboardHooks {
  /** Persists or uploads a pasted image and returns its final markdown src. */
  imageAction?: (image: ImagePayload) => Promise<string>
  /** Converts external HTML to markdown (sync so the event can be consumed). */
  htmlToMarkdown?: (html: string) => string
  /** Renders markdown to HTML for the clipboard's text/html flavor (sync). */
  clipboardHtml?: (markdown: string) => string
  /** Smart paste: convert external HTML to markdown. Default true. */
  htmlPasteEnabled?: boolean
}

export interface PasteFile {
  type: string
  name: string
}

export interface PastePayload {
  text?: string
  html?: string
  files?: PasteFile[]
  /** Reads an image file as a data URL; required for the image flow. */
  readFileAsDataUrl?: (file: PasteFile) => Promise<string>
}

function insertAtSelection(view: EditorView, text: string): void {
  const range = view.state.selection.main
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.cursor(range.from + text.length),
    userEvent: 'input.paste'
  })
}

/**
 * Synchronous paste decision shared by the DOM handler and tests.
 * Returns 'consumed' when default insertion must be suppressed.
 */
export function consumePastePayload(
  view: EditorView,
  payload: PastePayload,
  hooks: ClipboardHooks
): boolean {
  const imageFile = payload.files?.find(f => f.type.startsWith('image/'))
  if (imageFile && hooks.imageAction && payload.readFileAsDataUrl) {
    const placeholderId = `loading-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
    insertAtSelection(view, `![${placeholderId}]()`)
    runImageFlow(view, imageFile, placeholderId, payload.readFileAsDataUrl, hooks.imageAction)
    return true
  }

  if (
    hooks.htmlPasteEnabled !== false &&
    payload.html &&
    hooks.htmlToMarkdown &&
    looksLikeRichContent(payload)
  ) {
    const markdown = hooks.htmlToMarkdown(payload.html)
    if (markdown.trim()) {
      insertAtSelection(view, markdown)
      return true
    }
  }
  return false
}

function looksLikeRichContent(payload: PastePayload): boolean {
  // Browsers attach a plain-text shadow next to text/html; a non-empty shadow
  // alongside html means the source was rich content worth converting.
  return Boolean(payload.text?.trim())
}

/** Swaps the `![loading-x]()` placeholder inserted while awaiting imageAction. */
export function replaceImagePlaceholder(view: EditorView, id: string, finalSrc: string): void {
  const token = `![${id}]()`
  const at = view.state.doc.toString().indexOf(token)
  if (at < 0) return
  view.dispatch({
    changes: { from: at, to: at + token.length, insert: `![img](${finalSrc})` },
    userEvent: 'input.set'
  })
}

export function removeImagePlaceholder(view: EditorView, id: string): void {
  const token = `![${id}]()`
  const at = view.state.doc.toString().indexOf(token)
  if (at < 0) return
  view.dispatch({ changes: { from: at, to: at + token.length }, userEvent: 'delete' })
}

/** Adapts DOM clipboard events to the testable payload pipeline. */
export function createClipboardHandlers(hooks: ClipboardHooks) {
  return EditorView.domEventHandlers({
    copy(event: ClipboardEvent, view) {
      if (!hooks.clipboardHtml) return false
      const range = view.state.selection.main
      const empty = range.empty
      const markdown = view.state.sliceDoc(range.from, range.to)
      const html = hooks.clipboardHtml(empty ? view.state.doc.toString() : markdown)
      event.clipboardData?.setData('text/html', html)
      return false
    },
    paste(event: ClipboardEvent, view) {
      const dt = event.clipboardData
      if (!dt) return false
      const realFiles = dt.files ? Array.from(dt.files) : []
      const files: PasteFile[] = realFiles.map(f => ({ type: f.type, name: f.name }))
      const readFileAsDataUrl = realFiles.length
        ? (file: PasteFile) =>
          new Promise<string>((resolve, reject) => {
            const real = realFiles.find(f => f.name === file.name)
            if (!real) {
              reject(new Error('file gone'))
              return
            }
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error ?? new Error('read failed'))
            reader.readAsDataURL(real)
          })
        : undefined
      const consumed = consumePastePayload(
        view,
        { text: dt.getData('text/plain'), html: dt.getData('text/html'), files, readFileAsDataUrl },
        hooks
      )
      if (consumed) event.preventDefault()
      return consumed
    }
  })
}

async function runImageFlow(
  view: EditorView,
  file: PasteFile,
  placeholderId: string,
  readFile: (f: PasteFile) => Promise<string>,
  imageAction: (image: ImagePayload) => Promise<string>
): Promise<void> {
  try {
    const dataUrl = await readFile(file)
    const finalSrc = await imageAction({ src: dataUrl, alt: '', title: '' })
    replaceImagePlaceholder(view, placeholderId, finalSrc || '')
  } catch {
    removeImagePlaceholder(view, placeholderId)
  }
}
