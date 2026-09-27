import { Auction, Bid, CreateAuctionInput, PlaceBidInput, PlaceBidResult } from '../types.ts';

const API_BASE = '/api';

export async function fetchAuctions(): Promise<Auction[]> {
  const res = await fetch(`${API_BASE}/auctions`);
  if (!res.ok) throw new Error('Error al cargar subastas');
  return res.json();
}

export async function fetchAuction(id: string): Promise<Auction> {
  const res = await fetch(`${API_BASE}/auctions/${id}`);
  if (!res.ok) throw new Error('Error al cargar detalle de subasta');
  return res.json();
}

export async function fetchBids(auctionId: string): Promise<Bid[]> {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/bids`);
  if (!res.ok) throw new Error('Error al cargar historial de pujas');
  return res.json();
}

export async function createAuction(input: CreateAuctionInput): Promise<Auction> {
  const res = await fetch(`${API_BASE}/auctions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || 'Error al crear subasta');
  }
  return res.json();
}

export async function placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
  const { auction_id, ...body } = input;
  const res = await fetch(`${API_BASE}/auctions/${auction_id}/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({
    success: false,
    error: 'Error de comunicación con el servidor'
  }));

  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Error al enviar puja',
      errorCode: data.errorCode
    };
  }

  return data;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(cents / 100);
}
