import { test, expect } from '@playwright/test'
import { _electron } from 'playwright'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { launchElectron, getElectronPath, waitForMenuReady, enterSourceMode, exitSourceMode } from './helpers'

test('font controls resize only document text and remember separate sizes across tabs and restart', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-font-ui-'))
  const markdown = path.join(dir, 'note.md')
  const text = path.join(dir, 'events.log')
  writeFileSync(markdown, 'Markdown body\n')
  writeFileSync(text, '中文日志\r\nsecond line\r\n')
  let { app, page } = await launchElectron([markdown], {
    editorEngine: 'codemirror', preferences: { fontSize: 16, codeFontSize: 14, zoom: 1 }
  })
  try {
    await waitForMenuReady(app)
    const open = async(file: string) => {
      await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), file)
    }
    const chromeSize = () => page.locator('.editor-tools').evaluate(el => ({
      height: el.getBoundingClientRect().height,
      font: getComputedStyle(el).fontSize,
      sidebarWidth: document.querySelector('.side-bar')?.getBoundingClientRect().width
    }))
    const chromeBefore = await chromeSize()
    await expect(page.getByTestId('font-size-reset')).toHaveText('16 px')
    await page.getByTestId('font-size-increase').click()
    await expect(page.locator('.editor-component .cm-content')).toHaveCSS('font-size', '17px')
    expect(await chromeSize()).toEqual(chromeBefore)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())).toBe(1)

    await open(text)
    await expect(page.getByTestId('font-size-reset')).toHaveText('14 px')
    await page.getByTestId('font-size-increase').click()
    await expect(page.locator('.text-editor .cm-content')).toHaveCSS('font-size', '15px')
    await expect(page.locator('.text-status')).toHaveCSS('font-size', '12px')
    await open(markdown)
    await expect(page.getByTestId('font-size-reset')).toHaveText('17 px')
    await enterSourceMode(page, app)
    await expect(page.getByTestId('font-size-reset')).toHaveText('15 px')
    await page.getByTestId('font-size-increase').click()
    await expect(page.locator('.source-code .cm-content')).toHaveCSS('font-size', '16px')
    await exitSourceMode(page, app)
    await expect(page.getByTestId('font-size-reset')).toHaveText('17 px')
    await open(text)
    await expect(page.locator('.text-editor .cm-content')).toHaveCSS('font-size', '16px')
    // Toolbar must fit at the application's minimum window width.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(550, 600))
    await expect(page.getByTestId('font-size-increase')).toBeInViewport()
    await expect(page.getByTestId('zoom-in')).toBeInViewport()
    const profile = await app.evaluate(({ app }) => app.getPath('userData'))
    await expect.poll(() => {
      const prefs = JSON.parse(readFileSync(path.join(profile, 'preferences.json'), 'utf8'))
      return [prefs.fontSize, prefs.codeFontSize]
    }).toEqual([17, 16])
    await app.close()
    app = await _electron.launch({
      executablePath: getElectronPath(),
      args: [path.resolve(__dirname, '../..'), '--user-data-dir', profile, text],
      env: { ...process.env, PERF_TESTING: 'true', MARKTEXT_EDITOR_ENGINE: 'codemirror' }
    })
    page = await app.firstWindow()
    await expect(page.getByTestId('font-size-reset')).toHaveText('16 px')
    await expect(page.locator('.text-editor .cm-content')).toHaveCSS('font-size', '16px')
    await open(markdown)
    await expect(page.getByTestId('font-size-reset')).toHaveText('17 px')
    await expect(page.locator('.editor-component .cm-content')).toHaveCSS('font-size', '17px')
    expect(readFileSync(markdown, 'utf8')).toBe('Markdown body\n')
    expect(readFileSync(text, 'utf8')).toBe('中文日志\r\nsecond line\r\n')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('font controls respect preference bounds and reset each group independently', async() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-font-bounds-'))
  const markdown = path.join(dir, 'note.md')
  const text = path.join(dir, 'events.log')
  writeFileSync(markdown, 'Body\n')
  writeFileSync(text, 'Log\n')
  const { app, page } = await launchElectron([markdown], {
    editorEngine: 'codemirror', preferences: { fontSize: 32, codeFontSize: 12 }
  })
  try {
    await expect(page.getByTestId('font-size-increase')).toBeDisabled()
    await page.getByTestId('font-size-reset').click()
    await expect(page.locator('.editor-component .cm-content')).toHaveCSS('font-size', '16px')
    await page.evaluate(p => window.electron.ipcRenderer.send('mt::open-file', p, {}), text)
    await expect(page.getByTestId('font-size-decrease')).toBeDisabled()
    await page.getByTestId('font-size-reset').click()
    await expect(page.locator('.text-editor .cm-content')).toHaveCSS('font-size', '14px')
    await page.getByTestId('font-size-decrease').click()
    await expect(page.locator('.text-editor .cm-content')).toHaveCSS('font-size', '13px')
  } finally {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
