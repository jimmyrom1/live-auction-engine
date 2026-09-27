import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createDatabase(dbPath: string = ':memory:'): DatabaseSync {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Set performant & reliable PRAGMAs
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      starting_price INTEGER NOT NULL,
      min_increment INTEGER NOT NULL,
      current_price INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')),
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      anti_sniping_trigger_seconds INTEGER NOT NULL DEFAULT 30,
      anti_sniping_extend_seconds INTEGER NOT NULL DEFAULT 60,
      sniping_extensions_count INTEGER NOT NULL DEFAULT 0,
      winner_user_id TEXT,
      winner_bid_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
      bidder_id TEXT NOT NULL,
      bidder_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      placed_at INTEGER NOT NULL,
      extended_auction INTEGER NOT NULL DEFAULT 0,
      previous_price INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bids_auction_placed ON bids(auction_id, placed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auctions_status_end ON auctions(status, end_time);
  `);

  // Seed default demo auctions if database is completely empty
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM auctions').get() as { cnt: number };
  if (countRow.cnt === 0) {
    const now = Date.now();
    const insertStmt = db.prepare(`
      INSERT INTO auctions (
        id, title, description, starting_price, min_increment, current_price,
        status, start_time, end_time, anti_sniping_trigger_seconds,
        anti_sniping_extend_seconds, sniping_extensions_count,
        winner_user_id, winner_bid_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      'demo-auction-rolex',
      'Reloj Rolex Submariner Date 1985 (Vintage)',
      'Pieza de colección en perfecto estado de conservación, esfera negra original y caja de acero Oystersteel.',
      500000, // 5.000 €
      10000,  // 100 €
      500000,
      'ACTIVE',
      now,
      now + (300 * 1000), // 5 min
      30,
      60,
      0,
      null,
      null,
      now,
      now
    );

    insertStmt.run(
      'demo-auction-gibson',
      'Guitarra Gibson Les Paul Custom Ebony',
      'Guitarra eléctrica profesional acabado ébano, pastillas humbucker 490R/498T y estuche rígido original.',
      320000, // 3.200 €
      5000,   // 50 €
      320000,
      'ACTIVE',
      now,
      now + (600 * 1000), // 10 min
      30,
      60,
      0,
      null,
      null,
      now,
      now
    );
  }
}

