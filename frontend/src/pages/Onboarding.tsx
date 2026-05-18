import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  LayoutGrid,
  Lightbulb,
  Wifi,
  Rocket,
  Play,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { totalLedCount, calculateSlotsClient } from '@/lib/ledCalculator';

const steps = [
  { id: 1, label: 'Willkommen', icon: Zap },
  { id: 2, label: 'Magazin', icon: LayoutGrid },
  { id: 3, label: 'WLED', icon: Wifi },
  { id: 4, label: 'LEDs', icon: Lightbulb },
  { id: 5, label: 'Fertig', icon: Rocket },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);

  // Step 2 — Magazine shape
  const [name, setName] = useState('');
  const [rows, setRows] = useState(9);
  const [columns, setColumns] = useState(4);
  const [bottomRowLarge, setBottomRowLarge] = useState(true);

  // Step 3 — WLED
  const [wledName, setWledName] = useState('');
  const [wledIp, setWledIp] = useState('');
  const [mqttTopic, setMqttTopic] = useState('wled/magazin1');
  const [stripLedCount, setStripLedCount] = useState<number | null>(null); // total LEDs on the physical strip
  const [skipWled, setSkipWled] = useState(false);
  const [wledConnected, setWledConnected] = useState(false);

  // Step 4 — LEDs
  const [ledsPerSlot, setLedsPerSlot] = useState(3);
  const [ledGap, setLedGap] = useState(0);
  const [rowPadding, setRowPadding] = useState(0);
  const [serpentine, setSerpentine] = useState(false);
  const [stripOrigin, setStripOrigin] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-left');
  const [ledSkipFirst, setLedSkipFirst] = useState(0);
  const [largeRowLeds, setLargeRowLeds] = useState(0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState('');
  const [litSlotIdx, setLitSlotIdx] = useState<number | null>(null);

  // Created IDs
  const [createdMagazineId, setCreatedMagazineId] = useState<number | null>(null);
  const [createdDeviceId, setCreatedDeviceId] = useState<number | null>(null);

  const totalLeds = useMemo(
    () => totalLedCount(rows, columns, ledsPerSlot, bottomRowLarge, ledGap, ledSkipFirst, largeRowLeds, rowPadding),
    [rows, columns, ledsPerSlot, bottomRowLarge, ledGap, ledSkipFirst, largeRowLeds, rowPadding]
  );

  const goNext = () => { setDir(1); setStep((s) => s + 1); };
  const goPrev = () => { setDir(-1); setStep((s) => s - 1); };

  // Step 3: create magazine + optional WLED device, then advance
  const createMagazineAndDevice = useMutation({
    mutationFn: async () => {
      const mag = await api.magazines.create({
        name,
        rows,
        columns,
        ledsPerSlot,
        ledGap,
        ledSkipFirst,
        rowPadding,
        serpentine,
        stripOrigin,
        bottomRowLarge,
        largeRowLeds,
      });
      setCreatedMagazineId(mag.id);

      if (!skipWled && mqttTopic) {
        // Use the physical strip length (what the user entered) so WLED commands address ALL LEDs
        const physicalLeds = stripLedCount ?? totalLedCount(rows, columns, ledsPerSlot, bottomRowLarge, ledGap, ledSkipFirst, largeRowLeds);
        const dev = await api.wled.create({
          magazineId: mag.id,
          name: wledName || 'WLED Gerät 1',
          ipAddress: wledIp || null,
          mqttTopic,
          ledCount: physicalLeds,
        });
        setCreatedDeviceId(dev.id);
        setWledConnected(true);
      }

      await queryClient.invalidateQueries({ queryKey: ['magazines'] });
      return mag;
    },
    onSuccess: () => goNext(),
  });

  // Step 4: save config, sync device LED count, turn off LEDs, advance to Done
  const finalizeLedsPerSlot = useMutation({
    mutationFn: async () => {
      if (createdMagazineId !== null) {
        await api.magazines.update(createdMagazineId, { ledsPerSlot, ledGap, ledSkipFirst, rowPadding, serpentine, stripOrigin, largeRowLeds });
        if (createdDeviceId !== null) {
          await api.wled.update(createdDeviceId, { ledCount: stripLedCount ?? totalLeds });
          // Turn off any LEDs that were lit during testing
          await api.wled.allOff(createdDeviceId).catch(() => {});
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['magazines'] });
      await queryClient.invalidateQueries({ queryKey: ['magazine', createdMagazineId] });
    },
    onSuccess: () => goNext(),
  });

  // Calculate slot definitions client-side (mirrors backend logic)
  const calcSlots = useMemo(
    () => calculateSlotsClient(rows, columns, ledsPerSlot, bottomRowLarge, ledGap, serpentine, stripOrigin, ledSkipFirst, largeRowLeds, rowPadding),
    [rows, columns, ledsPerSlot, bottomRowLarge, ledGap, serpentine, stripOrigin, ledSkipFirst, largeRowLeds, rowPadding]
  );

  const handleLightSlot = async (slotIdx: number) => {
    if (!createdDeviceId) return;
    const slot = calcSlots[slotIdx];
    if (!slot) return;
    setLitSlotIdx(slotIdx);
    setTestError('');
    try {
      await api.wled.lightRange(createdDeviceId, slot.ledStart, slot.ledCount, [0, 200, 255], totalLeds);
    } catch {
      setTestError('WLED nicht erreichbar. Prüfe Broker-Verbindung.');
    }
  };

  const handleAllOn = async () => {
    if (!createdDeviceId) return;
    // Toggle: if already all-on, turn off
    if (litSlotIdx === -1) {
      setLitSlotIdx(null);
      await api.wled.allOff(createdDeviceId).catch(() => {});
      return;
    }
    setLitSlotIdx(-1); // -1 = all on
    setTestError('');
    try {
      // Pass current totalLeds so backend uses our live-calculated value, not stale DB value
      await api.wled.test(createdDeviceId, 'flash', undefined, totalLeds);
    } catch {
      setTestError('WLED nicht erreichbar. Prüfe MQTT-Verbindung.');
      setLitSlotIdx(null);
    }
  };

  const handleAllOff = async () => {
    if (!createdDeviceId) return;
    setLitSlotIdx(null);
    await api.wled.allOff(createdDeviceId).catch(() => {});
  };

  // Light only LED 0 — helps the user identify where the strip physically starts
  const handleTestLed0 = async () => {
    if (!createdDeviceId) return;
    setTestError('');
    try {
      await api.wled.lightRange(createdDeviceId, 0, 1, [255, 80, 0], totalLeds);
    } catch {
      setTestError('WLED nicht erreichbar. Prüfe MQTT-Verbindung.');
    }
  };

  const handleSequence = async () => {
    if (!createdDeviceId || testRunning) return;
    setTestError('');
    setTestRunning(true);
    setLitSlotIdx(null);
    try {
      // Pass live-calculated slots + totalLeds so backend uses current UI state, not stale DB
      await api.wled.test(
        createdDeviceId,
        'sequence',
        600,
        totalLeds,
        calcSlots.map(s => ({ ledStart: s.ledStart, ledCount: s.ledCount }))
      );
      for (let i = 0; i < calcSlots.length; i++) {
        await new Promise<void>(res => setTimeout(() => { setLitSlotIdx(i); res(); }, i * 680));
      }
    } catch {
      setTestError('Sequenz konnte nicht gestartet werden.');
    } finally {
      setTimeout(() => { setTestRunning(false); setLitSlotIdx(null); }, calcSlots.length * 680 + 800);
    }
  };

  const gridPreviewCols = Math.min(columns, 12);

  return (
    <div
      className="min-h-screen w-full relative"
      style={{ background: '#07090f' }}
    >
      {/* Fixed background gradients (do not scroll) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-64"
          style={{
            background: 'radial-gradient(ellipse at 50% 100%, rgba(245,158,11,0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="w-full max-w-2xl relative z-10 mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
                      done && 'step-done',
                      active && 'step-active',
                      !done && !active && 'step-inactive'
                    )}
                  >
                    {done ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={cn('w-4 h-4', active ? 'text-white' : 'text-slate-500')} />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium hidden sm:block',
                      active ? 'text-accent-light' : done ? 'text-emerald-400' : 'text-slate-600'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-px mb-5 transition-all duration-500',
                      step > s.id ? 'bg-emerald-500/60' : 'bg-slate-700'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Card — no overflow-hidden so long steps can scroll naturally with the page */}
        <div
          className="rounded-2xl"
          style={{
            background: 'rgba(13,17,23,0.95)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.05)',
          }}
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ── Step 1: Welcome ── */}
              {step === 1 && (
                <div className="p-10 flex flex-col items-center text-center gap-6">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center animate-float"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b22, #f59e0b11)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      boxShadow: '0 0 40px rgba(245,158,11,0.2)',
                    }}
                  >
                    <Zap className="w-10 h-10 text-led-on" fill="currentColor" />
                  </div>
                  <div>
                    <h1
                      className="text-4xl font-bold mb-3"
                      style={{
                        background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      Pick·n·Light
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                      Das intelligente LED-Lager­system. Finde jedes Teil in Sekunden — dein Magazin leuchtet es an.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                    {[
                      { icon: '🔦', text: 'LED-Ortung' },
                      { icon: '🔍', text: 'Blitzsuche' },
                      { icon: '🎙️', text: 'Sprachsteuerung' },
                    ].map((f) => (
                      <div
                        key={f.text}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
                        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}
                      >
                        <span className="text-xl">{f.icon}</span>
                        <span className="text-sm font-medium text-slate-300">{f.text}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={goNext}
                    className="btn-primary flex items-center gap-2 px-8 py-3 text-base font-semibold"
                  >
                    Jetzt einrichten <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* ── Step 2: Magazine shape ── */}
              {step === 2 && (
                <div className="p-8 flex flex-col gap-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Magazin konfigurieren</h2>
                    <p className="text-slate-400 text-sm">Wie sieht dein Teile­magazin aus?</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Magazin-Name</label>
                      <input
                        className="input-dark w-full px-4 py-2.5 text-sm"
                        placeholder="z.B. Schrauben-Magazin A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          Spalten <span className="text-accent-light font-bold">{columns}</span>
                        </label>
                        <input
                          type="range" min={1} max={20} value={columns}
                          onChange={(e) => setColumns(Number(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1</span><span>20</span></div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          Reihen <span className="text-accent-light font-bold">{rows}</span>
                        </label>
                        <input
                          type="range" min={1} max={20} value={rows}
                          onChange={(e) => setRows(Number(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1</span><span>20</span></div>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={bottomRowLarge} onChange={(e) => setBottomRowLarge(e.target.checked)} />
                        <div className={cn('w-11 h-6 rounded-full transition-all duration-200', bottomRowLarge ? 'bg-accent' : 'bg-slate-700')} />
                        <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow', bottomRowLarge ? 'left-6' : 'left-1')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Unterste Reihe = Großfach</p>
                        <p className="text-xs text-slate-500">Ein einzelnes großes Fach über alle Spalten</p>
                      </div>
                    </label>
                  </div>

                  {/* Grid preview */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(7,9,15,0.8)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-widest">Vorschau</p>
                    <div
                      className="magazine-grid mx-auto"
                      style={{ gridTemplateColumns: `repeat(${gridPreviewCols}, 1fr)`, maxWidth: 360 }}
                    >
                      {Array.from({ length: rows }).map((_, r) => {
                        const isLargeRow = bottomRowLarge && r === rows - 1;
                        if (isLargeRow) {
                          return (
                            <div key={`row-${r}`} className="col-span-full h-8 rounded-md"
                              style={{ background: 'rgba(99,102,241,0.15)', border: '1px dashed rgba(99,102,241,0.3)' }} />
                          );
                        }
                        return Array.from({ length: Math.min(columns, 12) }).map((_, c) => (
                          <div key={`${r}-${c}`} className="h-8 rounded-md"
                            style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.2)' }} />
                        ));
                      })}
                    </div>
                    <p className="text-xs text-slate-600 text-center mt-2">
                      {columns > 12 && `(${columns - 12} weitere Spalten nicht angezeigt) · `}
                      {rows * columns - (bottomRowLarge ? columns - 1 : 0)} Fächer gesamt
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <button onClick={goPrev} className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm">
                      <ArrowLeft className="w-4 h-4" /> Zurück
                    </button>
                    <button
                      onClick={goNext}
                      disabled={!name.trim()}
                      className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      Weiter <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: WLED connect ── */}
              {step === 3 && (
                <div className="p-8 flex flex-col gap-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">WLED verbinden</h2>
                    <p className="text-slate-400 text-sm">
                      Verbinde deinen ESP32/ESP8266 mit WLED — danach kannst du die LED-Ausleuchtung sofort testen.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={skipWled} onChange={(e) => setSkipWled(e.target.checked)} />
                        <div className={cn('w-11 h-6 rounded-full transition-all duration-200', skipWled ? 'bg-accent' : 'bg-slate-700')} />
                        <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow', skipWled ? 'left-6' : 'left-1')} />
                      </div>
                      <p className="text-sm font-medium text-slate-300">WLED später einrichten</p>
                    </label>

                    {!skipWled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex flex-col gap-3 overflow-hidden"
                      >
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1.5">Gerätename</label>
                          <input
                            className="input-dark w-full px-4 py-2.5 text-sm"
                            placeholder="z.B. WLED Magazin 1"
                            value={wledName}
                            onChange={(e) => setWledName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            IP-Adresse <span className="text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                            placeholder="192.168.1.100"
                            value={wledIp}
                            onChange={(e) => setWledIp(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            MQTT Topic
                          </label>
                          <input
                            className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                            placeholder="wled/magazin1"
                            value={mqttTopic}
                            onChange={(e) => setMqttTopic(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            Anzahl LEDs am Strip <span className="text-slate-500 font-normal">(in WLED konfiguriert)</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={2000}
                            className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                            placeholder="z.B. 162"
                            value={stripLedCount ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setStripLedCount(v === '' ? null : Math.max(1, Math.min(2000, parseInt(v, 10) || 0)));
                            }}
                          />
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            Schau in WLED unter <span className="text-slate-400 font-mono">Config → LED Preferences → Length</span>.
                            Diese Zahl muss exakt mit deinem physischen Streifen übereinstimmen.
                          </p>
                        </div>

                        <div
                          className="rounded-xl p-4"
                          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Wifi className="w-4 h-4 text-led-cyan" />
                            <p className="text-sm font-semibold text-led-cyan">WLED Einrichtung</p>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            In WLED: <strong className="text-slate-300">Config → MQTT</strong><br />
                            Broker: <code className="text-accent-light font-mono">IP_DIESES_SERVERS:1883</code><br />
                            Topic: <code className="text-accent-light font-mono">{mqttTopic || 'wled/magazin1'}</code>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {createMagazineAndDevice.isError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-300">{(createMagazineAndDevice.error as Error).message}</p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button onClick={goPrev} className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm">
                      <ArrowLeft className="w-4 h-4" /> Zurück
                    </button>
                    <button
                      onClick={() => createMagazineAndDevice.mutate()}
                      disabled={createMagazineAndDevice.isPending || (!skipWled && (!mqttTopic.trim() || !stripLedCount))}
                      className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {createMagazineAndDevice.isPending ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Erstelle…</>
                      ) : (
                        <>Weiter <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 4: LED config + interactive test ── */}
              {step === 4 && (
                <div className="p-8 flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">LED-Konfiguration</h2>
                      <p className="text-slate-400 text-sm">LEDs pro Fach und Strip-Verlegung einstellen.</p>
                    </div>
                    {wledConnected && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium whitespace-nowrap mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> WLED verbunden
                      </span>
                    )}
                  </div>

                  {/* LEDs per slot slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-slate-300">LEDs pro Fach</label>
                      <span className="text-2xl font-bold font-mono" style={{ color: '#f59e0b', textShadow: '0 0 12px rgba(245,158,11,0.5)' }}>
                        {ledsPerSlot}
                      </span>
                    </div>
                    <input
                      type="range" min={1} max={10} value={ledsPerSlot}
                      onChange={(e) => { setLedsPerSlot(Number(e.target.value)); setLitSlotIdx(null); }}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1 LED</span><span>10 LEDs</span></div>
                  </div>

                  {/* ── Stats + live validation row ── */}
                  <div className="flex items-center gap-3">
                    {[
                      { label: 'LEDs/Reihe', value: String(rowPadding * 2 + columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap), color: '#f59e0b' },
                      { label: 'Fächer', value: String(calcSlots.length), color: '#6366f1' },
                      { label: 'Ges. LEDs', value: String(totalLeds), color: '#06b6d4' },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 text-center rounded-xl py-2.5 px-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Validation bar */}
                  {stripLedCount !== null && (() => {
                    const exact = totalLeds === stripLedCount;
                    const ok = totalLeds <= stripLedCount;
                    return (
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm"
                        style={{
                          background: exact ? 'rgba(16,185,129,0.08)' : ok ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.1)',
                          border: exact ? '1px solid rgba(16,185,129,0.3)' : ok ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(239,68,68,0.3)',
                        }}
                      >
                        <span className={exact ? 'text-emerald-400' : ok ? 'text-amber-400' : 'text-red-400'}>{exact ? '✓' : ok ? 'ⓘ' : '⚠'}</span>
                        <span className="text-slate-300 text-xs">
                          Magazin braucht <span className="font-mono text-cyan-400">{totalLeds}</span> · Strip hat <span className="font-mono text-cyan-400">{stripLedCount}</span>
                          {exact && ' — perfekt!'}
                          {!exact && ok && ` — ${stripLedCount - totalLeds} LEDs am Strip-Ende bleiben dunkel`}
                          {!ok && ' — Konfiguration zu groß! LEDs/Fach oder Reihen verringern.'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* ── Strip-Verlegung (origin + serpentine) ── */}
                  <div className="rounded-xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-sm font-semibold text-slate-200">Strip-Verlegung</p>

                    {/* Origin picker */}
                    <div className="flex gap-4 items-center">
                      <div className="relative flex-shrink-0"
                        style={{ width: 140, height: 90, background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 10 }}>
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-slate-700 select-none">Magazin</span>
                        {([
                          { id: 'top-left', cls: 'top-1.5 left-1.5' },
                          { id: 'top-right', cls: 'top-1.5 right-1.5' },
                          { id: 'bottom-left', cls: 'bottom-1.5 left-1.5' },
                          { id: 'bottom-right', cls: 'bottom-1.5 right-1.5' },
                        ] as const).map((o) => {
                          const active = stripOrigin === o.id;
                          return (
                            <button key={o.id} onClick={() => { setStripOrigin(o.id); setLitSlotIdx(null); }}
                              className={cn('absolute w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200', o.cls)}
                              style={{
                                background: active ? '#06b6d4' : 'rgba(255,255,255,0.06)',
                                border: active ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.12)',
                                boxShadow: active ? '0 0 12px rgba(6,182,212,0.5)' : 'none',
                              }}>
                              {active && <span className="text-[9px] font-bold text-white leading-none">0</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-xs text-slate-400 leading-snug">
                          Wähle die Ecke wo <span className="text-cyan-400">LED&nbsp;0</span> physisch sitzt.
                        </p>
                        <p className="text-xs text-slate-500">
                          Gewählt: <span className="text-cyan-400">
                            {stripOrigin === 'top-left' && 'oben links'}
                            {stripOrigin === 'top-right' && 'oben rechts'}
                            {stripOrigin === 'bottom-left' && 'unten links'}
                            {stripOrigin === 'bottom-right' && 'unten rechts'}
                          </span>
                        </p>
                        {wledConnected && (
                          <button onClick={handleTestLed0}
                            className="self-start px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: 'rgba(255,128,0,0.1)', border: '1px solid rgba(255,128,0,0.3)', color: '#fb923c' }}>
                            🔍 LED 0 leuchten
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Serpentine toggle */}
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer select-none transition-all"
                      style={{ background: serpentine ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', border: serpentine ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)' }}
                      onClick={() => { setSerpentine(!serpentine); setLitSlotIdx(null); }}>
                      <div className="w-9 h-5 rounded-full flex-shrink-0 relative transition-colors duration-200"
                        style={{ background: serpentine ? '#6366f1' : 'rgba(255,255,255,0.12)' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: serpentine ? 'translateX(20px)' : 'translateX(2px)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Schlangenmuster (Serpentine)</p>
                        <p className="text-xs text-slate-500">{serpentine ? '→ ← → ← (Reihen wechseln Richtung)' : 'Alle Reihen gleiche Richtung'}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Erweiterte Optionen (gap + skip + large row) ── */}
                  <div>
                    <button type="button"
                      onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                      <motion.span animate={{ rotate: showAdvancedOptions ? 90 : 0 }} transition={{ duration: 0.2 }} className="inline-block text-xs">▶</motion.span>
                      <span>Erweiterte Optionen</span>
                      {(ledGap > 0 || rowPadding > 0 || ledSkipFirst > 0 || largeRowLeds > 0) && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>aktiv</span>
                      )}
                    </button>

                    {showAdvancedOptions && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 rounded-xl flex flex-col divide-y overflow-hidden"
                        style={{ border: '1px solid rgba(99,102,241,0.2)' }}>

                        {/* Row padding */}
                        <div className="p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-300">Reihen-Randabstand</label>
                            <span className="text-base font-bold font-mono text-indigo-400">{rowPadding} LED{rowPadding !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            LEDs an beiden Enden jeder physischen Reihe überspringen.
                            {rowPadding > 0 && <> Reihe: <span className="font-mono text-indigo-400">{rowPadding}+{columns}×{ledsPerSlot}+{rowPadding} = {rowPadding * 2 + columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap} LEDs</span></>}
                          </p>
                          <input type="range" min={0} max={5} value={rowPadding}
                            onChange={(e) => { setRowPadding(Number(e.target.value)); setLitSlotIdx(null); }}
                            className="w-full accent-indigo-500" />
                          {rowPadding > 0 && (
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {(() => {
                                const total = rowPadding * 2 + columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;
                                return Array.from({ length: Math.min(total, 30) }, (_, i) => {
                                  const isPad = i < rowPadding || i >= total - rowPadding;
                                  return <div key={i} className="w-2.5 h-2.5 rounded-full"
                                    style={isPad
                                      ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }
                                      : { background: '#06b6d4', boxShadow: '0 0 5px rgba(6,182,212,0.5)' }} />;
                                });
                              })()}
                              {(rowPadding * 2 + columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap) > 30 && <span className="text-xs text-slate-600 ml-1">…</span>}
                            </div>
                          )}
                        </div>

                        {/* Gap between slots */}
                        <div className="p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-300">Abstand zwischen Fächern</label>
                            <span className="text-base font-bold font-mono text-indigo-400">{ledGap} LED{ledGap !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-xs text-slate-500">LEDs hinter Stegen, die nicht leuchten sollen. z.B. <span className="font-mono text-indigo-400">{ledsPerSlot}+{ledGap}+{ledsPerSlot}+{ledGap}…</span></p>
                          <input type="range" min={0} max={8} value={ledGap}
                            onChange={(e) => { setLedGap(Number(e.target.value)); setLitSlotIdx(null); }}
                            className="w-full accent-indigo-500" />
                          {ledGap > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {Array.from({ length: Math.min((ledsPerSlot + ledGap) * 2, 24) }, (_, i) => {
                                const inCycle = i % (ledsPerSlot + ledGap);
                                return <div key={i} className="w-2.5 h-2.5 rounded-full"
                                  style={inCycle >= ledsPerSlot
                                    ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }
                                    : { background: '#06b6d4', boxShadow: '0 0 5px rgba(6,182,212,0.5)' }} />;
                              })}
                            </div>
                          )}
                        </div>

                        {/* Skip first */}
                        <div className="p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-300">LEDs am Strip-Anfang überspringen</label>
                            <span className="text-base font-bold font-mono text-indigo-400">{ledSkipFirst}</span>
                          </div>
                          <p className="text-xs text-slate-500">Tote LEDs / Zuleitung vor dem ersten Fach. Klick auf "LED 0 leuchten" zum Prüfen.</p>
                          <input type="range" min={0} max={50} value={ledSkipFirst}
                            onChange={(e) => { setLedSkipFirst(Number(e.target.value)); setLitSlotIdx(null); }}
                            className="w-full accent-indigo-500" />
                        </div>

                        {/* Large row override */}
                        {bottomRowLarge && (
                          <div className="p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <label className="text-sm font-medium text-slate-300">LEDs im großen Fach (unten)</label>
                              <span className="text-base font-bold font-mono text-indigo-400">
                                {largeRowLeds === 0
                                  ? `= ${columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap} (auto)`
                                  : largeRowLeds}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">0 = gleich wie eine normale Reihe. Eingabe falls das große Fach mehr LEDs hat.</p>
                            <input type="number" min={0} max={500} value={largeRowLeds}
                              onChange={(e) => { const v = parseInt(e.target.value, 10); setLargeRowLeds(isNaN(v) ? 0 : Math.max(0, Math.min(500, v))); setLitSlotIdx(null); }}
                              className="input-dark w-full px-3 py-2 text-sm font-mono" placeholder="0 = automatisch" />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Interactive test grid — only if WLED connected */}
                  {wledConnected && (
                    <div className="flex flex-col gap-3">
                      <div
                        className="rounded-xl p-4"
                        style={{ background: 'rgba(7,9,15,0.8)', border: '1px solid rgba(6,182,212,0.2)' }}
                      >
                        <p className="text-xs font-semibold text-led-cyan uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" /> LED Test — klicke ein Fach
                        </p>

                        {/* Mini grid */}
                        <div
                          className="magazine-grid mb-3"
                          style={{
                            gridTemplateColumns: `repeat(${Math.min(columns, 10)}, minmax(0, 1fr))`,
                            maxWidth: 400,
                            margin: '0 auto',
                          }}
                        >
                          {calcSlots.map((slot, idx) => {
                            const isLit = litSlotIdx === idx || litSlotIdx === -1;
                            const label = slot.isLarge
                              ? 'Groß'
                              : `${slot.row + 1}/${slot.col + 1}`;
                            return (
                              <motion.button
                                key={idx}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => handleLightSlot(idx)}
                                className={cn(
                                  'rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200 cursor-pointer',
                                  slot.isLarge ? 'col-span-full h-9' : 'h-10'
                                )}
                                style={{
                                  background: isLit
                                    ? 'rgba(0,200,255,0.18)'
                                    : 'rgba(30,41,59,0.6)',
                                  border: `1.5px solid ${isLit ? 'rgba(0,200,255,0.7)' : 'rgba(71,85,105,0.4)'}`,
                                  boxShadow: isLit ? '0 0 12px rgba(0,200,255,0.35)' : 'none',
                                }}
                              >
                                <span className={cn('text-xs font-semibold', isLit ? 'text-led-cyan' : 'text-slate-600')}>
                                  {label}
                                </span>
                                <span className={cn('font-mono leading-none', isLit ? 'text-led-cyan/70' : 'text-slate-700')}
                                  style={{ fontSize: '9px' }}>
                                  {slot.ledStart}–{slot.ledStart + slot.ledCount - 1}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Control buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleAllOn}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                            style={litSlotIdx === -1 ? {
                              background: 'rgba(0,200,255,0.2)',
                              border: '1px solid rgba(0,200,255,0.6)',
                              color: '#06b6d4',
                              boxShadow: '0 0 12px rgba(6,182,212,0.3)',
                            } : {
                              background: 'rgba(0,200,255,0.08)',
                              border: '1px solid rgba(0,200,255,0.2)',
                              color: '#06b6d4',
                            }}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            {litSlotIdx === -1 ? 'Leuchtet ✓' : 'Alle Ein'}
                          </button>
                          <button
                            onClick={handleAllOff}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#64748b',
                            }}
                          >
                            Alle Aus
                          </button>
                          <button
                            onClick={handleSequence}
                            disabled={testRunning}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            style={{
                              background: testRunning ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
                              border: '1px solid rgba(245,158,11,0.25)',
                              color: '#f59e0b',
                            }}
                          >
                            <Play className={cn('w-3.5 h-3.5', testRunning && 'animate-pulse')} />
                            {testRunning ? 'Läuft…' : 'Sequenz'}
                          </button>
                        </div>

                        {testError && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg mt-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            <p className="text-xs text-red-300">{testError}</p>
                          </div>
                        )}

                        <p className="text-xs text-slate-600 text-center mt-2">
                          Passt die Ausleuchtung? Slider anpassen → erneut testen
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button onClick={goPrev} className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm">
                      <ArrowLeft className="w-4 h-4" /> Zurück
                    </button>
                    <button
                      onClick={() => finalizeLedsPerSlot.mutate()}
                      disabled={finalizeLedsPerSlot.isPending}
                      className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {finalizeLedsPerSlot.isPending ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Speichere…</>
                      ) : (
                        <>Fertig <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 5: Done ── */}
              {step === 5 && (
                <div className="p-10 flex flex-col items-center text-center gap-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 0 40px rgba(16,185,129,0.4)',
                    }}
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>

                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Bereit!</h2>
                    <p className="text-slate-400 leading-relaxed max-w-sm">
                      <strong className="text-white">{name}</strong> wurde erfolgreich eingerichtet.<br />
                      Klicke auf ein leeres Fach, um Teile einzupflegen.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                    {[
                      { label: 'Fächer', value: rows * columns - (bottomRowLarge ? columns - 1 : 0) },
                      { label: 'Gesamt LEDs', value: totalLeds },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="py-4 rounded-xl text-center"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                      >
                        <p className="text-2xl font-bold text-accent-light font-mono">{stat.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-primary flex items-center gap-2 px-8 py-3 text-base font-semibold"
                  >
                    <Rocket className="w-5 h-5" /> Zum Magazin
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
