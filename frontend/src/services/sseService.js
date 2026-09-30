/**
 * Real-Time Event Stream Service (SSE)
 * Replaces aggressive HTTP polling with push updates
 */

class SSEService {
  constructor() {
    this.eventSource = null;
    this.reconnectTimeout = null;
    this.listeners = new Map(); // eventType -> Set of callbacks
    this.isConnected = false;
  }

  connect() {
    const token = localStorage.getItem('jowis_token');
    if (!token) return;

    if (this.eventSource) {
      this.disconnect();
    }

    const streamUrl = `/api/communications/stream?token=${encodeURIComponent(token)}`;

    try {
      this.eventSource = new EventSource(streamUrl);

      this.eventSource.addEventListener('connected', (e) => {
        this.isConnected = true;
        this.emit('connected', JSON.parse(e.data));
      });

      this.eventSource.addEventListener('notification', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.emit('notification', data);
        } catch (err) {
          console.error('Failed to parse SSE notification:', err);
        }
      });

      this.eventSource.addEventListener('announcement', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.emit('announcement', data);
        } catch (err) {
          console.error('Failed to parse SSE announcement:', err);
        }
      });

      this.eventSource.onerror = () => {
        this.isConnected = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Reconnect after 5 seconds if authenticated
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          if (localStorage.getItem('jowis_token')) {
            this.connect();
          }
        }, 5000);
      };
    } catch (err) {
      console.warn('SSE connection could not be established:', err.message);
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimeout);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      for (const cb of this.listeners.get(eventType)) {
        try {
          cb(data);
        } catch (err) {
          console.error('SSE listener callback error:', err);
        }
      }
    }
  }
}

export const sseService = new SSEService();
