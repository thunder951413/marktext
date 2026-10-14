# @marktext/wysiwyg

CodeMirror 6 live-preview WYSIWYG markdown editor engine for MarkText. It
provides an optional alternative to the Muya rendering layer: the markdown source
itself is the single source of truth, and the WYSIWYG view is derived from the
Lezer syntax tree through decorations.

## How it works

- `src/markdown.ts` — canonical `markdown()` language config (GFM extensions
  plus a custom `==highlight==` inline parser).
- `src/decorations/livePreview.ts` — the core: a pure decoration builder that
  hides syntax marks away from the caret, styles inline formatting inline
  (bold/italic/strikethrough/highlight/code/links), sizes headings, and
  collapses images and horizontal rules into widgets. Marks reveal when the
  caret touches anywhere inside their element (Obsidian-style), and everything
  reveals during IME composition.
- `src/keymap.ts` — Tab / Shift-Tab list indentation; Enter/Backspace list
  continuation comes from `markdownKeymap` in `@codemirror/lang-markdown`.
- `src/editor.ts` — `WysiwygEditor`, the public API shell. Its shapes mirror
  what the desktop renderer consumes from `@muyajs/core` (line/ch cursors,
  `content-change`, `selection-change`) while `codemirrorEditor.vue` adapts these shapes to the desktop stores.

## Commands

```bash
pnpm install --frozen-lockfile   # workspace install
pnpm -C packages/wysiwyg test        # vitest
pnpm -C packages/wysiwyg typecheck   # tsc --noEmit
pnpm -C packages/wysiwyg/examples dev:demo   # vite demo page
```

## Desktop integration status

Phases 1–4 plus the engine-side compatibility layer of Phase 5: core
decorations, list editing, math, diagrams, image widgets, interactive task
checkboxes, code-block line numbers, front matter styling, sanitized HTML
previews, GFM tables (navigation / row-column ops / alignment / pipe
escaping / createTable), clipboard pipeline, search with muya-compatible
highlight classes, TOC with GitHub slugs, and the full muya contract
surface — `format`, `updateParagraph`, `duplicate`/`insertParagraph`/
`deleteParagraph`, `selectAll`, offset-based `getSelection`/`setCursor`,
opaque in-memory history tokens that preserve undo across tab switches,
spellcheck word replacement, locale storage, no-op float hooks.

The desktop uses this engine by default. Muya remains as a fallback until
the exit criteria in `docs/ENGINE_DECISION.md` are met:

```bash
MARKTEXT_EDITOR_ENGINE=muya pnpm dev          # one-off fallback
# or Preferences > Editor > Misc > WYSIWYG engine (applies after restart)
```

Engine-owned UI that replaces Muya's floats:

- `features/formatToolbar.ts` — floating inline-format toolbar over
  selections (pointer selections only in Vim mode).
- `decorations/tableWidget.ts` — tables render as a grid until the caret
  enters their lines; `moveTableColumn` (Alt-Shift-Left/Right) and
  `formatTable` (Alt-Shift-F, pads cells so pipes align — GFM has no
  column-width syntax). Alt-drag makes rectangular selections.
- `features/completions.ts` — code-fence language and `:emoji` completion.
- `features/vimEx.ts` — `:w`, `:q`, `:q!`, `:wq`, `:x`; the embedder supplies
  the save/close handlers via `setVimExHandlers`.

Large documents (> 50k chars) are decorated only around the viewport, so
keystroke cost no longer scales with document size.

Still missing compared with Muya: image toolbar/editing popups, link hover
tools, footnote tool, the `@` quick-insert menu and paragraph front menu.
