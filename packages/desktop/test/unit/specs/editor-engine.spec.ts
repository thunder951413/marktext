import { describe, expect, it } from 'vitest'
import { DEFAULT_EDITOR_ENGINE, resolveEditorEngine } from 'common/editorEngine'

describe('editor engine selection', () => {
  it('defaults to CodeMirror', () => {
    expect(DEFAULT_EDITOR_ENGINE).toBe('codemirror')
    expect(resolveEditorEngine()).toBe('codemirror')
  })

  it('honours the saved preference as the fallback switch', () => {
    expect(resolveEditorEngine(undefined, 'muya')).toBe('muya')
    expect(resolveEditorEngine(undefined, 'codemirror')).toBe('codemirror')
  })

  it('lets the environment variable override the preference', () => {
    expect(resolveEditorEngine('muya', 'codemirror')).toBe('muya')
    expect(resolveEditorEngine('codemirror', 'muya')).toBe('codemirror')
  })

  it('ignores unknown values', () => {
    expect(resolveEditorEngine('prosemirror', 'tiptap')).toBe('codemirror')
    expect(resolveEditorEngine('', 'muya')).toBe('muya')
  })
})
