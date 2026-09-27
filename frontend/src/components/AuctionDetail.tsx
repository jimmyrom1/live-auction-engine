import React, { useState, useEffect } from 'react';
import { Auction, Bid } from '../types.ts';
import { formatMoney } from '../services/api.ts';
import { Clock, ShieldAlert, Trophy, User, ArrowUpRight } from 'lucide-react';

interface Props {
  auction: Auction;
  bids: Bid[];
  antiSnipingNotification: string | null;
}

export const AuctionDetail: React.FC<Props> = ({
  auction,
  bids,
  antiSnipingNotification
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(Math.max(0, auction.end_time - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, auction.end_time - Date.now()));
    }, 200);
    return () => clearInterval(timer);
  }, [auction.end_time]);

  const isEnded = auction.status === 'ENDED' || timeLeft === 0;
  const isUrgent = !isEnded && timeLeft < 30000;

  const formatTimer = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-6 shadow-xl flex flex-col h-full space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-700 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{auction.title}</h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                isEnded
                  ? 'bg-slate-700 text-slate-300'
                  : isUrgent
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isEnded ? 'Finalizada' : isUrgent ? '¡Últimos 30 Segundos!' : 'Subasta en Vivo'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">{auction.description || 'Sin descripción adicional.'}</p>
        </div>

        {/* Big Countdown Timer */}
        <div className={`p-4 rounded-xl text-center border min-w-[200px] transition-all ${
          isEnded
            ? 'bg-slate-900/50 border-slate-700 text-slate-400'
            : isUrgent
            ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/50'
            : 'bg-slate-900/70 border-slate-700'
        }`}>
          <div className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center justify-center gap-1.5 mb-1">
            <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-rose-400 animate-spin' : 'text-slate-400'}`} />
            {isEnded ? 'Subasta Cerrada' : 'Tiempo Restante'}
          </div>
          <div className={`font-mono text-3xl font-black ${
            isEnded
              ? 'text-slate-500'
              : isUrgent
              ? 'text-rose-400 animate-pulse'
              : 'text-white'
          }`}>
            {isEnded ? '00:00.0' : formatTimer(timeLeft)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Ventana anti-sniping: {auction.anti_sniping_trigger_seconds}s (+{auction.anti_sniping_extend_seconds}s)
          </div>
        </div>
      </div>

      {/* Anti-Sniping Alert Banner */}
      {antiSnipingNotification && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium animate-bounce shadow-md">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>{antiSnipingNotification}</span>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Precio Actual</span>
          <span className="text-2xl font-black text-emerald-400">
            {formatMoney(auction.current_price)}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Incremento Mínimo</span>
          <span className="text-xl font-bold text-slate-200">
            +{formatMoney(auction.min_increment)}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Líder Actual</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <User className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-slate-200 text-sm truncate">
              {auction.winner_user_id || 'Sin pujas'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Extensiones Anti-sniping</span>
          <span className="text-xl font-bold text-amber-400">
            {auction.sniping_extensions_count}
          </span>
        </div>
      </div>

      {/* Winner Banner if Ended */}
      {isEnded && (
        <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-blue-900/40 border border-blue-500/40 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-white text-base">¡Subasta Finalizada!</h4>
              <p className="text-xs text-slate-300">
                {auction.winner_user_id
                  ? `Ganador definitivo: ${auction.winner_user_id} con una puja de ${formatMoney(auction.current_price)}`
                  : 'La subasta ha concluido sin ninguna puja registrada.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-lg">
            CERRADA
          </span>
        </div>
      )}

      {/* Real-time Bid Log Feed */}
      <div className="flex-1 flex flex-col min-h-[220px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Historial de Pujas en Directo</span>
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-mono">
              {bids.length}
            </span>
          </h3>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
            Streaming WebSocket activo
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden flex-1 flex flex-col">
          <div className="overflow-y-auto max-h-[280px] p-2 space-y-2 flex-1">
            {bids.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm py-12">
                Aún no se han registrado pujas para esta subasta. ¡Sé el primero!
              </div>
            ) : (
              bids.map((bid, index) => {
                const isLeading = index === 0 && !isEnded;
                const date = new Date(bid.placed_at);
                const timeStr = date.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div
                    key={bid.id}
                    className={`p-3 rounded-lg flex items-center justify-between border transition-all ${
                      isLeading
                        ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                        : 'bg-slate-800/40 border-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isLeading
                            ? 'bg-emerald-500 text-slate-900 font-extrabold'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{bid.bidder_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({bid.bidder_id})</span>
                          {bid.extended_auction === 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5" /> +60s
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block">{timeStr}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className={`text-base font-extrabold ${isLeading ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {formatMoney(bid.amount)}
                      </span>
                      {isLeading && (
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
