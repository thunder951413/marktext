import { Facet, StateEffect, StateField } from '@codemirror/state'
import type { TextLineEnding } from 'common/textDocument'

export const defaultTextLineEnding = Facet.define<TextLineEnding, TextLineEnding>({ combine: values => values[0] ?? '\n' })

export const replaceEndings = StateEffect.define<TextLineEnding[]>()
export const endingsField = StateField.define<TextLineEnding[]>({
  create: () => [],
  update(endings, tr) {
    if (tr.docChanged) {
      let next = endings
      const fallback = endings[0] ?? tr.startState.facet(defaultTextLineEnding)
      let delta = 0
      tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
        const first = tr.startState.doc.lineAt(from).number - 1
        const removed = tr.startState.doc.lineAt(to).number - 1 - first
        const added = inserted.lines - 1
        if (!added && !removed) return
        const replacements = Array.from({ length: added }, (_, i) => i < removed ? endings[first + i] ?? fallback : fallback)
        next = next.slice(0, first + delta).concat(replacements, next.slice(first + delta + removed))
        delta += added - removed
      })
      endings = next
    }
    for (const effect of tr.effects) if (effect.is(replaceEndings)) endings = effect.value
    return endings
  }
})
