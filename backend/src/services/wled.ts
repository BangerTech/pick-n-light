import mqtt from 'mqtt';

let client: mqtt.MqttClient | null = null;
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

export function connectMqtt(brokerUrl: string): void {
  client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Connected to broker: ${brokerUrl}`);
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('offline', () => {
    console.warn('[MQTT] Broker offline, reconnecting...');
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
export function lightSlot(
  mqttTopic: string,
  ledStart: number,
  ledCount: number,
  totalLeds: number,
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
      // Segment 0: full strip as dark background
      { id: 0, start: 0, stop: totalLeds, col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
      // Segment 1: only the target slot
      { id: 1, start: ledStart, stop: ledStart + ledCount, col: [color, [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
    ],
  });

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
}

/**
 * Light all LEDs with a solid colour. Stays on until turnOffAll() is called.
 * Pass persistent=false to auto-off after durationMs (legacy behaviour).
 */
export function flashAll(
  mqttTopic: string,
  totalLeds: number,
  color: [number, number, number] = [0, 200, 255],
  persistent = true,
  durationMs = 3000
): void {
  // Clear any segment-1 overrides so the full strip is visible
  publish(mqttTopic, {
    on: true,
    bri: 255,
    seg: [
      { id: 0, start: 0, stop: totalLeds, col: [color, [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
      { id: 1, start: 0, stop: 0 }, // remove segment 1 if it existed
    ],
  });

  if (!persistent) {
    setTimeout(() => turnOffAll(mqttTopic), durationMs);
  }
}

/**
 * Blink all LEDs red (no match found during search).
 */
export function blinkAllRed(mqttTopic: string, totalLeds: number): void {
  publish(mqttTopic, {
    on: true,
    bri: 255,
    seg: [
      {
        id: 0,
        start: 0,
        stop: totalLeds,
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
        { id: 0, start: 0, stop: totalLeds, col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fx: 0, on: true },
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
