import { EditorState } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { GFM, parser as baseParser } from '@lezer/markdown'
import { buildLivePreviewDecorations } from '../decorations/livePreview'
import { highlightExtension } from '../markdown'

const mdParser = baseParser.configure([GFM, highlightExtension])

interface CollectedDeco {
  from: number
  to: number
  kind: 'replace' | 'mark' | 'line' | 'widget'
  cls?: string
}

function collect(set: DecorationSet): CollectedDeco[] {
  const out: CollectedDeco[] = []
  const cursor = set.iter()
  while (cursor.value) {
    const spec = cursor.value.spec as { class?: string; widget?: unknown }
    const kind: CollectedDeco['kind'] = spec.widget
      ? 'widget'
      : spec.class?.startsWith('wysiwyg-line')
        ? 'line'
        : spec.class
          ? 'mark'
          : 'replace'
    out.push({
      from: cursor.from,
      to: cursor.to,
      kind,
      cls: spec.class
    })
    cursor.next()
  }
  return out
}

function build(doc: string, selectionFrom?: number, selectionTo?: number) {
  const state = EditorState.create({
    doc,
    selection:
      selectionFrom == null
        ? undefined
        : { anchor: selectionFrom, head: selectionTo ?? selectionFrom }
  })
  return buildLivePreviewDecorations(state, mdParser.parse(doc), false, {})
}

describe('live preview decorations', () => {
  it('hides strong/emphasis marks when the cursor is away', () => {
    const doc = 'hello **bold** world'
    // marks at 6..8 and 12..14. Cursor at 0 stays clear of the element.
    const { decorations } = build(doc, 0)
    const replaces = collect(decorations).filter(d => d.kind === 'replace')
    expect(replaces.map(r => [r.from, r.to])).toEqual(
      expect.arrayContaining([
        [6, 8],
        [12, 14]
      ])
    )
  })

  it('reveals marks while the cursor is anywhere inside the element', () => {
    const doc = 'hello **bold** world'
    const { decorations } = build(doc, 10)
    const replaces = collect(decorations).filter(d => d.kind === 'replace')
    expect(replaces.filter(r => r.to <= 14 && r.from >= 6)).toEqual([])
  })

  it('styles the inner text of inline containers', () => {
    const doc = 'plain **strong** end'
    const { decorations } = build(doc, 0)
    const mark = collect(decorations).find(d => d.kind === 'mark' && d.cls === 'wysiwyg-strong')
    expect([mark?.from, mark?.to]).toEqual([8, 14])
  })

  it('styles strikethrough and custom highlights', () => {
    const doc = '~~gone==and==now~~ text ==lit== tail'
    const { decorations } = build(doc, doc.length - 1)
    const classes = collect(decorations).filter(d => d.kind === 'mark').map(d => d.cls)
    expect(classes).toContain('wysiwyg-del')
    expect(classes).toContain('wysiwyg-highlight')
  })

  it('decorates heading lines and hides the hashes', () => {
    const doc = '# Title\n\nbody'
    const result = build(doc, doc.length - 1)
    const line = collect(result.decorations).find(d => d.kind === 'line' && d.cls === 'wysiwyg-line-wysiwyg-h1')
    expect(line?.from).toBe(0)
    const hashHide = collect(result.decorations).filter(d => d.kind === 'replace')
    expect(hashHide.some(h => h.from === 0 && h.to === 1)).toBe(true)
  })

  it('collapses images into a widget away from the cursor', () => {
    const doc = 'before ![alt text](img.png) after'
    const imgStart = doc.indexOf('![')
    const { decorations } = build(doc, 0)
    const widgets = collect(decorations).filter(d => d.kind === 'widget')
    expect(widgets).toHaveLength(1)
    expect(widgets[0].from).toBe(imgStart)

    const revealed = build(doc, imgStart + 3)
    expect(collect(revealed.decorations).filter(d => d.kind === 'widget')).toEqual([])
  })

  it('hides link URLs but keeps the label', () => {
    const doc = 'see [label](https://example.com/x) end'
    const { decorations } = build(doc, 0)
    const urlHide = collect(decorations)
      .filter(d => d.kind === 'replace')
      .find(h => doc.slice(h.from, h.to) === 'https://example.com/x')
    expect(urlHide).toBeDefined()
  })

  it('reveals everything during IME composition', () => {
    const doc = 'hello **bold** world'
    const state = EditorState.create({ doc })
    const result = buildLivePreviewDecorations(state, mdParser.parse(doc), true, {})
    expect(collect(result.decorations).filter(d => d.kind === 'replace')).toEqual([])
  })

  it('keeps horizontal rules collapsed away from the cursor', () => {
    const doc = 'above\n\n---\n\nbelow'
    const { decorations } = build(doc, doc.length - 1)
    expect(collect(decorations).filter(d => d.kind === 'widget')).toHaveLength(1)
  })
})
