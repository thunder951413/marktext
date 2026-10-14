import { describe, expect, it } from 'vitest'
import { WysiwygEditor } from '../editor'
import { getCursorContext } from '../features/context'

function mount(markdown: string) {
  const editor = new WysiwygEditor(document.createElement('div'), { markdown })
  editor.init()
  return editor
}

function contextAt(markdown: string, line: number, ch: number) {
  const editor = mount(markdown)
  editor.setCursorByOffset({ anchor: { line, ch }, focus: { line, ch } })
  // @ts-expect-error peek at the private view for the pure helper
  const context = getCursorContext(editor.view)
  editor.destroy()
  return context
}

describe('cursor context', () => {
  it('classifies headings and paragraphs', () => {
    expect(contextAt('# Title\n\nbody', 0, 2).affiliation).toEqual([{ type: 'h1' }])
    expect(contextAt('# Title\n\nbody', 2, 1).affiliation).toEqual([{ type: 'p' }])
  })

  it('classifies list kinds including tasks', () => {
    const bullet = contextAt('- one\n- two', 0, 2)
    expect(bullet.affiliation).toContainEqual({ type: 'ul', listType: 'bullet', isLooseListItem: false })
    expect(bullet.affiliation).toContainEqual({ type: 'li' })

    const task = contextAt('- [ ] open item', 0, 5)
    expect(task.affiliation.find(a => a.type === 'ul')?.listType).toBe('task')

    const ordered = contextAt('1. first', 0, 2)
    expect(ordered.affiliation).toContainEqual({ type: 'ol', isLooseListItem: false })
  })

  it('classifies quotes, fences, tables and front matter', () => {
    expect(contextAt('> quoted', 0, 3).affiliation).toContainEqual({ type: 'blockquote' })
    expect(contextAt('```ts\ncode\n```', 1, 1).affiliation).toContainEqual({
      type: 'pre',
      functionType: 'code'
    })
    expect(contextAt('| a | b |\n| --- | --- |', 0, 3).affiliation).toContainEqual({
      type: 'figure',
      functionType: 'table'
    })
    expect(contextAt('---\ntitle: x\n---\n', 1, 2).affiliation).toContainEqual({
      type: 'pre',
      functionType: 'frontmatter'
    })
  })

  it('marks fenced endpoints as code content', () => {
    const ctx = contextAt('```\nlet a = 1\n```', 1, 3)
    expect(ctx.anchor.functionType).toBe('codeContent')
    expect(ctx.anchor.type).toBe('span')
  })

  it('reports display math via line scanning', () => {
    expect(contextAt('$$\nx = 1\n$$', 1, 1).affiliation).toContainEqual({
      type: 'pre',
      functionType: 'multiplemath'
    })
    // $$ inside a fence is not math.
    expect(contextAt('```\n$$\n```', 1, 0).affiliation).not.toContainEqual({
      type: 'pre',
      functionType: 'multiplemath'
    })
  })

  it('collects active inline formats at the caret', () => {
    const editor = mount('plain **bold** tail')
    editor.setSelectionRange(9, 9)
    // @ts-expect-error peek at the private view
    const ctx = getCursorContext(editor.view)
    expect(ctx.formats).toContainEqual({ type: 'strong' })
  })

  it('flags front matter presence', () => {
    expect(contextAt('---\ntitle: x\n---\n\nbody', 4, 1).hasFrontMatter).toBe(true)
    expect(contextAt('body only', 0, 1).hasFrontMatter).toBe(false)
  })
})

describe('cursor context additions', () => {
  it('detects horizontal rules', () => {
    expect(contextAt('before\n\n---\n\nafter', 2, 1).affiliation).toContainEqual({ type: 'hr' })
  })

  it('flags loose bullet lists', () => {
    const ctx = contextAt('- one\n\n- two\n', 0, 3)
    const ul = ctx.affiliation.find(a => a.type === 'ul')
    expect(ul?.isLooseListItem).toBe(true)
    const tight = contextAt('- one\n- two\n', 0, 3)
    const ul2 = tight.affiliation.find(a => a.type === 'ul')
    expect(ul2?.isLooseListItem).toBe(false)
  })
})
