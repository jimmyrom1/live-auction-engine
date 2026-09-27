import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuctionService } from '../services/auction_service.js';
import { WebSocketHub } from '../ws/websocket_hub.js';
import { CreateAuctionInput, PlaceBidInput } from '../domain/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function buildApp(
  auctionService: AuctionService,
  wsHub?: WebSocketHub
): FastifyInstance {
  const app = Fastify({
    logger: false
  });

  app.register(cors, {
    origin: true
  });

  // Serve static React SPA if built
  const staticPath = resolve(__dirname, '../../../frontend/dist');
  if (existsSync(staticPath)) {
    app.register(fastifyStatic, {
      root: staticPath,
      prefix: '/'
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  }


  // Health check
  app.get('/healthz', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // List all auctions
  app.get('/api/auctions', async () => {
    return auctionService.listAuctions();
  });

  // Create new auction
  app.post<{ Body: CreateAuctionInput }>('/api/auctions', async (req, reply) => {
    const { title, description, starting_price, min_increment, duration_seconds, anti_sniping_trigger_seconds, anti_sniping_extend_seconds } = req.body || {};

    if (!title || typeof starting_price !== 'number' || starting_price <= 0) {
      return reply.status(400).send({
        error: 'title and positive starting_price are required'
      });
    }

    try {
      const auction = auctionService.createAuction({
        title,
        description,
        starting_price,
        min_increment,
        duration_seconds: duration_seconds || 300,
        anti_sniping_trigger_seconds,
        anti_sniping_extend_seconds
      });

      wsHub?.broadcastAll({
        type: 'AUCTION_STATUS_CHANGED',
        auctionId: auction.id,
        payload: auction,
        timestamp: Date.now()
      });

      return reply.status(201).send(auction);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating auction';
      return reply.status(400).send({ error: message });
    }
  });

  // Get single auction
  app.get<{ Params: { id: string } }>('/api/auctions/:id', async (req, reply) => {
    const auction = auctionService.getAuction(req.params.id);
    if (!auction) {
      return reply.status(404).send({ error: 'Auction not found' });
    }
    return auction;
  });

  // Get bids for an auction
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/auctions/:id/bids',
    async (req) => {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      return auctionService.getBids(req.params.id, limit);
    }
  );

  // Place a bid
  app.post<{ Params: { id: string }; Body: Omit<PlaceBidInput, 'auction_id'> }>(
    '/api/auctions/:id/bids',
    async (req, reply) => {
      const auctionId = req.params.id;
      const { bidder_id, bidder_name, amount } = req.body || {};

      if (!bidder_id || !bidder_name || typeof amount !== 'number') {
        return reply.status(400).send({
          error: 'bidder_id, bidder_name, and numeric amount are required'
        });
      }

      const result = auctionService.placeBid({
        auction_id: auctionId,
        bidder_id,
        bidder_name,
        amount
      });

      if (!result.success) {
        return reply.status(result.statusCode || 400).send({
          error: result.error,
          errorCode: result.errorCode
        });
      }

      // Broadcast bid to auction room subscribers
      if (wsHub && result.bid && result.auction) {
        wsHub.broadcastToAuction(auctionId, {
          type: 'BID_PLACED',
          auctionId,
          payload: {
            bid: result.bid,
            current_price: result.auction.current_price,
            winner_user_id: result.auction.winner_user_id,
            end_time: result.auction.end_time,
            extended: result.extended
          },
          timestamp: Date.now()
        });

        if (result.extended) {
          wsHub.broadcastToAuction(auctionId, {
            type: 'ANTI_SNIPING_TRIGGERED',
            auctionId,
            payload: {
              new_end_time: result.new_end_time,
              extensions_count: result.auction.sniping_extensions_count,
              added_seconds: result.auction.anti_sniping_extend_seconds
            },
            timestamp: Date.now()
          });
        }
      }

      return reply.status(200).send(result);
    }
  );

  return app;
}
