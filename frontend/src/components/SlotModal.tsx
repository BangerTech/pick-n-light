import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Save, Trash2, AlertTriangle, Package, Zap, Tag, QrCode } from 'lucide-react';
import type { Slot, Magazine } from '@/lib/types';
import { api } from '@/lib/api';
import { cn, isLowStock, formatQuantity } from '@/lib/utils';

interface SlotModalProps {
  slot: Slot;
  magazine: Magazine;
  onClose: () => void;
  onSaved: () => void;
}

export default function SlotModal({ slot, magazine, onClose, onSaved }: SlotModalProps) {
  const isNew = !slot.part;

  const [name, setName] = useState(slot.part?.name ?? '');
  const [description, setDescription] = useState(slot.part?.description ?? '');
  const [quantity, setQuantity] = useState(String(slot.part?.quantity ?? ''));
  const [unit, setUnit] = useState(slot.part?.unit ?? 'Stk');
  const [minQuantity, setMinQuantity] = useState(
    slot.part?.minQuantity != null ? String(slot.part.minQuantity) : ''
  );
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(slot.part?.tags ?? []);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [deleteTransitionPending, startDeleteTransition] = useTransition();

  const commonUnits = ['Stk', 'g', 'kg', 'mm', 'cm', 'm', 'ml', 'l', 'Pck', 'Rolle'];

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: api.tags.list,
    staleTime: 30_000,
  });

  const tagSuggestions = allTags.filter(
    (t) => t.includes(tagInput.toLowerCase().trim()) && !tags.includes(t)
  );

  // React 19: useActionState replaces manual isPending + error state + useMutation for save
  const [formState, submitAction, isSaving] = useActionState(
    async (_prev: { error: string }) => {
      if (!name.trim()) return { error: 'Bitte einen Artikelnamen eingeben.' };
      try {
        const data = {
          name,
          description: description || undefined,
          quantity: parseFloat(quantity) || 0,
          unit,
          minQuantity: minQuantity ? parseFloat(minQuantity) : null,
          tags,
        };
        if (isNew) {
          await api.parts.create({ slotId: slot.id, ...data });
        } else {
          await api.parts.update(slot.part!.id, data);
        }
        onSaved();
        return { error: '' };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    { error: '' }
  );

  const deletePart = useMutation({
    mutationFn: () => api.parts.delete(slot.part!.id),
    onSuccess: onSaved,
  });

  const handlePrintQr = async () => {
    const QRCode = await import('qrcode');
    const label = name || 'Unbekannt';
    const dataUrl = await QRCode.toDataURL(label, { width: 256, margin: 1, color: { dark: '#000', light: '#fff' } });
    const win = window.open('', '_blank', 'width=400,height=500');
    if (!win) return;
    const pos = slot.isLarge ? `Großfach` : `R${slot.row + 1} / S${slot.col + 1}`;
    win.document.write(`<!DOCTYPE html><html><head><title>QR Label</title>
      <style>body{font-family:sans-serif;text-align:center;padding:20px;background:#fff;color:#000}
      img{display:block;margin:0 auto 8px}p{margin:4px 0;font-size:13px}strong{font-size:16px}</style></head>
      <body><img src="${dataUrl}" width="200" /><strong>${label}</strong><p>${pos}</p>
      <script>window.print();window.close();<\/script></body></html>`);
  };

  const handleAddTag = (value?: string) => {
    const t = (value ?? tagInput).trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
    setShowTagDropdown(false);
  };
  const lowStock = slot.part
    ? isLowStock({ quantity: parseFloat(quantity) || 0, minQuantity: minQuantity ? parseFloat(minQuantity) : null })
    : false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const position = slot.isLarge
    ? `Großfach (Reihe ${slot.row + 1})`
    : `Reihe ${slot.row + 1}, Spalte ${slot.col + 1}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[95dvh]"
        style={{
          background: 'rgba(13,17,23,0.98)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}
        >
          {/* Mobile drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/10 sm:hidden" />

          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isNew ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
                border: `1px solid ${isNew ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}
            >
              {isNew ? (
                <Package className="w-4 h-4 text-accent-light" />
              ) : (
                <Zap className="w-4 h-4 text-led-on" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isNew ? 'Neues Teil anlegen' : 'Teil bearbeiten'}
              </p>
              <p className="text-xs text-slate-500">
                {magazine.name} · {position}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form (scrollable) */}
        <form action={submitAction} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Artikelname *
            </label>
            <input
              className="input-dark w-full px-4 py-2.5 text-sm"
              placeholder="z.B. M4x20 Senkkopfschraube"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Beschreibung
            </label>
            <textarea
              className="input-dark w-full px-4 py-2.5 text-sm resize-none"
              placeholder="Optional: Details, Material, Hersteller…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Menge
              </label>
              <input
                type="number"
                min={0}
                step="any"
                className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Einheit
              </label>
              <select
                className="input-dark w-full px-3 py-2.5 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {commonUnits.map((u) => (
                  <option key={u} value={u} style={{ background: '#0d1117' }}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Min quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Mindestmenge{' '}
              <span className="text-slate-600 normal-case font-normal tracking-normal">
                (Niedrigbestand-Warnung)
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="any"
                className={cn(
                  'input-dark w-full px-4 py-2.5 text-sm font-mono',
                  lowStock && 'border-led-low'
                )}
                placeholder="z.B. 10"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
              {lowStock && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-led-low">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">Niedrig!</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Tags
                <span className="text-slate-600 normal-case font-normal tracking-normal">
                  (global · für alle Teile nutzbar)
                </span>
              </span>
            </label>
            <div className="relative">
              <div className="flex gap-2 mb-2">
                <input
                  ref={tagInputRef}
                  className="input-dark flex-1 px-4 py-2 text-sm"
                  placeholder="Tag tippen → vorhandene werden vorgeschlagen"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagDropdown(true);
                  }}
                  onFocus={() => setShowTagDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddTag();
                    } else if (e.key === 'Escape') {
                      setShowTagDropdown(false);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="btn-ghost px-3 py-2 text-sm"
                >
                  +
                </button>
              </div>

              {/* Autocomplete dropdown */}
              {showTagDropdown && tagSuggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-10 z-10 rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    background: '#0d1117',
                    border: '1px solid rgba(99,102,241,0.25)',
                    marginTop: '2px',
                  }}
                >
                  {tagSuggestions.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag(t);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 text-left transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.6)' }}
                      />
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-70"
                    style={{
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#818cf8',
                    }}
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    {tag}
                    <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-600 mt-1.5">
              Tags sind global — gleiche Tags können vielen Teilen zugewiesen werden
            </p>
          </div>

          {/* Low stock info */}
          {!isNew && slot.part && (
            <div
              className="rounded-xl p-3 flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: lowStock ? '#f97316' : '#10b981',
                  boxShadow: `0 0 6px ${lowStock ? '#f97316' : '#10b981'}`,
                }}
              />
              <span className="text-xs text-slate-400">
                Aktuell:{' '}
                <strong className={cn('font-mono', lowStock ? 'text-led-low' : 'text-emerald-400')}>
                  {formatQuantity(parseFloat(quantity) || 0, unit)}
                </strong>
                {slot.part.minQuantity && (
                  <>
                    {' '}
                    · Minimum:{' '}
                    <strong className="font-mono text-slate-300">
                      {formatQuantity(slot.part.minQuantity, unit)}
                    </strong>
                  </>
                )}
              </span>
            </div>
          )}

          {formState.error && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {formState.error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 pb-1">
            {!isNew ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startDeleteTransition(() => { deletePart.mutate(); })}
                  disabled={deleteTransitionPending || deletePart.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={handlePrintQr}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                  title="QR-Label drucken"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isNew ? 'Anlegen' : 'Speichern'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
