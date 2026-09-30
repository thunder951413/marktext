import { afterEach } from 'vitest'
import { EditorView } from '@codemirror/view'

// jsdom has no layout engine. Pure model tests still construct EditorView,
// whose scheduled measurements require these browser geometry methods.
const rect = () => new DOMRect(0, 0, 0, 0)
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = rect
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
}

afterEach(() => {
  for (const element of document.querySelectorAll('.cm-editor')) {
    EditorView.findFromDOM(element as HTMLElement)?.destroy()
  }
  document.body.replaceChildren()
})
