import bus from '@/bus'
import type {
  InsertPlacement,
  VimEditorAdapter,
  VimMotion,
  VimOperator
} from './controller'

interface BlockUnit {
  next: BlockUnit | null
  prev: BlockUnit | null
  getState(): unknown
  remove(): void
  firstContentInDescendant(): ContentBlock | null
  lastContentInDescendant(): ContentBlock | null
}

interface ContentBlock {
  text: string
  path: Array<string | number>
  outMostBlock: BlockUnit | null
  getCursor(): { start: { offset: number }; end: { offset: number } } | null
  setCursor(start: number, end: number, update?: boolean): void
  keydownHandler(event: KeyboardEvent): void
  closestBlock(name: string): BlockUnit | null
  nextContentInContext(): ContentBlock | null
  previousContentInContext(): ContentBlock | null
}

type SelectionEndpoint = SavedEndpoint

interface EditorSelection {
  anchor: SelectionEndpoint
  focus: SelectionEndpoint
  isCollapsed: boolean
}

interface MuyaInstance {
  focus(): void
  undo(): void
  redo(): void
  replaceContent(content: string): boolean
  editor: {
    activeContentBlock: ContentBlock | null
    scrollPage: {
      firstContentInDescendant(): ContentBlock | null
      lastContentInDescendant(): ContentBlock | null
    } | null
    history: {
      markInputBoundary?(inputType: string, data: string | null): void
    }
    selection: {
      getSelection(): EditorSelection | null
      setSelection(anchor: SelectionEndpoint, focus: SelectionEndpoint): void
    }
    clipboard: {
      getClipboardData(): { text: string; html: string }
      cutHandler(): void
      pasteText(text: string): Promise<void>
    }
  }
}

interface SavedEndpoint {
  offset: number
  block: ContentBlock
  path: Array<string | number>
}

interface CharacterFind {
  character: string
  direction: 'forward' | 'backward'
  till: boolean
}

const motionSpec = (motion: VimMotion): {
  direction: 'forward' | 'backward'
  granularity: 'character' | 'word' | 'line' | 'lineboundary' | 'documentboundary'
} | null => {
  switch (motion) {
    case 'left': return { direction: 'backward', granularity: 'character' }
    case 'right': return { direction: 'forward', granularity: 'character' }
    case 'up': return { direction: 'backward', granularity: 'line' }
    case 'down': return { direction: 'forward', granularity: 'line' }
    case 'word-forward': return { direction: 'forward', granularity: 'word' }
    case 'word-backward': return { direction: 'backward', granularity: 'word' }
    case 'word-end': return { direction: 'forward', granularity: 'word' }
    case 'line-start': return { direction: 'backward', granularity: 'lineboundary' }
    case 'line-end': return { direction: 'forward', granularity: 'lineboundary' }
    case 'document-start': return { direction: 'backward', granularity: 'documentboundary' }
    case 'document-end': return { direction: 'forward', granularity: 'documentboundary' }
    default: return null
  }
}

export class MuyaVimAdapter implements VimEditorAdapter {
  private lastFind: CharacterFind | null = null
  private readonly muya: MuyaInstance

  constructor(muya: unknown) {
    this.muya = muya as MuyaInstance
  }

  move(motion: VimMotion, count: number, extend: boolean): void {
    if (motion === 'line-first-nonblank') {
      const block = this.activeBlock()
      if (!block) return
      const offset = block.text.search(/\S|$/)
      this.setEndpoint(block, offset, extend)
      return
    }

    if (motion === 'document-start' || motion === 'document-end') {
      const page = this.muya.editor.scrollPage
      const block = motion === 'document-start'
        ? page?.firstContentInDescendant()
        : page?.lastContentInDescendant()
      if (!block) return
      const offset = motion === 'document-start' ? 0 : block.text.length
      this.setEndpoint(block, offset, extend)
      return
    }

    const spec = motionSpec(motion)
    const selection = window.getSelection()
    if (!spec || !selection) return
    this.muya.focus()
    for (let index = 0; index < count; index += 1) {
      selection.modify(extend ? 'extend' : 'move', spec.direction, spec.granularity)
    }
    this.syncSelection()
  }

  enterInsert(placement: InsertPlacement): void {
    const block = this.activeBlock()
    if (!block) {
      this.muya.focus()
      return
    }
    const cursor = block.getCursor?.()
    const offset = cursor?.end?.offset ?? 0
    switch (placement) {
      case 'after':
        block.setCursor(Math.min(offset + 1, block.text.length), Math.min(offset + 1, block.text.length), true)
        break
      case 'line-start': {
        const first = block.text.search(/\S|$/)
        block.setCursor(first, first, true)
        break
      }
      case 'line-end':
        block.setCursor(block.text.length, block.text.length, true)
        break
      case 'line-below':
        block.setCursor(block.text.length, block.text.length, true)
        block.keydownHandler(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        break
      case 'line-above':
        block.setCursor(0, 0, true)
        block.keydownHandler(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        break
      default:
        block.setCursor(offset, offset, true)
    }
    this.muya.focus()
  }

  leaveInsert(): void {
    const block = this.activeBlock()
    const cursor = block?.getCursor?.()
    if (!block || !cursor) return
    const offset = Math.max(0, cursor.end.offset - 1)
    block.setCursor(offset, offset, true)
  }

  undo(): void {
    this.muya.undo()
  }

  redo(): void {
    this.muya.redo()
  }

  search(direction: 'forward' | 'backward'): void {
    bus.emit('find')
    if (direction === 'backward') bus.emit('findPrev')
  }

  findNext(direction: 'forward' | 'backward'): void {
    bus.emit(direction === 'forward' ? 'findNext' : 'findPrev')
  }

  removeCharacters(count: number): void {
    const block = this.activeBlock()
    const cursor = block?.getCursor?.()
    if (!block || !cursor) return
    const start = cursor.start.offset
    const end = Math.min(block.text.length, start + count)
    if (start === end) return
    this.muya.editor.history.markInputBoundary?.('deleteContentForward', null)
    block.text = block.text.substring(0, start) + block.text.substring(end)
    block.setCursor(Math.min(start, block.text.length), Math.min(start, block.text.length), true)
  }

  operate(operator: VimOperator, motion: VimMotion, count: number): void {
    this.collapseSelection()
    this.move(motion, count, true)
    this.applySelectionOperator(operator)
  }

  operateLine(operator: VimOperator, count: number): void {
    const block = this.activeBlock()
    const firstOutmost = this.lineUnit(block)
    if (!block || !firstOutmost) return

    const blocks = [firstOutmost]
    let next = firstOutmost.next
    while (blocks.length < count && next) {
      blocks.push(next)
      next = next.next
    }
    const start = blocks[0].firstContentInDescendant()
    const end = blocks[blocks.length - 1].lastContentInDescendant()
    if (!start || !end) return
    const savedSelection = this.muya.editor.selection.getSelection()
    this.muya.editor.selection.setSelection(
      { offset: 0, block: start, path: start.path },
      { offset: end.text.length, block: end, path: end.path }
    )
    const markdown = this.muya.editor.clipboard.getClipboardData().text
    if (markdown) window.electron.clipboard.writeText(markdown)

    if (operator === 'yank') {
      const anchor = savedSelection?.anchor
      if (anchor) this.muya.editor.selection.setSelection(anchor, anchor)
      else block.setCursor(0, 0, true)
      return
    }

    if (operator === 'change') {
      this.muya.editor.clipboard.cutHandler()
      return
    }

    const nextBlock = end.nextContentInContext?.()
    const previousBlock = start.previousContentInContext?.()
    if (!nextBlock && !previousBlock) {
      this.muya.replaceContent('')
      this.muya.focus()
      return
    }
    for (const item of blocks) item.remove()
    const target = nextBlock ?? previousBlock
    target?.setCursor(0, 0, true)
  }

  operateSelection(operator: VimOperator, linewise: boolean): void {
    if (linewise) this.expandToWholeBlocks()
    this.applySelectionOperator(operator)
  }

  paste(position: 'after' | 'before', count: number): void {
    window.electron.clipboard.readText().then((text) => {
      if (!text) return
      const block = this.activeBlock()
      const cursor = block?.getCursor?.()
      if (!block || !cursor) return
      const offset = position === 'after'
        ? Math.min(cursor.end.offset + 1, block.text.length)
        : cursor.start.offset
      block.setCursor(offset, offset, true)
      const repeated = Array.from({ length: count }, () => text).join('')
      return this.muya.editor.clipboard.pasteText(repeated)
    }).catch(() => undefined)
  }

  findCharacter(
    character: string,
    direction: 'forward' | 'backward',
    till: boolean,
    count: number,
    extend: boolean
  ): void {
    this.lastFind = { character, direction, till }
    const block = this.activeBlock()
    const cursor = block?.getCursor?.()
    if (!block || !cursor) return
    let offset = cursor.end.offset
    for (let index = 0; index < count; index += 1) {
      const found = direction === 'forward'
        ? block.text.indexOf(character, offset + 1)
        : block.text.lastIndexOf(character, offset - 1)
      if (found < 0) return
      offset = found
    }
    if (till) offset += direction === 'forward' ? -1 : 1
    this.setEndpoint(block, offset, extend)
  }

  repeatCharacterFind(reverse: boolean, count: number, extend: boolean): void {
    if (!this.lastFind) return
    const direction = reverse
      ? this.lastFind.direction === 'forward' ? 'backward' : 'forward'
      : this.lastFind.direction
    this.findCharacter(this.lastFind.character, direction, this.lastFind.till, count, extend)
  }

  beginVisual(linewise: boolean): void {
    if (linewise) this.expandToWholeBlocks()
  }

  collapseSelection(): void {
    const selection = this.muya.editor.selection.getSelection()
    if (!selection) return
    const focus = selection.focus as SavedEndpoint
    this.muya.editor.selection.setSelection(focus, focus)
  }

  private activeBlock(): ContentBlock | null {
    const selection = this.muya.editor.selection.getSelection()
    return selection?.focus?.block ?? selection?.anchor?.block ?? this.muya.editor.activeContentBlock ?? null
  }

  private lineUnit(block: ContentBlock | null): BlockUnit | null {
    if (!block) return null
    return block.closestBlock('list-item') ??
      block.closestBlock('task-list-item') ??
      block.closestBlock('table.row') ??
      block.outMostBlock
  }

  private setEndpoint(block: ContentBlock, offset: number, extend: boolean): void {
    const bounded = Math.max(0, Math.min(offset, block.text.length))
    if (!extend) {
      block.setCursor(bounded, bounded, true)
      return
    }
    const selection = this.muya.editor.selection.getSelection()
    const anchor = selection?.anchor
    if (!anchor) {
      block.setCursor(bounded, bounded, true)
      return
    }
    this.muya.editor.selection.setSelection(anchor, {
      offset: bounded,
      block,
      path: block.path
    })
  }

  private syncSelection(): void {
    const selection = this.muya.editor.selection.getSelection()
    if (selection) this.muya.editor.selection.setSelection(selection.anchor, selection.focus)
  }

  private applySelectionOperator(operator: VimOperator): void {
    const selection = this.muya.editor.selection.getSelection()
    if (!selection || selection.isCollapsed) return
    const anchor = selection.anchor as SavedEndpoint
    if (operator === 'yank') {
      const payload = this.muya.editor.clipboard.getClipboardData()
      if (payload.text) window.electron.clipboard.writeText(payload.text)
      this.muya.editor.selection.setSelection(anchor, anchor)
      return
    }
    this.muya.editor.clipboard.cutHandler()
  }

  private expandToWholeBlocks(): void {
    const selection = this.muya.editor.selection.getSelection()
    const anchorBlock = selection?.anchor?.block ?? this.activeBlock()
    const focusBlock = selection?.focus?.block ?? anchorBlock
    const start = anchorBlock?.outMostBlock?.firstContentInDescendant?.()
    const end = focusBlock?.outMostBlock?.lastContentInDescendant?.()
    if (!start || !end) return
    this.muya.editor.selection.setSelection(
      { offset: 0, block: start, path: start.path },
      { offset: end.text.length, block: end, path: end.path }
    )
  }
}
