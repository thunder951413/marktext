import { ipcMain } from '../utils/secureIpc'
import fs from 'fs-extra'
import { statSync, constants, type Stats } from 'fs'

import { isFile as commonIsFile, isDirectory as commonIsDirectory } from 'common/filesystem'
import { isImageFile } from 'common/filesystem/paths'
import { isWithinRoots } from '../utils/fileAccess'
import type { IpcMainInvokeEvent } from 'electron'

type AccessRoots = { read: string[]; write: string[] }
let accessRoots: (senderId: number) => Promise<AccessRoots> = async() => ({ read: [], write: [] })

export const configureFileSystemAccess = (resolve: typeof accessRoots): void => { accessRoots = resolve }

export const checkedPath = async(event: IpcMainInvokeEvent, value: string, write = false, image = false): Promise<string> => {
  if (typeof value !== 'string') throw new Error('Invalid filesystem path')
  const roots = await accessRoots(event.sender.id)
  if (!isWithinRoots(value, write ? roots.write : [...roots.read, ...roots.write]) && !(image && isImageFile(value))) {
    throw new Error('Filesystem path is outside the opened workspace')
  }
  return value
}

interface SerializedStat {
  size: number
  mtimeMs: number
  ctimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

const serializeStat = (stats: Stats): SerializedStat => ({
  size: stats.size,
  mtimeMs: stats.mtimeMs,
  ctimeMs: stats.ctimeMs,
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  isSymbolicLink: stats.isSymbolicLink()
})

const toBuffer = (data: unknown): unknown => {
  if (data == null) return data
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (typeof data === 'string') return data
  if (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === 'Buffer' &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return Buffer.from((data as { data: number[] }).data)
  }
  return data
}

export const registerFsHandlers = (): void => {
  ipcMain.handle('mt::fs::is-file', (_e, p: string) => commonIsFile(p))
  ipcMain.handle('mt::fs::is-directory', (_e, p: string) => commonIsDirectory(p))
  ipcMain.handle('mt::fs::copy', async(e, src: string, dest: string) =>
    fs.copy(await checkedPath(e, src, false, true), await checkedPath(e, dest, true)))
  ipcMain.handle('mt::fs::ensure-dir', async(e, p: string) => fs.ensureDir(await checkedPath(e, p, true)))

  ipcMain.handle('mt::fs::output-file', async(e, p: string, data: unknown) =>
    fs.outputFile(await checkedPath(e, p, true), toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::move', async(e, src: string, dest: string) =>
    fs.move(await checkedPath(e, src, true), await checkedPath(e, dest, true), { overwrite: false })
  )
  ipcMain.handle('mt::fs::stat', async(_e, p: string) => serializeStat(await fs.stat(p)))

  ipcMain.handle('mt::fs::write-file', async(e, p: string, data: unknown) =>
    fs.writeFile(await checkedPath(e, p, true), toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::read-file', async(e, p: string, encoding?: BufferEncoding) => {
    const buf = await fs.readFile(await checkedPath(e, p, false, true), encoding)
    return buf
  })
  ipcMain.handle('mt::fs::path-exists', (_e, p: string) => fs.pathExists(p))
  ipcMain.handle('mt::fs::readdir', (_e, p: string) => fs.readdir(p))
  ipcMain.handle('mt::fs::is-executable', (_e, p: string) => {
    try {
      const stat = statSync(p)
      if (process.platform === 'win32') return stat.isFile()
      return (
        stat.isFile() &&
        (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
      )
    } catch {
      return false
    }
  })
}
