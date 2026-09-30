import { afterEach, describe, expect, it } from 'vitest'
import { WysiwygEditor } from '../editor'
import type { WysiwygOptions } from '../editor'

const editors: WysiwygEditor[] = []
function mount(options: WysiwygOptions) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const editor = new WysiwygEditor(host, options)
  editors.push(editor)
  editor.init()
  return { editor, host }
}
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy() })

describe('editor option regressions', () => {
  it('applies native spellcheck changes without remounting', () => {
    const { editor, host } = mount({ spellcheckEnabled: true, spellcheckHideMarks: true })
    const content = host.querySelector<HTMLElement>('.cm-content')!
    expect(content.spellcheck).toBe(true)
    expect(content.classList.contains('wysiwyg-hide-spelling')).toBe(true)
    editor.setOptions({ spellcheckEnabled: false, spellcheckHideMarks: false })
    expect(content.spellcheck).toBe(false)
    expect(content.classList.contains('wysiwyg-hide-spelling')).toBe(false)
    editor.setOptions({ spellcheckEnabled: true })
    expect(content.spellcheck).toBe(true)
  })

  it('sanitizes HTML previews and updates their enabled state', () => {
    const { editor, host } = mount({ markdown: 'body\n\n<div><img src="x" onerror="alert(1)"><script>alert(1)</script>safe</div>', htmlPreviewEnabled: true })
    const preview = host.querySelector('.wysiwyg-html-preview')
    expect(preview?.textContent).toContain('safe')
    expect(preview?.querySelector('script, [onerror]')).toBeNull()
    editor.setOptions({ htmlPreviewEnabled: false })
    expect(host.querySelector('.wysiwyg-html-preview')).toBeNull()
  })

  it('keeps preview options independent across simultaneous editors', () => {
    const markdown = 'body\n\n<div>preview</div>'
    const enabled = mount({ markdown, htmlPreviewEnabled: true })
    const disabled = mount({ markdown, htmlPreviewEnabled: false })
    enabled.editor.setContent(markdown + '\n')
    expect(enabled.host.querySelector('.wysiwyg-html-preview')).not.toBeNull()
    expect(disabled.host.querySelector('.wysiwyg-html-preview')).toBeNull()
  })
})
