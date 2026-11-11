import { ENCODING_NAME_MAP, getEncodingName, type Encoding } from 'common/encoding'
import { delay } from '@/util'
import bus from '../bus'
import getCommandDescriptionById from './descriptions'
import { t, getCurrentLanguage } from '../i18n'
import type { EditorState } from '@/store/editor'

interface EncodingEditorState extends EditorState {
  REOPEN_WITH_ENCODING(encoding: string): Promise<void>
}

interface EncodingSubcommand {
  id: string
  description: string
}

class FileEncodingCommand {
  id: string
  description: string
  placeholder: string
  subcommands: EncodingSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EncodingEditorState

  constructor(editorState: EncodingEditorState, private readonly reopen = false) {
    this.id = reopen ? 'file.reopen-encoding' : 'file.change-encoding'
    this.description = reopen ? (getCurrentLanguage().startsWith('zh') ? '按指定编码重新打开文件' : 'Reopen file with encoding') : getCommandDescriptionById('file.change-encoding')
    this.placeholder = t('commandPalette.placeholders.selectOption')

    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async(): Promise<void> => {
    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Load encoding from current tab to highlight it.
    const encodingObj = this._getCurrentEncoding()
    const { encoding, isBom } = encodingObj

    for (const [key, value] of Object.entries(ENCODING_NAME_MAP)) {
      this.subcommands.push({ id: key, description: value })
      if (!this.reopen && /^utf(?:8|16le|16be|32le|32be)$/.test(key)) {
        this.subcommands.push({ id: `${key}-bom`, description: `${value} with BOM` })
      }
    }
    const currentId = !this.reopen && isBom ? `${encoding}-bom` : encoding
    const currentIndex = this.subcommands.findIndex(item => item.id === currentId)
    if (currentIndex >= 0) {
      const [item] = this.subcommands.splice(currentIndex, 1)
      item.description = `${getEncodingName(encodingObj)} - current`
      this.subcommands.unshift(item)
      this.subcommandSelectedIndex = 0
    }
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(id: string): Promise<void> => {
    if (this.reopen) {
      await this._editorState.REOPEN_WITH_ENCODING(id)
    } else {
      bus.emit('mt::set-file-encoding', id)
    }
  }

  unload = (): void => {
    this.subcommands = []
  }

  _getCurrentEncoding = (): Encoding => {
    const { _editorState } = this
    const { currentFile } = _editorState
    if (currentFile) {
      return currentFile.encoding as Encoding
    }
    return { encoding: '' }
  }
}

export default FileEncodingCommand
