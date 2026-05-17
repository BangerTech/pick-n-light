import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Copy,
  Trash2,
  Edit2,
  ChevronRight,
  LayoutGrid,
  Package,
  Zap,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { Magazine } from '@/lib/types';
import MagazineGrid from '@/components/MagazineGrid';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeMagazineId, setActiveMagazineId } = useAppStore();

  const { data: magazines = [], isLoading } = useQuery({
    queryKey: ['magazines'],
    queryFn: api.magazines.list,
  });

  const activeMag = magazines.find((m) => m.id === activeMagazineId) ?? magazines[0];

  const { data: magazineDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['magazine', activeMag?.id],
    queryFn: () => api.magazines.get(activeMag!.id),
    enabled: !!activeMag?.id,
  });

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.magazines.duplicate(id),
    onSuccess: (newMag) => {
      queryClient.invalidateQueries({ queryKey: ['magazines'] });
      setActiveMagazineId(newMag.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.magazines.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['magazines'] });
      setActiveMagazineId(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.magazines.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['magazines'] });
      queryClient.invalidateQueries({ queryKey: ['magazine', activeMag?.id] });
      setEditingName(false);
    },
  });

  const handleRename = () => {
    if (!activeMag || !nameInput.trim()) return;
    renameMutation.mutate({ id: activeMag.id, name: nameInput.trim() });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['magazine', activeMag?.id] });
    queryClient.invalidateQueries({ queryKey: ['magazines'] });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-DEFAULT border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (magazines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Keine Magazine gefunden.</p>
          <button onClick={() => navigate('/onboarding')} className="btn-primary px-6 py-2.5 text-sm">
            Magazin erstellen
          </button>
        </div>
      </div>
    );
  }

  const occupiedCount = magazineDetail?.slots.filter((s) => s.part).length ?? 0;
  const totalSlots = magazineDetail?.slots.length ?? 0;
  const lowStockCount = magazineDetail?.slots.filter(
    (s) => s.part && s.part.minQuantity !== null && s.part.quantity <= (s.part.minQuantity ?? Infinity)
  ).length ?? 0;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
      >
        {/* Magazine tabs */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-1">
          {magazines.map((mag) => (
            <button
              key={mag.id}
              onClick={() => setActiveMagazineId(mag.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border',
                activeMag?.id === mag.id
                  ? 'bg-accent-DEFAULT/20 text-accent-light border-accent-DEFAULT/30'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-white/5'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {mag.name}
              {(mag as Magazine & { occupiedSlots?: number }).occupiedSlots !== undefined && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-mono',
                    activeMag?.id === mag.id
                      ? 'bg-accent-DEFAULT/30 text-accent-light'
                      : 'bg-white/10 text-slate-500'
                  )}
                >
                  {(mag as Magazine & { occupiedSlots?: number }).occupiedSlots}/{mag._count?.slots}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => navigate('/onboarding')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-400 border border-dashed border-slate-700 hover:border-slate-500 transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Neu
          </button>
        </div>

        {/* Actions for active mag */}
        {activeMag && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => {
                setNameInput(activeMag.name);
                setEditingName(true);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
              title="Umbenennen"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => duplicateMutation.mutate(activeMag.id)}
              disabled={duplicateMutation.isPending}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
              title="Duplizieren"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Magazin "${activeMag.name}" wirklich löschen?`)) {
                  deleteMutation.mutate(activeMag.id);
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Rename modal */}
      <AnimatePresence>
        {editingName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 w-full max-w-sm mx-4"
              style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <h3 className="text-white font-semibold mb-4">Magazin umbenennen</h3>
              <input
                className="input-dark w-full px-4 py-2.5 text-sm mb-4"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingName(false)} className="btn-ghost px-4 py-2 text-sm">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={handleRename} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                  <Check className="w-4 h-4" /> Speichern
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {activeMag && (
          <div className="max-w-5xl mx-auto">
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                {
                  icon: Package,
                  label: 'Belegt',
                  value: `${occupiedCount} / ${totalSlots}`,
                  color: '#6366f1',
                  glow: 'rgba(99,102,241,0.3)',
                },
                {
                  icon: Zap,
                  label: 'Frei',
                  value: `${totalSlots - occupiedCount}`,
                  color: '#10b981',
                  glow: 'rgba(16,185,129,0.3)',
                },
                {
                  icon: AlertTriangle,
                  label: 'Niedrig',
                  value: `${lowStockCount}`,
                  color: lowStockCount > 0 ? '#f97316' : '#475569',
                  glow: lowStockCount > 0 ? 'rgba(249,115,22,0.3)' : 'none',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${stat.color}22`, boxShadow: `0 0 10px ${stat.glow}` }}
                  >
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid */}
            {isDetailLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-accent-DEFAULT border-t-transparent rounded-full animate-spin" />
              </div>
            ) : magazineDetail ? (
              <MagazineGrid magazine={magazineDetail} onRefresh={handleRefresh} />
            ) : null}

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-xs text-slate-600">
              {[
                { color: 'rgba(99,102,241,0.3)', border: '1px dashed rgba(99,102,241,0.3)', label: 'Leer (klicken zum Befüllen)' },
                { color: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)', label: 'Belegt' },
                { color: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', label: 'Gefunden / Aktiv' },
                { color: 'transparent', border: '1.5px solid #f97316', label: 'Niedrigbestand' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-5 h-3.5 rounded" style={{ background: l.color, border: l.border }} />
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
