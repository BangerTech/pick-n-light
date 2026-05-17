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
  compact?: boolean;
}

export default function MagazineGrid({ magazine, onRefresh, compact = false }: MagazineGridProps) {
  const { highlightedSlotId, notFoundBlink } = useAppStore();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

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
    const rowSlots = magazine.slots
      .filter((s) => s.row === r)
      .sort((a, b) => a.col - b.col);
    return { row: r, isLarge: false, slots: rowSlots };
  });

  return (
    <>
      <div className="flex flex-col gap-1 w-full">
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
                compact={compact}
                onClick={() => handleSlotClick(slot)}
              />
            ))}
            {/* Empty placeholders if slots missing */}
            {!isLarge &&
              rowSlots.length < magazine.columns &&
              Array.from({ length: magazine.columns - rowSlots.length }).map((_, i) => (
                <div
                  key={`empty-${row}-${i}`}
                  className={cn('rounded-lg', compact ? 'h-10' : 'h-14')}
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

interface SlotCellProps {
  slot: Slot;
  isLarge: boolean;
  isHighlighted: boolean;
  notFoundBlink: boolean;
  compact?: boolean;
  onClick: () => void;
}

function SlotCell({ slot, isLarge, isHighlighted, notFoundBlink, compact = false, onClick }: SlotCellProps) {
  const part = slot.part;
  const lowStock = part ? isLowStock(part) : false;

  const isEmpty = !part;
  const isOccupied = !!part;

  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'relative rounded-lg text-left transition-all duration-200 overflow-hidden cursor-pointer group',
        compact ? (isLarge ? 'h-10' : 'h-10') : isLarge ? 'h-14' : 'h-[72px]',
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
      {/* Background glow for highlighted */}
      {isHighlighted && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.2) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Top-right: LED index badge */}
      <div
        className="absolute top-1 right-1.5 font-mono opacity-0 group-hover:opacity-30 transition-opacity"
        style={{ fontSize: '8px', color: '#94a3b8', lineHeight: 1 }}
      >
        {slot.ledStart}
      </div>

      {/* Slot position label (top-left, very subtle) */}
      {!compact && (
        <div
          className="absolute top-1 left-1.5 font-mono opacity-20"
          style={{ fontSize: '8px', color: '#94a3b8', lineHeight: 1 }}
        >
          {slot.row + 1}·{slot.col + 1}
        </div>
      )}

      {/* Content */}
      <div className={cn('h-full flex flex-col justify-between', compact ? 'p-1.5' : 'p-2.5')}>
        {isEmpty ? (
          <div className="flex items-center justify-center h-full gap-1.5 text-slate-600 group-hover:text-slate-500 transition-colors">
            <Plus className={cn(compact ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
            {!compact && <span className="text-xs font-medium">Leer</span>}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1 min-w-0">
              {isHighlighted ? (
                <Zap
                  className={cn('flex-shrink-0 text-led-on', compact ? 'w-3 h-3 mt-0' : 'w-3.5 h-3.5 mt-0.5')}
                  fill="currentColor"
                />
              ) : lowStock ? (
                <AlertTriangle
                  className={cn('flex-shrink-0 text-led-low', compact ? 'w-3 h-3 mt-0' : 'w-3.5 h-3.5 mt-0.5')}
                />
              ) : (
                <Package
                  className={cn('flex-shrink-0 text-slate-500', compact ? 'w-3 h-3 mt-0' : 'w-3.5 h-3.5 mt-0.5')}
                />
              )}
              <p
                className={cn(
                  'font-semibold leading-tight truncate min-w-0',
                  compact ? 'text-[10px]' : 'text-xs',
                  isHighlighted ? 'text-led-on' : lowStock ? 'text-led-low' : 'text-slate-200'
                )}
              >
                {part!.name}
              </p>
            </div>

            {!compact && (
              <div className="flex items-end justify-between gap-1 mt-auto">
                <p
                  className={cn(
                    'text-xs font-mono tabular-nums',
                    isHighlighted ? 'text-led-on/70' : lowStock ? 'text-led-low/70' : 'text-slate-500'
                  )}
                >
                  {formatQuantity(part!.quantity, part!.unit)}
                </p>

                {/* Tag dots */}
                {part!.tags.length > 0 && (
                  <div className="flex gap-0.5 flex-shrink-0">
                    {part!.tags.slice(0, 3).map((tag) => (
                      <div
                        key={tag}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.5)' }}
                        title={tag}
                      />
                    ))}
                    {part!.tags.length > 3 && (
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.25)' }}
                        title={`+${part!.tags.length - 3} weitere`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Low-stock accent line at bottom */}
      {lowStock && !isHighlighted && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, transparent, #f97316, transparent)' }}
        />
      )}

      {/* Highlighted accent line at bottom */}
      {isHighlighted && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }}
        />
      )}
    </motion.button>
  );
}
