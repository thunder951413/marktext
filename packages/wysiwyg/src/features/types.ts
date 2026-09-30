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
  /** Renders a diagram into the container. Defaults to muya's loaders. */
  diagramRenderer?: DiagramRenderer
}

export const DEFAULT_OPTIONS: Required<Pick<LivePreviewOptions, 'revealAll' | 'mathEnabled' | 'htmlPreviewEnabled' | 'codeBlockLineNumbers'>> = {
  revealAll: false,
  mathEnabled: true,
  htmlPreviewEnabled: true,
  codeBlockLineNumbers: false
}

/** Languages rendered as diagrams inside fenced code blocks. */
export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'vega-lite', 'plantuml', 'flowchart', 'sequence'])
