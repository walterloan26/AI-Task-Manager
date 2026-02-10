// lib/events/eventEmitter.ts
type EventCallback = (data?: any) => void;

class EventEmitter {
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
      // Clone the array to avoid issues if callbacks modify the array
      [...this.events.get(event)!].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Clear all listeners for an event
  clear(event: string) {
    this.events.delete(event);
  }

  // Clear all events
  clearAll() {
    this.events.clear();
  }
}

// Create a singleton instance
export const globalEvents = new EventEmitter();