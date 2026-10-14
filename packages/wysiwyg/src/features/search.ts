import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

export interface SearchMatch {
  from: number
  to: number
}

export interface SearchOptions {
  /** Muya-era names (isCaseSensitive/isWholeWord/isRegexp) are accepted. */
  caseSensitive?: boolean
  isCaseSensitive?: boolean
  wholeWord?: boolean
  isWholeWord?: boolean
  regexp?: boolean
  isRegexp?: boolean
}

interface SearchStateValue {
  matches: SearchMatch[]
  active: number
}

/** Replaces the match set; dispatched by the editor's search methods. */
export const setSearchEffect = StateEffect.define<SearchStateValue>()

const emptyState: SearchStateValue = { matches: [], active: -1 }

export const searchField = StateField.define<SearchStateValue>({
  create: () => emptyState,
  update(value, tr) {
    let next = value
    for (const effect of tr.effects) {
      if (effect.is(setSearchEffect)) next = effect.value
    }
    if (tr.docChanged && next.matches.length) {
      // Keep highlights anchored through edits; assoc=1 makes insertions at
      // the match start push the range forward instead of absorbing it.
      const matches = next.matches
        .map(m => ({ from: tr.changes.mapPos(m.from, 1), to: tr.changes.mapPos(m.to, 1) }))
        .filter(m => m.to > m.from)
      next = {
        matches,
        active: Math.min(Math.max(next.active, -1), matches.length - 1)
      }
    }
    return next
  }
})

export function buildSearchDecorations(
  value: SearchStateValue,
  docLength: number
): DecorationSet {
  if (!value.matches.length) return Decoration.none
  const ranges = value.matches.flatMap((m, i) => {
    if (m.to > docLength || m.from < 0) return []
    // Muya theme convention: the ACTIVE match is .mu-highlight, inactive
    // ones .mu-selection — the desktop search UI counts them separately.
    const cls = i === value.active ? 'mu-highlight' : 'mu-selection'
    return [Decoration.mark({ class: cls }).range(m.from, m.to)]
  })
  return Decoration.set(ranges, true)
}

export const searchHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none

    update(update: ViewUpdate) {
      this.decorations = buildSearchDecorations(update.state.field(searchField), update.state.doc.length)
    }

    constructor(view: EditorView) {
      this.decorations = buildSearchDecorations(view.state.field(searchField, false) ?? emptyState, view.state.doc.length)
    }
  },
  {
    decorations: v => v.decorations
  }
)

export function computeMatches(docText: string, query: string, opts: SearchOptions = {}): SearchMatch[] {
  if (!query) return []
  const caseSensitive = opts.isCaseSensitive ?? opts.caseSensitive ?? false
  const regexp = opts.isRegexp ?? opts.regexp ?? false
  const wholeWord = opts.isWholeWord ?? opts.wholeWord ?? false
  if (regexp && !wholeWord) {
    const flags = `g${caseSensitive ? '' : 'i'}`
    let re: RegExp
    try {
      re = new RegExp(query, flags)
    } catch {
      return []
    }
    const out: SearchMatch[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(docText)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      if (wholeWord && !isWordBounded(docText, m.index, m.index + m[0].length)) continue
      out.push({ from: m.index, to: m.index + m[0].length })
    }
    return out
  }
  const hay = caseSensitive ? docText : docText.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const out: SearchMatch[] = []
  let at = hay.indexOf(needle)
  while (at >= 0) {
    if (!wholeWord || isWordBounded(docText, at, at + needle.length)) {
      out.push({ from: at, to: at + needle.length })
    }
    at = hay.indexOf(needle, at + needle.length)
  }
  return out
}

const WORD_CHAR = /[\p{L}\p{N}_]/u

function isWordBounded(text: string, from: number, to: number): boolean {
  const before = from > 0 ? text[from - 1] : ''
  const after = to < text.length ? text[to] : ''
  return !(WORD_CHAR.test(before) && WORD_CHAR.test(text[from])) &&
    !(WORD_CHAR.test(text[to - 1]) && WORD_CHAR.test(after))
}
