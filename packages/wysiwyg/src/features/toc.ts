import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
// @ts-expect-error -- runtime-resolved muya deep import
import { generateGithubSlug } from '@muyajs/core/utils/slug'

export interface TocItem {
  slug: string
  lvl: number
  text: string
  /** Zero-based document line number, matching the muyaIndexCursor shape. */
  line: number
  /** Absolute document offset of the heading start. */
  pos: number
}

const HEADING_LEVELS: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
  SetextHeading1: 1,
  SetextHeading2: 2
}

/**
 * Extracts headings in document order. Duplicate slugs get GitHub-style
 * `-1`/`-2` suffixes so anchors stay linkable.
 */
export function getTocItems(view: EditorView): TocItem[] {
  const state = view.state
  const items: Array<{ slug: string; lvl: number; text: string; line: number; pos: number }> = []
  const seen = new Map<string, number>()

  syntaxTree(state).iterate({
    enter: node => {
      const lvl = HEADING_LEVELS[node.name]
      if (!lvl) return undefined
      // Setext nodes span text + underline line; only the first line is text.
      let text = state.doc.sliceString(node.from, node.to).split('\n')[0]
      // Strip the ATX marker and surrounding spaces for the anchor text.
      text = text.replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, '')
      const base = generateGithubSlug(text)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const slug = count === 0 ? base : `${base}-${count}`
      items.push({ slug, lvl, text, line: state.doc.lineAt(node.from).number - 1, pos: node.from })
      return undefined
    }
  })

  return items
}

/** Scrolls the heading into the center of the viewport and moves the caret. */
export function scrollToTocItem(view: EditorView, item: TocItem, opts: { scroll?: boolean } = {}): void {
  const effects =
    opts.scroll === false ? [] : [EditorView.scrollIntoView(item.pos, { y: 'center' })]
  view.dispatch({
    selection: EditorSelection.cursor(item.pos),
    effects,
    scrollIntoView: opts.scroll !== false
  })
}
