import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDangerousExecutableFile, isExtensionlessExecutable } from 'common/filesystem/paths'

// #3575 — clicking a markdown link to a co-located script/executable used to
// call shell.openPath() with no check, so a `.js`/`.vbs`/`.bat` next to an
// untrusted document ran code (WSH JScript) on Windows without confirmation.
// This guard flags those extensions so the handler can confirm before opening.

describe('#3575 — isDangerousExecutableFile', () => {
  it('flags Windows Script Host script files', () => {
    for (const ext of ['js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ws', 'wsc', 'hta']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('flags native executables, installers and batch files', () => {
    for (const ext of ['exe', 'com', 'scr', 'pif', 'cpl', 'msi', 'msp', 'bat', 'cmd']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('flags PowerShell and shortcut/registry files', () => {
    for (const ext of ['ps1', 'psm1', 'lnk', 'url', 'reg', 'inf', 'scf', 'jar', 'chm', 'msix']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('is case-insensitive and tolerates an absolute path', () => {
    expect(isDangerousExecutableFile('C:\\Users\\a\\Update.JS')).toBe(true)
    expect(isDangerousExecutableFile('/tmp/run.VBS')).toBe(true)
  })

  it('flags macOS and Linux launchers, not just Windows', () => {
    for (const name of [
      'run.command',
      'run.tool',
      'shell.terminal',
      'Foo.app',
      'Setup.pkg',
      'jump.fileloc',
      'launch.desktop',
      'install.sh',
      'App.AppImage',
      'installer.run'
    ]) {
      expect(isDangerousExecutableFile(name)).toBe(true)
    }
  })

  it('still flags when a trailing dot or space would slip past ShellExecute (#4843 review)', () => {
    // Windows strips trailing dots/spaces, so these still run update.js.
    expect(isDangerousExecutableFile('update.js.')).toBe(true)
    expect(isDangerousExecutableFile('update.js ')).toBe(true)
    expect(isDangerousExecutableFile('payload.exe...')).toBe(true)
    expect(isDangerousExecutableFile('payload.bat  ')).toBe(true)
  })

  it('does not misflag a safe file that merely ends in a dot/space', () => {
    expect(isDangerousExecutableFile('note.md.')).toBe(false)
    expect(isDangerousExecutableFile('photo.png ')).toBe(false)
  })

  it('does not flag documents, images or markdown', () => {
    for (const name of ['note.md', 'photo.png', 'data.json', 'readme.txt', 'archive.zip', 'index.html']) {
      expect(isDangerousExecutableFile(name)).toBe(false)
    }
  })

  it('does not flag a file with no extension or an empty input', () => {
    expect(isDangerousExecutableFile('Makefile')).toBe(false)
    expect(isDangerousExecutableFile('')).toBe(false)
  })
})

// A markdown link to an extensionless file with an execute bit (`./setup`)
// slipped past the extension list; macOS opens such a file in Terminal and runs it.
describe.skipIf(process.platform === 'win32')('isExtensionlessExecutable', () => {
  let dir: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-exec-'))
    fs.writeFileSync(path.join(dir, 'setup'), '#!/bin/sh\n', { mode: 0o755 })
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n', { mode: 0o644 })
    fs.writeFileSync(path.join(dir, 'photo.png'), '', { mode: 0o755 })
    fs.mkdirSync(path.join(dir, 'bin'))
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('flags an extensionless file with an execute bit', () => {
    expect(isExtensionlessExecutable(path.join(dir, 'setup'))).toBe(true)
  })

  it('does not flag an extensionless file without an execute bit', () => {
    expect(isExtensionlessExecutable(path.join(dir, 'LICENSE'))).toBe(false)
  })

  it('leaves files with an extension to the extension list', () => {
    expect(isExtensionlessExecutable(path.join(dir, 'photo.png'))).toBe(false)
  })

  it('does not flag directories or missing paths', () => {
    expect(isExtensionlessExecutable(path.join(dir, 'bin'))).toBe(false)
    expect(isExtensionlessExecutable(path.join(dir, 'missing'))).toBe(false)
    expect(isExtensionlessExecutable('')).toBe(false)
  })
})
