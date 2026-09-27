import React, { useState } from 'react';
import { Auction } from '../types.ts';
import { formatMoney, placeBid } from '../services/api.ts';
import { Zap, AlertTriangle, CheckCircle2, UserCheck, Flame } from 'lucide-react';

interface Props {
  auction: Auction | null;
  onBidPlaced: () => void;
}

interface Persona {
  id: string;
  name: string;
  avatarColor: string;
}

const PERSONAS: Persona[] = [
  { id: 'user-alice', name: 'Alice Coleccionista', avatarColor: 'bg-indigo-600' },
  { id: 'user-bob', name: 'Bob Inversor', avatarColor: 'bg-emerald-600' },
  { id: 'user-charlie', name: 'Charlie Cazador de Gangas', avatarColor: 'bg-amber-600' }
];

export const MultiBidderSimulator: React.FC<Props> = ({ auction, onBidPlaced }) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [raceResults, setRaceResults] = useState<Array<{ name: string; amount: number; success: boolean; error?: string }>>([]);

  if (!auction) {
    return (
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-5 shadow-xl text-center text-slate-400 py-12">
        Selecciona una subasta para acceder al panel de pujas.
      </div>
    );
  }

  const isEnded = auction.status === 'ENDED' || Date.now() >= auction.end_time;
  const isLeader = auction.winner_user_id === selectedPersona.id;

  const minNextBidCents = auction.winner_bid_id === null
    ? auction.starting_price
    : auction.current_price + auction.min_increment;

  const handlePlaceBid = async (amountCents: number, persona: Persona = selectedPersona) => {
    if (isEnded) {
      setStatusMessage({ text: 'La subasta ya ha finalizado', isError: true });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await placeBid({
      auction_id: auction.id,
      bidder_id: persona.id,
      bidder_name: persona.name,
      amount: amountCents
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        text: `¡Puja de ${formatMoney(amountCents)} aceptada con éxito por ${persona.name}!`,
        isError: false
      });
      setCustomAmount('');
      onBidPlaced();
    } else {
      setStatusMessage({
        text: `Rechazada (${res.errorCode || 'Error'}): ${res.error}`,
        isError: true
      });
    }
  };

  const handleSimulateRaceCondition = async () => {
    if (isEnded) return;

    setStatusMessage(null);
    setRaceResults([]);
    setIsSubmitting(true);

    const baseAmount = minNextBidCents;

    // Simulate 3 concurrent bidders hitting the API at the EXACT same time
    const attempts = [
      { persona: PERSONAS[0], amount: baseAmount },
      { persona: PERSONAS[1], amount: baseAmount }, // Exact same amount conflict
      { persona: PERSONAS[2], amount: baseAmount + 500 }
    ];

    const results = await Promise.all(
      attempts.map(async (att) => {
        const res = await placeBid({
          auction_id: auction.id,
          bidder_id: att.persona.id,
          bidder_name: att.persona.name,
          amount: att.amount
        });
        return {
          name: att.persona.name,
          amount: att.amount,
          success: res.success,
          error: res.error
        };
      })
    );

    setIsSubmitting(false);
    setRaceResults(results);
    onBidPlaced();
  };

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-5 shadow-xl flex flex-col space-y-4">
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <div>
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Simulador Multiusuario y Concurrencia</span>
          </h3>
          <p className="text-xs text-slate-400">Alterna de postor y prueba condiciones de carrera concurrentes</p>
        </div>
      </div>

      {/* Select Persona */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Postor Activo
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PERSONAS.map((p) => {
            const isSelected = p.id === selectedPersona.id;
            const pIsLeader = auction.winner_user_id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p)}
                className={`p-2.5 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-slate-700 border-blue-500 ring-1 ring-blue-500 shadow-md'
                    : 'bg-slate-900/60 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${p.avatarColor}`} />
                  <span className="font-semibold text-xs text-white truncate block">{p.name.split(' ')[0]}</span>
                </div>
                {pIsLeader && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5 mt-1">
                    <UserCheck className="w-3 h-3" /> Líder
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Bid Actions */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Próxima puja mínima válida:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {formatMoney(minNextBidCents)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            disabled={isEnded || isLeader || isSubmitting}
            onClick={() => handlePlaceBid(minNextBidCents)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow"
          >
            Mínima ({formatMoney(minNextBidCents)})
          </button>
          <button
            disabled={isEnded || isLeader || isSubmitting}
            onClick={() => handlePlaceBid(minNextBidCents + 1000)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all"
          >
            +10,00 €
          </button>
          <button
            disabled={isEnded || isLeader || isSubmitting}
            onClick={() => handlePlaceBid(minNextBidCents + 5000)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all"
          >
            +50,00 €
          </button>
          <button
            disabled={isEnded || isLeader || isSubmitting}
            onClick={() => handlePlaceBid(minNextBidCents + 10000)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all"
          >
            +100,00 €
          </button>
        </div>
      </div>

      {/* Custom Bid Input */}
      <div className="flex gap-2">
        <input
          type="number"
          step="1"
          placeholder={`Importe en € (mín. ${(minNextBidCents / 100).toFixed(2)})`}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          disabled={isEnded || isLeader || isSubmitting}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          disabled={isEnded || isLeader || isSubmitting || !customAmount}
          onClick={() => {
            const val = parseFloat(customAmount);
            if (!isNaN(val) && val > 0) {
              handlePlaceBid(Math.round(val * 100));
            }
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow transition-all"
        >
          Pujar
        </button>
      </div>

      {/* Race Condition Simulator Button */}
      <div className="pt-2 border-t border-slate-700">
        <button
          disabled={isEnded || isSubmitting}
          onClick={handleSimulateRaceCondition}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2 transition-all"
        >
          <Flame className="w-4 h-4" />
          <span>⚡ Simular Carrera Concurrente (3 Postores Simultáneos)</span>
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-1">
          Lanza 3 peticiones HTTP en el mismo milisegundo para comprobar el aislamiento atómico de SQLite.
        </p>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            statusMessage.isError
              ? 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
          }`}
        >
          {statusMessage.isError ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Race Results Breakdown */}
      {raceResults.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg space-y-1.5 text-xs">
          <div className="font-bold text-white mb-1">Resultado de la Carrera Simultánea:</div>
          {raceResults.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">{r.name} ({formatMoney(r.amount)}):</span>
              {r.success ? (
                <span className="text-emerald-400 font-bold">✅ Ganó la carrera</span>
              ) : (
                <span className="text-rose-400 font-medium truncate max-w-[200px]" title={r.error}>
                  ❌ Conflicto atómico ({r.error})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
