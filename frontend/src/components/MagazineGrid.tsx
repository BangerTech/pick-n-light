import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Package, AlertTriangle, Zap } from 'lucide-react';
import type { Slot, Magazine } from '@/lib/types';
import { cn, isLowStock, formatQuantity } from '@/lib/utils';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import SlotModal from './SlotModal';

interface MagazineGridProps {
  magazine: Magazine;
  onRefresh: () => void;
}

export default function MagazineGrid({ magazine, onRefresh }: MagazineGridProps) {
  const { highlightedSlotId, notFoundBlink } = useAppStore();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const handleSlotClick = async (slot: Slot) => {
    if (slot.part) {
      await api.search.highlight(slot.id);
    }
    setSelectedSlot(slot);
  };

  const gridRows = Array.from({ length: magazine.rows }, (_, r) => {
    const isLargeRow = magazine.bottomRowLarge && r === magazine.rows - 1;
    if (isLargeRow) {
      const largeSlot = magazine.slots.find((s) => s.row === r && s.col === 0);
      return { row: r, isLarge: true, slots: largeSlot ? [largeSlot] : [] };
    }
    const rowSlots = magazine.slots
      .filter((s) => s.row === r)
      .sort((a, b) => a.col - b.col);
    return { row: r, isLarge: false, slots: rowSlots };
  });

  return (
    <>
      <div className="flex flex-col gap-1.5 w-full">
        {gridRows.map(({ row, isLarge, slots: rowSlots }) => (
          <div
            key={row}
            className={cn(
              'magazine-grid',
              isLarge ? 'grid-cols-1' : `grid-cols-${Math.min(magazine.columns, 12)}`
            )}
            style={
              !isLarge
                ? { gridTemplateColumns: `repeat(${magazine.columns}, minmax(0, 1fr))` }
                : undefined
            }
          >
            {rowSlots.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                isLarge={isLarge}
                isHighlighted={highlightedSlotId === slot.id}
                notFoundBlink={notFoundBlink}
                onClick={() => handleSlotClick(slot)}
              />
            ))}
            {/* Empty placeholders if slots missing */}
            {!isLarge &&
              rowSlots.length < magazine.columns &&
              Array.from({ length: magazine.columns - rowSlots.length }).map((_, i) => (
                <div
                  key={`empty-${row}-${i}`}
                  className="h-16 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                />
              ))}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedSlot && (
          <SlotModal
            slot={selectedSlot}
            magazine={magazine}
            onClose={() => setSelectedSlot(null)}
            onSaved={() => {
              setSelectedSlot(null);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface SlotCellProps {
  slot: Slot;
  isLarge: boolean;
  isHighlighted: boolean;
  notFoundBlink: boolean;
  onClick: () => void;
}

function SlotCell({ slot, isLarge, isHighlighted, notFoundBlink, onClick }: SlotCellProps) {
  const part = slot.part;
  const lowStock = part ? isLowStock(part) : false;

  const isEmpty = !part;
  const isOccupied = !!part;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'relative rounded-lg text-left transition-all duration-200 overflow-hidden cursor-pointer',
        isLarge ? 'h-14' : 'h-16',
        isEmpty && !notFoundBlink && 'slot-empty',
        isOccupied && !isHighlighted && !notFoundBlink && 'slot-occupied',
        isHighlighted && 'slot-highlighted',
        notFoundBlink && 'slot-not-found',
        lowStock && !isHighlighted && 'slot-low-stock'
      )}
      style={
        lowStock && !isHighlighted
          ? { borderColor: '#f97316', borderStyle: 'solid' }
          : undefined
      }
    >
      {/* LED position badge */}
      <div
        className="absolute top-1 right-1.5 text-xs font-mono opacity-25"
        style={{ fontSize: '9px', color: '#94a3b8' }}
      >
        {slot.ledStart}
      </div>

      {/* Highlighted glow overlay */}
      {isHighlighted && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.15) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="p-2 h-full flex flex-col justify-between">
        {isEmpty ? (
          <div className="flex items-center justify-center h-full gap-1.5 text-slate-600">
            <Plus className="w-4 h-4" />
            <span className="text-xs font-medium">Leer</span>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1.5">
              {isHighlighted ? (
                <Zap className="w-3.5 h-3.5 text-led-on flex-shrink-0 mt-0.5" fill="currentColor" />
              ) : lowStock ? (
                <AlertTriangle className="w-3.5 h-3.5 text-led-low flex-shrink-0 mt-0.5" />
              ) : (
                <Package className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={cn(
                  'text-xs font-semibold leading-tight line-clamp-2',
                  isHighlighted ? 'text-led-on' : lowStock ? 'text-led-low' : 'text-slate-200'
                )}
              >
                {part!.name}
              </p>
            </div>
            <p
              className={cn(
                'text-xs font-mono mt-auto',
                isHighlighted ? 'text-led-on/80' : lowStock ? 'text-led-low/80' : 'text-slate-500'
              )}
            >
              {formatQuantity(part!.quantity, part!.unit)}
            </p>
          </>
        )}
      </div>
    </motion.button>
  );
}
