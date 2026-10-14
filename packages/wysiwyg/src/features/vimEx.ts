import { Vim } from '@replit/codemirror-vim'

/**
 * File-level Ex commands for every CodeMirror editor in the app (WYSIWYG and
 * source mode share one @replit/codemirror-vim instance, whose Ex registry is
 * global). The embedder supplies what "write" and "quit" mean; until it does,
 * the commands report that they are unavailable instead of silently failing.
 *
 * Substitution (`:s`, `:%s`), marks (`m`, `` ` ``, `'`) and registers (`"a`)
 * are built into codemirror-vim and need no wiring here.
 */
export interface VimExHandlers {
  /** `:w` — save the current document. */
  write(): void
  /** `:q` (force=false) and `:q!` (force=true) — close the current document. */
  quit(force: boolean): void
  /** `:wq` / `:x` — save, then close once the save succeeded. */
  writeQuit(): void
}

let handlers: VimExHandlers | null = null
let registered = false

type ExFn = Parameters<typeof Vim.defineEx>[2]
type VimCm = Parameters<ExFn>[0]
type ExParams = { argString?: string }

function unavailable(cm: VimCm, command: string): void {
  try {
    cm.openNotification(document.createTextNode(`:${command} is not available here`), { bottom: true, duration: 3000 })
  } catch {
    // The notification panel needs a mounted view; a missing one is harmless.
  }
}

function bang(params: ExParams): boolean {
  return (params.argString ?? '').trim().startsWith('!')
}

/** Installs (once) the Ex commands and points them at `next`; pass null to detach. */
export function setVimExHandlers(next: VimExHandlers | null): void {
  handlers = next
  if (registered) return
  registered = true
  Vim.defineEx('write', 'w', (cm: VimCm) => {
    if (handlers) handlers.write()
    else unavailable(cm, 'write')
  })
  Vim.defineEx('quit', 'q', (cm: VimCm, params: ExParams) => {
    if (handlers) handlers.quit(bang(params))
    else unavailable(cm, 'quit')
  })
  Vim.defineEx('wq', 'wq', (cm: VimCm) => {
    if (handlers) handlers.writeQuit()
    else unavailable(cm, 'wq')
  })
  Vim.defineEx('xit', 'x', (cm: VimCm) => {
    if (handlers) handlers.writeQuit()
    else unavailable(cm, 'xit')
  })
}
