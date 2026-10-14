import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { GFM, parser as baseParser } from '@lezer/markdown'
import type { WidgetType } from '@codemirror/view'
import { buildLivePreviewDecorations } from '../decorations/livePreview'
import { highlightExtension, inlineMathExtension } from '../markdown'
import { toggleTaskAt } from '../features/tasks'
import { createDefaultDiagramRenderer } from '../features/diagrams'

const mdParser = baseParser.configure([GFM, highlightExtension, inlineMathExtension])

interface Collected {
  from: number
  to: number
  kind: string
  cls?: string
  widget?: WidgetType
  attrs?: Record<string, string>
}

function collect(state: EditorState, opts?: Parameters<typeof buildLivePreviewDecorations>[3]): Collected[] {
  const { decorations } = buildLivePreviewDecorations(state, mdParser.parse(state.doc.toString()), false, opts)
  const out: Collected[] = []
  const cursor = decorations.iter()
  while (cursor.value) {
    const spec = cursor.value.spec as {
      class?: string
      widget?: WidgetType
      attributes?: Record<string, string>
    }
    const isLineClass =
      spec.class?.startsWith('wysiwyg-line') ||
      spec.class === 'wysiwyg-frontmatter' ||
      spec.class === 'wysiwyg-code-line'
    out.push({
      from: cursor.from,
      to: cursor.to,
      kind: spec.widget ? ((spec.widget as { kind?: string }).kind ?? 'widget') : isLineClass ? 'line' : spec.class ? 'mark' : 'replace',
      cls: spec.class,
      widget: spec.widget,
      attrs: spec.attributes
    })
    cursor.next()
  }
  return out
}

function renderWidgetDom(entry: Collected | undefined): HTMLElement {
  if (!entry?.widget) throw new Error('expected a widget entry')
  return (entry.widget as unknown as { toDOM: () => HTMLElement }).toDOM()
}

describe('math features', () => {
  it('collapses inline math into a KaTeX widget away from the caret', () => {
    const state = EditorState.create({ doc: 'value $a^2+b$ end' })
    const math = collect(state).find(d => d.kind === 'math')
    expect(renderWidgetDom(math).innerHTML).toContain('katex')
  })

  it('keeps inline math raw when the caret is inside it', () => {
    const state = EditorState.create({ doc: 'value $a+b$ end', selection: { anchor: 9 } })
    expect(collect(state).filter(d => d.kind === 'math')).toEqual([])
  })

  it('renders display math blocks and ignores $$ inside fences', () => {
    const doc = '$$\nE=mc^2\n$$\n\n```\n$$\n```\n'
    const state = EditorState.create({ doc })
    const blocks = collect(state).filter(d => d.kind === 'math')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].from).toBe(0)
  })

  it('ignores currency-style dollar usage', () => {
    const state = EditorState.create({ doc: 'it costs $5 today' })
    expect(collect(state).filter(d => d.kind === 'math')).toEqual([])
  })
})

describe('image widgets', () => {
  it('renders an img element with the parsed source', () => {
    const state = EditorState.create({ doc: 'text ![cat](/img/cat.png) tail' })
    const image = collect(state).find(d => d.kind === 'image')
    const dom = renderWidgetDom(image)
    expect(dom.tagName).toBe('IMG')
    expect(dom.getAttribute('src')).toBe('/img/cat.png')
    expect(dom.getAttribute('alt')).toBe('cat')
  })
})

describe('task list checkboxes', () => {
  it('replaces task markers with checkbox widgets carrying checked state', () => {
    const state = EditorState.create({ doc: '- [ ] open\n- [x] done' })
    const tasks = collect(state).filter(d => d.kind === 'task')
    expect(tasks).toHaveLength(2)
    const checkedStates = tasks.map(t => (t.widget as unknown as { checked: boolean }).checked)
    expect(checkedStates).toEqual([false, true])
  })

  it('toggles the underlying markdown on click', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = new EditorView({ parent: host, doc: '- [ ] ship phase two' })
    expect(toggleTaskAt(view, 2)).toBe(true)
    expect(view.state.doc.toString()).toBe('- [x] ship phase two')
    expect(toggleTaskAt(view, 2)).toBe(true)
    expect(view.state.doc.toString()).toBe('- [ ] ship phase two')
    view.destroy()
  })

  it('reports false for non-task positions', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = new EditorView({ parent: host, doc: 'plain paragraph' })
    expect(toggleTaskAt(view, 0)).toBe(false)
    view.destroy()
  })
})

describe('code block line numbers', () => {
  const doc = '```ts\nlet a = 1\nlet b = 2\n```\n'

  it('adds data-lineno line decorations when enabled', () => {
    const state = EditorState.create({ doc })
    const numbered = collect(state, { codeBlockLineNumbers: true }).filter(d => d.attrs?.['data-lineno'])
    expect(numbered.map(l => l.attrs?.['data-lineno'])).toEqual(['1', '2'])
  })

  it('does not add them by default', () => {
    const state = EditorState.create({ doc })
    expect(collect(state).filter(d => d.attrs?.['data-lineno'])).toEqual([])
  })
})

describe('front matter styling', () => {
  it('decorates the leading front matter block', () => {
    const doc = '---\ntitle: hi\n---\n\nbody'
    const state = EditorState.create({ doc })
    const styled = collect(state)
      .filter(d => d.cls === 'wysiwyg-frontmatter')
      .map(d => d.from)
    expect(styled).toEqual([0, 4, 14])
  })

  it('ignores a stray --- that is not front matter', () => {
    const state = EditorState.create({ doc: 'intro\n\n---\n\noutro' })
    const fmCount = collect(state).filter(d => d.cls === 'wysiwyg-frontmatter').length
    expect(fmCount).toBe(0)
  })
})

describe('html block preview', () => {
  it('renders sanitized html when a sanitizer is provided', () => {
    const doc = '<div class="x">hi</div>\n\nafter'
    // Keep the caret away from the block; touching it reveals raw source.
    const state = EditorState.create({ doc, selection: { anchor: doc.length } })
    const htmls = collect(state, { htmlPreviewEnabled: true, sanitizeHtml: s => s.replace(/<script[\s\S]*?<\/script>/g, '') }).filter(
      d => d.kind === 'html'
    )
    expect(htmls).toHaveLength(1)
    const dom = renderWidgetDom(htmls[0])
    expect(dom.querySelector('script')).toBeNull()
    expect(dom.textContent).toContain('hi')
  })

  it('shows raw text when previews are disabled', () => {
    const state = EditorState.create({ doc: '<div class="x">hi</div>\n\nafter', selection: { anchor: 30 } })
    expect(collect(state, { htmlPreviewEnabled: false, sanitizeHtml: s => s }).filter(d => d.kind === 'html')).toEqual([])
  })
})

describe('default diagram renderer', () => {
  it('rejects unknown diagram languages without rendering', async() => {
    const renderer = createDefaultDiagramRenderer()
    const container = document.createElement('div')
    await expect(renderer('x', 'nope', container)).rejects.toThrow('Unknown diagram language')
  })

  it('surfaces invalid specs as rejections', async() => {
    const renderer = createDefaultDiagramRenderer()
    const container = document.createElement('div')
    await expect(renderer('not json', 'vega-lite', container)).rejects.toThrow()
  })
})
