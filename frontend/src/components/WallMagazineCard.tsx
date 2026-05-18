import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import type { Magazine } from '@/lib/types';
import { api } from '@/lib/api';
import MagazineGrid from './MagazineGrid';

interface WallMagazineCardProps {
  mag: Magazine;
  index: number;
  compact: boolean;
}

export default function WallMagazineCard({ mag, index, compact }: WallMagazineCardProps) {
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['magazine', mag.id],
    queryFn: () => api.magazines.get(mag.id),
  });

  const occupied = detail?.slots.filter((s) => s.part).length ?? 0;
  const total = detail?.slots.length ?? 0;
  const lowStock =
    detail?.slots.filter(
      (s) =>
        s.part &&
        s.part.minQuantity !== null &&
        s.part.quantity <= (s.part.minQuantity ?? Infinity)
    ).length ?? 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['magazine', mag.id] });
    queryClient.invalidateQueries({ queryKey: ['magazines'] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Magazine header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-3.5 h-3.5 text-accent-light flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">{mag.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {lowStock > 0 && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(249,115,22,0.15)',
                color: '#f97316',
                border: '1px solid rgba(249,115,22,0.25)',
              }}
            >
              ⚠ {lowStock}
            </span>
          )}
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {occupied}/{total}
          </span>
        </div>
      </div>

      {/* Grid content */}
      <div className="p-2 sm:p-3 flex-1">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detail ? (
          <MagazineGrid magazine={detail} onRefresh={handleRefresh} compact={compact} />
        ) : null}
      </div>
    </motion.div>
  );
}
