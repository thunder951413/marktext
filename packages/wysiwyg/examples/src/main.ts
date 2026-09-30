import { WysiwygEditor } from '@marktext/wysiwyg'

const SAMPLE = `# MarkText WYSIWYG on CodeMirror 6

This paragraph has **bold**, *italic*, ~~strikethrough~~, ==highlight==,
inline \`code\`, a [link](https://github.com/marktext) and an image:

![logo](https://github.com/github.png)

## Lists

- bullet one
- bullet two with **bold** inside
  - nested item
1. first
2. second

- [ ] task to do
- [x] task done

## Quote

> Live preview keeps the markdown source as the single source of truth.

\`\`\`ts
export const answer = 42
\`\`\`

---

| Feature | Status |
| --- | --- |
| mark hiding | done |
| tables | phase 3 |

Math, diagrams and footnotes land in Phase 2.
`

const host = document.getElementById('editor-host')
if (!host) throw new Error('missing #editor-host')
const editor = new WysiwygEditor(host, { markdown: SAMPLE, fontSize: 16 })
editor.init()

editor.on('content-change', ({ markdown }) => {
  document.title = `${markdown.length} chars`
})
