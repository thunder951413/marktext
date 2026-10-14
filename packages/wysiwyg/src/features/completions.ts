import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { languages } from '@codemirror/language-data'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

/**
 * Inline pickers that replace Muya's floating CodeBlockLanguageSelector and
 * EmojiSelector: completions on a code fence's info string and on `:name`.
 */

let languageOptions: Completion[] | null = null

function languageCompletions(): Completion[] {
  if (languageOptions) return languageOptions
  const seen = new Set<string>()
  const options: Completion[] = []
  const add = (label: string, detail?: string) => {
    const key = label.toLowerCase()
    if (!key || seen.has(key) || /\s/.test(key)) return
    seen.add(key)
    options.push({ label: key, detail, type: 'type' })
  }
  for (const lang of languages) {
    add(lang.name, undefined)
    for (const alias of lang.alias) add(alias, lang.name)
  }
  // Diagram fences rendered by the live preview.
  for (const diagram of ['mermaid', 'plantuml', 'flowchart', 'sequence', 'vega-lite', 'math']) add(diagram, 'diagram')
  languageOptions = options
  return options
}

/** ```lang — completes the info string right after an opening fence. */
export function fenceLanguageSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const match = /^\s{0,3}(`{3,}|~{3,})([\w+#.-]*)$/.exec(before)
  if (!match) return null
  // A fence line inside an existing code block is its closing fence.
  for (let node: SyntaxNode | null = syntaxTree(context.state).resolveInner(line.from, 1); node; node = node.parent) {
    if (node.name === 'FencedCode' && context.state.doc.lineAt(node.from).number !== line.number) return null
  }
  return {
    from: context.pos - match[2].length,
    options: languageCompletions(),
    validFor: /^[\w+#.-]*$/
  }
}

interface EmojiEntry {
  emoji: string
  description: string
  aliases: string[]
  tags: string[]
}

let emojiOptions: Promise<Completion[]> | null = null

function emojiCompletions(): Promise<Completion[]> {
  // The table is ~300 KB of source; load it the first time `:` is typed.
  // @ts-expect-error -- runtime-resolved muya deep import (see diagrams.ts)
  emojiOptions ??= import('@muyajs/core/config/emojis').then(mod => {
    const list = (mod as { default: EmojiEntry[] }).default
    const options: Completion[] = []
    for (const entry of list) {
      for (const alias of entry.aliases) {
        options.push({
          label: `:${alias}:`,
          displayLabel: `${entry.emoji}  :${alias}:`,
          detail: entry.description,
          // Inserting the character keeps the file portable; `:alias:`
          // shortcodes are not part of CommonMark/GFM.
          apply: entry.emoji,
          type: 'text',
          boost: entry.tags.length ? 0 : -1
        })
      }
    }
    return options
  })
  return emojiOptions
}

/** `:smi` at a word start — completes emoji shortcodes to the emoji itself. */
export async function emojiSource(context: CompletionContext): Promise<CompletionResult | null> {
  const match = context.matchBefore(/(?:^|[\s([{>])(:[a-z0-9_+-]{2,})$/i)
  if (!match) return null
  const text = /:[a-z0-9_+-]+$/i.exec(match.text)![0]
  const options = await emojiCompletions()
  return {
    from: context.pos - text.length,
    options,
    validFor: /^:[a-z0-9_+-]*$/i
  }
}

export function markdownCompletions() {
  return autocompletion({
    override: [fenceLanguageSource, emojiSource],
    icons: false,
    activateOnTyping: true
  })
}
