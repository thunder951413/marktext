import katex from 'katex'

// KaTeX output is deterministic per (tex, displayMode); rendering is the
// expensive part on large documents, so memoize with a bounded map.
const cache = new Map<string, string>()
const CACHE_LIMIT = 500

export function renderMathToString(tex: string, displayMode: boolean): string {
  const key = `${displayMode ? 'D' : 'I'}:${tex}`
  const cached = cache.get(key)
  if (cached) return cached
  let html: string
  try {
    html = katex.renderToString(tex, { throwOnError: false, displayMode })
  } catch {
    html = ''
  }
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, html)
  return html
}
