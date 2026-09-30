import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import {
  livePreviewDomHandlers,
  livePreviewField,
  livePreviewUpdateListener,
  requestLivePreviewRebuild,
} from '../decorations/livePreview'

function makeLiveView(doc: string): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new EditorView({
    parent: host,
    doc,
    extensions: [livePreviewField, livePreviewUpdateListener, livePreviewDomHandlers, createMarkdownLanguage()]
  })
}

// Regression: block decorations routed through a ViewPlugin crashed the
// renderer with "Block decorations may not be specified via plugins" as soon
// as a math/html/diagram block was measured. They are provided by a
// StateField now; this pins the real-view path.
describe('block decorations in a live view', () => {
  it('renders display-math widgets without crashing', () => {
    const view = makeLiveView('$$\nE=mc^2\n$$\n\ntail')
    requestLivePreviewRebuild(view)
    const widget = document.querySelector('.wysiwyg-math-block')
    expect(widget).not.toBeNull()
    expect(widget!.querySelector('.katex')).not.toBeNull()
    view.destroy()
  })

  it('reveals raw source while the caret is inside the block content', () => {
    const view = makeLiveView('$$\nE=mc^2\n$$')
    view.dispatch({ selection: { anchor: 5 } })
    expect(document.querySelector('.wysiwyg-math-block')).toBeNull()
    view.destroy()
  })

  it('keeps html previews out of the plugin path too', () => {
    const view = makeLiveView('<div class="x">hello</div>')
    requestLivePreviewRebuild(view)
    // Caret on the block itself keeps it raw here; no crash is the assertion.
    expect(view.state.doc.toString()).toContain('<div')
    view.destroy()
  })
})
