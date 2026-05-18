import mqtt from 'mqtt';
import { EventEmitter } from 'events';

let client: mqtt.MqttClient | null = null;
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

// EventEmitter für WebSocket-Broadcasts
export const wledEvents = new EventEmitter();

export interface LedStateEvent {
  type: 'led_on' | 'led_off' | 'mqtt_status';
  mqttTopic?: string;
  ledStart?: number;
  ledCount?: number;
  color?: [number, number, number];
  status?: 'connected' | 'disconnected' | 'connecting';
}

export function connectMqtt(brokerUrl: string): void {
  client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Connected to broker: ${brokerUrl}`);
    wledEvents.emit('state', { type: 'mqtt_status', status: 'connected' });
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
    wledEvents.emit('state', { type: 'mqtt_status', status: 'disconnected' });
  });

  client.on('offline', () => {
    console.warn('[MQTT] Broker offline, reconnecting...');
    wledEvents.emit('state', { type: 'mqtt_status', status: 'connecting' });
  });
}

export function getMqttStatus(): 'connected' | 'disconnected' | 'connecting' {
  if (!client) return 'disconnected';
  if (client.connected) return 'connected';
  return 'connecting';
}

function publish(topic: string, payload: object): Promise<void> {
  return new Promise((resolve) => {
    if (!client || !client.connected) {
      console.warn('[WLED] MQTT not connected, cannot publish');
      resolve();
      return;
    }
    client.publish(`${topic}/api`, JSON.stringify(payload), {}, () => resolve());
  });
}

/**
 * Light a specific LED range while keeping the rest of the strip dark.
 *
 * Uses two WLED segments:
 *   Segment 0 — full strip, solid black (background)
 *   Segment 1 — the slot range, lit with the desired colour
 *
 * This ensures LEDs outside the slot do NOT light up unintentionally.
 */
// Sentinel: tells WLED "from here to end of strip". WLED clips stop to info.leds.count,
// so this safely covers any strip length without us needing to know the exact LED count.
const FULL_STRIP = 9999;

export function lightSlot(
  mqttTopic: string,
  ledStart: number,
  ledCount: number,
  _totalLeds: number, // kept for API compatibility; we use FULL_STRIP instead
  color: [number, number, number] = [255, 165, 0],
  autoOffSeconds?: number
): void {
  const timerKey = `${mqttTopic}:slot`;

  if (activeTimers.has(timerKey)) {
    clearTimeout(activeTimers.get(timerKey)!);
    activeTimers.delete(timerKey);
  }

  publish(mqttTopic, {
    on: true,
    bri: 255,
    seg: [
      // Segment 0: full strip as dark background (FULL_STRIP is clipped by WLED to its actual LED count)
      { id: 0, start: 0, stop: FULL_STRIP, col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
      // Segment 1: only the target slot
      { id: 1, start: ledStart, stop: ledStart + ledCount, col: [color, [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
    ],
  });

  wledEvents.emit('state', { type: 'led_on', mqttTopic, ledStart, ledCount, color });

  if (autoOffSeconds && autoOffSeconds > 0) {
    const timer = setTimeout(() => {
      turnOffAll(mqttTopic);
      activeTimers.delete(timerKey);
    }, autoOffSeconds * 1000);
    activeTimers.set(timerKey, timer);
  }
}

/**
 * Turn everything off.
 */
export function turnOffAll(mqttTopic: string): void {
  publish(mqttTopic, { on: false });
  wledEvents.emit('state', { type: 'led_off', mqttTopic });
}

/**
 * Light all LEDs with a solid colour. Stays on until turnOffAll() is called.
 * Pass persistent=false to auto-off after durationMs (legacy behaviour).
 */
export function flashAll(
  mqttTopic: string,
  _totalLeds: number, // kept for API compatibility; FULL_STRIP sentinel is used instead
  color: [number, number, number] = [0, 200, 255],
  persistent = true,
  durationMs = 3000
): void {
  // Use FULL_STRIP so WLED lights every LED regardless of how many there are
  publish(mqttTopic, {
    on: true,
    bri: 255,
    seg: [
      { id: 0, start: 0, stop: FULL_STRIP, col: [color, [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
      { id: 1, start: 0, stop: 0 }, // delete segment 1 (any previous slot highlight)
    ],
  });

  if (!persistent) {
    setTimeout(() => turnOffAll(mqttTopic), durationMs);
  }
}

/**
 * Blink all LEDs red (no match found during search).
 */
export function blinkAllRed(mqttTopic: string, _totalLeds: number): void {
  publish(mqttTopic, {
    on: true,
    bri: 255,
    seg: [
      {
        id: 0,
        start: 0,
        stop: FULL_STRIP,
        col: [[255, 0, 0], [0, 0, 0], [0, 0, 0]],
        fx: 1,   // blink effect
        ix: 220,
        on: true,
      },
      { id: 1, start: 0, stop: 0 },
    ],
  });

  setTimeout(() => turnOffAll(mqttTopic), 3000);
}

const runningSequences = new Map<string, boolean>();

export async function runTestSequence(
  mqttTopic: string,
  slots: { ledStart: number; ledCount: number }[],
  totalLeds: number,
  delayMs = 600
): Promise<void> {
  // Cancel any running sequence for this device
  runningSequences.set(mqttTopic, false);
  await new Promise((r) => setTimeout(r, 150));

  runningSequences.set(mqttTopic, true);

  // Start with all off
  await publish(mqttTopic, { on: false });
  await new Promise((r) => setTimeout(r, 100));

  for (let i = 0; i < slots.length; i++) {
    if (!runningSequences.get(mqttTopic)) return;

    const slot = slots[i];
    await publish(mqttTopic, {
      on: true,
      bri: 255,
      seg: [
        { id: 0, start: 0, stop: FULL_STRIP, col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
        { id: 1, start: slot.ledStart, stop: slot.ledStart + slot.ledCount, col: [[0, 200, 255], [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
      ],
    });
    await new Promise((r) => setTimeout(r, delayMs));
  }

  if (runningSequences.get(mqttTopic)) {
    await publish(mqttTopic, { on: false });
    runningSequences.delete(mqttTopic);
  }
}
