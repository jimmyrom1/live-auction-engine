import React, { useState } from 'react';
import { CreateAuctionInput } from '../types.ts';
import { X, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateAuctionInput) => Promise<void>;
}

export const CreateAuctionModal: React.FC<Props> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPriceEuros, setStartingPriceEuros] = useState('50.00');
  const [minIncrementEuros, setMinIncrementEuros] = useState('5.00');
  const [durationSeconds, setDurationSeconds] = useState(60); // 60s default for easy live demo testing
  const [antiSnipingTrigger, setAntiSnipingTrigger] = useState(30);
  const [antiSnipingExtend, setAntiSnipingExtend] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(startingPriceEuros);
    const inc = parseFloat(minIncrementEuros);

    if (!title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setError('El precio inicial debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        starting_price: Math.round(price * 100),
        min_increment: Math.round(inc * 100) || 100,
        duration_seconds: durationSeconds,
        anti_sniping_trigger_seconds: antiSnipingTrigger,
        anti_sniping_extend_seconds: antiSnipingExtend
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creando subasta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Crear Nueva Subasta</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Título del Artículo
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Tarjeta Gráfica RTX 4080 Super"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Descripción
            </label>
            <textarea
              rows={2}
              placeholder="Detalles del estado, garantía, accesorios incluidos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Precio Inicial (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={startingPriceEuros}
                onChange={(e) => setStartingPriceEuros(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Incremento Mínimo (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={minIncrementEuros}
                onChange={(e) => setMinIncrementEuros(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Duración de la Subasta
            </label>
            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={45}>45 Segundos (ideal para probar anti-sniping inmediato)</option>
              <option value={60}>1 Minuto</option>
              <option value={180}>3 Minutos</option>
              <option value={300}>5 Minutos</option>
              <option value={600}>10 Minutos</option>
            </select>
          </div>

          {/* Anti-Sniping Config Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 p-3.5 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase">
              <ShieldAlert className="w-4 h-4" />
              <span>Reglas Anti-Sniping</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Si se recibe una puja válida en los últimos segundos, el reloj se extiende automáticamente para evitar bots de última décima.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block">Ventana de activación</span>
                <input
                  type="number"
                  min="5"
                  value={antiSnipingTrigger}
                  onChange={(e) => setAntiSnipingTrigger(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white mt-0.5"
                />
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Tiempo añadido (+seg)</span>
                <input
                  type="number"
                  min="10"
                  value={antiSnipingExtend}
                  onChange={(e) => setAntiSnipingExtend(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white mt-0.5"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md transition-all"
            >
              {isSubmitting ? 'Creando...' : 'Publicar Subasta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
