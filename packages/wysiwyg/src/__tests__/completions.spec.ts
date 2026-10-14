import { CompletionContext } from '@codemirror/autocomplete'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { emojiSource, fenceLanguageSource } from '../features/completions'
import { createMarkdownLanguage } from '../markdown'

function contextAt(doc: string, pos = doc.length, explicit = false) {
  const state = EditorState.create({ doc, extensions: [createMarkdownLanguage()] })
  ensureSyntaxTree(state, state.doc.length, 1000)
  return new CompletionContext(state, pos, explicit)
}

describe('code fence language completion', () => {
  it('offers languages after an opening fence', () => {
    const result = fenceLanguageSource(contextAt('text\n\n```ty'))
    expect(result).not.toBeNull()
    expect(result!.from).toBe('text\n\n```'.length)
    const labels = result!.options.map(o => o.label)
    expect(labels).toEqual(expect.arrayContaining(['typescript', 'python', 'mermaid']))
    // Labels are unique even though languages share aliases.
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('stays quiet on closing fences and ordinary text', () => {
    expect(fenceLanguageSource(contextAt('```js\nconst a = 1\n```'))).toBeNull()
    expect(fenceLanguageSource(contextAt('plain text'))).toBeNull()
  })
})

describe('emoji completion', () => {
  it('completes :shortcodes to the emoji character', async() => {
    const result = await emojiSource(contextAt('Nice work :smil'))
    expect(result).not.toBeNull()
    expect(result!.from).toBe('Nice work '.length)
    const smile = result!.options.find(o => o.label === ':smile:')
    expect(smile?.apply).toBe('😄')
  })

  it('ignores colons inside words, times and single characters', async() => {
    expect(await emojiSource(contextAt('Note:ab'))).toBeNull()
    expect(await emojiSource(contextAt('at 10:30'))).toBeNull()
    expect(await emojiSource(contextAt('hey :s'))).toBeNull()
  })
})
