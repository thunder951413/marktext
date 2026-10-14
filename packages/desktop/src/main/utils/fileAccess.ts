import path from 'path'
import { realpathSync, existsSync } from 'fs'

export function canonicalPath(value: string): string {
  if (!path.isAbsolute(value) || value.includes('\0')) throw new Error('Expected an absolute local path')
  let existing = path.normalize(value)
  const suffix: string[] = []
  while (!existsSync(existing)) {
    suffix.unshift(path.basename(existing))
    const parent = path.dirname(existing)
    if (parent === existing) throw new Error('Invalid filesystem path')
    existing = parent
  }
  return path.join(realpathSync(existing), ...suffix)
}

export function isWithinRoots(value: string, roots: string[]): boolean {
  const target = canonicalPath(value)
  return roots.some(root => {
    if (!root || !path.isAbsolute(root)) return false
    const base = canonicalPath(root)
    const relative = path.relative(base, target)
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  })
}
