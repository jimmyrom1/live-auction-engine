import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App.tsx';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockAuctions = [
      {
        id: 'auction-1',
        title: 'Rare Diamond Watch',
        description: 'Luxury collector edition',
        starting_price: 100000,
        min_increment: 5000,
        current_price: 100000,
        status: 'ACTIVE',
        start_time: Date.now() - 10000,
        end_time: Date.now() + 100000,
        anti_sniping_trigger_seconds: 30,
        anti_sniping_extend_seconds: 60,
        sniping_extensions_count: 0,
        winner_user_id: null,
        winner_bid_id: null,
        created_at: Date.now() - 10000,
        updated_at: Date.now() - 10000
      }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/bids')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      if (urlStr.endsWith('/auctions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAuctions)
        });
      }
      if (urlStr.includes('/auctions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAuctions[0])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

  });

  it('renders the title and connects to auctions', async () => {
    render(<App />);

    expect(screen.getByText('Live Auction Engine')).toBeInTheDocument();

    const card = await screen.findByText('Rare Diamond Watch');
    expect(card).toBeInTheDocument();

    // Click the auction card to trigger selection and detail loading
    card.click();

    await waitFor(() => {
      expect(screen.getByText('Simulador Multiusuario y Concurrencia')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });
});


