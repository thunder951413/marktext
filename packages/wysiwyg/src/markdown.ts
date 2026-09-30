import { GFM, type MarkdownConfig, type InlineContext, type Element } from '@lezer/markdown'
import { tags as t } from '@lezer/highlight'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

// Simplified single-pass parser for `==highlight==`. Unlike Strikethrough it
// does not use lezer-markdown's two-pass delimiter matching, so degenerate
// runs like `a===b` may parse imprecisely; the math extension in Phase 2 will
// introduce the full delimiter machinery and should absorb this parser then.
// Simplified single-pass parser for `$...$`. Like Highlight it avoids the
// delimiter machinery: escaped `\$`, currency-adjacent digits and multi-line
// spans are rejected outright rather than resolved contextually.
const InlineMath: MarkdownConfig = {
  defineNodes: [{ name: 'InlineMath' }],
  parseInline: [
    {
      name: 'InlineMath',
      parse(cx: InlineContext, next: number, pos: number) {
        if (next !== 36 /* '$' */ || cx.char(pos + 1) === 36) return -1
        const afterOpen = cx.char(pos + 1)
        if (afterOpen === 32 || (afterOpen >= 48 && afterOpen <= 57)) return -1
        let end = pos + 1
        while (end < cx.end) {
          const ch = cx.char(end)
          if (ch === 36) break
          if (ch === 10) return -1
          end++
        }
        if (end >= cx.end || end === pos + 1) return -1
        const beforeClose = cx.char(end - 1)
        if (beforeClose === 32 || (beforeClose >= 48 && beforeClose <= 57)) return -1
        const el = cx.elt('InlineMath', pos, end + 1)
        if (!el) return -1
        cx.addElement(el)
        return end + 1
      }
    }
  ]
}

const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: t.emphasis }
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx: InlineContext, next: number, pos: number) {
        if (next !== 61 /* '=' */ || cx.char(pos + 1) !== 61) return -1
        const contentStart = pos + 2
        let end = contentStart
        while (end < cx.end - 1) {
          if (cx.char(end) === 61 && cx.char(end + 1) === 61 && end > contentStart) break
          if (cx.char(end) === 10) return -1
          end++
        }
        if (end >= cx.end - 1 || end === contentStart) return -1
        const el = cx.elt('Highlight', pos, end + 2)
        if (!el) return -1
        cx.addElement(el)
        return end + 2
      }
    }
  ]
}

// Exported for tests so they can configure a standalone lezer parser with
// the exact extension set the editor language uses.
export const highlightExtension = Highlight
export const inlineMathExtension = InlineMath

// Re-exported so consumers (and tests) build one canonical editor language.
export function createMarkdownLanguage() {
  return markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    extensions: [GFM, Highlight, InlineMath]
  })
}

export type { Element }
