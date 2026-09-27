import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import { createServer, Server } from 'node:http';
import { createDatabase } from '../src/db/database.js';
import { AuctionService } from '../src/services/auction_service.js';
import { WebSocketHub } from '../src/ws/websocket_hub.js';
import { buildApp } from '../src/api/app.js';

describe('Fastify REST API', () => {
  let app: FastifyInstance;
  let service: AuctionService;
  let server: Server;
  let wss: WebSocketServer;
  let wsHub: WebSocketHub;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    service = new AuctionService(db);
    server = createServer();
    wss = new WebSocketServer({ server });
    wsHub = new WebSocketHub(wss);
    app = buildApp(service, wsHub);
    await app.ready();
  });

  afterEach(async () => {
    wsHub.close();
    wss.close();
    await app.close();
  });


  it('GET /healthz returns ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('POST /api/auctions creates and returns a new auction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      payload: {
        title: 'Pokemon Base Set Booster Box',
        description: 'Sealed 1st Edition',
        starting_price: 1000000,
        min_increment: 25000,
        duration_seconds: 3600
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Pokemon Base Set Booster Box');
    expect(body.current_price).toBe(1000000);
    expect(body.status).toBe('ACTIVE');
  });

  it('GET /api/auctions/:id retrieves created auction and 404 for missing', async () => {
    const created = service.createAuction({
      title: 'Diamond Ring',
      starting_price: 300000,
      duration_seconds: 1800
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/auctions/${created.id}`
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe(created.id);

    const missingRes = await app.inject({
      method: 'GET',
      url: '/api/auctions/non-existent-uuid'
    });
    expect(missingRes.statusCode).toBe(404);
  });

  it('POST /api/auctions/:id/bids places a bid and returns result', async () => {
    const created = service.createAuction({
      title: 'Gaming Laptop',
      starting_price: 120000,
      min_increment: 5000,
      duration_seconds: 1800
    });

    const bidRes = await app.inject({
      method: 'POST',
      url: `/api/auctions/${created.id}/bids`,
      payload: {
        bidder_id: 'user-bob',
        bidder_name: 'Bob',
        amount: 120000
      }
    });

    expect(bidRes.statusCode).toBe(200);
    const body = JSON.parse(bidRes.body);
    expect(body.success).toBe(true);
    expect(body.bid.amount).toBe(120000);
    expect(body.auction.winner_user_id).toBe('user-bob');
  });

  it('GET /api/auctions returns list of auctions', async () => {
    service.createAuction({ title: 'Item 1', starting_price: 1000, duration_seconds: 60 });
    service.createAuction({ title: 'Item 2', starting_price: 2000, duration_seconds: 60 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/auctions/:id/bids returns bids history', async () => {
    const created = service.createAuction({ title: 'Item With Bids', starting_price: 1000, duration_seconds: 60 });
    service.placeBid({ auction_id: created.id, bidder_id: 'u1', bidder_name: 'User 1', amount: 1000 });

    const res = await app.inject({
      method: 'GET',
      url: `/api/auctions/${created.id}/bids`
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.length).toBe(1);
    expect(body[0].amount).toBe(1000);
  });

  it('validates bad input on POST /api/auctions and POST /api/auctions/:id/bids', async () => {
    const badAuctionRes = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      payload: { title: '', starting_price: -50 }
    });
    expect(badAuctionRes.statusCode).toBe(400);

    const badBidRes = await app.inject({
      method: 'POST',
      url: '/api/auctions/fake-id/bids',
      payload: { bidder_id: '', amount: 'abc' }
    });
    expect(badBidRes.statusCode).toBe(400);
  });
});

