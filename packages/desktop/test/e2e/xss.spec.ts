import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'
import path from 'path'
import os from 'os'

test.describe('Test XSS Vulnerabilities', () => {
  let app: ElectronApplication

  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron(['test/e2e/data/xss.md'])
    app = electronApp
    page = firstPage

    // Wait to parse and render the document.
    await new Promise((resolve) => setTimeout(resolve, 3000))
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Load malicious document', async() => {
    const { isVisible, isCrashed } = await app.evaluate(async(process) => {
      const mainWindow = process.BrowserWindow.getAllWindows()[0]
      return {
        isVisible: mainWindow.isVisible(),
        isCrashed: mainWindow.webContents.isCrashed()
      }
    })

    expect(isVisible).toBeTruthy()
    expect(isCrashed).toBeFalsy()
    const unsafe = await page.evaluate(() => ({
      handlers: document.querySelectorAll('.editor-component [onerror], .editor-component [onload], .editor-component script').length,
      nodeAccess: typeof (window as unknown as { require?: unknown }).require
    }))
    expect(unsafe.handlers).toBe(0)
    expect(unsafe.nodeAccess).toBe('undefined')
  })

  test('runtime bridge rejects internal channels and forbidden URL protocols', async() => {
    const completion = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image completion reply timed out')), 3000)
      const ipc = window.electron.ipcRenderer as unknown as {
        once: (channel: string, callback: (event: unknown, files: unknown) => void) => void
      }
      ipc.once('mt::response-of-image-path-mt-888', (_event, files) => { clearTimeout(timer); resolve(files) })
      window.electron.ipcRenderer.send('mt::ask-for-image-auto-path', { pathname: '', src: '', id: 'mt-888' })
    }))
    expect(completion).toEqual([])
    const rejected = await page.evaluate(async(outsidePath) => {
      const ipc = window.electron.ipcRenderer as unknown as {
        send: (channel: string, ...args: unknown[]) => void
        invoke: (channel: string) => Promise<unknown>
      }
      let internal = false
      let arbitrary = false
      let outsideRead = false
      let outsideWrite = false
      try { ipc.send('window-close-by-id', 1) } catch { internal = true }
      try { await ipc.invoke('unknown-channel') } catch { arbitrary = true }
      try { await window.fileUtils.readFile(outsidePath) } catch { outsideRead = true }
      try { await window.fileUtils.writeFile(outsidePath, 'blocked') } catch { outsideWrite = true }
      const external = await window.electron.shell.openExternal('javascript:alert(1)')
      return { internal, arbitrary, external, outsideRead, outsideWrite }
    }, path.join(os.tmpdir(), 'marktext-outside-workspace.txt'))
    expect(rejected).toEqual({ internal: true, arbitrary: true, external: false, outsideRead: true, outsideWrite: true })
  })
})
