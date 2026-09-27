import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuctionList } from './AuctionList.tsx';
import { Auction } from '../types.ts';

describe('AuctionList Component', () => {
  const mockAuctions: Auction[] = [
    {
      id: 'auc-1',
      title: 'Vintage Rolex',
      description: 'Classic luxury watch',
      starting_price: 500000,
      min_increment: 10000,
      current_price: 550000,
      status: 'ACTIVE',
      start_time: Date.now() - 1000,
      end_time: Date.now() + 60000,
      anti_sniping_trigger_seconds: 30,
      anti_sniping_extend_seconds: 60,
      sniping_extensions_count: 1,
      winner_user_id: 'user-alice',
      winner_bid_id: 'bid-1',
      created_at: Date.now() - 1000,
      updated_at: Date.now() - 1000
    }
  ];

  it('renders auction list and handles selection and creation trigger', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <AuctionList
        auctions={mockAuctions}
        selectedAuctionId={null}
        onSelectAuction={onSelect}
        onOpenCreateModal={onCreate}
      />
    );

    expect(screen.getByText('Vintage Rolex')).toBeInTheDocument();
    expect(screen.getByText('Extendida +1 vez (anti-sniping)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Vintage Rolex'));
    expect(onSelect).toHaveBeenCalledWith('auc-1');

    fireEvent.click(screen.getByText('Nueva Subasta'));
    expect(onCreate).toHaveBeenCalled();
  });
});
