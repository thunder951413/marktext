import { reactive } from 'vue'

export interface LiveEditorSelectionState {
  hasSelection: boolean
  isDisabled: boolean
  isCodeFences: boolean
  isTable: boolean
  isTaskList: boolean
  activeFormats: Record<string, boolean>
}

export const editorSelectionState = reactive<LiveEditorSelectionState>({
  hasSelection: false,
  isDisabled: false,
  isCodeFences: false,
  isTable: false,
  isTaskList: false,
  activeFormats: {}
})

export const updateEditorSelectionState = (payload: {
  hasSelection: boolean
  isDisabled: boolean
  isCodeFences: boolean
  isTable: boolean
  isTaskList: boolean
}): void => {
  editorSelectionState.hasSelection = payload.hasSelection
  editorSelectionState.isDisabled = payload.isDisabled
  editorSelectionState.isCodeFences = payload.isCodeFences
  editorSelectionState.isTable = payload.isTable
  editorSelectionState.isTaskList = payload.isTaskList
}

export const updateEditorSelectionFormats = (formats: Record<string, boolean>): void => {
  editorSelectionState.activeFormats = { ...formats }
}

export const resetEditorSelectionState = (): void => {
  editorSelectionState.hasSelection = false
  editorSelectionState.isDisabled = false
  editorSelectionState.isCodeFences = false
  editorSelectionState.isTable = false
  editorSelectionState.isTaskList = false
  editorSelectionState.activeFormats = {}
}
