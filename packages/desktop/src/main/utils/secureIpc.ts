import path from 'path'
import { app, ipcMain as rawIpcMain } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { isAllowedChannel } from '@shared/security/ipcChannels'
import { isTrustedRendererUrl } from '@shared/security/renderer'

type Event = IpcMainEvent | IpcMainInvokeEvent

const assertSender = (event: Event, channel: string): void => {
  const frame = event.senderFrame
  const mainFrame = event.sender.mainFrame
  const allowed = isAllowedChannel('invoke', channel) || isAllowedChannel('send', channel) || isAllowedChannel('sync', channel)
  if (!allowed || !frame || frame !== mainFrame || !isTrustedRendererUrl(
    frame.url,
    path.join(app.getAppPath(), 'out/renderer/index.html'),
    process.env.NODE_ENV === 'development' ? process.env.ELECTRON_RENDERER_URL : undefined
  )) throw new Error('Untrusted IPC request')
}

// Keep trusted in-process EventEmitter messages intact, while every renderer
// handler validates its transport-provided sender frame before doing any work.
export const ipcMain = new Proxy({} as typeof rawIpcMain, {
  get(_target, property) {
    const target = rawIpcMain
    if (property === 'handle') {
      return (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
        target.handle(channel, (event, ...args) => {
          assertSender(event, channel)
          return listener(event, ...args)
        })
    }
    if (property === 'on') {
      return (channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void) =>
        target.on(channel, (event, ...args) => {
          if (event && typeof event === 'object' && 'sender' in event) {
            try {
              assertSender(event, channel)
            } catch {
              event.returnValue = null
              return
            }
          }
          listener(event, ...args)
        })
    }
    const value = Reflect.get(target, property)
    return typeof value === 'function' ? value.bind(target) : value
  }
})
