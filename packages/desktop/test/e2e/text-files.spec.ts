import { test, expect } from '@playwright/test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import iconv from 'iconv-lite'
import { launchElectron, waitForMenuReady, sendIpcToRenderer } from './helpers'

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

test('text editing, search, tab switching, encoding conversion and extensionless save', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-text-ui-'))
  const logfile = path.join(dir, 'events.log')
  const config = path.join(dir, 'Dockerfile')
  const md = path.join(dir, 'note.md')
  writeFileSync(logfile, '# literal  \r\nnext\r\n\r\n')
  writeFileSync(config, 'FROM sample\n')
  writeFileSync(md, '# Markdown\n')
  const { app, page } = await launchElectron([logfile], { editorEngine: 'codemirror' })
  try {
    await waitForMenuReady(app)
    const content = page.locator('.text-editor .cm-content')
    await expect(content).toContainText('# literal')
    await expect(page.locator('.text-editor select[aria-label="Line endings"]')).toHaveValue('crlf')
    await content.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End')
    await page.keyboard.insertText('中文 😀')
    await expect(content).toContainText('中文 😀')
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(logfile, 'utf8')).toBe('# literal  \r\nnext\r\n\r\n中文 😀')
    await page.keyboard.press(`${modifier}+f`)
    await expect(page.locator('.text-editor .cm-search')).toBeVisible()
    await page.locator('.cm-search input[name="search"]').fill('next')
    await page.keyboard.press('Escape')

    // Cross-engine switches must keep both text and the text editor's undo state.
    await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), md)
    await expect(page.locator('.text-editor')).toHaveCount(0)
    await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), logfile)
    await expect(content).toContainText('中文 😀')
    await content.click()
    await page.keyboard.press(`${modifier}+z`)
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(logfile, 'utf8')).toBe('# literal  \r\nnext\r\n\r\n')

    await page.evaluate(p => window.electron.ipcRenderer.send('mt::window::drop', [p]), config)
    await expect(content).toContainText('FROM sample')
    await content.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End')
    await page.keyboard.type('RUN sample')
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(config, 'utf8')).toBe('FROM sample\nRUN sample')

    await page.locator('select[aria-label="Encoding"]').selectOption('utf16le')
    await page.getByRole('button', { name: 'Save with encoding', exact: true }).click()
    await expect.poll(() => iconv.decode(readFileSync(config), 'utf16le')).toBe('FROM sample\nRUN sample')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('reopens legacy Chinese text with a chosen encoding and preserves bytes', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-encoding-ui-'))
  const pathname = path.join(dir, 'legacy.txt')
  const bytes = iconv.encode('中文日志\r\n第二行\r\n', 'gbk')
  writeFileSync(pathname, bytes)
  const { app, page } = await launchElectron([pathname], { editorEngine: 'codemirror', preferences: { autoGuessEncoding: false } })
  try {
    await waitForMenuReady(app)
    await expect(page.locator('.text-editor')).toBeVisible()
    await page.locator('select[aria-label="Encoding"]').selectOption('gbk')
    await page.getByRole('button', { name: 'Reopen with encoding', exact: true }).click()
    await expect(page.locator('.text-editor .cm-content')).toContainText('中文日志')
    await expect(page.locator('.text-warning')).toHaveCount(0)
    await page.locator('.text-editor .cm-content').click()
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(pathname).equals(bytes)).toBe(true)
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('mixed endings survive replacement and undo, and explicit LF/BOM changes save correctly', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-mixed-ui-'))
  const pathname = path.join(dir, 'mixed.log')
  const original = '# item 1\r\nitem 2\ritem 3\n\n'
  writeFileSync(pathname, original)
  const { app, page } = await launchElectron([pathname], { editorEngine: 'codemirror' })
  try {
    await waitForMenuReady(app)
    const content = page.locator('.text-editor .cm-content')
    await expect(content).toContainText('item 3')
    await page.locator('.text-status').getByRole('button', { name: 'Find', exact: true }).click()
    await page.locator('.cm-search input[name="search"]').fill('item')
    await page.locator('.cm-search input[name="replace"]').fill('entry')
    await page.locator('.cm-search button[name="replaceAll"]').click()
    await content.click()
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(pathname, 'utf8')).toBe(original.replaceAll('item', 'entry'))
    await page.keyboard.press(`${modifier}+z`)
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(pathname, 'utf8')).toBe(original)
    await page.locator('select[aria-label="Line endings"]').selectOption('lf')
    await page.getByRole('checkbox', { name: 'BOM', exact: true }).check()
    await content.click()
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(pathname, 'utf8')).toBe('\uFEFF' + original.replace(/\r\n|\r/g, '\n'))
    await page.screenshot({ path: '/tmp/marktext-text-editor.png' })
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('folder text files open from the sidebar and reload after external changes', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-folder-text-'))
  const pathname = path.join(dir, 'settings.json')
  writeFileSync(pathname, '{"name":"first"}\n')
  writeFileSync(path.join(dir, '.env'), 'VALUE=first\n')
  const { app, page } = await launchElectron([dir], { editorEngine: 'codemirror' })
  try {
    await waitForMenuReady(app)
    await page.locator('.side-bar').getByText('settings.json', { exact: true }).click()
    await expect(page.locator('.text-editor .cm-content')).toContainText('first')
    writeFileSync(pathname, '{"name":"external"}\n')
    await expect(page.locator('.text-editor .cm-content')).toContainText('external', { timeout: 10000 })
    writeFileSync(pathname, '{"name":"external"}\r\n')
    await expect(page.locator('select[aria-label="Line endings"]')).toHaveValue('crlf', { timeout: 10000 })
    await page.locator('.text-editor .cm-content').click()
    await page.keyboard.press(`${modifier}+s`)
    await expect.poll(() => readFileSync(pathname, 'utf8')).toBe('{"name":"external"}\r\n')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('large text uses a virtualized editor and remains searchable', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-large-text-'))
  const pathname = path.join(dir, 'large.log')
  writeFileSync(pathname, ('2026-11-11 INFO repeated log line with values abcdefghijklmnopqrstuvwxyz\n').repeat(30000) + 'FINAL_SENTINEL\n')
  const { app, page } = await launchElectron([pathname], { editorEngine: 'codemirror' })
  try {
    await waitForMenuReady(app)
    await expect(page.locator('.text-editor')).toBeVisible()
    expect(await page.locator('.text-editor .cm-line').count()).toBeLessThan(200)
    await page.locator('.text-status').getByRole('button', { name: 'Find', exact: true }).click()
    await page.locator('.cm-search input[name="search"]').fill('FINAL_SENTINEL')
    await page.locator('.cm-search button[name="next"]').click()
    await expect(page.locator('.text-editor .cm-content')).toContainText('FINAL_SENTINEL')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Markdown undo survives a visit to a plain-text tab', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-md-text-undo-'))
  const md = path.join(dir, 'note.md')
  const txt = path.join(dir, 'note.txt')
  writeFileSync(md, 'Original paragraph.\n')
  writeFileSync(txt, 'Plain text.\n')
  const { app, page } = await launchElectron([md], { editorEngine: 'codemirror' })
  try {
    await waitForMenuReady(app)
    const markdown = page.locator('.editor-component .cm-content')
    await expect(markdown).toContainText('Original paragraph.')
    await markdown.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End')
    await page.keyboard.insertText(' added')
    await expect(markdown).toContainText('added')
    await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), txt)
    await expect(page.locator('.text-editor')).toBeVisible()
    await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), md)
    await expect(markdown).toContainText('added')
    await markdown.click()
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(markdown).not.toContainText('added')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
