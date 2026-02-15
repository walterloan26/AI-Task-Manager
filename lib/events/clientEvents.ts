// lib/events/clientEvents.ts

type EventCallback = (data?: any) => void;

class ClientEventEmitter {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.events.get(event);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event: string, data?: any) {
    const callbacks = this.events.get(event);
    if (!callbacks) return;

    const handlers = [...callbacks];

    queueMicrotask(() => {
      handlers.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Event handler error (${event})`, err);
        }
      });
    });
  }
}

/*
  TRUE singleton across entire browser runtime
*/
const globalForEvents = globalThis as unknown as {
  clientEvents?: ClientEventEmitter;
};

export const clientEvents =
  globalForEvents.clientEvents ??
  (globalForEvents.clientEvents = new ClientEventEmitter());
