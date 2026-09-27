import { WsMessage } from '../types.ts';

type MessageHandler = (message: WsMessage) => void;
type StatusHandler = (connected: boolean) => void;

export class AuctionWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private subscribedAuctions: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isExplicitlyClosed = false;

  constructor(private url: string = '') {
    if (!this.url && typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${proto}//${window.location.host}/ws`;
    }
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.notifyStatus(true);
        // Resubscribe to previous rooms
        for (const auctionId of this.subscribedAuctions) {
          this.send({
            type: 'SUBSCRIBE',
            auctionId,
            timestamp: Date.now()
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          for (const handler of this.messageHandlers) {
            handler(msg);
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus(false);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  subscribe(auctionId: string): void {
    this.subscribedAuctions.add(auctionId);
    this.send({
      type: 'SUBSCRIBE',
      auctionId,
      timestamp: Date.now()
    });
  }

  unsubscribe(auctionId: string): void {
    this.subscribedAuctions.delete(auctionId);
    this.send({
      type: 'UNSUBSCRIBE',
      auctionId,
      timestamp: Date.now()
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private send(msg: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private notifyStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) {
      handler(connected);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new AuctionWebSocket();
