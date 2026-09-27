import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketHub } from '../src/ws/websocket_hub.js';

describe('WebSocketHub', () => {
  let server: Server;
  let wss: WebSocketServer;
  let hub: WebSocketHub;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    wss = new WebSocketServer({ server });
    hub = new WebSocketHub(wss);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    hub.close();
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('manages client connection, subscriptions, and room broadcasts', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    expect(hub.getTotalConnected()).toBe(1);

    // Subscribe to auction
    ws.send(JSON.stringify({
      type: 'SUBSCRIBE',
      auctionId: 'auction-123',
      timestamp: Date.now()
    }));

    // Wait for subscription processing
    await new Promise((r) => setTimeout(r, 50));
    expect(hub.getSubscriberCount('auction-123')).toBe(1);

    // Broadcast event to room
    const receivedMessages: unknown[] = [];
    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    hub.broadcastToAuction('auction-123', {
      type: 'BID_PLACED',
      auctionId: 'auction-123',
      payload: { amount: 15000 },
      timestamp: Date.now()
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(receivedMessages.length).toBe(1);
    expect((receivedMessages[0] as { type: string }).type).toBe('BID_PLACED');

    // Unsubscribe
    ws.send(JSON.stringify({
      type: 'UNSUBSCRIBE',
      auctionId: 'auction-123',
      timestamp: Date.now()
    }));

    await new Promise((r) => setTimeout(r, 50));
    expect(hub.getSubscriberCount('auction-123')).toBe(0);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(hub.getTotalConnected()).toBe(0);
  });
});
