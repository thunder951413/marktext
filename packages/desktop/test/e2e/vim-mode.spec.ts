import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  enterSourceMode,
  exitSourceMode,
  getMarkdownContent,
  launchWithMarkdown,
  placeCaretInEditor,
  setSourceMarkdown
} from './helpers'

const placeCaretAtFirstCharacter = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const root = document.querySelector('.editor-component') as HTMLElement | null
    const target = root?.querySelector('.mu-content') as HTMLElement | null
    const node = target?.firstChild
    if (!root || !target || !node) return false
    root.focus()
    const range = document.createRange()
    range.setStart(node, 0)
    range.collapse(true)
    const selection = window.getSelection()
    if (!selection) return false
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
    return true
  })

test.describe('Vim mode', () => {
  let app: ElectronApplication
  let page: Page
  let initialMarkdown = ''

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('alpha beta\n\nsecond line\n', { vimMode: true })
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('WYSIWYG starts in Normal, blocks typing, and i/Escape toggles Insert', async() => {
    const status = page.getByTestId('vim-status')
    await expect(status).toContainText('NORMAL')
    await placeCaretInEditor(page)

    const initial = await getMarkdownContent(page, app)
    initialMarkdown = initial
    await placeCaretInEditor(page)
    // `z` has no standalone command in this phase and must never leak into the
    // content. (Typing an arbitrary English word is not a valid guard test:
    // it may legitimately contain `i`, `a` or `o`, which enter Insert mode.)
    await page.keyboard.type('zzz')
    expect(await getMarkdownContent(page, app)).toBe(initial)

    await placeCaretInEditor(page)
    await page.keyboard.press('i')
    await expect(status).toContainText('INSERT')
    await page.keyboard.type('!')
    await page.keyboard.press('Escape')
    await expect(status).toContainText('NORMAL')
    await expect.poll(() => getMarkdownContent(page, app)).toContain('!')
  })

  test('hjkl, counts, undo and slash search use Vim semantics', async() => {
    await placeCaretInEditor(page)
    const before = await page.evaluate(() => window.getSelection()?.focusOffset ?? -1)
    await page.keyboard.press('2')
    await page.keyboard.press('h')
    const after = await page.evaluate(() => window.getSelection()?.focusOffset ?? -1)
    expect(after).toBeLessThan(before)

    await page.keyboard.press('u')
    await expect.poll(() => getMarkdownContent(page, app)).toBe(initialMarkdown)

    await placeCaretInEditor(page)
    await page.keyboard.press('/')
    await expect(page.getByTestId('vim-status')).toContainText('SEARCH')
    await expect(page.locator('.search-bar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('vim-status')).toContainText('NORMAL')
  })

  test('source mode uses CodeMirror Vim Normal/Insert/undo', async() => {
    await enterSourceMode(page, app)
    await expect(page.getByTestId('vim-status')).toContainText('NORMAL')
    const cmContent = page.locator('.source-code .cm-content')
    await cmContent.click()
    await page.keyboard.press('G')
    await page.keyboard.press('A')
    await expect(page.getByTestId('vim-status')).toContainText('INSERT')
    await page.keyboard.type(' source-vim')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('vim-status')).toContainText('NORMAL')
    await page.keyboard.press('u')

    const value = await page.evaluate(() => {
      const root = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: { getValue(): string } })
        | null
      return root?.CodeMirror?.getValue() ?? ''
    })
    expect(value).not.toContain('source-vim')
    await exitSourceMode(page, app)
  })

  test('operator motions, line yank/delete and Visual mode use Muya history and clipboard', async() => {
    await setSourceMarkdown(page, app, 'alpha beta\n\nsecond line\n')
    expect(await placeCaretAtFirstCharacter(page)).toBe(true)

    await page.keyboard.press('d')
    await page.keyboard.press('w')
    await expect.poll(() => getMarkdownContent(page, app)).not.toContain('alpha beta')
    await placeCaretAtFirstCharacter(page)
    await page.keyboard.press('u')
    await expect.poll(() => getMarkdownContent(page, app)).toContain('alpha beta')

    await placeCaretAtFirstCharacter(page)
    await page.keyboard.press('V')
    await expect(page.getByTestId('vim-status')).toContainText('VISUAL LINE')
    await page.keyboard.press('y')
    await expect(page.getByTestId('vim-status')).toContainText('NORMAL')
    const yanked = await page.evaluate(() => window.electron.clipboard.readText())
    expect(yanked).toContain('alpha beta')

    await placeCaretAtFirstCharacter(page)
    await page.keyboard.press('d')
    await page.keyboard.press('d')
    await expect.poll(() => getMarkdownContent(page, app)).not.toContain('alpha beta')
    await expect.poll(() => getMarkdownContent(page, app)).toContain('second line')
  })

  test('dd removes the current list item instead of the entire list', async() => {
    await setSourceMarkdown(page, app, '- first item\n- second item\n')
    expect(await placeCaretAtFirstCharacter(page)).toBe(true)
    await page.keyboard.press('d')
    await page.keyboard.press('d')
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).not.toContain('first item')
    expect(markdown).toContain('second item')
  })

  test('change-word and open-line commands enter Insert and preserve undoable structure', async() => {
    await setSourceMarkdown(page, app, 'alpha beta\n')
    expect(await placeCaretAtFirstCharacter(page)).toBe(true)
    await page.keyboard.press('c')
    await page.keyboard.press('w')
    await expect(page.getByTestId('vim-status')).toContainText('INSERT')
    await page.keyboard.type('gamma')
    await page.keyboard.press('Escape')
    await expect.poll(() => getMarkdownContent(page, app)).toContain('gamma beta')

    await placeCaretAtFirstCharacter(page)
    await page.keyboard.press('o')
    await expect(page.getByTestId('vim-status')).toContainText('INSERT')
    await page.keyboard.type('opened below')
    await page.keyboard.press('Escape')
    await expect.poll(() => getMarkdownContent(page, app)).toContain('opened below')
  })

  test('f/semicolon character search and yy/p clipboard paste work', async() => {
    await setSourceMarkdown(page, app, 'a x a x a\n\nlanding\n')
    expect(await placeCaretAtFirstCharacter(page)).toBe(true)
    await page.keyboard.press('f')
    await page.keyboard.press('a')
    const firstFind = await page.evaluate(() => window.getSelection()?.focusOffset ?? -1)
    await page.keyboard.press(';')
    const secondFind = await page.evaluate(() => window.getSelection()?.focusOffset ?? -1)
    expect(secondFind).toBeGreaterThan(firstFind)

    await page.keyboard.press('y')
    await page.keyboard.press('y')
    await expect.poll(() => page.evaluate(() => window.electron.clipboard.readText()))
      .toContain('a x a x a')
    // The test-only IPC clipboard read can move focus away from the content in
    // Electron. Restore the caret before exercising the actual Vim commands.
    expect(await placeCaretAtFirstCharacter(page)).toBe(true)
    await page.keyboard.press('j')
    await page.keyboard.press('p')
    await expect.poll(async() => (await page.locator('.editor-component').innerText())
      .match(/a x a x a/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(2)
    expect((await getMarkdownContent(page, app)).match(/a x a x a/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(2)
  })
})
