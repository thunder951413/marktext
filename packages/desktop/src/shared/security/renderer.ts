import { fileURLToPath } from 'url'
import path from 'path'

export function isTrustedRendererUrl(url: string, rendererPath: string, devUrl?: string): boolean {
  try {
    const target = new URL(url)
    if (devUrl) {
      const dev = new URL(devUrl)
      return target.origin === dev.origin && target.pathname === dev.pathname
    }
    return target.protocol === 'file:' && path.resolve(fileURLToPath(target)) === path.resolve(rendererPath)
  } catch {
    return false
  }
}

export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).some(character => character.charCodeAt(0) < 32)) return false
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}
