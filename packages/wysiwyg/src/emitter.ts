export type EventHandler<T = unknown> = (payload: T) => void

/** Minimal typed pub/sub matching the muya EventCenter surface we expose. */
export class Emitter {
  private handlers = new Map<string, Set<EventHandler>>()

  on<T>(event: string, handler: EventHandler<T>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as EventHandler)
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler)
  }

  once<T>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = payload => {
      this.off(event, wrapper)
      handler(payload)
    }
    this.on(event, wrapper)
  }

  emit<T>(event: string, payload?: T): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of [...set]) handler(payload as T)
  }

  clear(): void {
    this.handlers.clear()
  }
}
