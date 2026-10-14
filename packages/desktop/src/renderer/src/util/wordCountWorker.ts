import type { FileWordCount } from '../../../shared/types/files'

interface WordCountResponse {
  id: number
  result?: FileWordCount
  error?: string
}

interface PendingRequest {
  markdown: string
  resolve: (result: FileWordCount) => void
}

let nextRequestId = 0
let worker: Worker | null = null
let workerUnavailable = false
const pending = new Map<number, PendingRequest>()

const countOnMainThread = async(markdown: string): Promise<FileWordCount> => {
  const { wordCount } = await import('@muyajs/core/utils/wordCount')
  return wordCount(markdown)
}

const disableWorker = () => {
  workerUnavailable = true
  worker?.terminate()
  worker = null
  for (const [id, request] of pending) {
    pending.delete(id)
    countOnMainThread(request.markdown).then(request.resolve)
  }
}

const getWorker = (): Worker | null => {
  if (workerUnavailable || typeof Worker === 'undefined') return null
  if (worker) return worker

  try {
    worker = new Worker(new URL('../workers/wordCount.worker.ts', import.meta.url), {
      type: 'module',
      name: 'marktext-word-count'
    })
    worker.onmessage = ({ data }: MessageEvent<WordCountResponse>) => {
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)
      if (data.result) request.resolve(data.result)
      else countOnMainThread(request.markdown).then(request.resolve)
    }
    worker.onerror = disableWorker
    return worker
  } catch {
    disableWorker()
    return null
  }
}

/** Count a Markdown snapshot without blocking renderer input or painting. */
export const getWordCount = (markdown: string): Promise<FileWordCount> => {
  const activeWorker = getWorker()
  if (!activeWorker) return countOnMainThread(markdown)

  return new Promise((resolve) => {
    const id = ++nextRequestId
    pending.set(id, { markdown, resolve })
    try {
      activeWorker.postMessage({ id, markdown })
    } catch {
      pending.delete(id)
      disableWorker()
      countOnMainThread(markdown).then(resolve)
    }
  })
}
