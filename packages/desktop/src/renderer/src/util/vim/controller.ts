import type { VimMode } from '@/store/vim'

export type VimMotion =
  | 'left'
  | 'down'
  | 'up'
  | 'right'
  | 'word-forward'
  | 'word-backward'
  | 'word-end'
  | 'line-start'
  | 'line-first-nonblank'
  | 'line-end'
  | 'document-start'
  | 'document-end'

export type VimOperator = 'delete' | 'change' | 'yank'
export type InsertPlacement = 'before' | 'after' | 'line-start' | 'line-end' | 'line-below' | 'line-above'

export interface VimEditorAdapter {
  move(motion: VimMotion, count: number, extend: boolean): void
  enterInsert(placement: InsertPlacement): void
  leaveInsert(): void
  undo(): void
  redo(): void
  search(direction: 'forward' | 'backward'): void
  findNext(direction: 'forward' | 'backward'): void
  removeCharacters(count: number): void
  operate(operator: VimOperator, motion: VimMotion, count: number): void
  operateLine(operator: VimOperator, count: number): void
  operateSelection(operator: VimOperator, linewise: boolean): void
  paste(position: 'after' | 'before', count: number): void
  findCharacter(character: string, direction: 'forward' | 'backward', till: boolean, count: number, extend: boolean): void
  repeatCharacterFind(reverse: boolean, count: number, extend: boolean): void
  beginVisual(linewise: boolean): void
  collapseSelection(): void
}

export interface VimControllerOptions {
  adapter: VimEditorAdapter
  onModeChange: (mode: VimMode) => void
  onPendingChange?: (pending: string) => void
}

const MOTIONS: Partial<Record<string, VimMotion>> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
  w: 'word-forward',
  b: 'word-backward',
  e: 'word-end',
  0: 'line-start',
  '^': 'line-first-nonblank',
  $: 'line-end',
  G: 'document-end'
}

const OPERATOR_KEYS: Partial<Record<string, VimOperator>> = {
  d: 'delete',
  c: 'change',
  y: 'yank'
}

interface PendingFind {
  direction: 'forward' | 'backward'
  till: boolean
}

export class VimController {
  private readonly adapter: VimEditorAdapter
  private readonly onModeChange: (mode: VimMode) => void
  private readonly onPendingChange: (pending: string) => void
  private mode: VimMode = 'normal'
  private count = ''
  private pendingOperator: VimOperator | null = null
  private pendingG = false
  private pendingFind: PendingFind | null = null

  constructor(options: VimControllerOptions) {
    this.adapter = options.adapter
    this.onModeChange = options.onModeChange
    this.onPendingChange = options.onPendingChange ?? (() => {})
    this.emitState()
  }

  get currentMode(): VimMode {
    return this.mode
  }

  reset(): void {
    this.mode = 'normal'
    this.clearPending()
    this.emitState()
  }

  handle(event: KeyboardEvent): boolean {
    if (this.mode === 'search') {
      if (event.key === 'Escape') {
        this.setMode('normal')
        return true
      }
      return false
    }

    if (this.mode === 'insert') {
      if (event.key === 'Escape' || (event.ctrlKey && event.key === '[')) {
        this.adapter.leaveInsert()
        this.setMode('normal')
        return true
      }
      return false
    }

    if (event.metaKey || event.altKey || (event.ctrlKey && event.key.toLowerCase() !== 'r')) {
      return false
    }

    if (event.ctrlKey && event.key.toLowerCase() === 'r') {
      this.adapter.redo()
      this.clearPending()
      return true
    }

    const key = event.key
    if (key === 'Escape') {
      if (this.isVisual()) this.adapter.collapseSelection()
      this.setMode('normal')
      return true
    }

    if (this.pendingFind) {
      if (key.length === 1) {
        const pending = this.pendingFind
        this.adapter.findCharacter(
          key,
          pending.direction,
          pending.till,
          this.takeCount(),
          this.isVisual()
        )
      }
      this.clearPending()
      return true
    }

    if (/^[1-9]$/.test(key) || (key === '0' && this.count.length > 0)) {
      this.count += key
      this.emitPending()
      return true
    }

    if (this.pendingG) {
      if (key === 'g') {
        if (this.pendingOperator) {
          const operator = this.pendingOperator
          this.adapter.operate(operator, 'document-start', this.takeCount())
          this.afterOperator(operator)
          return true
        }
        this.adapter.move('document-start', this.takeCount(), this.isVisual())
      }
      this.clearPending()
      return true
    }

    if (this.pendingOperator) {
      return this.handlePendingOperator(key)
    }

    if (this.isVisual()) return this.handleVisual(key)

    const motion = MOTIONS[key]
    if (motion) {
      this.adapter.move(motion, this.takeCount(), false)
      this.clearPending()
      return true
    }

    const operator = OPERATOR_KEYS[key]
    if (operator) {
      this.pendingOperator = operator
      this.emitPending()
      return true
    }

    switch (key) {
      case 'g':
        this.pendingG = true
        this.emitPending()
        return true
      case 'i':
        return this.beginInsert('before')
      case 'I':
        return this.beginInsert('line-start')
      case 'a':
        return this.beginInsert('after')
      case 'A':
        return this.beginInsert('line-end')
      case 'o':
        return this.beginInsert('line-below')
      case 'O':
        return this.beginInsert('line-above')
      case 'u':
        this.adapter.undo()
        break
      case 'x':
        this.adapter.removeCharacters(this.takeCount())
        break
      case 'D':
        this.adapter.operate('delete', 'line-end', this.takeCount())
        break
      case 'Y':
        this.adapter.operateLine('yank', this.takeCount())
        break
      case 'p':
      case 'P':
        this.adapter.paste(key === 'p' ? 'after' : 'before', this.takeCount())
        break
      case 'v':
        this.adapter.beginVisual(false)
        this.setMode('visual')
        return true
      case 'V':
        this.adapter.beginVisual(true)
        this.setMode('visual-line')
        return true
      case '/':
      case '?':
        this.adapter.search(key === '/' ? 'forward' : 'backward')
        this.setMode('search')
        return true
      case 'n':
      case 'N':
        this.adapter.findNext(key === 'n' ? 'forward' : 'backward')
        break
      case 'f':
      case 'F':
      case 't':
      case 'T':
        this.pendingFind = {
          direction: key === 'f' || key === 't' ? 'forward' : 'backward',
          till: key === 't' || key === 'T'
        }
        this.emitPending()
        return true
      case ';':
      case ',':
        this.adapter.repeatCharacterFind(key === ',', this.takeCount(), false)
        break
      default:
        this.clearPending()
        return false
    }

    this.clearPending()
    return true
  }

  finishSearch(): void {
    if (this.mode === 'search') this.setMode('normal')
  }

  private handlePendingOperator(key: string): boolean {
    const operator = this.pendingOperator
    if (!operator) return false
    const operatorKey = Object.entries(OPERATOR_KEYS).find(([, value]) => value === operator)?.[0]

    if (key === operatorKey) {
      this.adapter.operateLine(operator, this.takeCount())
      this.afterOperator(operator)
      return true
    }

    if (key === 'g') {
      this.pendingG = true
      this.emitPending()
      return true
    }

    const motion = MOTIONS[key]
    if (motion) {
      this.adapter.operate(operator, motion, this.takeCount())
      this.afterOperator(operator)
      return true
    }

    this.clearPending()
    return true
  }

  private handleVisual(key: string): boolean {
    if (key === 'v') {
      this.adapter.collapseSelection()
      this.setMode(this.mode === 'visual' ? 'normal' : 'visual')
      return true
    }
    if (key === 'V') {
      if (this.mode === 'visual-line') {
        this.adapter.collapseSelection()
        this.setMode('normal')
      } else {
        this.adapter.beginVisual(true)
        this.setMode('visual-line')
      }
      return true
    }

    const operator = OPERATOR_KEYS[key]
    if (operator) {
      this.adapter.operateSelection(operator, this.mode === 'visual-line')
      this.afterOperator(operator)
      return true
    }

    const motion = MOTIONS[key]
    if (motion) {
      this.adapter.move(motion, this.takeCount(), true)
      this.clearPending()
      return true
    }

    if (key === 'g') {
      this.pendingG = true
      this.emitPending()
      return true
    }

    if (key === 'f' || key === 'F' || key === 't' || key === 'T') {
      this.pendingFind = {
        direction: key === 'f' || key === 't' ? 'forward' : 'backward',
        till: key === 't' || key === 'T'
      }
      this.emitPending()
      return true
    }

    this.clearPending()
    return false
  }

  private beginInsert(placement: InsertPlacement): true {
    this.adapter.enterInsert(placement)
    this.setMode('insert')
    return true
  }

  private afterOperator(operator: VimOperator): void {
    this.clearPending()
    if (operator === 'change') {
      this.adapter.enterInsert('before')
      this.setMode('insert')
    } else {
      this.setMode('normal')
    }
  }

  private isVisual(): boolean {
    return this.mode === 'visual' || this.mode === 'visual-line'
  }

  private takeCount(): number {
    const count = Number.parseInt(this.count, 10) || 1
    this.count = ''
    return count
  }

  private setMode(mode: VimMode): void {
    this.mode = mode
    this.clearPending()
    this.emitState()
  }

  private clearPending(): void {
    this.count = ''
    this.pendingOperator = null
    this.pendingG = false
    this.pendingFind = null
    this.emitPending()
  }

  private emitState(): void {
    this.onModeChange(this.mode)
    this.emitPending()
  }

  private emitPending(): void {
    const operator = this.pendingOperator
      ? Object.entries(OPERATOR_KEYS).find(([, value]) => value === this.pendingOperator)?.[0] ?? ''
      : ''
    const special = this.pendingG
      ? 'g'
      : this.pendingFind
        ? this.pendingFind.till
          ? this.pendingFind.direction === 'forward' ? 't' : 'T'
          : this.pendingFind.direction === 'forward' ? 'f' : 'F'
        : ''
    this.onPendingChange(`${this.count}${operator}${special}`)
  }
}
