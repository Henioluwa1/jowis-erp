import { EventEmitter } from 'events';

class SSEManager extends EventEmitter {
  constructor() {
    super();
    // Map of connectionId -> { res, userId, role, ip }
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  startHeartbeat() {
    // Keep connections alive and prevent proxy timeouts every 30s
    this.heartbeatInterval = setInterval(() => {
      const comment = `: ping ${Date.now()}\n\n`;
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(comment);
        } catch {
          this.clients.delete(id);
        }
      }
    }, 30000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  addClient(connectionId, res, user) {
    this.clients.set(connectionId, {
      res,
      userId: user.id,
      role: user.role
    });

    // Send initial connection packet
    res.write(`event: connected\ndata: ${JSON.stringify({
      message: 'Connected to Jowis Real-Time Event Stream',
      userId: user.id,
      role: user.role,
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.on('close', () => {
      this.clients.delete(connectionId);
    });
  }

  sendToUser(userId, eventType, payload) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          client.res.write(message);
        } catch {
          this.clients.delete(id);
        }
      }
    }
  }

  broadcast(eventType, payload, roleFilter = null) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (!roleFilter || client.role === roleFilter) {
        try {
          client.res.write(message);
        } catch {
          this.clients.delete(id);
        }
      }
    }
  }

  getActiveClientCount() {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
