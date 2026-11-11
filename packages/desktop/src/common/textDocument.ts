// Browser-safe document classification, shared by the main process and renderer.
export const MARKDOWN_FILE_EXTENSIONS = ['markdown', 'mdown', 'mkdn', 'md', 'mkd', 'mdwn', 'mdtxt', 'mdtext', 'mdx', 'mmd'] as const

export const isMarkdownName = (name: string): boolean =>
  MARKDOWN_FILE_EXTENSIONS.some(ext => name.toLowerCase().endsWith(`.${ext}`))

export const isTextDocument = (file: { pathname?: string | null; filename?: string; documentKind?: string }): boolean =>
  file.documentKind === 'text' || (!!file.pathname && !isMarkdownName(file.pathname))

export const MAX_TEXT_FILE_BYTES = 50 * 1024 * 1024
export const LARGE_TEXT_FILE_BYTES = 10 * 1024 * 1024

export type TextLineEnding = '\n' | '\r\n' | '\r'

export const splitTextLineEndings = (content: string): { text: string; endings: TextLineEnding[] } => {
  const endings: TextLineEnding[] = []
  const text = content.replace(/\r\n|\r|\n/g, ending => {
    endings.push(ending as TextLineEnding)
    return '\n'
  })
  return { text, endings }
}

export const restoreTextLineEndings = (text: string, endings: TextLineEnding[] | undefined, fallback: string): string => {
  let index = 0
  return text.replace(/\n/g, () => endings?.[index++] ?? fallback)
}

// Avoid watching known binary assets; explicitly opening a file still validates its content.
export const isKnownBinaryName = (name: string): boolean =>
  /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|xz|7z|rar|exe|dll|so|dylib|woff2?|ttf|otf|mp[34]|mov|wav|sqlite|db|docx?|xlsx?|pptx?)$/i.test(name)
