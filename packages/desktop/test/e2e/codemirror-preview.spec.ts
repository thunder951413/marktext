import { expect, test } from '@playwright/test'
import { getMarkdownContent, launchWithMarkdown } from './helpers'
import type { Page } from 'playwright'

const updatePreferences = (page: Page, values: Record<string, unknown>) => page.evaluate(values => {
  const root = document.querySelector('#app') as Element & {
    __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { SET_USER_PREFERENCE: (values: unknown) => void }> } } } }
  }
  root.__vue_app__.config.globalProperties.$pinia._s.get('preferences')?.SET_USER_PREFERENCE(values)
}, values)

test('CodeMirror preview preserves text, TOC labels and dynamic settings', async() => {
  const markdown = '# Heading\n\n<div>HTML preview</div>\n\nparagraph\n'
  const { app, page } = await launchWithMarkdown(markdown, {
    editorEngine: 'codemirror', preferences: { isHtmlEnabled: true, spellcheckerEnabled: true }
  })
  try {
    const content = page.locator('.editor-component .cm-content')
    await expect(content).toBeVisible()
    await expect(page.locator('.wysiwyg-html-preview')).toContainText('HTML preview')
    expect(await getMarkdownContent(page, app)).toBe(markdown)
    await content.click()
    await page.keyboard.type('added')
    const labels = await page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { listToc: Array<{ content: string }> }> } } } }
      }
      return root.__vue_app__.config.globalProperties.$pinia._s.get('editor')?.listToc.map(item => item.content)
    })
    expect(labels).toEqual(['Heading'])
    await updatePreferences(page, { isHtmlEnabled: false, spellcheckerEnabled: false })
    await expect(page.locator('.wysiwyg-html-preview')).toHaveCount(0)
    await expect(content).toHaveAttribute('spellcheck', 'false')
    await updatePreferences(page, { isHtmlEnabled: true, spellcheckerEnabled: true })
    await expect(content).toHaveAttribute('spellcheck', 'true')
    await expect(page.locator('.wysiwyg-html-preview')).toContainText('HTML preview')
    expect(await getMarkdownContent(page, app)).toContain('added')
    await content.evaluate(element => {
      const data = new DataTransfer()
      data.setData('text/plain', 'rich paste')
      data.setData('text/html', '<strong>rich paste</strong>')
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    expect(await getMarkdownContent(page, app)).toContain('**rich paste**')
  } finally { await app.close() }
})

test('CodeMirror preview reports live Vim Normal and Insert modes', async() => {
  const { app, page } = await launchWithMarkdown('alpha beta\n', { editorEngine: 'codemirror', vimMode: true })
  try {
    const status = page.getByTestId('vim-status')
    await expect(status).toContainText('NORMAL')
    await page.locator('.editor-component .cm-content').click()
    await page.keyboard.press('i')
    await expect(status).toContainText('INSERT')
    await page.keyboard.type('added')
    await page.keyboard.press('Escape')
    await expect(status).toContainText('NORMAL')
    expect(await getMarkdownContent(page, app)).toContain('added')
  } finally { await app.close() }
})
