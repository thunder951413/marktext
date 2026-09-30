import { describe, expect, it } from 'vitest'
import { WysiwygEditor } from '../editor'

function mount(markdown: string, cursor: number) {
  const editor = new WysiwygEditor(document.createElement('div'), { markdown })
  editor.init()
  editor.setCursorByOffset({ anchor: { line: cursor, ch: 0 }, focus: { line: cursor, ch: 0 } })
  return editor
}

describe('inline formatting', () => {
  it('wraps a selection and unwraps on repeat', () => {
    const editor = new WysiwygEditor(document.createElement('div'), { markdown: 'hello world' })
    editor.init()
    // Select 'world' via the compat selection shape.
    editor.setSelectionRange(6, 11)
    expect(editor.format('strong')).toBe(true)
    expect(editor.getMarkdown()).toBe('hello **world**')

    // Selection now covers the inner text; formatting again unwraps.
    expect(editor.format('strong')).toBe(true)
    expect(editor.getMarkdown()).toBe('hello world')
  })

  it('inserts a marker pair at a collapsed caret', () => {
    const editor = new WysiwygEditor(document.createElement('div'), { markdown: 'ab' })
    editor.init()
    editor.setSelectionRange(1, 1)
    editor.format('em')
    expect(editor.getMarkdown()).toBe('a**b')
    // The caret sits between the two asterisks.
    expect(editor.getSelection()?.anchor.offset).toBe(2)
  })

  it('clears all inline markers inside the selection', () => {
    const editor = new WysiwygEditor(document.createElement('div'), {
      markdown: '**bold *it*~~del~~**'
    })
    editor.init()
    editor.setSelectionRange(0, 20)
    editor.format('clear')
    expect(editor.getMarkdown()).toBe('bold itdel')
  })
})

describe('paragraph conversion', () => {
  it('converts to headings of any level', () => {
    const editor = mount('some text', 0)
    expect(editor.updateParagraph('heading 2')).toBe(true)
    expect(editor.getMarkdown()).toBe('## some text')
    editor.updateParagraph('heading 4')
    expect(editor.getMarkdown()).toBe('#### some text')
  })

  it('resets lists, quotes and headings back to plain paragraphs', () => {
    const editor = mount('- [ ] task item', 0)
    editor.updateParagraph('reset-to-paragraph')
    expect(editor.getMarkdown()).toBe('task item')
    editor.updateParagraph('blockquote')
    expect(editor.getMarkdown()).toBe('> task item')
    editor.updateParagraph('reset-to-paragraph')
    expect(editor.getMarkdown()).toBe('task item')
  })

  it('wraps fenced code and math blocks', () => {
    const editor = mount('code line', 0)
    editor.updateParagraph('pre')
    expect(editor.getMarkdown()).toBe('```\ncode line\n```')
    const editor2 = mount('$x$', 0)
    editor2.updateParagraph('mathblock')
    expect(editor2.getMarkdown()).toBe('$$\n$x$\n$$')
  })

  it('renumbers ordered lists per line within the block', () => {
    const editor = mount('first\nsecond', 0)
    editor.updateParagraph('ol-numeric')
    expect(editor.getMarkdown()).toBe('1. first\n2. second')
  })
})

describe('block operations', () => {
  it('duplicates the block below the caret', () => {
    const editor = mount('# Title\n\nbody', 0)
    editor.duplicate()
    expect(editor.getMarkdown()).toBe('# Title\n# Title\n\nbody')
  })

  it('inserts an empty paragraph after the block', () => {
    const editor = mount('para one', 0)
    editor.insertParagraph()
    expect(editor.getMarkdown()).toBe('para one\n\n')
  })

  it('deletes the last block together with its preceding newline', () => {
    const editor = mount('# keep\n\ndrop me', 0)
    editor.setCursorByOffset({ anchor: { line: 2, ch: 0 }, focus: { line: 2, ch: 0 } })
    editor.deleteParagraph()
    expect(editor.getMarkdown()).toBe('# keep\n')
  })
})

describe('muya contract odds and ends', () => {
  it('replaces the current word for spellcheck corrections', () => {
    const editor = new WysiwygEditor(document.createElement('div'), { markdown: 'teh quick plan' })
    editor.init()
    editor.setSelectionRange(14, 14)
    expect(editor.replaceCurrentWordInlineUnsafe('teh', 'the')).toBe(true)
    expect(editor.getMarkdown()).toBe('the quick plan')
    expect(editor.replaceCurrentWordInlineUnsafe('missing', 'x')).toBe(false)
  })

  it('round-trips undo history through the opaque token', () => {
    const editorA = new WysiwygEditor(document.createElement('div'), { markdown: '# A\n' })
    editorA.init()
    editorA.setContent('# A\n\nmore text\n')
    const token = editorA.getHistory()

    const editorB = new WysiwygEditor(document.createElement('div'), { markdown: '# B\n' })
    editorB.init()
    // Tab switch: B hands its state over, then receives A's state back.
    const tokenB = editorB.getHistory()
    editorA.setHistory(tokenB)
    expect(editorA.getMarkdown()).toBe('# B\n')
    editorA.setHistory(token)
    expect(editorA.getMarkdown()).toBe('# A\n\nmore text\n')
  })

  it('exposes muya-shaped selections for serializeCursor', () => {
    const editor = new WysiwygEditor(document.createElement('div'), { markdown: 'abcdef' })
    editor.init()
    editor.setSelectionRange(2, 5)
    expect(editor.getSelection()).toEqual({
      anchor: { offset: 2 },
      focus: { offset: 5 }
    })
    editor.setCursor({ anchor: { offset: 3 } })
    expect(editor.getSelection()?.anchor.offset).toBe(3)
  })

  it('accepts locale dictionaries and no-op float calls safely', () => {
    const editor = new WysiwygEditor(document.createElement('div'))
    editor.locale({ bold: 'Bold' })
    expect(() => editor.hideAllFloatTools()).not.toThrow()
    expect(() => editor.invalidateImageCache()).not.toThrow()
    expect(editor.getState()).toBeNull()
  })
})
