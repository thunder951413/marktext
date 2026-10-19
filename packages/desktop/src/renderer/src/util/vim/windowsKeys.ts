import { Vim } from '@replit/codemirror-vim'

// On Windows the menu accelerators use Ctrl (Ctrl+R replace, Ctrl+V paste,
// Ctrl+D strikethrough, Ctrl+W close tab, ...), so Vim's Ctrl chords collide
// with them: Vim consumes the key event and the menu item never fires. macOS
// is unaffected because its accelerators use Cmd. Windows therefore keeps the
// modal core (motions, operators, registers, search, Ex commands) and drops
// every Ctrl chord except Ctrl-[, which has no app binding and is a handy Esc.
export function isReservedWindowsChord(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey' | 'key'>
): boolean {
  if (!event.ctrlKey || event.metaKey) return false
  // AltGr reports as Ctrl+Alt and types ordinary characters on many layouts.
  if (event.altKey) return false
  return event.key !== '['
}

type KeyFromEvent = (event: KeyboardEvent, vimState?: unknown) => string | undefined

let installed = false

/** Idempotent; shared by every codemirror-vim editor in the window. */
export function restrictVimKeysOnWindows(
  platform: string | undefined = typeof window !== 'undefined'
    ? window.electron?.process?.platform
    : undefined
): void {
  if (platform !== 'win32' || installed) return
  installed = true
  const api = Vim as unknown as { vimKeyFromEvent: KeyFromEvent }
  const original = api.vimKeyFromEvent
  // An empty key makes the plugin return before it claims the event, so the
  // browser default and the menu accelerator still run.
  api.vimKeyFromEvent = (event, vimState) =>
    isReservedWindowsChord(event) ? '' : original.call(Vim, event, vimState)
}
