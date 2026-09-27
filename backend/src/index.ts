import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createDatabase } from './db/database.js';
import { AuctionService } from './services/auction_service.js';
import { WebSocketHub } from './ws/websocket_hub.js';
import { buildApp } from './api/app.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const DB_PATH = process.env.DB_PATH || 'data/auctions.db';

async function bootstrap() {
  const db = createDatabase(DB_PATH);
  const auctionService = new AuctionService(db);

  // Create Node HTTP server for both Fastify and WebSockets
  const server = createServer();

  // Create WebSocket Server mounted on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsHub = new WebSocketHub(wss);

  // Create Fastify app
  const app = buildApp(auctionService, wsHub);
  await app.ready();

  // Forward HTTP requests to Fastify
  server.on('request', (req, res) => {
    app.server.emit('request', req, res);
  });

  // Background ticker for auction expiration checks
  const ticker = setInterval(() => {
    const expired = auctionService.checkAndExpireAllActive();
    for (const a of expired) {
      wsHub.broadcastToAuction(a.id, {
        type: 'AUCTION_ENDED',
        auctionId: a.id,
        payload: a,
        timestamp: Date.now()
      });
      wsHub.broadcastAll({
        type: 'AUCTION_STATUS_CHANGED',
        auctionId: a.id,
        payload: a,
        timestamp: Date.now()
      });
    }
  }, 1000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AUCTION-ENGINE] Server running at http://localhost:${PORT}`);
    console.log(`[AUCTION-ENGINE] WebSocket endpoint at ws://localhost:${PORT}/ws`);
    console.log(`[AUCTION-ENGINE] SQLite DB initialized at ${DB_PATH} (WAL mode)`);
  });

  const shutdown = async () => {
    console.log('\n[AUCTION-ENGINE] Shutting down gracefully...');
    clearInterval(ticker);
    wsHub.close();
    wss.close();
    await app.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[AUCTION-ENGINE] Fatal error starting server:', err);
  process.exit(1);
});
