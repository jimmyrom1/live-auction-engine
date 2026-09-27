import React, { useState, useEffect, useCallback } from 'react';
import { Auction, Bid, CreateAuctionInput } from './types.ts';
import { fetchAuctions, fetchAuction, fetchBids, createAuction } from './services/api.ts';
import { wsClient } from './services/ws.ts';
import { AuctionList } from './components/AuctionList.tsx';
import { AuctionDetail } from './components/AuctionDetail.tsx';
import { MultiBidderSimulator } from './components/MultiBidderSimulator.tsx';
import { CreateAuctionModal } from './components/CreateAuctionModal.tsx';
import { Gavel, Radio, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [antiSnipingAlert, setAntiSnipingAlert] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load initial list
  const loadAuctions = useCallback(async () => {
    try {
      const list = await fetchAuctions();
      setAuctions(list);
      if (list.length > 0 && !selectedAuctionId) {
        setSelectedAuctionId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAuctionId]);

  // Load detail and bids when selected auction changes
  const loadSelectedDetail = useCallback(async (id: string) => {
    try {
      const [detail, bidsList] = await Promise.all([
        fetchAuction(id),
        fetchBids(id)
      ]);
      setSelectedAuction(detail);
      setBids(bidsList);
    } catch (err) {
      console.error('Error loading auction detail:', err);
    }
  }, []);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  useEffect(() => {
    if (selectedAuctionId) {
      loadSelectedDetail(selectedAuctionId);
      wsClient.subscribe(selectedAuctionId);
      setAntiSnipingAlert(null);

      return () => {
        wsClient.unsubscribe(selectedAuctionId);
      };
    }
  }, [selectedAuctionId, loadSelectedDetail]);

  // WebSocket lifecycle & events
  useEffect(() => {
    wsClient.connect();

    const unregStatus = wsClient.onStatusChange((status) => {
      setWsConnected(status);
    });

    const unregMsg = wsClient.onMessage((msg) => {
      if (msg.type === 'BID_PLACED') {
        const payload = msg.payload as {
          bid: Bid;
          current_price: number;
          winner_user_id: string;
          end_time: number;
          extended: boolean;
        };

        if (msg.auctionId === selectedAuctionId && payload.bid) {
          setBids((prev) => [payload.bid, ...prev]);
          setSelectedAuction((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              current_price: payload.current_price,
              winner_user_id: payload.winner_user_id,
              winner_bid_id: payload.bid.id,
              end_time: payload.end_time
            };
          });
        }

        // Update card in auction list
        setAuctions((prev) =>
          prev.map((a) =>
            a.id === msg.auctionId
              ? {
                  ...a,
                  current_price: payload.current_price,
                  winner_user_id: payload.winner_user_id,
                  end_time: payload.end_time
                }
              : a
          )
        );
      } else if (msg.type === 'ANTI_SNIPING_TRIGGERED') {
        const payload = msg.payload as {
          new_end_time: number;
          extensions_count: number;
          added_seconds: number;
        };

        if (msg.auctionId === selectedAuctionId) {
          setAntiSnipingAlert(
            `⚡ ¡Anti-sniping activado! Puja de última hora detectada. Se han añadido +${payload.added_seconds}s para permitir contraofertas.`
          );
          setSelectedAuction((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              end_time: payload.new_end_time,
              sniping_extensions_count: payload.extensions_count
            };
          });
        }
      } else if (msg.type === 'AUCTION_ENDED') {
        if (msg.auctionId === selectedAuctionId) {
          setSelectedAuction((prev) => (prev ? { ...prev, status: 'ENDED' } : null));
        }

        setAuctions((prev) =>
          prev.map((a) => (a.id === msg.auctionId ? { ...a, status: 'ENDED' } : a))
        );
      } else if (msg.type === 'AUCTION_STATUS_CHANGED') {
        loadAuctions();
      }
    });

    return () => {
      unregStatus();
      unregMsg();
      wsClient.disconnect();
    };
  }, [selectedAuctionId, loadAuctions]);

  const handleCreate = async (input: CreateAuctionInput) => {
    const created = await createAuction(input);
    await loadAuctions();
    setSelectedAuctionId(created.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white leading-tight tracking-tight">
                Live Auction Engine
              </h1>
              <p className="text-[11px] text-slate-400">
                Subastas concurrentes en tiempo real · WebSockets + SQLite WAL + Anti-sniping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700">
              <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
              <span className={wsConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {wsConnected ? 'Conectado en Directo' : 'Reconectando WS...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Auctions List */}
        <div className="lg:col-span-4 h-full">
          <AuctionList
            auctions={auctions}
            selectedAuctionId={selectedAuctionId}
            onSelectAuction={(id) => setSelectedAuctionId(id)}
            onOpenCreateModal={() => setIsModalOpen(true)}
          />
        </div>

        {/* Right Column: Live Auction View & Multi-Bidder Simulator */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          {loading ? (
            <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-12 text-center text-slate-400">
              Cargando subastas...
            </div>
          ) : selectedAuction ? (
            <>
              <AuctionDetail
                auction={selectedAuction}
                bids={bids}
                antiSnipingNotification={antiSnipingAlert}
              />
              <MultiBidderSimulator
                auction={selectedAuction}
                onBidPlaced={() => {
                  if (selectedAuctionId) {
                    loadSelectedDetail(selectedAuctionId);
                  }
                }}
              />
            </>
          ) : (
            <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 text-slate-500 mb-2" />
              <p>Selecciona una subasta de la columna izquierda o crea una nueva.</p>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      <CreateAuctionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};
