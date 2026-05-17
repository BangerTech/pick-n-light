import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Slot, Magazine } from '@/lib/types';
import { cn, isLowStock, formatQuantity } from '@/lib/utils';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import SlotModal from './SlotModal';

// ─── Color helpers ────────────────────────────────────────────────────────────

function parseRgb(str: string | undefined): [number, number, number] {
  if (!str) return [245, 158, 11];
  const parts = str.split(',').map((s) => parseInt(s.trim(), 10));
  return [parts[0] ?? 245, parts[1] ?? 158, parts[2] ?? 11];
}

interface ColorTheme {
  outer: string;
  handleBg: string;
  handleBorder: string;
  bodyBg: string;
  nameTxt: string;
  qtyTxt: string;
  glowPulse: [string, string, string];
  shimmer: string;
  barColor: string;
}

function buildHighlightTheme(rgbStr: string | undefined): ColorTheme {
  const [r, g, b] = parseRgb(rgbStr);
  const dk = (x: number, f: number) => Math.round(x * f);
  const lk = (x: number) => Math.min(255, Math.round(x * 0.75 + 255 * 0.25));
  return {
    outer: `rgba(${r},${g},${b},0.75)`,
    handleBg: `linear-gradient(180deg,rgba(${dk(r,0.45)},${dk(g,0.28)},${dk(b,0.28)},0.95) 0%,rgba(${dk(r,0.28)},${dk(g,0.17)},${dk(b,0.17)},0.98) 100%)`,
    handleBorder: `rgba(${r},${g},${b},0.5)`,
    bodyBg: `linear-gradient(180deg,rgba(${dk(r,0.18)},${dk(g,0.11)},${dk(b,0.11)},0.97) 0%,rgba(${dk(r,0.1)},${dk(g,0.06)},${dk(b,0.06)},0.98) 100%)`,
    nameTxt: `rgb(${lk(r)},${lk(g)},${lk(b)})`,
    qtyTxt: `rgba(${r},${g},${b},0.9)`,
    glowPulse: [
      `0 0 18px rgba(${r},${g},${b},0.45),0 4px 20px rgba(0,0,0,0.7)`,
      `0 0 42px rgba(${r},${g},${b},0.85),0 4px 20px rgba(0,0,0,0.7)`,
      `0 0 18px rgba(${r},${g},${b},0.45),0 4px 20px rgba(0,0,0,0.7)`,
    ],
    shimmer: `rgba(${r},${g},${b},0.22)`,
    barColor: `rgba(${r},${g},${b},0.9)`,
  };
}

const lowStockTheme: ColorTheme = {
  outer: 'rgba(249,115,22,0.55)',
  handleBg: 'linear-gradient(180deg,rgba(80,38,8,0.95) 0%,rgba(50,22,4,0.98) 100%)',
  handleBorder: 'rgba(249,115,22,0.4)',
  bodyBg: 'linear-gradient(180deg,rgba(30,14,2,0.97) 0%,rgba(16,8,1,0.98) 100%)',
  nameTxt: '#fdba74',
  qtyTxt: 'rgba(253,186,116,0.8)',
  glowPulse: [
    '0 0 14px rgba(249,115,22,0.3),0 4px 20px rgba(0,0,0,0.7)',
    '0 0 26px rgba(249,115,22,0.55),0 4px 20px rgba(0,0,0,0.7)',
    '0 0 14px rgba(249,115,22,0.3),0 4px 20px rgba(0,0,0,0.7)',
  ],
  shimmer: 'rgba(249,115,22,0.15)',
  barColor: 'rgba(249,115,22,0.9)',
};

const notFoundTheme: ColorTheme = {
  outer: 'rgba(239,68,68,0.7)',
  handleBg: 'linear-gradient(180deg,rgba(80,10,10,0.95) 0%,rgba(50,6,6,0.98) 100%)',
  handleBorder: 'rgba(239,68,68,0.5)',
  bodyBg: 'linear-gradient(180deg,rgba(30,4,4,0.97) 0%,rgba(16,2,2,0.98) 100%)',
  nameTxt: '#fca5a5',
  qtyTxt: 'rgba(252,165,165,0.8)',
  glowPulse: [
    '0 0 0 rgba(239,68,68,0),0 4px 20px rgba(0,0,0,0.7)',
    '0 0 32px rgba(239,68,68,0.8),0 4px 20px rgba(0,0,0,0.7)',
    '0 0 0 rgba(239,68,68,0),0 4px 20px rgba(0,0,0,0.7)',
  ],
  shimmer: 'rgba(239,68,68,0.18)',
  barColor: 'rgba(239,68,68,0.9)',
};

const occupiedTheme: ColorTheme = {
  outer: 'rgba(99,102,241,0.35)',
  handleBg: 'linear-gradient(180deg,rgba(32,44,80,0.98) 0%,rgba(20,28,56,0.98) 100%)',
  handleBorder: 'rgba(99,102,241,0.3)',
  bodyBg: 'linear-gradient(180deg,rgba(14,19,36,0.98) 0%,rgba(9,12,22,0.98) 100%)',
  nameTxt: '#e6edf3',
  qtyTxt: 'rgba(203,213,225,0.85)',
  glowPulse: ['0 4px 16px rgba(0,0,0,0.6)', '0 4px 16px rgba(0,0,0,0.6)', '0 4px 16px rgba(0,0,0,0.6)'],
  shimmer: 'rgba(255,255,255,0.06)',
  barColor: 'rgba(99,102,241,0.55)',
};

// ─── Magazine grid ────────────────────────────────────────────────────────────

interface MagazineGridProps {
  magazine: Magazine;
  onRefresh: () => void;
  compact?: boolean;
}

export default function MagazineGrid({ magazine, onRefresh, compact = false }: MagazineGridProps) {
  const { highlightedSlotId, notFoundBlink } = useAppStore();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
    staleTime: 60_000,
  });

  const handleSlotClick = (slot: Slot) => {
    api.search.highlight(slot.id).catch(() => {});
    setSelectedSlot(slot);
  };

  const handleModalClose = () => {
    setSelectedSlot(null);
    api.search.clearHighlight().catch(() => {});
  };

  const gridRows = Array.from({ length: magazine.rows }, (_, r) => {
    const isLargeRow = magazine.bottomRowLarge && r === magazine.rows - 1;
    if (isLargeRow) {
      const largeSlot = magazine.slots.find((s) => s.row === r && s.col === 0);
      return { row: r, isLarge: true, slots: largeSlot ? [largeSlot] : [] };
    }
    return {
      row: r,
      isLarge: false,
      slots: magazine.slots.filter((s) => s.row === r).sort((a, b) => a.col - b.col),
    };
  });

  return (
    <>
      {/* Cabinet frame */}
      <div
        className="p-2 sm:p-2.5 rounded-2xl"
        style={{
          background: 'linear-gradient(160deg,#0e1420 0%,#0a0f1a 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6),inset 0 -1px 2px rgba(255,255,255,0.04),0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div className="flex flex-col gap-1.5">
          {gridRows.map(({ row, isLarge, slots: rowSlots }) => (
            <div
              key={row}
              className="magazine-grid"
              style={isLarge ? { gridTemplateColumns: '1fr' } : { gridTemplateColumns: `repeat(${magazine.columns},minmax(0,1fr))` }}
            >
              {rowSlots.map((slot) => (
                <DrawerCell
                  key={slot.id}
                  slot={slot}
                  isLarge={isLarge}
                  isHighlighted={highlightedSlotId === slot.id}
                  notFoundBlink={notFoundBlink}
                  compact={compact}
                  highlightRgb={settings?.search_highlight_color}
                  onClick={() => handleSlotClick(slot)}
                />
              ))}
              {!isLarge &&
                rowSlots.length < magazine.columns &&
                Array.from({ length: magazine.columns - rowSlots.length }).map((_, i) => (
                  <div key={`ph-${row}-${i}`} className={cn('rounded-lg', compact ? 'h-12' : 'h-[90px]')} style={{ background: 'rgba(255,255,255,0.012)' }} />
                ))}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedSlot && (
          <SlotModal
            slot={selectedSlot}
            magazine={magazine}
            onClose={handleModalClose}
            onSaved={() => {
              setSelectedSlot(null);
              api.search.clearHighlight().catch(() => {});
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Drawer cell ──────────────────────────────────────────────────────────────

interface DrawerCellProps {
  slot: Slot;
  isLarge: boolean;
  isHighlighted: boolean;
  notFoundBlink: boolean;
  compact?: boolean;
  highlightRgb?: string;
  onClick: () => void;
}

function DrawerCell({ slot, isLarge, isHighlighted, notFoundBlink, compact = false, highlightRgb, onClick }: DrawerCellProps) {
  const part = slot.part;
  const lowStock = part ? isLowStock(part) : false;
  const isEmpty = !part;

  const theme: ColorTheme | null = isHighlighted
    ? buildHighlightTheme(highlightRgb)
    : lowStock
    ? lowStockTheme
    : notFoundBlink
    ? notFoundTheme
    : isEmpty
    ? null
    : occupiedTheme;

  const height = compact ? 'h-12' : isLarge ? 'h-16' : 'h-[90px]';
  const handleH = compact ? '40%' : '32%';
  const isAnimated = (isHighlighted || notFoundBlink) && theme !== null;

  return (
    <motion.button
      onClick={onClick}
      className={cn('relative rounded-lg overflow-hidden cursor-pointer group', height)}
      style={
        isEmpty
          ? { background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(99,102,241,0.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }
          : { border: `1px solid ${theme!.outer}`, boxShadow: theme!.glowPulse[0] }
      }
      whileHover={isEmpty ? { scale: 1.01, borderColor: 'rgba(99,102,241,0.45)' } : { y: -2, scale: 1.008 }}
      whileTap={{ scale: 0.97, y: 0 }}
      animate={isAnimated ? { boxShadow: theme!.glowPulse } : {}}
      transition={
        isAnimated
          ? { duration: isHighlighted ? 1.4 : 0.4, repeat: isHighlighted ? Infinity : 5, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 340, damping: 28 }
      }
    >
      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 transition-colors" style={{ color: 'rgba(100,116,139,0.7)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.9)' )}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(100,116,139,0.7)')}
        >
          <Plus className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.5} />
          {!compact && <span className="text-[10px] font-medium tracking-widest uppercase">Leer</span>}
        </div>
      ) : (
        <>
          {/* Handle / label strip */}
          <div
            className="absolute left-0 right-0 top-0 flex items-center justify-center px-2 overflow-hidden"
            style={{ height: handleH, background: theme!.handleBg, borderBottom: `1px solid ${theme!.handleBorder}` }}
          >
            {/* Glass shimmer */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(180deg,${theme!.shimmer} 0%,transparent 100%)` }} />
            {/* Top specular */}
            <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 40%,rgba(255,255,255,0.18) 60%,transparent)' }} />

            {isHighlighted && <Zap className="absolute left-2 w-2.5 h-2.5 flex-shrink-0" style={{ color: theme!.qtyTxt }} fill="currentColor" />}

            <p className={cn('font-semibold text-center leading-none w-full truncate', compact ? 'text-[9px]' : 'text-[11px]')} style={{ color: theme!.nameTxt, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {part!.name}
            </p>

            {!compact && (
              <span className="absolute right-1.5 font-mono opacity-0 group-hover:opacity-30 transition-opacity" style={{ fontSize: '7px', color: '#94a3b8' }}>
                {slot.row + 1}.{slot.col + 1}
              </span>
            )}
          </div>

          {/* Drawer body */}
          <div className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center" style={{ top: handleH, background: theme!.bodyBg }}>
            {/* Inner depth shadow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 100%)' }} />

            <p className={cn('font-mono tabular-nums font-bold text-center', compact ? 'text-[9px]' : 'text-sm')} style={{ color: theme!.qtyTxt, textShadow: `0 0 10px ${theme!.qtyTxt}` }}>
              {formatQuantity(part!.quantity, part!.unit)}
            </p>

            {!compact && part!.tags.length > 0 && (
              <div className="flex gap-0.5 mt-1">
                {part!.tags.slice(0, 4).map((tag) => (
                  <div key={tag} className="w-1 h-1 rounded-full" style={{ background: theme!.barColor }} title={tag} />
                ))}
              </div>
            )}
          </div>

          {/* Bottom accent bar */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg,transparent 0%,${theme!.barColor} 25%,${theme!.barColor} 75%,transparent 100%)`, opacity: isHighlighted || lowStock ? 0.9 : 0.4 }}
          />
        </>
      )}
    </motion.button>
  );
}
