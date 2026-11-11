export type RadialMenuMode =
  | 'markdown-selection'
  | 'markdown-default'
  | 'markdown-source'
  | 'plain-text'
  | 'empty'

export type RadialIconName =
  | 'command'
  | 'source'
  | 'code-block'
  | 'table'
  | 'task-list'
  | 'find'
  | 'folder-search'
  | 'sidebar'
  | 'export-pdf'
  | 'bold'
  | 'italic'
  | 'inline-code'
  | 'link'
  | 'highlight'
  | 'strike'
  | 'clear-format'
  | 'new-tab'
  | 'save'
  | 'save-as'
  | 'open-file'
  | 'open-folder'
  | 'import'
  | 'undo'
  | 'settings'

export type RadialIpcChannel =
  | 'mt::open-setting-window'
  | 'mt::cmd-open-file'
  | 'mt::cmd-open-folder'
  | 'mt::cmd-import-file'

export type RadialActionPayload =
  | { kind: 'bus'; event: string; payload?: unknown; focusEditor?: boolean }
  | { kind: 'ipc'; channel: RadialIpcChannel }

export interface RadialActionItem {
  id: string
  commandId?: string
  labelKey: string
  icon: RadialIconName
  defaultShortcutMac?: string
  defaultShortcutOther?: string
  active?: boolean
  action: RadialActionPayload
}

export interface RadialContextSnapshot {
  hasCurrentFile: boolean
  isPlainText: boolean
  sourceCode: boolean
  showSideBar: boolean
  hasSelection: boolean
  isCodeFences: boolean
  isDisabled: boolean
  isTaskList: boolean
  activeFormats: Record<string, boolean>
}

export interface ResolvedRadialMenu {
  mode: RadialMenuMode
  modeLabelKey: string
  items: RadialActionItem[]
}

/**
 * Determine which contextual radial ring to present based on current workspace
 * and editor selection state.
 */
export const resolveRadialMenuMode = (ctx: RadialContextSnapshot): RadialMenuMode => {
  if (!ctx.hasCurrentFile) {
    return 'empty'
  }
  if (ctx.isPlainText) {
    return 'plain-text'
  }
  if (ctx.sourceCode) {
    return 'markdown-source'
  }
  if (ctx.hasSelection && !ctx.isCodeFences && !ctx.isDisabled) {
    return 'markdown-selection'
  }
  return 'markdown-default'
}

/**
 * Build the 8-sector clockwise action ring (`N, NE, E, SE, S, SW, W, NW`)
 * tailored to the active context while keeping spatial landmarks consistent.
 */
export const buildRadialMenu = (ctx: RadialContextSnapshot): ResolvedRadialMenu => {
  const mode = resolveRadialMenuMode(ctx)

  switch (mode) {
    case 'markdown-selection':
      return {
        mode,
        modeLabelKey: 'radialMenu.modes.selection',
        items: [
          {
            id: 'format-strong',
            commandId: 'format.strong',
            labelKey: 'radialMenu.items.bold',
            icon: 'bold',
            defaultShortcutMac: '⌘B',
            defaultShortcutOther: 'Ctrl+B',
            active: !!ctx.activeFormats.strong,
            action: { kind: 'bus', event: 'format', payload: 'strong', focusEditor: true }
          },
          {
            id: 'format-emphasis',
            commandId: 'format.emphasis',
            labelKey: 'radialMenu.items.italic',
            icon: 'italic',
            defaultShortcutMac: '⌘I',
            defaultShortcutOther: 'Ctrl+I',
            active: !!ctx.activeFormats.em,
            action: { kind: 'bus', event: 'format', payload: 'em', focusEditor: true }
          },
          {
            id: 'format-inline-code',
            commandId: 'format.inline-code',
            labelKey: 'radialMenu.items.inlineCode',
            icon: 'inline-code',
            defaultShortcutMac: '⌘`',
            defaultShortcutOther: 'Ctrl+`',
            active: !!ctx.activeFormats.inline_code,
            action: { kind: 'bus', event: 'format', payload: 'inline_code', focusEditor: true }
          },
          {
            id: 'format-hyperlink',
            commandId: 'format.hyperlink',
            labelKey: 'radialMenu.items.link',
            icon: 'link',
            defaultShortcutMac: '⌘L',
            defaultShortcutOther: 'Ctrl+L',
            active: !!ctx.activeFormats.link,
            action: { kind: 'bus', event: 'format', payload: 'link', focusEditor: true }
          },
          {
            id: 'format-highlight',
            commandId: 'format.highlight',
            labelKey: 'radialMenu.items.highlight',
            icon: 'highlight',
            defaultShortcutMac: '⇧⌘H',
            defaultShortcutOther: 'Ctrl+Shift+H',
            active: !!ctx.activeFormats.mark,
            action: { kind: 'bus', event: 'format', payload: 'mark', focusEditor: true }
          },
          {
            id: 'format-strike',
            commandId: 'format.strike',
            labelKey: 'radialMenu.items.strike',
            icon: 'strike',
            defaultShortcutMac: '⌘D',
            defaultShortcutOther: 'Ctrl+D',
            active: !!ctx.activeFormats.del,
            action: { kind: 'bus', event: 'format', payload: 'del', focusEditor: true }
          },
          {
            id: 'format-clear',
            commandId: 'format.clear-format',
            labelKey: 'radialMenu.items.clearFormat',
            icon: 'clear-format',
            defaultShortcutMac: '⇧⌘R',
            defaultShortcutOther: 'Ctrl+Shift+R',
            action: { kind: 'bus', event: 'format', payload: 'clear', focusEditor: true }
          },
          {
            id: 'command-palette',
            commandId: 'view.command-palette',
            labelKey: 'radialMenu.items.commandPalette',
            icon: 'command',
            defaultShortcutMac: '⇧⌘P',
            defaultShortcutOther: 'Ctrl+Shift+P',
            action: { kind: 'bus', event: 'show-command-palette' }
          }
        ]
      }

    case 'markdown-default':
      return {
        mode,
        modeLabelKey: 'radialMenu.modes.markdown',
        items: [
          {
            id: 'command-palette',
            commandId: 'view.command-palette',
            labelKey: 'radialMenu.items.commandPalette',
            icon: 'command',
            defaultShortcutMac: '⇧⌘P',
            defaultShortcutOther: 'Ctrl+Shift+P',
            action: { kind: 'bus', event: 'show-command-palette' }
          },
          {
            id: 'toggle-source',
            commandId: 'view.source-code-mode',
            labelKey: 'radialMenu.items.sourceMode',
            icon: 'source',
            defaultShortcutMac: '⌥⌘S',
            defaultShortcutOther: 'Ctrl+Alt+S',
            active: ctx.sourceCode,
            action: { kind: 'bus', event: 'view:toggle-view-entry', payload: 'sourceCode' }
          },
          {
            id: 'insert-code-fence',
            commandId: 'paragraph.code-fence',
            labelKey: 'radialMenu.items.codeBlock',
            icon: 'code-block',
            defaultShortcutMac: '⌥⌘C',
            defaultShortcutOther: 'Ctrl+Shift+K',
            active: ctx.isCodeFences,
            action: { kind: 'bus', event: 'paragraph', payload: 'pre', focusEditor: true }
          },
          {
            id: 'insert-table',
            commandId: 'paragraph.table',
            labelKey: 'radialMenu.items.table',
            icon: 'table',
            defaultShortcutMac: '⇧⌘T',
            defaultShortcutOther: 'Ctrl+Shift+T',
            action: { kind: 'bus', event: 'paragraph', payload: 'table', focusEditor: true }
          },
          {
            id: 'insert-task-list',
            commandId: 'paragraph.task-list',
            labelKey: 'radialMenu.items.taskList',
            icon: 'task-list',
            defaultShortcutMac: '⌥⌘X',
            defaultShortcutOther: 'Ctrl+Alt+X',
            active: ctx.isTaskList,
            action: { kind: 'bus', event: 'paragraph', payload: 'ul-task', focusEditor: true }
          },
          {
            id: 'edit-find',
            commandId: 'edit.find',
            labelKey: 'radialMenu.items.find',
            icon: 'find',
            defaultShortcutMac: '⌘F',
            defaultShortcutOther: 'Ctrl+F',
            action: { kind: 'bus', event: 'find', payload: 'find' }
          },
          {
            id: 'toggle-sidebar',
            commandId: 'view.toggle-sidebar',
            labelKey: 'radialMenu.items.sidebar',
            icon: 'sidebar',
            defaultShortcutMac: '⌘J',
            defaultShortcutOther: 'Ctrl+J',
            active: ctx.showSideBar,
            action: { kind: 'bus', event: 'view:toggle-layout-entry', payload: 'showSideBar' }
          },
          {
            id: 'export-pdf',
            commandId: 'file.export-file.pdf',
            labelKey: 'radialMenu.items.exportPdf',
            icon: 'export-pdf',
            defaultShortcutMac: '⌃⌥E',
            defaultShortcutOther: 'Ctrl+Alt+E',
            action: { kind: 'bus', event: 'showExportDialog', payload: 'pdf' }
          }
        ]
      }

    case 'markdown-source':
      return {
        mode,
        modeLabelKey: 'radialMenu.modes.source',
        items: [
          {
            id: 'command-palette',
            commandId: 'view.command-palette',
            labelKey: 'radialMenu.items.commandPalette',
            icon: 'command',
            defaultShortcutMac: '⇧⌘P',
            defaultShortcutOther: 'Ctrl+Shift+P',
            action: { kind: 'bus', event: 'show-command-palette' }
          },
          {
            id: 'toggle-source',
            commandId: 'view.source-code-mode',
            labelKey: 'radialMenu.items.sourceMode',
            icon: 'source',
            defaultShortcutMac: '⌥⌘S',
            defaultShortcutOther: 'Ctrl+Alt+S',
            active: true,
            action: { kind: 'bus', event: 'view:toggle-view-entry', payload: 'sourceCode' }
          },
          {
            id: 'new-tab',
            commandId: 'file.new-tab',
            labelKey: 'radialMenu.items.newTab',
            icon: 'new-tab',
            defaultShortcutMac: '⌘N',
            defaultShortcutOther: 'Ctrl+N',
            action: {
              kind: 'bus',
              event: 'mt::new-untitled-tab',
              payload: { selected: true, markdown: '' }
            }
          },
          {
            id: 'file-save',
            commandId: 'file.save',
            labelKey: 'radialMenu.items.save',
            icon: 'save',
            defaultShortcutMac: '⌘S',
            defaultShortcutOther: 'Ctrl+S',
            action: { kind: 'bus', event: 'mt::editor-ask-file-save' }
          },
          {
            id: 'find-in-folder',
            commandId: 'edit.find-in-folder',
            labelKey: 'radialMenu.items.searchFolder',
            icon: 'folder-search',
            defaultShortcutMac: '⇧⌘F',
            defaultShortcutOther: 'Ctrl+Shift+F',
            action: { kind: 'bus', event: 'mt::editor-edit-action', payload: 'findInFolder' }
          },
          {
            id: 'edit-undo',
            commandId: 'edit.undo',
            labelKey: 'radialMenu.items.undo',
            icon: 'undo',
            defaultShortcutMac: '⌘Z',
            defaultShortcutOther: 'Ctrl+Z',
            action: { kind: 'bus', event: 'undo', payload: 'undo' }
          },
          {
            id: 'toggle-sidebar',
            commandId: 'view.toggle-sidebar',
            labelKey: 'radialMenu.items.sidebar',
            icon: 'sidebar',
            defaultShortcutMac: '⌘J',
            defaultShortcutOther: 'Ctrl+J',
            active: ctx.showSideBar,
            action: { kind: 'bus', event: 'view:toggle-layout-entry', payload: 'showSideBar' }
          },
          {
            id: 'preferences',
            commandId: 'file.preferences',
            labelKey: 'radialMenu.items.preferences',
            icon: 'settings',
            defaultShortcutMac: '⌘,',
            defaultShortcutOther: 'Ctrl+,',
            action: { kind: 'ipc', channel: 'mt::open-setting-window' }
          }
        ]
      }

    case 'plain-text':
      return {
        mode,
        modeLabelKey: 'radialMenu.modes.plainText',
        items: [
          {
            id: 'command-palette',
            commandId: 'view.command-palette',
            labelKey: 'radialMenu.items.commandPalette',
            icon: 'command',
            defaultShortcutMac: '⇧⌘P',
            defaultShortcutOther: 'Ctrl+Shift+P',
            action: { kind: 'bus', event: 'show-command-palette' }
          },
          {
            id: 'new-tab',
            commandId: 'file.new-tab',
            labelKey: 'radialMenu.items.newTab',
            icon: 'new-tab',
            defaultShortcutMac: '⌘N',
            defaultShortcutOther: 'Ctrl+N',
            action: {
              kind: 'bus',
              event: 'mt::new-untitled-tab',
              payload: { selected: true, markdown: '' }
            }
          },
          {
            id: 'file-save',
            commandId: 'file.save',
            labelKey: 'radialMenu.items.save',
            icon: 'save',
            defaultShortcutMac: '⌘S',
            defaultShortcutOther: 'Ctrl+S',
            action: { kind: 'bus', event: 'mt::editor-ask-file-save' }
          },
          {
            id: 'file-save-as',
            commandId: 'file.save-as',
            labelKey: 'radialMenu.items.saveAs',
            icon: 'save-as',
            defaultShortcutMac: '⇧⌘S',
            defaultShortcutOther: 'Ctrl+Shift+S',
            action: { kind: 'bus', event: 'mt::editor-ask-file-save-as' }
          },
          {
            id: 'find-in-folder',
            commandId: 'edit.find-in-folder',
            labelKey: 'radialMenu.items.searchFolder',
            icon: 'folder-search',
            defaultShortcutMac: '⇧⌘F',
            defaultShortcutOther: 'Ctrl+Shift+F',
            action: { kind: 'bus', event: 'mt::editor-edit-action', payload: 'findInFolder' }
          },
          {
            id: 'edit-find',
            commandId: 'edit.find',
            labelKey: 'radialMenu.items.find',
            icon: 'find',
            defaultShortcutMac: '⌘F',
            defaultShortcutOther: 'Ctrl+F',
            action: { kind: 'bus', event: 'find', payload: 'find' }
          },
          {
            id: 'toggle-sidebar',
            commandId: 'view.toggle-sidebar',
            labelKey: 'radialMenu.items.sidebar',
            icon: 'sidebar',
            defaultShortcutMac: '⌘J',
            defaultShortcutOther: 'Ctrl+J',
            active: ctx.showSideBar,
            action: { kind: 'bus', event: 'view:toggle-layout-entry', payload: 'showSideBar' }
          },
          {
            id: 'preferences',
            commandId: 'file.preferences',
            labelKey: 'radialMenu.items.preferences',
            icon: 'settings',
            defaultShortcutMac: '⌘,',
            defaultShortcutOther: 'Ctrl+,',
            action: { kind: 'ipc', channel: 'mt::open-setting-window' }
          }
        ]
      }

    case 'empty':
      return {
        mode,
        modeLabelKey: 'radialMenu.modes.workspace',
        items: [
          {
            id: 'command-palette',
            commandId: 'view.command-palette',
            labelKey: 'radialMenu.items.commandPalette',
            icon: 'command',
            defaultShortcutMac: '⇧⌘P',
            defaultShortcutOther: 'Ctrl+Shift+P',
            action: { kind: 'bus', event: 'show-command-palette' }
          },
          {
            id: 'new-tab',
            commandId: 'file.new-tab',
            labelKey: 'radialMenu.items.newFile',
            icon: 'new-tab',
            defaultShortcutMac: '⌘N',
            defaultShortcutOther: 'Ctrl+N',
            action: {
              kind: 'bus',
              event: 'mt::new-untitled-tab',
              payload: { selected: true, markdown: '' }
            }
          },
          {
            id: 'open-file',
            commandId: 'file.open-file',
            labelKey: 'radialMenu.items.openFile',
            icon: 'open-file',
            defaultShortcutMac: '⌘O',
            defaultShortcutOther: 'Ctrl+O',
            action: { kind: 'ipc', channel: 'mt::cmd-open-file' }
          },
          {
            id: 'open-folder',
            commandId: 'file.open-folder',
            labelKey: 'radialMenu.items.openFolder',
            icon: 'open-folder',
            defaultShortcutMac: '⇧⌘O',
            defaultShortcutOther: 'Ctrl+Shift+O',
            action: { kind: 'ipc', channel: 'mt::cmd-open-folder' }
          },
          {
            id: 'import-file',
            commandId: 'file.import-file',
            labelKey: 'radialMenu.items.importFile',
            icon: 'import',
            action: { kind: 'ipc', channel: 'mt::cmd-import-file' }
          },
          {
            id: 'find-in-folder',
            commandId: 'edit.find-in-folder',
            labelKey: 'radialMenu.items.searchFolder',
            icon: 'folder-search',
            defaultShortcutMac: '⇧⌘F',
            defaultShortcutOther: 'Ctrl+Shift+F',
            action: { kind: 'bus', event: 'mt::editor-edit-action', payload: 'findInFolder' }
          },
          {
            id: 'toggle-sidebar',
            commandId: 'view.toggle-sidebar',
            labelKey: 'radialMenu.items.sidebar',
            icon: 'sidebar',
            defaultShortcutMac: '⌘J',
            defaultShortcutOther: 'Ctrl+J',
            active: ctx.showSideBar,
            action: { kind: 'bus', event: 'view:toggle-layout-entry', payload: 'showSideBar' }
          },
          {
            id: 'preferences',
            commandId: 'file.preferences',
            labelKey: 'radialMenu.items.preferences',
            icon: 'settings',
            defaultShortcutMac: '⌘,',
            defaultShortcutOther: 'Ctrl+,',
            action: { kind: 'ipc', channel: 'mt::open-setting-window' }
          }
        ]
      }
  }
}
