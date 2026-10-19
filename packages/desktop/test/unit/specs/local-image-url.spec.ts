import { describe, expect, it } from 'vitest'
import { resolveLocalImageUrl as resolve } from '@/util/localImageUrl'

describe('resolveLocalImageUrl', () => {
  it('anchors relative paths to the document directory', () => {
    expect(resolve('./assets/a.png', '/Users/me/notes')).toBe('file:///Users/me/notes/assets/a.png')
    expect(resolve('../img/a b.png', '/Users/me/notes')).toBe('file:///Users/me/img/a%20b.png')
    expect(resolve('../../../../a.png', '/x')).toBe('file:///a.png')
  })

  it('does not double-encode already-escaped paths', () => {
    expect(resolve('a%20b.png', '/x')).toBe('file:///x/a%20b.png')
    expect(resolve('a%231.png', '/x')).toBe('file:///x/a%231.png')
    expect(resolve('100%.png', '/x')).toBe('file:///x/100%25.png')
  })

  it('keeps a query string or fragment untouched', () => {
    expect(resolve('a.png?t=1', '/x')).toBe('file:///x/a.png?t=1')
  })

  it('builds loadable URLs for Windows drive and UNC paths', () => {
    expect(resolve('C:\\Users\\me\\a.png', '')).toBe('file:///C:/Users/me/a.png')
    expect(resolve('pics\\a.png', 'C:\\Users\\me\\doc')).toBe('file:///C:/Users/me/doc/pics/a.png')
    expect(resolve('..\\a.png', 'C:\\Users\\me\\doc\\')).toBe('file:///C:/Users/me/a.png')
    expect(resolve('\\\\srv\\share\\a.png', '')).toBe('file://srv/share/a.png')
  })

  it('leaves URLs and data URIs alone', () => {
    expect(resolve('https://x.com/a', '')).toBe('https://x.com/a')
    expect(resolve('data:image/png;base64,AAA', '')).toBe('data:image/png;base64,AAA')
    expect(resolve('file:///x/a.png', '/y')).toBe('file:///x/a.png')
  })

  it('returns an empty string when the source cannot be resolved', () => {
    expect(resolve('a.png', '')).toBe('')
    expect(resolve('a.txt', '/x')).toBe('')
    expect(resolve('', '/x')).toBe('')
  })

  it('encodes non-ASCII path segments', () => {
    expect(resolve('中文/图.PNG', '/笔记')).toBe(
      'file:///%E7%AC%94%E8%AE%B0/%E4%B8%AD%E6%96%87/%E5%9B%BE.PNG'
    )
  })
})
