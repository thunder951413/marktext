// Turns the `src` of a Markdown image into a URL the renderer can load.
//
// Relative paths are anchored to the directory of the open document, and
// absolute local paths (POSIX, Windows drive, UNC) become well-formed
// `file://` URLs. The `file://${src}` shortcut is wrong for Windows paths:
// `file://C:\a\b.png` is not a loadable URL, and unescaped `#`, `?` or `%`
// in a file name truncate or corrupt the path.
const IMAGE_EXT_REG = /\.(?:jpe?g|png|gif|svg|webp|bmp|avif|ico)$/i
const PASSTHROUGH_REG = /^(?:https?:|data:|file:|blob:)/i
const DRIVE_REG = /^[a-zA-Z]:\//
const SPLIT_SUFFIX_REG = /^([^?#]*)([?#].*)?$/s

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function collapseDots(path: string): string {
  const isDrive = DRIVE_REG.test(path)
  const root = isDrive ? path.slice(0, 2) : ''
  const rest = isDrive ? path.slice(2) : path
  const leading = rest.startsWith('//') ? '//' : rest.startsWith('/') ? '/' : ''
  const segments: string[] = []
  for (const segment of rest.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return `${root}${leading}${segments.join('/')}`
}

function encodeSegments(path: string): string {
  const isDrive = DRIVE_REG.test(path)
  const root = isDrive ? path.slice(0, 2) : ''
  const rest = isDrive ? path.slice(2) : path
  return root + rest.split('/').map(encodeURIComponent).join('/')
}

/**
 * @param src The raw URL from the Markdown source.
 * @param baseDir Directory of the open document; empty for an unsaved tab.
 * @returns A loadable URL, or '' when the source cannot be resolved so the
 *          caller can show its placeholder.
 */
export function resolveLocalImageUrl(src: string, baseDir?: string | null): string {
  const raw = src.trim()
  if (!raw) return ''
  if (PASSTHROUGH_REG.test(raw)) return raw

  const suffixMatch = SPLIT_SUFFIX_REG.exec(raw)
  const pathPart = decodePath(suffixMatch?.[1] ?? raw).replace(/\\/g, '/')
  const suffix = suffixMatch?.[2] ?? ''
  if (!IMAGE_EXT_REG.test(pathPart)) return ''

  const isAbsolute = pathPart.startsWith('/') || DRIVE_REG.test(pathPart)
  let absolute = pathPart
  if (!isAbsolute) {
    if (!baseDir) return ''
    absolute = `${baseDir.replace(/\\/g, '/').replace(/\/+$/, '')}/${pathPart}`
  }
  absolute = collapseDots(absolute)
  if (!absolute) return ''

  const encoded = encodeSegments(absolute)
  if (DRIVE_REG.test(absolute)) return `file:///${encoded}${suffix}`
  if (absolute.startsWith('//')) return `file:${encoded}${suffix}`
  return `file://${encoded}${suffix}`
}
