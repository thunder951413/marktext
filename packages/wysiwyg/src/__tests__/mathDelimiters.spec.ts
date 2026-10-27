import { type ChangeSpec, EditorState } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { GFM, parser as baseParser } from '@lezer/markdown'
import { buildLivePreviewDecorations, mathDelimiterLines } from '../decorations/livePreview'
import { highlightExtension } from '../markdown'

const mdParser = baseParser.configure([GFM, highlightExtension])

function scanned(doc: string): readonly number[] {
  return EditorState.create({ doc, extensions: [mathDelimiterLines] }).field(mathDelimiterLines)
}

// Deterministic PRNG so a failing edit sequence can be replayed.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LINE_POOL = ['$$', '  $$ ', '$$x', 'text $$', 'x = 1', '', '```', '- item']
const INSERT_POOL = ['$$', '\n', '$$\n', '\n$$', 'a', ' ', '\n\n', '$', '```\n', 'x\n$$\ny']

function randomDoc(rand: () => number, lines: number): string {
  return Array.from({ length: lines }, () => LINE_POOL[Math.floor(rand() * LINE_POOL.length)]).join('\n')
}

function randomChanges(rand: () => number, length: number): ChangeSpec[] {
  const count = 1 + Math.floor(rand() * 3)
  const cuts = Array.from({ length: count * 2 }, () => Math.floor(rand() * (length + 1))).sort((a, b) => a - b)
  const changes: ChangeSpec[] = []
  for (let i = 0; i < cuts.length; i += 2) {
    const from = cuts[i]
    // Keep ranges disjoint: a change may not start inside the previous one.
    if (i > 0 && from < cuts[i - 1]) continue
    const to = rand() < 0.5 ? from : cuts[i + 1]
    const insert = rand() < 0.3 ? '' : INSERT_POOL[Math.floor(rand() * INSERT_POOL.length)]
    changes.push({ from, to, insert })
  }
  return changes
}

describe('mathDelimiterLines', () => {
  it('records the start of every line whose trimmed text is $$', () => {
    expect(scanned('$$\na\n  $$  \n$$x\ntext $$\n$$')).toEqual([0, 5, 24])
  })

  it('matches a full rescan after random multi-range edits', () => {
    const rand = mulberry32(4828)
    for (let round = 0; round < 200; round++) {
      let state = EditorState.create({ doc: randomDoc(rand, 12), extensions: [mathDelimiterLines] })
      for (let step = 0; step < 15; step++) {
        const changes = randomChanges(rand, state.doc.length)
        state = state.update({ changes }).state
        const doc = state.doc.toString()
        expect(state.field(mathDelimiterLines), `round ${round} step ${step}: ${JSON.stringify(doc)}`).toEqual(
          scanned(doc)
        )
      }
    }
  })

  it('tracks a delimiter line split and joined by newline edits', () => {
    let state = EditorState.create({ doc: 'a\n$$\nb', extensions: [mathDelimiterLines] })
    // Join `$$` onto the previous line, then split it back out.
    state = state.update({ changes: { from: 1, to: 2 } }).state
    expect(state.field(mathDelimiterLines)).toEqual([])
    state = state.update({ changes: { from: 1, insert: '\n' } }).state
    expect(state.field(mathDelimiterLines)).toEqual([2])
  })
})

function blockRanges(set: DecorationSet): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const cursor = set.iter(); cursor.value; cursor.next()) {
    if ((cursor.value.spec as { block?: boolean }).block) out.push([cursor.from, cursor.to])
  }
  return out
}

describe('display math pairing with tracked delimiters', () => {
  const doc = [
    '```',
    '$$',
    '```',
    '',
    '$$',
    'E=mc^2',
    '$$',
    '',
    '- item',
    '  ```',
    '  $$',
    '  ```',
    '',
    '$$',
    'a+b',
    '$$',
    ''
  ].join('\n')

  it('skips $$ inside top-level and list-nested fences', () => {
    const state = EditorState.create({ doc, extensions: [mathDelimiterLines] })
    const { decorations } = buildLivePreviewDecorations(state, mdParser.parse(doc), false)
    const first = doc.indexOf('$$\nE=mc^2')
    const second = doc.indexOf('$$\na+b')
    expect(blockRanges(decorations)).toEqual([
      [first, first + '$$\nE=mc^2\n$$'.length],
      [second, second + '$$\na+b\n$$'.length]
    ])
  })

  it('pairs the same blocks as a full scan without the field', () => {
    const tree = mdParser.parse(doc)
    const withField = EditorState.create({ doc, extensions: [mathDelimiterLines] })
    const without = EditorState.create({ doc })
    expect(blockRanges(buildLivePreviewDecorations(withField, tree, false).decorations)).toEqual(
      blockRanges(buildLivePreviewDecorations(without, tree, false).decorations)
    )
  })
})
