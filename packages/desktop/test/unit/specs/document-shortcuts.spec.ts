import { describe, expect, it } from 'vitest'
import { isEqualAccelerator } from 'common/keybinding'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'

const platforms = [keybindingsDarwin, keybindingsLinux, keybindingsWindows]

describe('new document and display zoom shortcuts', () => {
  it('uses the platform-standard new-document shortcut', () => {
    expect(keybindingsDarwin.get('file.new-tab')).toBe('Command+N')
    expect(keybindingsLinux.get('file.new-tab')).toBe('Ctrl+N')
    expect(keybindingsWindows.get('file.new-tab')).toBe('Ctrl+N')
  })

  it('provides zoom in, zoom out, and actual-size shortcuts on every desktop platform', () => {
    for (const keybindings of platforms) {
      expect(keybindings.get('window.zoomIn')).toBeTruthy()
      expect(keybindings.get('window.zoomOut')).toBeTruthy()
      expect(keybindings.get('window.zoomReset')).toBeTruthy()
    }
  })

  it('does not introduce conflicts for the new document and zoom actions', () => {
    const changedIds = new Set([
      'file.new-tab',
      'file.new-window',
      'window.zoomIn',
      'window.zoomOut',
      'window.zoomReset'
    ])
    for (const keybindings of platforms) {
      const bound = [...keybindings.entries()].filter((entry): entry is [string, string] => !!entry[1])
      for (const [id, accelerator] of bound.filter(([id]) => changedIds.has(id))) {
        const duplicate = bound
          .filter(([candidateId]) => candidateId !== id)
          .find(([, candidate]) => isEqualAccelerator(accelerator, candidate))
        expect(duplicate, `${id} duplicates ${duplicate?.[0]}`).toBeUndefined()
      }
    }
  })
})
