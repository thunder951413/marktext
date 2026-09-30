import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { createMarkdownLanguage } from '../markdown'
import { buildSearchDecorations, computeMatches, searchField, setSearchEffect } from '../features/search'
import { consumePastePayload, removeImagePlaceholder, replaceImagePlaceholder } from '../features/clipboard'
import { getTocItems as extractTocItems } from '../features/toc'
import { WysiwygEditor } from '../editor'

const views: EditorView[] = []

function makeView(doc: string, cursor = 0): EditorView {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const view = new EditorView({
    parent: host,
    doc,
    selection: { anchor: cursor },
    extensions: [createMarkdownLanguage(), searchField]
  })
  views.push(view)
  return view
}

afterEach(() => {
  while (views.length) views.pop()!.destroy()
})

describe('search matching', () => {
  it('finds plain matches case-insensitively by default', () => {
    expect(computeMatches('aBc abc ABC', 'abc')).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 8, to: 11 }
    ])
  })

  it('honors case sensitivity', () => {
    expect(computeMatches('aBc abc', 'abc', { caseSensitive: true })).toEqual([{ from: 4, to: 7 }])
  })

  it('supports regex queries and guards zero-width loops', () => {
    const matches = computeMatches('foo bar foo', 'f(o+)', { regexp: true })
    expect(matches).toEqual([
      { from: 0, to: 3 },
      { from: 8, to: 11 }
    ])
    expect(computeMatches('abc', 'x*', { regexp: true })).toEqual([])
  })

  it('returns nothing for empty or invalid patterns', () => {
    expect(computeMatches('text', '')).toEqual([])
    expect(computeMatches('text', '([', { regexp: true })).toEqual([])
  })
})

describe('search decorations', () => {
  it('marks all matches and distinguishes the active one', () => {
    const set = buildSearchDecorations(
      {
        matches: [
          { from: 0, to: 2 },
          { from: 5, to: 7 }
        ],
        active: 1
      },
      10
    )
    const classes: string[] = []
    const cursor = set.iter()
    while (cursor.value) {
      classes.push((cursor.value.spec as { class?: string }).class ?? '')
      cursor.next()
    }
    expect(classes).toEqual(['mu-selection', 'mu-highlight'])
  })

  it('drops out-of-range matches', () => {
    const set = buildSearchDecorations({ matches: [{ from: 8, to: 12 }], active: 0 }, 10)
    expect(set.size).toBe(0)
  })
})

describe('editor search API', () => {
  it('searches, walks with wrap-around, and replaces single/all', () => {
    const editor = new WysiwygEditor(document.createElement('div'), { markdown: 'cat dog cat' })
    editor.init()

    expect(editor.search('cat')).toBe(2)
    editor.find('next')
    let state = editor.getSearchState()
    expect(state.index).toBe(1)

    // Wrap past the end back to the first match.
    editor.find('next')
    state = editor.getSearchState()
    expect(state.index).toBe(0)

    expect(editor.replace('fish', { isSingle: true })).toBe(1)
    expect(editor.getMarkdown()).toBe('fish dog cat')

    expect(editor.replace('trout')).toBe(1)
    expect(editor.getMarkdown()).toBe('fish dog trout')

    editor.clearSearch()
    expect(editor.getSearchState().matches).toEqual([])
  })

  it('keeps highlight anchors mapped through incremental edits', () => {
    const view = makeView('one two three')
    view.dispatch({ effects: setSearchEffect.of({ matches: [{ from: 4, to: 7 }], active: 0 }) })
    // Typing 'XX ' before the match shifts it; the field must follow.
    view.dispatch({ changes: { from: 4, insert: 'XX ' }, userEvent: 'input.type' })
    const value = view.state.field(searchField)
    expect(value.matches[0]).toEqual({ from: 7, to: 10 })
  })
})

describe('paste pipeline', () => {
  const hooksWithImage = () => ({
    imageAction: async({ src }: { src: string }) => `uploaded/${src.split(',').pop()}.png`
  })

  it('routes image payloads through a placeholder swap', async() => {
    const view = makeView('')
    const consumed = await new Promise<boolean>(resolve => {
      const ok = consumePastePayload(
        view,
        {
          files: [{ type: 'image/png', name: 'x.png' }],
          readFileAsDataUrl: async() => 'data:image/png;base64,AAA'
        },
        hooksWithImage() as never
      )
      resolve(ok)
    })
    expect(consumed).toBe(true)
    await waitForAssertion(() => expect(view.state.doc.toString()).toBe('![img](uploaded/AAA.png)'))
  })

  it('removes the placeholder when the action fails', async() => {
    const view = makeView('')
    consumePastePayload(
      view,
      {
        files: [{ type: 'image/png', name: 'x.png' }],
        readFileAsDataUrl: async() => 'data:image/png;base64,AAA'
      },
      {
        imageAction: async() => {
          throw new Error('upload denied')
        }
      } as never
    )
    await waitForAssertion(() => expect(view.state.doc.toString()).toBe(''))
  })

  it('converts rich html via the injected converter', () => {
    const view = makeView('')
    const consumed = consumePastePayload(
      view,
      { text: '<b>hi</b>', html: '<b>hi</b>' },
      { htmlToMarkdown: html => html.replace(/<\/?b>/g, '**') }
    )
    expect(consumed).toBe(true)
    expect(view.state.doc.toString()).toBe('**hi**')
  })

  it('leaves plain text to default insertion', () => {
    const view = makeView('')
    expect(consumePastePayload(view, { text: 'plain' }, {})).toBe(false)
  })

  it('swaps and removes placeholders by token', () => {
    const view = makeView('![loading-7]()')
    replaceImagePlaceholder(view, 'loading-7', '/final.png')
    expect(view.state.doc.toString()).toBe('![img](/final.png)')
    removeImagePlaceholder(view, 'nope')
    expect(view.state.doc.toString()).toBe('![img](/final.png)')
  })
})

function waitForAssertion(assertion: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      try {
        assertion()
        resolve()
      } catch (error) {
        if (Date.now() - start > 1000) reject(error)
        else setTimeout(tick, 10)
      }
    }
    tick()
  })
}

describe('toc extraction', () => {
  it('extracts headings in document order with github slugs', () => {
    const doc = '# Alpha\n\nbody\n\n## Beta\n\n### Alpha\n\nsetext\n======\n'
    const view = makeView(doc)
    const items = extractTocItems(view)
    expect(items.map(i => [i.lvl, i.text])).toEqual([
      [1, 'Alpha'],
      [2, 'Beta'],
      [3, 'Alpha'],
      [1, 'setext']
    ])
    expect(items[0].slug).toBe('alpha')
    // Duplicate heading gets the GitHub -1 suffix.
    expect(items[2].slug).toBe('alpha-1')
  })

  it('scrolls to a heading by moving the caret onto its line', () => {
    const editor = new WysiwygEditor(document.createElement('div'), {
      markdown: '# First\n\ntext\n\n## Second\n'
    })
    editor.init()
    const toc = editor.getTOC()
    expect(toc).toHaveLength(2)
    // jsdom cannot measure client rects for real scrolling; selection-only.
    expect(editor.scrollToHeading('second', { scroll: false })).toBe(true)
    expect(editor.getCursorOffset()?.anchor.line).toBe(4)
    expect(editor.scrollToHeading('missing')).toBe(false)
  })
})

describe('search option aliases', () => {
  it('accepts muya-style is* flags and whole-word filtering', () => {
    expect(computeMatches('Apple apple pineapple', 'apple', { isCaseSensitive: true })).toEqual([
      { from: 6, to: 11 },
      { from: 16, to: 21 }
    ])
    expect(computeMatches('apple pineapple', 'apple', { isWholeWord: true })).toEqual([
      { from: 0, to: 5 }
    ])
    expect(computeMatches('abc abc', 'b+', { isRegexp: true, isWholeWord: true })).toEqual([])
  })
})
