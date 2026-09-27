import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuctionDetail } from './AuctionDetail.tsx';
import { Auction, Bid } from '../types.ts';

describe('AuctionDetail Component', () => {
  const mockAuction: Auction = {
    id: 'auc-2',
    title: 'Gibson Les Paul Custom',
    description: 'Electric guitar in mint condition',
    starting_price: 350000,
    min_increment: 5000,
    current_price: 355000,
    status: 'ACTIVE',
    start_time: Date.now() - 5000,
    end_time: Date.now() + 120000,
    anti_sniping_trigger_seconds: 30,
    anti_sniping_extend_seconds: 60,
    sniping_extensions_count: 0,
    winner_user_id: 'user-bob',
    winner_bid_id: 'bid-2',
    created_at: Date.now() - 5000,
    updated_at: Date.now() - 5000
  };

  const mockBids: Bid[] = [
    {
      id: 'bid-2',
      auction_id: 'auc-2',
      bidder_id: 'user-bob',
      bidder_name: 'Bob',
      amount: 355000,
      placed_at: Date.now() - 1000,
      extended_auction: 0,
      previous_price: 350000
    }
  ];

  it('renders auction details, live statistics and bid feed', () => {
    render(
      <AuctionDetail
        auction={mockAuction}
        bids={mockBids}
        antiSnipingNotification="⚡ Anti-sniping activado"
      />
    );

    expect(screen.getByText('Gibson Les Paul Custom')).toBeInTheDocument();
    expect(screen.getByText('Electric guitar in mint condition')).toBeInTheDocument();
    expect(screen.getByText('⚡ Anti-sniping activado')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Subasta en Vivo')).toBeInTheDocument();
  });
});
