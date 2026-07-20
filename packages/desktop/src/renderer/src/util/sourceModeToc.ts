/** Minimal source-editor surface `scrollSourceEditorToLine` needs. */
interface ISourceEditor {
  setCursor: (
    pos: { line: number, ch: number },
    ch?: number | null,
    options?: { scroll?: boolean }
  ) => void
  heightAtLine: (line: number, mode: 'local' | 'page' | 'div') => number
  scrollTo?: (x: number | null, y: number | null) => void
}

/**
 * Scroll the Source Code editor so `line` sits at the TOP of the viewport,
 * animated.
 *
 * CodeMirror 6 owns the scroll viewport so it can virtualize large documents.
 * The optional outer-container fallback keeps this utility usable with the
 * legacy test double and any older embedded source editor.
 */
export function scrollSourceEditorToLine(
  editor: ISourceEditor,
  line: number,
  scrollContainer: HTMLElement | null | undefined
): void {
  editor.setCursor({ line, ch: 0 }, null, { scroll: false })

  const top = editor.heightAtLine(line, 'local')
  if (editor.scrollTo) editor.scrollTo(null, top)
  else scrollContainer?.scrollTo({ top, behavior: 'smooth' })
}

/**
 * Find the 0-based line number of the `headingIndex`-th markdown heading
 * (ATX `# foo` or setext `foo\n===`) in document order, skipping fenced code
 * blocks. Returns -1 when not found.
 *
 * Used by Source Code mode to resolve a TOC entry (whose order matches the
 * document heading order muya builds the TOC from) to a CodeMirror line.
 */
export function findMarkdownHeadingLine(markdown: string, headingIndex: number): number {
  if (headingIndex < 0) return -1

  const lines = markdown.split('\n')
  let fence: string | null = null
  let count = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Toggle fenced-code-block state on ``` / ~~~ markers.
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (marker === fence) fence = null
      continue
    }
    if (fence !== null) continue

    // ATX heading.
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
      if (count === headingIndex) return i
      count++
      continue
    }

    // Setext heading: a non-blank line immediately followed by an `===`/`---`
    // underline.
    const next = lines[i + 1]
    if (line.trim() !== '' && next !== undefined && /^ {0,3}(?:=+|-+)\s*$/.test(next)) {
      if (count === headingIndex) return i
      count++
      i++ // consume the underline line
    }
  }

  return -1
}
