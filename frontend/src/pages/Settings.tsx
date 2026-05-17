import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Wifi,
  Trash2,
  Play,
  Save,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Zap,
  Clock,
  Palette,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { WledDevice } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['wled-devices'],
    queryFn: api.wled.devices,
  });

  const { data: magazines = [] } = useQuery({
    queryKey: ['magazines'],
    queryFn: api.magazines.list,
  });

  const { data: mqttStatus } = useQuery({
    queryKey: ['mqtt-status'],
    queryFn: api.wled.status,
    refetchInterval: 5000,
  });

  // Settings form
  const [autoOff, setAutoOff] = useState('30');
  const [highlightColor, setHighlightColor] = useState('255,165,0');
  const [notFoundColor, setNotFoundColor] = useState('255,0,0');
  const [lowStockColor, setLowStockColor] = useState('255,100,0');
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setAutoOff(settings.led_auto_off_seconds ?? '30');
      setHighlightColor(settings.search_highlight_color ?? '255,165,0');
      setNotFoundColor(settings.not_found_color ?? '255,0,0');
      setLowStockColor(settings.low_stock_color ?? '255,100,0');
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      api.settings.update({
        led_auto_off_seconds: autoOff,
        search_highlight_color: highlightColor,
        not_found_color: notFoundColor,
        low_stock_color: lowStockColor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    },
  });

  // WLED device form
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<WledDevice | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    magazineId: '',
    name: '',
    ipAddress: '',
    mqttTopic: '',
    ledCount: '',
  });
  const [testingDeviceId, setTestingDeviceId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string } | null>>({});
  const [expandedDeviceId, setExpandedDeviceId] = useState<number | null>(null);

  const resetDeviceForm = () =>
    setDeviceForm({ magazineId: '', name: '', ipAddress: '', mqttTopic: '', ledCount: '' });

  const createDevice = useMutation({
    mutationFn: () =>
      api.wled.create({
        magazineId: parseInt(deviceForm.magazineId),
        name: deviceForm.name,
        ipAddress: deviceForm.ipAddress || null,
        mqttTopic: deviceForm.mqttTopic,
        ledCount: parseInt(deviceForm.ledCount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wled-devices'] });
      setShowAddDevice(false);
      resetDeviceForm();
    },
  });

  const updateDevice = useMutation({
    mutationFn: () =>
      api.wled.update(editingDevice!.id, {
        name: deviceForm.name,
        ipAddress: deviceForm.ipAddress || null,
        mqttTopic: deviceForm.mqttTopic,
        ledCount: parseInt(deviceForm.ledCount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wled-devices'] });
      setEditingDevice(null);
      resetDeviceForm();
    },
  });

  const deleteDevice = useMutation({
    mutationFn: (id: number) => api.wled.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wled-devices'] }),
  });

  const testDevice = async (id: number) => {
    setTestingDeviceId(id);
    setTestResult((prev) => ({ ...prev, [id]: null }));
    try {
      const result = await api.wled.test(id, 'flash');
      setTestResult((prev) => ({
        ...prev,
        [id]: { ok: true, msg: `✓ Gesendet an ${result.mqttTopic} — alle LEDs sollten 3 Sek. aufleuchten` },
      }));
    } catch (e: unknown) {
      setTestResult((prev) => ({
        ...prev,
        [id]: { ok: false, msg: `Fehler: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}` },
      }));
    } finally {
      setTestingDeviceId(null);
      setTimeout(() => setTestResult((prev) => ({ ...prev, [id]: null })), 6000);
    }
  };

  const startEdit = (device: WledDevice) => {
    setEditingDevice(device);
    setDeviceForm({
      magazineId: String(device.magazineId),
      name: device.name,
      ipAddress: device.ipAddress ?? '',
      mqttTopic: device.mqttTopic,
      ledCount: String(device.ledCount),
    });
  };

  function rgbToHex(rgb: string): string {
    const parts = rgb.split(',').map((v) => parseInt(v.trim()));
    return '#' + parts.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  return (
    <div className="h-full overflow-auto px-6 py-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{
              background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Einstellungen
          </h1>
          <p className="text-slate-500 text-sm">WLED-Geräte, LED-Verhalten und Farben</p>
        </div>

        {/* MQTT Status */}
        <section
          className="rounded-2xl p-5"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                mqttStatus?.status === 'connected' ? 'bg-emerald-400' : 'bg-slate-600'
              )}
              style={
                mqttStatus?.status === 'connected'
                  ? { boxShadow: '0 0 10px rgba(52,211,153,0.8)' }
                  : {}
              }
            />
            <div>
              <p className="text-sm font-semibold text-slate-200">
                MQTT Broker{' '}
                <span
                  className={cn(
                    mqttStatus?.status === 'connected' ? 'text-emerald-400' : 'text-slate-500'
                  )}
                >
                  ({mqttStatus?.status === 'connected' ? 'Verbunden' : 'Getrennt'})
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Mosquitto läuft intern auf Port 1883 (MQTT) und 9001 (WebSocket)
              </p>
            </div>
          </div>
        </section>

        {/* WLED Devices */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-accent-DEFAULT" /> WLED Geräte
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">ESP32/ESP8266 mit WLED-Firmware</p>
            </div>
            <button
              onClick={() => {
                resetDeviceForm();
                setEditingDevice(null);
                setShowAddDevice(true);
              }}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Gerät hinzufügen
            </button>
          </div>

          {devicesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent-DEFAULT border-t-transparent rounded-full animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(99,102,241,0.15)' }}
            >
              <Wifi className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Noch keine WLED-Geräte konfiguriert.</p>
              <p className="text-slate-600 text-xs mt-1">
                Füge ein Gerät hinzu, um LEDs zu steuern.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {devices.map((device) => (
                <motion.div
                  key={device.id}
                  layout
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(13,17,23,0.8)',
                    border: `1px solid ${testResult[device.id]?.ok === false ? 'rgba(239,68,68,0.3)' : testResult[device.id]?.ok === true ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.15)'}`,
                    transition: 'border-color 0.3s',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                            testingDeviceId === device.id && 'animate-pulse'
                          )}
                          style={{
                            background: testingDeviceId === device.id ? 'rgba(6,182,212,0.2)' : 'rgba(245,158,11,0.12)',
                            border: `1px solid ${testingDeviceId === device.id ? 'rgba(6,182,212,0.4)' : 'rgba(245,158,11,0.2)'}`,
                            boxShadow: testingDeviceId === device.id ? '0 0 16px rgba(6,182,212,0.3)' : '0 0 12px rgba(245,158,11,0.1)',
                          }}
                        >
                          <Zap className={cn('w-4 h-4', testingDeviceId === device.id ? 'text-led-cyan' : 'text-led-on')} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{device.name}</p>
                          <p className="text-xs text-slate-500">
                            Topic: <code className="text-accent-light">{device.mqttTopic}/api</code>
                            {device.ipAddress && (
                              <> · <code className="text-slate-400">{device.ipAddress}</code></>
                            )}
                            {' · '}{device.ledCount} LEDs
                          </p>
                          {device.magazine && (
                            <p className="text-xs text-slate-600 mt-0.5">📦 {device.magazine.name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => testDevice(device.id)}
                          disabled={testingDeviceId === device.id}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            testingDeviceId === device.id ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
                          )}
                          style={{
                            background: testingDeviceId === device.id ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.08)',
                            border: `1px solid ${testingDeviceId === device.id ? 'rgba(6,182,212,0.3)' : 'rgba(245,158,11,0.2)'}`,
                            color: testingDeviceId === device.id ? '#06b6d4' : '#f59e0b',
                          }}
                        >
                          {testingDeviceId === device.id ? (
                            <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Sendet…</>
                          ) : (
                            <><Play className="w-3 h-3" /> Test</>
                          )}
                        </button>
                        <button
                          onClick={() => setExpandedDeviceId(expandedDeviceId === device.id ? null : device.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                          title="WLED Setup anzeigen"
                        >
                          <Wifi className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(device)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Gerät "${device.name}" wirklich löschen?`)) {
                              deleteDevice.mutate(device.id);
                            }
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Test result feedback */}
                    <AnimatePresence>
                      {testResult[device.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-medium"
                          style={{
                            background: testResult[device.id]!.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${testResult[device.id]!.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                            color: testResult[device.id]!.ok ? '#10b981' : '#ef4444',
                          }}
                        >
                          {testResult[device.id]!.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                          {testResult[device.id]!.msg}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* WLED Setup hint (expandable) */}
                  <AnimatePresence>
                    {expandedDeviceId === device.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-4 pb-4"
                          style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}
                        >
                          <p className="text-xs font-semibold text-led-cyan flex items-center gap-1.5 pt-3 mb-2">
                            <Wifi className="w-3.5 h-3.5" /> WLED Einrichtung
                          </p>
                          <div
                            className="rounded-xl p-3 font-mono text-xs leading-relaxed"
                            style={{ background: 'rgba(7,9,15,0.8)', border: '1px solid rgba(6,182,212,0.15)' }}
                          >
                            <p className="text-slate-500 mb-1">In WLED: Config → MQTT</p>
                            <p><span className="text-slate-500">Broker IP: </span><span className="text-accent-light">{window.location.hostname}:1883</span></p>
                            <p><span className="text-slate-500">Topic:     </span><span className="text-accent-light">{device.mqttTopic}</span></p>
                            <p className="text-slate-600 mt-1.5 text-xs">
                              → WLED hört dann auf: <span className="text-slate-400">{device.mqttTopic}/api</span>
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">
                            Nach dem Speichern in WLED den Test-Button drücken — alle {device.ledCount} LEDs sollten kurz aufleuchten.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Device Form Modal */}
        <AnimatePresence>
          {(showAddDevice || editingDevice) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.25)' }}
              >
                <h3 className="text-white font-semibold mb-5">
                  {editingDevice ? 'Gerät bearbeiten' : 'Neues WLED-Gerät'}
                </h3>
                <div className="flex flex-col gap-3">
                  {!editingDevice && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                        Magazin
                      </label>
                      <select
                        className="input-dark w-full px-4 py-2.5 text-sm"
                        value={deviceForm.magazineId}
                        onChange={(e) => setDeviceForm({ ...deviceForm, magazineId: e.target.value })}
                      >
                        <option value="" style={{ background: '#0d1117' }}>Magazin wählen…</option>
                        {magazines.map((m) => (
                          <option key={m.id} value={m.id} style={{ background: '#0d1117' }}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {[
                    { key: 'name', label: 'Gerätename', placeholder: 'WLED Magazin 1' },
                    { key: 'ipAddress', label: 'IP-Adresse (optional)', placeholder: '192.168.1.100' },
                    { key: 'mqttTopic', label: 'MQTT Topic', placeholder: 'wled/magazin1' },
                    { key: 'ledCount', label: 'Anzahl LEDs', placeholder: '108', type: 'number' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                        {field.label}
                      </label>
                      <input
                        type={field.type || 'text'}
                        className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                        placeholder={field.placeholder}
                        value={deviceForm[field.key as keyof typeof deviceForm]}
                        onChange={(e) =>
                          setDeviceForm({ ...deviceForm, [field.key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    onClick={() => {
                      setShowAddDevice(false);
                      setEditingDevice(null);
                      resetDeviceForm();
                    }}
                    className="btn-ghost px-4 py-2 text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => (editingDevice ? updateDevice.mutate() : createDevice.mutate())}
                    disabled={createDevice.isPending || updateDevice.isPending}
                    className="btn-primary flex items-center gap-2 px-5 py-2 text-sm"
                  >
                    <Check className="w-4 h-4" />
                    {editingDevice ? 'Speichern' : 'Hinzufügen'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LED Settings */}
        <section
          className="rounded-2xl p-5 flex flex-col gap-5"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-led-on" /> LED-Verhalten
          </h2>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Auto-Ausschalten nach{' '}
              <span className="text-accent-light font-bold font-mono">{autoOff}s</span>
            </label>
            <input
              type="range" min={5} max={300} step={5}
              value={autoOff}
              onChange={(e) => setAutoOff(e.target.value)}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>5s</span><span>5 min</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-slate-500" /> LED-Farben (RGB)
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Treffer-Farbe', value: highlightColor, onChange: setHighlightColor, desc: 'LED-Farbe bei Suchtreffer' },
                { label: 'Nicht gefunden', value: notFoundColor, onChange: setNotFoundColor, desc: 'Blinkt wenn kein Teil gefunden' },
                { label: 'Niedrigbestand', value: lowStockColor, onChange: setLowStockColor, desc: 'Akzentuiert Niedrigbestand-Fächer' },
              ].map((colorField) => (
                <div key={colorField.label} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={rgbToHex(colorField.value)}
                    onChange={(e) => colorField.onChange(hexToRgb(e.target.value))}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0.5"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-300">{colorField.label}</p>
                    <p className="text-xs text-slate-600">{colorField.desc}</p>
                  </div>
                  <code className="text-xs font-mono text-slate-500 bg-black/30 px-2 py-1 rounded">
                    {colorField.value}
                  </code>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-medium transition-all self-start',
              settingsSaved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'btn-primary'
            )}
          >
            {saveSettings.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : settingsSaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {settingsSaved ? 'Gespeichert!' : 'Einstellungen speichern'}
          </button>
        </section>

        {/* Voice Webhook */}
        <section
          className="rounded-2xl p-5"
          style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <h2 className="text-base font-semibold text-white mb-3">🎙️ Sprachsteuerung</h2>
          <div className="flex flex-col gap-3 text-sm text-slate-400">
            <p>Nutze den Voice-Webhook für Alexa, Home Assistant, IFTTT oder n8n:</p>
            <div
              className="rounded-xl p-3 font-mono text-xs"
              style={{ background: 'rgba(7,9,15,0.8)', border: '1px solid rgba(99,102,241,0.1)' }}
            >
              <p className="text-slate-500 mb-1"># Suche auslösen</p>
              <p className="text-emerald-400">POST /api/voice/search</p>
              <p className="text-slate-400">{'{"query": "M4x20 Schraube"}'}</p>
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <p className="text-slate-300 font-medium mb-1">Home Assistant Beispiel</p>
              <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono">{`rest_command:
  picknlight:
    url: "http://<SERVER_IP>:7050/api/voice/search"
    method: POST
    content_type: application/json
    payload: '{"query": "{{ query }}"}'`}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map((v) => parseInt(v.trim()));
  if (parts.some(isNaN)) return '#ffa500';
  return '#' + parts.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
