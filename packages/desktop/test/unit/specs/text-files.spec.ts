import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, truncateSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import iconv from 'iconv-lite'
import { isMarkdownName, isTextDocument, MAX_TEXT_FILE_BYTES } from 'common/textDocument'
import { guessEncoding } from 'main_renderer/filesystem/encoding'
import { loadMarkdownFile, writeMarkdownFile } from 'main_renderer/filesystem/markdown'

vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
const dirs: string[] = []
const file = (name: string, bytes: Buffer | string) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-text-'))
  dirs.push(dir)
  const pathname = path.join(dir, name)
  writeFileSync(pathname, bytes)
  return pathname
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('general text files', () => {
  it('distinguishes Markdown from text, code and extensionless documents', () => {
    for (const name of ['a.TXT', 'a.log', '.env', 'Dockerfile', 'a.ts', 'a.json']) {
      expect(isMarkdownName(name)).toBe(false)
      expect(isTextDocument({ pathname: name })).toBe(true)
    }
    expect(isMarkdownName('a.MD')).toBe(true)
    expect(isTextDocument({ pathname: '' })).toBe(false)
  })

  for (const encoding of ['utf8', 'utf16le', 'utf16be', 'utf32le', 'utf32be', 'gbk', 'gb18030', 'big5', 'shiftjis', 'latin1']) {
    it(`round trips ${encoding} without changing whitespace, BOM or mixed line endings`, async() => {
      const content = encoding === 'latin1' ? '# café  \r\n\rfin\n\n\n' : '# 漢字  \r\n\rTEST\n\n\n'
      const bytes = iconv.encode(content, encoding, { addBOM: /^utf/.test(encoding) })
      const pathname = file('sample.log', bytes)
      const doc = await loadMarkdownFile(pathname, 'lf', true, 0, true, encoding)
      expect(doc.documentKind).toBe('text')
      expect(doc.decodingWarning).toBeUndefined()
      expect(doc.markdown.endsWith('\n\n\n')).toBe(true)
      expect(doc.isMixedLineEndings).toBe(true)
      await writeMarkdownFile(pathname, doc.markdown, doc)
      expect(readFileSync(pathname)).toEqual(bytes)
    })
  }

  it('recognizes UTF-32 BOM before the UTF-16 prefix and BOM-less UTF-16', () => {
    for (const encoding of ['utf32le', 'utf32be', 'utf16le', 'utf16be']) {
      expect(guessEncoding(iconv.encode('hello world', encoding, { addBOM: true }), true)).toEqual({ encoding, isBom: true })
    }
    expect(guessEncoding(iconv.encode('Hello world\r\n', 'utf16le'), true)).toEqual({ encoding: 'utf16le', isBom: false })
  })

  it('keeps extensionless filenames intact when saving', async() => {
    const pathname = file('Dockerfile', 'FROM example\n')
    const doc = await loadMarkdownFile(pathname, 'lf')
    await writeMarkdownFile(pathname, doc.markdown + 'RUN example\n', doc)
    expect(readdirSync(path.dirname(pathname))).toEqual(['Dockerfile'])
  })

  it('does not overwrite the original when converting to an encoding that loses characters', async() => {
    const pathname = file('sample.txt', '中文 😀\n')
    const doc = await loadMarkdownFile(pathname, 'lf')
    await expect(writeMarkdownFile(pathname, doc.markdown, { ...doc, encoding: { encoding: 'latin1' } })).rejects.toThrow('cannot represent')
    expect(readFileSync(pathname, 'utf8')).toBe('中文 😀\n')
  })

  it('flags lossy decoding and refuses to save it', async() => {
    const bytes = Buffer.from([0x61, 0xc2, 0x20, 0x62])
    const pathname = file('broken.log', bytes)
    const doc = await loadMarkdownFile(pathname, 'lf', false)
    expect(doc.decodingWarning).toBeTruthy()
    await expect(writeMarkdownFile(pathname, doc.markdown, doc)).rejects.toThrow('correct encoding')
    expect(readFileSync(pathname)).toEqual(bytes)
  })

  it('retains a chosen decoding for subsequent external reloads', async() => {
    const pathname = file('legacy.txt', iconv.encode('café', 'latin1'))
    await loadMarkdownFile(pathname, 'lf', true, 3, false, 'latin1')
    const doc = await loadMarkdownFile(pathname, 'lf')
    expect(doc.markdown).toBe('café')
    expect(doc.encoding.encoding).toBe('latin1')
  })

  it('updates the decoding choice after converting and saving', async() => {
    const pathname = file('converted.txt', iconv.encode('中文', 'gbk'))
    const doc = await loadMarkdownFile(pathname, 'lf', true, 3, false, 'gbk')
    await writeMarkdownFile(pathname, doc.markdown, { ...doc, encoding: { encoding: 'utf16le', isBom: false } })
    const reopened = await loadMarkdownFile(pathname, 'lf')
    expect(reopened.markdown).toBe('中文')
    expect(reopened.encoding.encoding).toBe('utf16le')
  })

  it('honors a new BOM when another application changes the encoding', async() => {
    const pathname = file('changed.txt', iconv.encode('中文', 'gbk'))
    await loadMarkdownFile(pathname, 'lf', true, 3, false, 'gbk')
    writeFileSync(pathname, iconv.encode('中文', 'utf8', { addBOM: true }))
    const reopened = await loadMarkdownFile(pathname, 'lf')
    expect(reopened.markdown).toBe('中文')
    expect(reopened.encoding).toEqual({ encoding: 'utf8', isBom: true })
  })

  it('rejects binary and oversized files before displaying them', async() => {
    await expect(loadMarkdownFile(file('binary.bin', Buffer.from([0, 0, 0, 0, 1, 2, 3, 4])), 'lf')).rejects.toThrow('binary')
    const pathname = file('huge.log', '')
    truncateSync(pathname, MAX_TEXT_FILE_BYTES + 1)
    await expect(loadMarkdownFile(pathname, 'lf')).rejects.toThrow('50 MiB')
  })
})
