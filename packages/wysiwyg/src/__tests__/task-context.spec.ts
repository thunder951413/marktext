import { describe, expect, it } from 'vitest'
import { WysiwygEditor } from '../editor'
import { getCursorContext } from '../features/context'

describe('task at offsets', () => {
  it('identifies task-list affiliation throughout the checkbox and text', () => {
    for (const ch of [2, 5, 6, 8]) {
      const editor = new WysiwygEditor(document.createElement('div'), { markdown: '- [ ] task\n' })
      editor.init()
      editor.setCursorByOffset({ anchor: { line: 0, ch }, focus: { line: 0, ch } })
      // @ts-expect-error private
      const ctx = getCursorContext(editor.view)
      expect(ctx.affiliation.some(item => item.listType === 'task')).toBe(true)
      editor.destroy()
    }
  })
})
