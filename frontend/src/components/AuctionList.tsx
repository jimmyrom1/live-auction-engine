import React, { useState, useEffect } from 'react';
import { Auction } from '../types.ts';
import { formatMoney } from '../services/api.ts';
import { Clock, ShieldAlert, Trophy } from 'lucide-react';

interface Props {
  auctions: Auction[];
  selectedAuctionId: string | null;
  onSelectAuction: (id: string) => void;
  onOpenCreateModal: () => void;
}

export const AuctionList: React.FC<Props> = ({
  auctions,
  selectedAuctionId,
  onSelectAuction,
  onOpenCreateModal
}) => {
  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Subastas Disponibles</h2>
          <p className="text-xs text-slate-400">Selecciona una subasta para participar en directo</p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span> Nueva Subasta
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {auctions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No hay subastas activas en este momento.</p>
            <button
              onClick={onOpenCreateModal}
              className="mt-3 text-emerald-400 hover:underline text-sm font-medium"
            >
              Crear la primera subasta
            </button>
          </div>
        ) : (
          auctions.map((a) => (
            <AuctionCard
              key={a.id}
              auction={a}
              isSelected={a.id === selectedAuctionId}
              onSelect={() => onSelectAuction(a.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const AuctionCard: React.FC<{
  auction: Auction;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ auction, isSelected, onSelect }) => {
  const [timeLeft, setTimeLeft] = useState<number>(Math.max(0, auction.end_time - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, auction.end_time - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.end_time]);

  const isEnded = auction.status === 'ENDED' || timeLeft === 0;
  const isUrgent = !isEnded && timeLeft < 30000;

  const formatTimer = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl cursor-pointer transition-all border ${
        isSelected
          ? 'bg-slate-700/90 border-blue-500 shadow-lg ring-1 ring-blue-500/50'
          : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-750 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white text-base leading-snug line-clamp-1">{auction.title}</h3>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isEnded
              ? 'bg-slate-700 text-slate-300'
              : isUrgent
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isEnded ? 'Finalizada' : isUrgent ? '¡Últimos 30s!' : 'En Vivo'}
        </span>
      </div>

      <p className="text-xs text-slate-400 line-clamp-1 mt-1">{auction.description || 'Sin descripción'}</p>

      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Puja actual</span>
          <span className="text-base font-extrabold text-emerald-400">
            {formatMoney(auction.current_price)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-slate-400 block text-[11px] flex items-center justify-end gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {isEnded ? 'Cerrada' : 'Tiempo'}
          </span>
          <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-rose-400' : 'text-slate-200'}`}>
            {isEnded ? '00:00' : formatTimer(timeLeft)}
          </span>
        </div>
      </div>

      {auction.sniping_extensions_count > 0 && (
        <div className="mt-2 text-[11px] text-amber-400/90 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded">
          <ShieldAlert className="w-3 h-3" />
          <span>Extendida +{auction.sniping_extensions_count} vez (anti-sniping)</span>
        </div>
      )}

      {isEnded && auction.winner_user_id && (
        <div className="mt-2 text-[11px] text-blue-300 flex items-center gap-1 font-medium bg-blue-500/10 px-2 py-0.5 rounded">
          <Trophy className="w-3 h-3 text-yellow-400" />
          <span>Ganador: {auction.winner_user_id}</span>
        </div>
      )}
    </div>
  );
};
