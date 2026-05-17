import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './db';
import { connectMqtt } from './services/wled';
import magazinesRouter from './routes/magazines';
import partsRouter from './routes/parts';
import searchRouter from './routes/search';
import wledRouter from './routes/wled';
import voiceRouter from './routes/voice';
import settingsRouter from './routes/settings';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

app.use('/api/magazines', magazinesRouter);
app.use('/api/parts', partsRouter);
app.use('/api/search', searchRouter);
app.use('/api/wled', wledRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function seedDefaultSettings() {
  const defaults = [
    { key: 'led_auto_off_seconds', value: process.env.LED_AUTO_OFF_SECONDS || '30' },
    { key: 'search_highlight_color', value: '255,165,0' },
    { key: 'not_found_color', value: '255,0,0' },
    { key: 'low_stock_color', value: '255,100,0' },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
}

async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    await seedDefaultSettings();

    const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    connectMqtt(mqttUrl);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[STARTUP] Fatal error:', err);
    process.exit(1);
  }
}

main();
