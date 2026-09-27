export type AuctionStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface Auction {
  id: string;
  title: string;
  description: string;
  starting_price: number; // in cents
  min_increment: number;  // in cents
  current_price: number;   // in cents
  status: AuctionStatus;
  start_time: number;      // Unix timestamp ms
  end_time: number;        // Unix timestamp ms
  anti_sniping_trigger_seconds: number;
  anti_sniping_extend_seconds: number;
  sniping_extensions_count: number;
  winner_user_id: string | null;
  winner_bid_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number;         // in cents
  placed_at: number;      // Unix timestamp ms
  extended_auction: number; // 1 or 0
  previous_price: number;  // in cents
}

export interface CreateAuctionInput {
  title: string;
  description?: string;
  starting_price: number; // in cents
  min_increment?: number; // in cents (defaults to 100 = 1.00)
  duration_seconds: number;
  anti_sniping_trigger_seconds?: number;
  anti_sniping_extend_seconds?: number;
}

export interface PlaceBidInput {
  auction_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number; // in cents
}

export interface PlaceBidResult {
  success: boolean;
  auction?: Auction;
  bid?: Bid;
  extended?: boolean;
  new_end_time?: number;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'NOT_ACTIVE' | 'BID_TOO_LOW' | 'AUCTION_EXPIRED' | 'SELF_BIDDING_DISALLOWED';
  statusCode?: number;
}


export type WsMessageType =
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'BID_PLACED'
  | 'ANTI_SNIPING_TRIGGERED'
  | 'AUCTION_ENDED'
  | 'AUCTION_STATUS_CHANGED'
  | 'ERROR'
  | 'PING'
  | 'PONG';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  auctionId?: string;
  payload?: T;
  timestamp: number;
}
