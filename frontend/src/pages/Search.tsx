import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, X, Zap, Package, MapPin, AlertTriangle, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { SearchResult } from '@/lib/types';
import { cn, isLowStock, formatQuantity } from '@/lib/utils';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeResultId, setActiveResultId] = useState<number | null>(null);
  const { setHighlightedSlotId, triggerNotFoundBlink } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        setHighlightedSlotId(null);
        return;
      }
      setIsSearching(true);
      setSearched(true);
      try {
        const res = await api.search.query(q);
        setResults(res);
        if (res.length === 0) {
          triggerNotFoundBlink();
          setHighlightedSlotId(null);
        } else {
          setHighlightedSlotId(res[0].slotId);
          setActiveResultId(res[0].id);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [setHighlightedSlotId, triggerNotFoundBlink]
  );

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setHighlightedSlotId(null);
    api.search.clearHighlight().catch(() => {});
    inputRef.current?.focus();
  };

  const handleResultClick = async (result: SearchResult) => {
    setActiveResultId(result.id);
    setHighlightedSlotId(result.slotId);
    await api.search.highlight(result.slotId).catch(() => {});
  };

  return (
    <div className="h-full flex flex-col items-center px-4 sm:px-6 py-5 sm:py-8 overflow-auto">
      {/* Header */}
      <div className="w-full max-w-2xl">
        <div className="mb-5 sm:mb-8 text-center">
          <h1
            className="text-2xl sm:text-3xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Teilsuche
          </h1>
          <p className="text-slate-500 text-sm">
            Gib einen Suchbegriff ein — das LED-Fach leuchtet sofort auf
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <div
            className="relative rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: 'rgba(13,17,23,0.95)',
              border: `1px solid ${query ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}`,
              boxShadow: query
                ? '0 0 30px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.4)'
                : '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center px-5 py-4 gap-4">
              <SearchIcon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  query ? 'text-accent-light' : 'text-slate-600'
                )}
              />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-lg text-white placeholder-slate-600 outline-none"
                placeholder="z.B. M4x20 Schraube, Kondensator, Kabelkanal…"
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
                autoFocus
              />
              <div className="flex items-center gap-2">
                {isSearching && (
                  <div className="w-5 h-5 border-2 border-accent-DEFAULT border-t-transparent rounded-full animate-spin" />
                )}
                {query && !isSearching && (
                  <button
                    onClick={handleClear}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                  title="Sprachsuche (Voice Webhook)"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {isSearching && (
              <div className="h-0.5 bg-gradient-to-r from-accent-DEFAULT via-led-cyan to-accent-DEFAULT animate-pulse" />
            )}
          </div>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {!searched && !query && (
            <motion.div
              key="hints"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-4 py-12 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <Zap className="w-8 h-8 text-accent-DEFAULT" />
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-1">Suche nach Teilen</p>
                <p className="text-slate-600 text-sm">
                  Einfach eintippen — bei einem Treffer leuchtet das LED-Fach auf
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Schraube', 'Kondensator', 'LED', 'Widerstand', 'Kabel'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => {
                      setQuery(hint);
                      doSearch(hint);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs text-slate-500 hover:text-slate-300 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {searched && results.length === 0 && !isSearching && (
            <motion.div
              key="not-found"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-12 text-center"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <X className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <p className="text-slate-300 font-medium">Nichts gefunden</p>
                <p className="text-slate-600 text-sm mt-1">
                  Kein Teil für <strong className="text-slate-400">"{query}"</strong> gefunden.
                  <br />
                  Alle LEDs haben kurz rot geblinkt.
                </p>
              </div>
            </motion.div>
          )}

          {results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-1">
                {results.length} Treffer
              </p>
              {results.map((result) => {
                const low = isLowStock(result);
                const isActive = activeResultId === result.id;
                return (
                  <motion.button
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      'w-full text-left rounded-xl p-4 transition-all duration-200',
                      isActive
                        ? 'border-led-on'
                        : 'border-slate-700/50 hover:border-accent-DEFAULT/40'
                    )}
                    style={{
                      background: isActive
                        ? 'rgba(245,158,11,0.08)'
                        : 'rgba(13,17,23,0.8)',
                      border: `1px solid ${isActive ? 'rgba(245,158,11,0.5)' : 'rgba(71,85,105,0.3)'}`,
                      boxShadow: isActive
                        ? '0 0 20px rgba(245,158,11,0.1)'
                        : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isActive
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(99,102,241,0.1)',
                          border: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.15)'}`,
                        }}
                      >
                        {isActive ? (
                          <Zap className="w-4 h-4 text-led-on" fill="currentColor" />
                        ) : (
                          <Package className="w-4 h-4 text-accent-DEFAULT" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p
                            className={cn(
                              'font-semibold text-sm',
                              isActive ? 'text-led-on' : 'text-slate-200'
                            )}
                          >
                            {result.name}
                          </p>
                          {low && (
                            <span className="flex items-center gap-1 text-xs text-led-low">
                              <AlertTriangle className="w-3 h-3" /> Niedrig
                            </span>
                          )}
                        </div>
                        {result.description && (
                          <p className="text-xs text-slate-500 truncate">{result.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {result.slot.magazine.name} · Reihe {result.slot.row + 1}
                            {!result.slot.isLarge && `, Spalte ${result.slot.col + 1}`}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-mono font-semibold',
                              low ? 'text-led-low' : 'text-emerald-400'
                            )}
                          >
                            {formatQuantity(result.quantity, result.unit)}
                          </span>
                        </div>
                        {result.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {result.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  background: 'rgba(99,102,241,0.1)',
                                  color: '#818cf8',
                                  border: '1px solid rgba(99,102,241,0.15)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className="flex-shrink-0 text-xs font-mono px-2 py-1 rounded-lg"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: '#475569',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        LED {result.slot.ledStart}–{result.slot.ledStart + result.slot.ledCount - 1}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice webhook hint */}
        <div
          className="mt-8 rounded-xl p-4"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-3.5 h-3.5 text-accent-DEFAULT" />
            <p className="text-xs font-semibold text-accent-light">Sprachsteuerung / Alexa</p>
          </div>
          <p className="text-xs text-slate-500">
            Webhook: <code className="text-accent-light font-mono">POST /api/voice/search</code> mit{' '}
            <code className="text-slate-400 font-mono">{'{"query": "M4x20 Schraube"}'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
