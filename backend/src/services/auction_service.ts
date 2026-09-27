import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  Auction,
  Bid,
  CreateAuctionInput,
  PlaceBidInput,
  PlaceBidResult
} from '../domain/types.js';

export class AuctionService {
  constructor(private db: DatabaseSync) {}

  createAuction(input: CreateAuctionInput): Auction {
    if (input.starting_price <= 0) {
      throw new Error('starting_price must be greater than 0');
    }
    const duration = input.duration_seconds > 0 ? input.duration_seconds : 300;
    const minIncrement = input.min_increment && input.min_increment > 0 ? input.min_increment : 100;
    const antiSnipingTrigger = input.anti_sniping_trigger_seconds ?? 30;
    const antiSnipingExtend = input.anti_sniping_extend_seconds ?? 60;

    const now = Date.now();
    const id = randomUUID();
    const endTime = now + (duration * 1000);

    const auction: Auction = {
      id,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      starting_price: input.starting_price,
      min_increment: minIncrement,
      current_price: input.starting_price,
      status: 'ACTIVE',
      start_time: now,
      end_time: endTime,
      anti_sniping_trigger_seconds: antiSnipingTrigger,
      anti_sniping_extend_seconds: antiSnipingExtend,
      sniping_extensions_count: 0,
      winner_user_id: null,
      winner_bid_id: null,
      created_at: now,
      updated_at: now
    };

    const stmt = this.db.prepare(`
      INSERT INTO auctions (
        id, title, description, starting_price, min_increment, current_price,
        status, start_time, end_time, anti_sniping_trigger_seconds,
        anti_sniping_extend_seconds, sniping_extensions_count,
        winner_user_id, winner_bid_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      auction.id,
      auction.title,
      auction.description,
      auction.starting_price,
      auction.min_increment,
      auction.current_price,
      auction.status,
      auction.start_time,
      auction.end_time,
      auction.anti_sniping_trigger_seconds,
      auction.anti_sniping_extend_seconds,
      auction.sniping_extensions_count,
      auction.winner_user_id,
      auction.winner_bid_id,
      auction.created_at,
      auction.updated_at
    );

    return auction;
  }

  getAuction(id: string): Auction | null {
    this.checkAndExpireAuction(id);

    const stmt = this.db.prepare('SELECT * FROM auctions WHERE id = ?');
    const row = stmt.get(id) as unknown as Auction | undefined;
    return row || null;
  }

  listAuctions(): Auction[] {
    // Process expirations for active auctions
    this.checkAndExpireAllActive();

    const stmt = this.db.prepare('SELECT * FROM auctions ORDER BY created_at DESC');
    return stmt.all() as unknown as Auction[];
  }

  getBids(auctionId: string, limit: number = 50): Bid[] {
    const stmt = this.db.prepare(
      'SELECT * FROM bids WHERE auction_id = ? ORDER BY placed_at DESC, amount DESC LIMIT ?'
    );
    return stmt.all(auctionId, limit) as unknown as Bid[];
  }

  placeBid(input: PlaceBidInput): PlaceBidResult {
    if (!input.auction_id || !input.bidder_id || !input.bidder_name) {
      return {
        success: false,
        error: 'Missing required bid parameters',
        statusCode: 400
      };
    }

    if (input.amount <= 0) {
      return {
        success: false,
        error: 'Bid amount must be positive',
        statusCode: 400
      };
    }

    // Atomic transaction for concurrency safety
    this.db.exec('BEGIN IMMEDIATE;');

    try {
      const getAuctionStmt = this.db.prepare('SELECT * FROM auctions WHERE id = ?');
      const auction = getAuctionStmt.get(input.auction_id) as unknown as Auction | undefined;

      if (!auction) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          error: 'Auction not found',
          errorCode: 'NOT_FOUND',
          statusCode: 404
        };
      }

      const now = Date.now();

      // Check if auction has expired
      if (auction.status === 'ENDED' || now >= auction.end_time) {
        if (auction.status === 'ACTIVE') {
          this.db.prepare("UPDATE auctions SET status = 'ENDED', updated_at = ? WHERE id = ?")
            .run(now, auction.id);
        }
        this.db.exec('COMMIT;');
        return {
          success: false,
          error: 'Auction has already ended',
          errorCode: 'AUCTION_EXPIRED',
          statusCode: 409
        };
      }

      if (auction.status !== 'ACTIVE') {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          error: `Auction is in ${auction.status} status and not accepting bids`,
          errorCode: 'NOT_ACTIVE',
          statusCode: 400
        };
      }

      // Check if bidder is already the highest bidder
      if (auction.winner_user_id === input.bidder_id) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          error: 'You already hold the leading bid for this auction',
          errorCode: 'SELF_BIDDING_DISALLOWED',
          statusCode: 400
        };
      }

      // Determine required minimum bid
      let minRequiredBid: number;
      if (auction.winner_bid_id === null) {
        // First bid can match starting_price
        minRequiredBid = auction.starting_price;
      } else {
        minRequiredBid = auction.current_price + auction.min_increment;
      }

      if (input.amount < minRequiredBid) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          error: `Bid of ${(input.amount / 100).toFixed(2)} is lower than required minimum of ${(minRequiredBid / 100).toFixed(2)}`,
          errorCode: 'BID_TOO_LOW',
          statusCode: 409
        };
      }

      // Evaluate Anti-Sniping
      const remainingMs = auction.end_time - now;
      const triggerMs = auction.anti_sniping_trigger_seconds * 1000;
      const extendMs = auction.anti_sniping_extend_seconds * 1000;

      let extended = false;
      let newEndTime = auction.end_time;
      let newExtensionCount = auction.sniping_extensions_count;

      if (remainingMs <= triggerMs) {
        extended = true;
        newEndTime = auction.end_time + extendMs;
        newExtensionCount += 1;
      }

      // Create Bid record
      const bidId = randomUUID();
      const insertBidStmt = this.db.prepare(`
        INSERT INTO bids (
          id, auction_id, bidder_id, bidder_name, amount,
          placed_at, extended_auction, previous_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertBidStmt.run(
        bidId,
        auction.id,
        input.bidder_id,
        input.bidder_name,
        input.amount,
        now,
        extended ? 1 : 0,
        auction.current_price
      );

      // Update Auction state
      const updateAuctionStmt = this.db.prepare(`
        UPDATE auctions SET
          current_price = ?,
          winner_user_id = ?,
          winner_bid_id = ?,
          end_time = ?,
          sniping_extensions_count = ?,
          updated_at = ?
        WHERE id = ?
      `);

      updateAuctionStmt.run(
        input.amount,
        input.bidder_id,
        bidId,
        newEndTime,
        newExtensionCount,
        now,
        auction.id
      );

      this.db.exec('COMMIT;');

      const updatedAuction: Auction = {
        ...auction,
        current_price: input.amount,
        winner_user_id: input.bidder_id,
        winner_bid_id: bidId,
        end_time: newEndTime,
        sniping_extensions_count: newExtensionCount,
        updated_at: now
      };

      const bid: Bid = {
        id: bidId,
        auction_id: auction.id,
        bidder_id: input.bidder_id,
        bidder_name: input.bidder_name,
        amount: input.amount,
        placed_at: now,
        extended_auction: extended ? 1 : 0,
        previous_price: auction.current_price
      };

      return {
        success: true,
        auction: updatedAuction,
        bid,
        extended,
        new_end_time: newEndTime,
        statusCode: 200
      };
    } catch (err: unknown) {
      this.db.exec('ROLLBACK;');
      const message = err instanceof Error ? err.message : 'Unknown database error';
      return {
        success: false,
        error: message,
        statusCode: 500
      };
    }
  }

  private checkAndExpireAuction(id: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      "UPDATE auctions SET status = 'ENDED', updated_at = ? WHERE id = ? AND status = 'ACTIVE' AND end_time <= ?"
    );
    stmt.run(now, id, now);
  }

  checkAndExpireAllActive(): Auction[] {
    const now = Date.now();
    const findExpiredStmt = this.db.prepare(
      "SELECT * FROM auctions WHERE status = 'ACTIVE' AND end_time <= ?"
    );
    const expired = findExpiredStmt.all(now) as unknown as Auction[];

    if (expired.length > 0) {
      const updateStmt = this.db.prepare(
        "UPDATE auctions SET status = 'ENDED', updated_at = ? WHERE status = 'ACTIVE' AND end_time <= ?"
      );
      updateStmt.run(now, now);
    }

    return expired;
  }
}
