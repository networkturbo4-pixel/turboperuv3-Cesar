/**
 * Agrupa ráfagas de mensajes consecutivos de la misma conversación
 * y evita ejecuciones concurrentes sobre el mismo hilo.
 */
export class ConversationDebouncer {
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<number>();
  private rerunAfterFinish = new Set<number>();

  schedule(conversationId: number, delayMs: number, task: () => Promise<void>): void {
    const existing = this.timers.get(conversationId);
    if (existing) clearTimeout(existing);

    const safeDelay = Math.max(0, delayMs);
    const timer = setTimeout(() => {
      this.timers.delete(conversationId);
      void this.runExclusive(conversationId, task);
    }, safeDelay);
    timer.unref?.();
    this.timers.set(conversationId, timer);
  }

  private async runExclusive(conversationId: number, task: () => Promise<void>): Promise<void> {
    if (this.inFlight.has(conversationId)) {
      this.rerunAfterFinish.add(conversationId);
      return;
    }
    this.inFlight.add(conversationId);
    try {
      await task();
    } finally {
      this.inFlight.delete(conversationId);
      if (this.rerunAfterFinish.delete(conversationId)) {
        void this.runExclusive(conversationId, task);
      }
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
