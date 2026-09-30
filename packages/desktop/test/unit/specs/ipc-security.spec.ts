import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isAllowedChannel } from '@shared/security/ipcChannels'
import { isSafeExternalUrl, isTrustedRendererUrl } from '@shared/security/renderer'
import { isWithinRoots } from 'main_renderer/utils/fileAccess'

const tempDirs: string[] = []
afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })

describe('IPC security boundaries', () => {
  it('permits only declared renderer channels and blocks internal messages', () => {
    expect(isAllowedChannel('invoke', 'mt::fs::read-file')).toBe(true)
    expect(isAllowedChannel('send', 'mt::cmd-open-file')).toBe(true)
    for (const channel of ['window-close-by-id', 'watcher-watch-file', 'set-user-preference', '__proto__', 'unknown']) {
      expect(isAllowedChannel('send', channel)).toBe(false)
    }
    expect(isAllowedChannel('invoke', 'mt::fs::empty-dir')).toBe(false)
    expect(isAllowedChannel('invoke', 'mt::fs::unlink')).toBe(false)
  })

  it('trusts the application page, including its bootstrap query, and rejects other files and origins', () => {
    const renderer = '/apps/marktext/out/renderer/index.html'
    expect(isTrustedRendererUrl('file://' + renderer + '?wid=1', renderer)).toBe(true)
    expect(isTrustedRendererUrl('file:///tmp/document.html', renderer)).toBe(false)
    expect(isTrustedRendererUrl('https://example.com', renderer)).toBe(false)
    expect(isTrustedRendererUrl('http://localhost:5173/?wid=1', renderer, 'http://localhost:5173/')).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5174/', renderer, 'http://localhost:5173/')).toBe(false)
  })

  it('limits external navigation to web and email protocols', () => {
    for (const value of ['https://example.com/a', 'http://localhost/', 'mailto:a@example.com']) expect(isSafeExternalUrl(value)).toBe(true)
    for (const value of ['javascript:alert(1)', 'file:///tmp/a', 'data:text/html,hello', 'custom://run', '\0https://example.com']) expect(isSafeExternalUrl(value)).toBe(false)
  })

  it('rejects traversal, sibling prefixes and symlinks escaping an opened directory', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-security-'))
    tempDirs.push(temp)
    const root = path.join(temp, 'project')
    const outside = path.join(temp, 'project-other')
    fs.mkdirSync(root)
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(isWithinRoots(path.join(root, 'assets/new.png'), [root])).toBe(true)
    expect(isWithinRoots(path.join(root, '../secret'), [root])).toBe(false)
    expect(isWithinRoots(path.join(outside, 'file'), [root])).toBe(false)
    expect(isWithinRoots(path.join(root, 'escape/new.png'), [root])).toBe(false)
    expect(() => isWithinRoots('relative/file', [root])).toThrow()
  })
})
