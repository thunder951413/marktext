import { EditorState } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { GFM, parser as baseParser } from '@lezer/markdown'
import { buildLivePreviewDecorations, LARGE_DOCUMENT_THRESHOLD } from '../decorations/livePreview'
import { highlightExtension } from '../markdown'

const mdParser = baseParser.configure([GFM, highlightExtension])

function ranges(set: DecorationSet): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const cursor = set.iter(); cursor.value; cursor.next()) out.push([cursor.from, cursor.to])
  return out
}

function section(i: number): string {
  return `## Heading ${i}\n\nSome **bold** text and *em* ${i}.\n\n- item ${i}\n- item b\n\n`
}

describe('large document decoration window', () => {
  it('only decorates inside the requested window', () => {
    const doc = Array.from({ length: 400 }, (_, i) => section(i)).join('')
    expect(doc.length).toBeGreaterThan(LARGE_DOCUMENT_THRESHOLD / 2)
    const state = EditorState.create({ doc })
    const from = Math.floor(doc.length / 2)
    const to = from + 2000
    const { decorations } = buildLivePreviewDecorations(state, mdParser.parse(doc), false, {}, { from, to })
    const decorated = ranges(decorations)
    expect(decorated.length).toBeGreaterThan(0)
    // Line decorations sit at a line start, which may precede `from` by at
    // most one line; nothing may land far outside the window.
    for (const [a, b] of decorated) {
      expect(b).toBeGreaterThanOrEqual(from - 200)
      expect(a).toBeLessThanOrEqual(to)
    }
  })

  it('matches the full build inside the window', () => {
    const doc = Array.from({ length: 50 }, (_, i) => section(i)).join('')
    const state = EditorState.create({ doc })
    const tree = mdParser.parse(doc)
    const from = state.doc.line(40).from
    const to = state.doc.line(80).to
    const inside = ([a, b]: [number, number]) => a >= from && b <= to
    const full = ranges(buildLivePreviewDecorations(state, tree, false, {}).decorations).filter(inside)
    const windowed = ranges(buildLivePreviewDecorations(state, tree, false, {}, { from, to }).decorations).filter(inside)
    expect(windowed).toEqual(full)
  })

  it('pairs display math across fenced code blocks in one linear pass', () => {
    const doc = [
      '```',
      '$$',
      '```',
      '',
      '$$',
      'a+b',
      '$$',
      '',
      '```js',
      '$$',
      'not math',
      '```',
      '',
      '$$',
      'c',
      '$$',
      ''
    ].join('\n')
    const state = EditorState.create({ doc })
    const { decorations } = buildLivePreviewDecorations(state, mdParser.parse(doc), false, { mathEnabled: true })
    const blocks: Array<[number, number]> = []
    for (const cursor = decorations.iter(); cursor.value; cursor.next()) {
      const spec = cursor.value.spec as { block?: boolean }
      if (spec.block) blocks.push([cursor.from, cursor.to])
    }
    const first = doc.indexOf('$$\na+b')
    const second = doc.indexOf('$$\nc')
    expect(blocks).toEqual([
      [first, first + '$$\na+b\n$$'.length],
      [second, second + '$$\nc\n$$'.length]
    ])
  })
})
