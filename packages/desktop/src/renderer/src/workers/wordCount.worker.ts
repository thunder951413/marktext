import { wordCount } from '@muyajs/core/utils/wordCount'
import type { FileWordCount } from '../../../shared/types/files'

interface WordCountRequest {
  id: number
  markdown: string
}

interface WordCountResponse {
  id: number
  result?: FileWordCount
  error?: string
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WordCountRequest>) => void) | null
  postMessage: (message: WordCountResponse) => void
}

workerScope.onmessage = ({ data }) => {
  try {
    workerScope.postMessage({ id: data.id, result: wordCount(data.markdown) })
  } catch (error) {
    workerScope.postMessage({ id: data.id, error: String(error) })
  }
}
