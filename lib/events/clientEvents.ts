// Client-side only event emitter
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
    if (this.events.has(event)) {
      const callbacks = this.events.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any) {
    if (this.events.has(event)) {
      // Use setTimeout to avoid blocking UI
      setTimeout(() => {
        [...this.events.get(event)!].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event handler for ${event}:`, error);
          }
        });
      }, 0);
    }
  }
}

// Singleton for client-side events
export const clientEvents = new ClientEventEmitter();