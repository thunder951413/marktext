export type DiagramRenderer = (
  code: string,
  lang: string,
  container: HTMLElement
) => Promise<void>

export interface LivePreviewOptions {
  /** Force every mark/range visible (IME composition, tests). */
  revealAll?: boolean
  /** Render `$...$` and `$$...$$` with KaTeX. Default true. */
  mathEnabled?: boolean
  /** Render sanitized previews for HTML blocks. Default true. */
  htmlPreviewEnabled?: boolean
  /** Show line numbers inside fenced code blocks. Default false. */
  codeBlockLineNumbers?: boolean
  /** Required when htmlPreviewEnabled; usually DOMPurify.sanitize. */
  sanitizeHtml?: (html: string) => string
  /** Render GFM tables as a grid while the caret is outside them. Default true. */
  renderTables?: boolean
  /** Renders a diagram into the container. Defaults to muya's loaders. */
  diagramRenderer?: DiagramRenderer
  /**
   * Maps a Markdown image `src` to a loadable URL (the embedder knows the
   * document directory). Return '' to show the placeholder. Identity when unset.
   */
  resolveImageSrc?: (src: string) => string
}

export const DEFAULT_OPTIONS: Required<Pick<LivePreviewOptions, 'revealAll' | 'mathEnabled' | 'htmlPreviewEnabled' | 'codeBlockLineNumbers' | 'renderTables'>> = {
  revealAll: false,
  renderTables: true,
  mathEnabled: true,
  htmlPreviewEnabled: true,
  codeBlockLineNumbers: false
}

/** Languages rendered as diagrams inside fenced code blocks. */
export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'vega-lite', 'plantuml', 'flowchart', 'sequence'])
