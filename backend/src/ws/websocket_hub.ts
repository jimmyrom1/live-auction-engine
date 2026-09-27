import { WebSocket, WebSocketServer } from 'ws';
import { WsMessage } from '../domain/types.js';

interface ClientMetadata {
  isAlive: boolean;
  subscriptions: Set<string>;
}

export class WebSocketHub {
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private clients: Map<WebSocket, ClientMetadata> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private wss: WebSocketServer) {
    this.setupWss();
    this.startHeartbeat();
  }

  private setupWss(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.set(ws, {
        isAlive: true,
        subscriptions: new Set()
      });

      ws.on('pong', () => {
        const meta = this.clients.get(ws);
        if (meta) {
          meta.isAlive = true;
        }
      });

      ws.on('message', (raw: Buffer | string) => {
        try {
          const parsed = JSON.parse(raw.toString()) as WsMessage;
          this.handleClientMessage(ws, parsed);
        } catch {
          this.sendDirect(ws, {
            type: 'ERROR',
            payload: 'Malformed JSON payload',
            timestamp: Date.now()
          });
        }
      });

      ws.on('close', () => {
        this.cleanupClient(ws);
      });

      ws.on('error', () => {
        this.cleanupClient(ws);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, msg: WsMessage): void {
    const meta = this.clients.get(ws);
    if (!meta) return;

    switch (msg.type) {
      case 'SUBSCRIBE':
        if (msg.auctionId) {
          this.subscribe(ws, msg.auctionId);
        }
        break;

      case 'UNSUBSCRIBE':
        if (msg.auctionId) {
          this.unsubscribe(ws, msg.auctionId);
        }
        break;

      case 'PING':
        this.sendDirect(ws, {
          type: 'PONG',
          timestamp: Date.now()
        });
        break;
    }
  }

  subscribe(ws: WebSocket, auctionId: string): void {
    const meta = this.clients.get(ws);
    if (!meta) return;

    meta.subscriptions.add(auctionId);

    if (!this.rooms.has(auctionId)) {
      this.rooms.set(auctionId, new Set());
    }
    this.rooms.get(auctionId)!.add(ws);
  }

  unsubscribe(ws: WebSocket, auctionId: string): void {
    const meta = this.clients.get(ws);
    if (meta) {
      meta.subscriptions.delete(auctionId);
    }

    const room = this.rooms.get(auctionId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(auctionId);
      }
    }
  }

  broadcastToAuction(auctionId: string, message: WsMessage): void {
    const room = this.rooms.get(auctionId);
    if (!room) return;

    const data = JSON.stringify(message);
    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  broadcastAll(message: WsMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  sendDirect(ws: WebSocket, message: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private cleanupClient(ws: WebSocket): void {
    const meta = this.clients.get(ws);
    if (meta) {
      for (const auctionId of meta.subscriptions) {
        const room = this.rooms.get(auctionId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            this.rooms.delete(auctionId);
          }
        }
      }
    }
    this.clients.delete(ws);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, meta] of this.clients.entries()) {
        if (!meta.isAlive) {
          this.cleanupClient(ws);
          ws.terminate();
          continue;
        }
        meta.isAlive = false;
        ws.ping();
      }
    }, 30000);
  }

  getSubscriberCount(auctionId: string): number {
    return this.rooms.get(auctionId)?.size ?? 0;
  }

  getTotalConnected(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
