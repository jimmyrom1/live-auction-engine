import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/db/database.js';
import { AuctionService } from '../src/services/auction_service.js';

describe('AuctionService', () => {
  let db: ReturnType<typeof createDatabase>;
  let service: AuctionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new AuctionService(db);
  });

  it('creates an auction with proper defaults', () => {
    const auction = service.createAuction({
      title: 'Vintage Rolex Submariner',
      description: 'Excellent condition, 1985',
      starting_price: 500000, // $5,000.00
      min_increment: 10000,   // $100.00
      duration_seconds: 600
    });

    expect(auction.id).toBeDefined();
    expect(auction.status).toBe('ACTIVE');
    expect(auction.current_price).toBe(500000);
    expect(auction.winner_user_id).toBeNull();
    expect(auction.sniping_extensions_count).toBe(0);
    expect(auction.end_time).toBeGreaterThan(Date.now());
  });

  it('allows the first bid to match starting_price', () => {
    const auction = service.createAuction({
      title: 'MacBook Pro M3 Max',
      starting_price: 250000, // $2,500.00
      min_increment: 5000,
      duration_seconds: 300
    });

    const res = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-alice',
      bidder_name: 'Alice',
      amount: 250000
    });

    expect(res.success).toBe(true);
    expect(res.auction?.current_price).toBe(250000);
    expect(res.auction?.winner_user_id).toBe('user-alice');
    expect(res.bid?.amount).toBe(250000);
  });

  it('rejects subsequent bids that do not meet min_increment', () => {
    const auction = service.createAuction({
      title: 'Sony A7 IV Camera',
      starting_price: 150000,
      min_increment: 10000, // $100.00 increment
      duration_seconds: 300
    });

    // Alice bids starting price 150000
    service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-alice',
      bidder_name: 'Alice',
      amount: 150000
    });

    // Bob tries to bid 155000 (only +5000, needed +10000)
    const res = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-bob',
      bidder_name: 'Bob',
      amount: 155000
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('BID_TOO_LOW');

    // Bob bids valid 160000
    const validRes = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-bob',
      bidder_name: 'Bob',
      amount: 160000
    });

    expect(validRes.success).toBe(true);
    expect(validRes.auction?.current_price).toBe(160000);
    expect(validRes.auction?.winner_user_id).toBe('user-bob');
  });

  it('disallows self-bidding when already holding the lead', () => {
    const auction = service.createAuction({
      title: 'Mechanical Keyboard',
      starting_price: 10000,
      duration_seconds: 300
    });

    service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-alice',
      bidder_name: 'Alice',
      amount: 10000
    });

    const res = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-alice',
      bidder_name: 'Alice',
      amount: 15000
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('SELF_BIDDING_DISALLOWED');
  });

  it('triggers anti-sniping extension when bid placed in the final seconds', () => {
    // Create an auction that expires in 15 seconds (within default 30s trigger window)
    const auction = service.createAuction({
      title: 'Signed Football',
      starting_price: 20000,
      duration_seconds: 15, // 15 seconds remaining
      anti_sniping_trigger_seconds: 30,
      anti_sniping_extend_seconds: 60
    });

    const originalEndTime = auction.end_time;

    const res = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-charlie',
      bidder_name: 'Charlie',
      amount: 20000
    });

    expect(res.success).toBe(true);
    expect(res.extended).toBe(true);
    expect(res.auction?.sniping_extensions_count).toBe(1);
    expect(res.new_end_time).toBe(originalEndTime + 60000);
    expect(res.auction?.end_time).toBe(originalEndTime + 60000);
  });

  it('rejects bids when auction has expired', () => {
    const auction = service.createAuction({
      title: 'Antique Vase',
      starting_price: 50000,
      duration_seconds: 1 // 1 second duration
    });

    // Manually force end_time in the past
    db.prepare('UPDATE auctions SET end_time = ? WHERE id = ?')
      .run(Date.now() - 5000, auction.id);

    const res = service.placeBid({
      auction_id: auction.id,
      bidder_id: 'user-david',
      bidder_name: 'David',
      amount: 50000
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('AUCTION_EXPIRED');

    const updated = service.getAuction(auction.id);
    expect(updated?.status).toBe('ENDED');
  });

  it('handles intense concurrent bids with atomic consistency', async () => {
    const auction = service.createAuction({
      title: 'Rare Vinyl Record',
      starting_price: 1000,
      min_increment: 100,
      duration_seconds: 300
    });

    const bidders = ['user-1', 'user-2', 'user-3', 'user-4'];
    let successfulBids = 0;
    let failedBids = 0;

    // Simulate 30 rapid sequential/concurrent bid attempts at identical price
    for (let round = 1; round <= 10; round++) {
      const targetAmount = 1000 + (round * 100);
      const promises = bidders.map((bidderId, idx) => {
        return Promise.resolve().then(() => {
          return service.placeBid({
            auction_id: auction.id,
            bidder_id: bidderId,
            bidder_name: `Bidder ${idx + 1}`,
            amount: targetAmount
          });
        });
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r.success) successfulBids++;
        else failedBids++;
      }
    }

    const finalAuction = service.getAuction(auction.id);
    const bidsHistory = service.getBids(auction.id);

    expect(finalAuction?.current_price).toBe(2000); // 1000 + 10 * 100
    expect(bidsHistory.length).toBe(successfulBids);
    expect(successfulBids).toBe(10); // Exactly one winner per targetAmount step
    expect(failedBids).toBe(30);     // 3 losers per round
  });

  it('validates invalid creation inputs and missing bid fields', () => {
    expect(() => service.createAuction({ title: 'Invalid', starting_price: -100, duration_seconds: 60 })).toThrow();

    const missingRes = service.placeBid({
      auction_id: 'non-existent',
      bidder_id: 'u1',
      bidder_name: 'U1',
      amount: 500
    });
    expect(missingRes.success).toBe(false);
    expect(missingRes.errorCode).toBe('NOT_FOUND');

    const emptyRes = service.placeBid({
      auction_id: '',
      bidder_id: '',
      bidder_name: '',
      amount: 0
    });
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.statusCode).toBe(400);
  });

  it('expires all active auctions whose end_time has passed', () => {
    const a1 = service.createAuction({ title: 'Expiring Soon', starting_price: 1000, duration_seconds: 1 });
    db.prepare('UPDATE auctions SET end_time = ? WHERE id = ?').run(Date.now() - 1000, a1.id);

    const expired = service.checkAndExpireAllActive();
    expect(expired.some((a) => a.id === a1.id)).toBe(true);

    const updated = service.getAuction(a1.id);
    expect(updated?.status).toBe('ENDED');
  });
});

