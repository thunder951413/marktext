// Vitest's DOM environments implement Web APIs on `window` but do not hoist
// them onto the global object, and for opaque test origins their storage backends
// are unavailable anyway. Renderer code (and these specs) read bare
// `localStorage`, so provide an in-memory implementation when missing.

interface MemoryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
}

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    }
  }
}

function resolveStorage(): MemoryStorage | undefined {
  if (typeof localStorage !== 'undefined') return localStorage as unknown as MemoryStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage as unknown as MemoryStorage
    }
  } catch {
    // Opaque-origin environments throw on access; fall through to the polyfill.
  }
  return undefined
}

const storage = resolveStorage() ?? createMemoryStorage()

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true
  })
}
