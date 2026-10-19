import { describe, expect, it } from 'vitest'
import { Vim } from '@replit/codemirror-vim'
import { isReservedWindowsChord, restrictVimKeysOnWindows } from '@/util/vim/windowsKeys'

const key = (k: string, init: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', { key: k, ...init })

describe('Windows Vim key restriction', () => {
  it('reserves Ctrl chords that collide with menu accelerators', () => {
    for (const k of ['r', 'v', 'd', 'u', 'o', 'w', 'f', 'b', 'a', 'x', 'q']) {
      expect(isReservedWindowsChord(key(k, { ctrlKey: true }))).toBe(true)
    }
  })

  it('keeps Ctrl-[ and plain keys', () => {
    expect(isReservedWindowsChord(key('[', { ctrlKey: true }))).toBe(false)
    expect(isReservedWindowsChord(key('j'))).toBe(false)
    expect(isReservedWindowsChord(key('D', { shiftKey: true }))).toBe(false)
  })

  it('does not touch AltGr characters', () => {
    expect(isReservedWindowsChord(key('@', { ctrlKey: true, altKey: true }))).toBe(false)
  })

  it('is a no-op outside Windows', () => {
    restrictVimKeysOnWindows('darwin')
    expect(Vim.vimKeyFromEvent(key('r', { ctrlKey: true }), undefined)).toBe('<C-r>')
  })

  it('drops Ctrl chords from Vim input on Windows, once', () => {
    restrictVimKeysOnWindows('win32')
    restrictVimKeysOnWindows('win32')
    expect(Vim.vimKeyFromEvent(key('r', { ctrlKey: true }), undefined)).toBeFalsy()
    expect(Vim.vimKeyFromEvent(key('v', { ctrlKey: true }), undefined)).toBeFalsy()
    expect(Vim.vimKeyFromEvent(key('j'), undefined)).toBe('j')
    expect(Vim.vimKeyFromEvent(key('[', { ctrlKey: true }), undefined)).toBe('<C-[>')
  })
})
