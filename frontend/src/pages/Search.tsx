import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, X, Zap, Package, MapPin, AlertTriangle, Mic, MicOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { SearchResult } from '@/lib/types';
import { cn, isLowStock, formatQuantity } from '@/lib/utils';


function parseRgb(str: string | undefined): [number, number, number] {
  if (!str) return [245, 158, 11];
  const parts = str.split(',').map((s) => parseInt(s.trim(), 10));
  return [parts[0] ?? 245, parts[1] ?? 158, parts[2] ?? 11];
}

function getSpeechRecognitionClass(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ─── German number → digit conversion ────────────────────────────────────────

const GERMAN_ONES: Record<string, number> = {
  null: 0, ein: 1, eins: 1, eine: 1, einem: 1, einen: 1, einer: 1, eines: 1,
  zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
  zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15,
  sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
  zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
  sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
  hundert: 100, tausend: 1000,
};

function parseGermanWord(word: string): number | null {
  const lower = word.toLowerCase();
  if (GERMAN_ONES[lower] !== undefined) return GERMAN_ONES[lower];

  // Compound: "zweiundvierzig" → 42, "einundzwanzig" → 21
  const andMatch = lower.match(/^([a-zäöüß]+)und([a-zäöüß]+)$/);
  if (andMatch) {
    const onesVal = parseGermanWord(andMatch[1]);
    const tensVal = parseGermanWord(andMatch[2]);
    if (onesVal !== null && tensVal !== null && onesVal < 10 && tensVal >= 20)
      return tensVal + onesVal;
  }

  // Hundreds: "zweihundert" → 200, "dreihundertfünfzig" → 350
  const hundredMatch = lower.match(/^([a-zäöüß]+)hundert([a-zäöüß]*)$/);
  if (hundredMatch) {
    const multiplier = parseGermanWord(hundredMatch[1]);
    if (multiplier !== null && multiplier < 10) {
      const remainder = hundredMatch[2] ? parseGermanWord(hundredMatch[2]) : 0;
      if (remainder !== null) return multiplier * 100 + remainder;
    }
  }

  return null;
}

/**
 * Normalize a query string for the API — used for both typed and voice input.
 * Handles ×, x, * as multiplication signs and collapses surrounding spaces.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2')  // × / x / * between digits → x
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Converts spoken German part names to technical notation.
 *
 * Examples:
 *   "M vier mal zwanzig"            → "M4x20"
 *   "vier mal fünfundzwanzig"       → "4x25"
 *   "4 × 25"  (Unicode ×, browser) → "4x25"
 *   "4 * 25"  (asterisk)           → "4x25"
 *   "4er Holzschraube"             → "4 Holzschraube"
 *   "M drei mal zwölf Senkkopf"    → "M3x12 Senkkopf"
 */
function normalizeTranscript(raw: string): string {
  let text = raw.trim();

  // 1. Normalize ×, x, * between digits — browsers often return "4 × 25"
  text = text.replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2');

  // 2a. German number word + "-er" suffix → digit
  //     Uses parseGermanWord to handle ALL number words automatically — no hardcoded list needed.
  //     "Vierer" → base "Vier" → 4, "Zwanziger" → 20, "Zweiundvierziger" → 42
  //     False positives avoided: "Schrauber"→base "Schraub"→null→unchanged
  text = text.replace(/\b([a-zäöüß]+)er\b/gi, (match, base) => {
    const n = parseGermanWord(base);
    return n !== null ? String(n) : match;
  });

  // 2b. Digit + "-er" suffix: "4er" → "4", "6er" → "6"
  text = text.replace(/\b(\d+)er\b/gi, '$1');

  // 3. Replace compound number words ("zweiundvierzig", "zweihundert", ...)
  text = text.replace(/\b([a-zäöüß]{4,}und[a-zäöüß]+|[a-zäöüß]+hundert[a-zäöüß]*)\b/gi, (m) => {
    const n = parseGermanWord(m);
    return n !== null ? String(n) : m;
  });

  // 4. Replace simple German number words
  const numWordPattern =
    /\b(null|eins?|eine[mnrs]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)\b/gi;
  text = text.replace(numWordPattern, (m) => {
    const n = parseGermanWord(m);
    return n !== null ? String(n) : m;
  });

  // 5. "4 mal 20" → "4x20"
  text = text.replace(/(\d)\s+mal\s+(\d)/gi, '$1x$2');

  // 6. Re-apply after number word substitution
  text = text.replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2');

  // 7. Collapse letter-prefix + space + number: "M 4" → "M4"
  text = text.replace(/\b([A-Z])\s+(\d)/g, '$1$2');

  // 8. Normalize whitespace
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeResultId, setActiveResultId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const { setHighlightedSlotId, triggerNotFoundBlink } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const speechSupported = getSpeechRecognitionClass() !== null;

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
    staleTime: 60_000,
  });

  const [hr, hg, hb] = parseRgb(settings?.search_highlight_color);
  const hColor = `rgb(${hr},${hg},${hb})`;
  const hBg = `rgba(${hr},${hg},${hb},0.1)`;
  const hBorder = `rgba(${hr},${hg},${hb},0.5)`;
  const hGlow = `0 0 20px rgba(${hr},${hg},${hb},0.12)`;
  const hIconBg = `rgba(${hr},${hg},${hb},0.2)`;
  const hIconBorder = `rgba(${hr},${hg},${hb},0.3)`;

  // Clear highlight when leaving the Search page
  useEffect(() => {
    return () => {
      setHighlightedSlotId(null);
      api.search.clearHighlight().catch(() => {});
      recognitionRef.current?.abort();
    };
  }, [setHighlightedSlotId]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        setHighlightedSlotId(null);
        return;
      }
      // Normalize ×, *, spaces around x for typed queries too
      const normalized = normalizeQuery(q);
      setIsSearching(true);
      setSearched(true);
      try {
        const res = await api.search.query(normalized);
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

  const handleMicClick = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      // Show raw interim transcript (user sees what was heard before normalization)
      if (interim) setInterimTranscript(interim);
      if (final) {
        // Normalize spoken German to technical notation ("vier mal zwanzig" → "4x20")
        const normalized = normalizeTranscript(final);
        setInterimTranscript('');
        setQuery(normalized);
        doSearch(normalized);
        inputRef.current?.focus();
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.start();
  }, [isListening, doSearch]);

  const displayQuery = isListening && interimTranscript ? interimTranscript : query;

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
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Gib einen Suchbegriff ein — das LED-Fach leuchtet sofort auf
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <div
            className="relative rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: 'rgba(16,21,36,0.97)',
              border: `1px solid ${
                isListening
                  ? 'rgba(239,68,68,0.6)'
                  : displayQuery
                  ? 'rgba(99,102,241,0.55)'
                  : 'rgba(255,255,255,0.1)'
              }`,
              boxShadow: isListening
                ? '0 0 30px rgba(239,68,68,0.2), 0 8px 32px rgba(0,0,0,0.4)'
                : displayQuery
                ? '0 0 30px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.4)'
                : '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-center px-5 py-4 gap-4">
              <SearchIcon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isListening ? 'text-red-400' : displayQuery ? 'text-accent-light' : 'text-slate-400'
                )}
              />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-lg placeholder-slate-500 outline-none transition-colors"
                style={{ color: isListening && interimTranscript ? 'rgba(255,255,255,0.5)' : 'white' }}
                placeholder={isListening ? 'Höre zu…' : 'z.B. M4x20 Schraube, Kondensator, Kabelkanal…'}
                value={displayQuery}
                onChange={(e) => !isListening && handleChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isListening && doSearch(query)}
                autoFocus
                readOnly={isListening}
              />
              <div className="flex items-center gap-2">
                {isSearching && (
                  <div className="w-5 h-5 border-2 border-accent-DEFAULT border-t-transparent rounded-full animate-spin" />
                )}
                {displayQuery && !isSearching && !isListening && (
                  <button
                    onClick={handleClear}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {speechSupported && (
                  <motion.button
                    onClick={handleMicClick}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-xl transition-all',
                      isListening
                        ? 'text-red-400 bg-red-500/15'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    )}
                    title={isListening ? 'Aufnahme stoppen' : 'Sprachsuche starten'}
                    animate={isListening ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={isListening ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </motion.button>
                )}
              </div>
            </div>

            {/* Progress bar — search or listening indicator */}
            {isSearching && (
              <div className="h-0.5 bg-gradient-to-r from-accent-DEFAULT via-led-cyan to-accent-DEFAULT animate-pulse" />
            )}
            {isListening && !isSearching && (
              <motion.div
                className="h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.0 }}
              />
            )}
          </div>

          {/* Listening hint below input */}
          <AnimatePresence>
            {isListening && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-red-400 mt-2 ml-1 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
                Sprich jetzt — Erkennung läuft…
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {!searched && !query && !isListening && (
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
                <p className="text-slate-300 font-medium mb-1">Suche nach Teilen</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Einfach eintippen — bei einem Treffer leuchtet das LED-Fach auf
                </p>
                {speechSupported && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Oder tippe auf das Mikrofon für Sprachsuche
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Schraube', 'Kondensator', 'LED', 'Widerstand', 'Kabel'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => {
                      setQuery(hint);
                      doSearch(hint);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-slate-200 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
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
                <p className="text-slate-200 font-medium">Nichts gefunden</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
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
                    className="w-full text-left rounded-xl p-4 transition-all duration-200"
                    style={{
                      background: isActive ? hBg : 'rgba(22,28,44,0.95)',
                      border: `1px solid ${isActive ? hBorder : 'rgba(255,255,255,0.09)'}`,
                      boxShadow: isActive ? hGlow : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isActive ? hIconBg : 'rgba(99,102,241,0.1)',
                          border: `1px solid ${isActive ? hIconBorder : 'rgba(99,102,241,0.15)'}`,
                        }}
                      >
                        {isActive ? (
                          <Zap className="w-4 h-4" style={{ color: hColor }} fill="currentColor" />
                        ) : (
                          <Package className="w-4 h-4 text-accent-DEFAULT" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p
                            className="font-semibold text-sm"
                            style={{ color: isActive ? hColor : '#e2e8f0' }}
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
                          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{result.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
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
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(255,255,255,0.09)',
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
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-3.5 h-3.5 text-accent-DEFAULT" />
            <p className="text-xs font-semibold text-accent-light">Sprachsteuerung / Alexa / Home Assistant</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Webhook: <code className="text-accent-light font-mono">POST /api/voice/search</code> mit{' '}
            <code className="text-slate-300 font-mono">{'{"query": "M4x20 Schraube"}'}</code>
          </p>
          {!speechSupported && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Direkte Mikrofon-Suche benötigt Chrome, Edge oder Safari (Firefox: nicht unterstützt).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
