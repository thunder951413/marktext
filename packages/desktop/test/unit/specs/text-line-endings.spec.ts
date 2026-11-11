import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history, invertedEffects, undo, redo } from '@codemirror/commands'
import { defaultTextLineEnding, endingsField, replaceEndings } from '@/util/textLineEndings'

describe('text editor mixed line endings', () => {
  it('tracks inserted/deleted separators and restores them through undo and redo', () => {
    let state = EditorState.create({
      doc: 'one\ntwo\nthree\n',
      extensions: [
        endingsField, history(), invertedEffects.of(tr => tr.docChanged ? [replaceEndings.of(tr.startState.field(endingsField))] : [])
      ]
    }).update({ effects: replaceEndings.of(['\r\n', '\r', '\n']) }).state
    const original = state.field(endingsField)
    state = state.update({ changes: { from: 0, insert: 'new\n' } }).state
    expect(state.field(endingsField)).toEqual(['\r\n', '\r\n', '\r', '\n'])
    const target = { get state() { return state }, dispatch: (tr: { state: EditorState }) => { state = tr.state } }
    expect(undo(target)).toBe(true)
    expect(state.doc.toString()).toBe('one\ntwo\nthree\n')
    expect(state.field(endingsField)).toEqual(original)
    expect(redo(target)).toBe(true)
    expect(state.field(endingsField)).toEqual(['\r\n', '\r\n', '\r', '\n'])
  })

  it('uses the chosen separator for the first newline in an empty file', () => {
    const state = EditorState.create({ extensions: [endingsField, defaultTextLineEnding.of('\r')] })
    const changed = state.update({ changes: { from: 0, insert: 'first\n' } }).state
    expect(changed.field(endingsField)).toEqual(['\r'])
  })

  it('does not copy the line-ending table for edits within a line', () => {
    const state = EditorState.create({ doc: 'one\ntwo', extensions: [endingsField] })
      .update({ effects: replaceEndings.of(['\r\n']) }).state
    const changed = state.update({ changes: { from: 1, insert: 'text' } }).state
    expect(changed.field(endingsField)).toBe(state.field(endingsField))
  })
})
