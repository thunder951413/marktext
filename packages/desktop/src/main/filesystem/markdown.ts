import fsPromises from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import iconv from 'iconv-lite'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from '../config'
import { isFile2, isDirectory2 } from 'common/filesystem'
import { isMarkdownName, MAX_TEXT_FILE_BYTES, splitTextLineEndings, restoreTextLineEndings } from 'common/textDocument'
import { normalizeAndResolvePath, writeFile } from '../filesystem'
import { guessEncoding } from './encoding'
import type { Encoding } from 'common/encoding'
import type { TextDocumentMetadata, LineEnding } from '@shared/types/files'

const encodingOverrides = new Map<string, string>()

interface MarkdownDocumentOptions extends TextDocumentMetadata {
  adjustLineEndingOnSave: boolean
  lineEnding: LineEnding
  encoding: Encoding
}

interface MarkdownDocumentRaw extends TextDocumentMetadata {
  markdown: string
  filename: string
  pathname: string
  encoding: Encoding
  lineEnding: LineEnding
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  isMixedLineEndings: boolean
}

const getLineEnding = (lineEnding: LineEnding): string => {
  if (lineEnding === 'cr') return '\r'
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }

  // This should not happen but use fallback value.
  log.error(`Invalid end of line character: expected "lf" or "crlf" but got "${lineEnding}".`)
  return '\n'
}

const convertLineEndings = (text: string, lineEnding: LineEnding): string => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

/**
 * Special function to normalize directory and markdown file paths.
 * Returns the normalized path and a directory hint, or null if it's not a
 * directory or markdown file.
 */
export const normalizeMarkdownPath = (
  pathname: string
): { isDir: boolean; path: string } | null => {
  const isDir = isDirectory2(pathname)
  if (isDir || isFile2(pathname)) {
    const resolved = normalizeAndResolvePath(pathname)
    if (resolved) {
      return { isDir, path: resolved }
    } else {
      console.error(`[ERROR] Cannot resolve "${pathname}".`)
    }
  }
  return null
}

/**
 * Write the content into a file.
 */
export const writeMarkdownFile = async(
  pathname: string,
  content: string,
  options: MarkdownDocumentOptions
): Promise<void> => {
  const { adjustLineEndingOnSave, lineEnding } = options
  const { encoding, isBom } = options.encoding
  if (options.decodingWarning) throw new Error('Reopen this file with the correct encoding before saving; decoding was not lossless.')

  if (options.documentKind === 'text') {
    content = restoreTextLineEndings(content, options.textLineEndings, getLineEnding(lineEnding))
  } else if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  const buffer = iconv.encode(content, encoding, { addBOM: isBom })
  // Never silently replace characters unsupported by the selected encoding.
  if (iconv.decode(buffer, encoding, { stripBOM: isBom !== false }) !== content) {
    throw new Error(`The selected encoding (${encoding}) cannot represent all characters. Choose UTF-8 or another encoding before saving.`)
  }
  await writeFile(pathname, buffer, undefined, undefined)
  encodingOverrides.set(path.resolve(pathname), encoding)
}

/**
 * Reads the contents of a markdown file.
 */
export const loadMarkdownFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding: boolean = true,
  trimTrailingNewline: number = 2,
  autoNormalizeLineEndings: boolean = false,
  explicitEncoding?: string
): Promise<MarkdownDocumentRaw> => {
  // TODO: Use streams to not buffer the file multiple times and only guess
  //       encoding on the first 256/512 bytes.

  const initialStat = await fsPromises.stat(path.resolve(pathname))
  if (!initialStat.isFile()) throw new Error('Only regular files can be opened as text.')
  if (initialStat.size > MAX_TEXT_FILE_BYTES) throw new Error('This file exceeds the 50 MiB text editor limit.')
  const handle = await fsPromises.open(path.resolve(pathname), 'r')
  let buffer: Buffer
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error('Only regular files can be opened as text.')
    if (stat.size > MAX_TEXT_FILE_BYTES) throw new Error('This file exceeds the 50 MiB text editor limit.')
    // Read at most the limit plus one byte, even if the file grows after stat.
    const chunks: Buffer[] = []
    let total = 0
    while (total <= MAX_TEXT_FILE_BYTES) {
      const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, MAX_TEXT_FILE_BYTES + 1 - total))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (!bytesRead) break
      chunks.push(chunk.subarray(0, bytesRead))
      total += bytesRead
    }
    if (total > MAX_TEXT_FILE_BYTES) throw new Error('This file exceeds the 50 MiB text editor limit.')
    buffer = Buffer.concat(chunks, total)
  } finally {
    await handle.close()
  }

  const detected = guessEncoding(buffer, autoGuessEncoding)
  // A new BOM on disk takes precedence over a previous manual choice.
  if (!explicitEncoding && !detected.isBom) explicitEncoding = encodingOverrides.get(path.resolve(pathname))
  const encoding = explicitEncoding
    ? { encoding: explicitEncoding, isBom: detected.isBom && detected.encoding === explicitEncoding }
    : detected
  const supported = iconv.encodingExists(encoding.encoding)
  if (!supported) {
    throw new Error(`"${encoding.encoding}" encoding is not supported.`)
  }

  let markdown = iconv.decode(buffer, encoding.encoding, { stripBOM: encoding.isBom !== false })
  const sample = markdown.slice(0, 65536)
  // eslint-disable-next-line no-control-regex -- binary detection deliberately checks control bytes
  const controls = sample.match(/[\x00-\x08\x0e-\x1a\x1c-\x1f]/g)?.length ?? 0
  if (sample.includes('\0') || controls > Math.max(2, sample.length / 100) || sample.startsWith('%PDF-') || sample.startsWith('PK\x03\x04')) {
    throw new Error('This is a binary file and cannot be opened in the text editor.')
  }
  const roundTrip = iconv.encode(markdown, encoding.encoding, { addBOM: encoding.isBom })
  const decodingWarning = roundTrip.equals(buffer) ? undefined : 'Some bytes could not be decoded losslessly. Reopen with another encoding before saving.'
  if ((explicitEncoding || detected.isBom) && !decodingWarning) encodingOverrides.set(path.resolve(pathname), encoding.encoding)
  const plainText = !isMarkdownName(pathname)
  if (plainText) {
    const { text, endings } = splitTextLineEndings(markdown)
    const firstEnding = endings[0]
    const lineEnding: LineEnding = firstEnding === '\r\n' ? 'crlf' : firstEnding === '\r' ? 'cr' : firstEnding === '\n' ? 'lf' : preferredEol
    return {
      markdown: text,
      filename: path.basename(pathname),
      pathname,
      encoding,
      lineEnding,
      documentKind: 'text',
      textLineEndings: endings,
      decodingWarning,
      adjustLineEndingOnSave: false,
      trimTrailingNewline: 3,
      isMixedLineEndings: new Set(endings).size > 1
    }
  }

  // Detect line ending
  const isLf = LF_LINE_ENDING_REG.test(markdown)
  const isCrlf = CRLF_LINE_ENDING_REG.test(markdown)
  const isMixedLineEndings = isLf && isCrlf
  const isUnknownEnding = !isLf && !isCrlf
  let lineEnding: LineEnding = preferredEol
  if (isLf && !isCrlf) {
    lineEnding = 'lf'
  } else if (isCrlf && !isLf) {
    lineEnding = 'crlf'
  }

  let adjustLineEndingOnSave = false

  if (isMixedLineEndings || isUnknownEnding || lineEnding !== 'lf') {
    markdown = convertLineEndings(markdown, 'lf')
    // MarkText always uses LF internally. If the user did not request LF line
    // endings, we need to adjust on save.
    adjustLineEndingOnSave = !autoNormalizeLineEndings && lineEnding !== 'lf'
  }

  // Detect final newline
  if (trimTrailingNewline === 2) {
    if (!markdown) {
      trimTrailingNewline = 3
    } else {
      const lastIndex = markdown.length - 1
      if (lastIndex >= 1 && markdown[lastIndex] === '\n' && markdown[lastIndex - 1] === '\n') {
        trimTrailingNewline = 2
      } else if (markdown[lastIndex] === '\n') {
        trimTrailingNewline = 1
      } else {
        trimTrailingNewline = 0
      }
    }
  }

  const filename = path.basename(pathname)

  return {
    markdown,
    decodingWarning,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline,
    isMixedLineEndings
  }
}
