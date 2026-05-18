import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import prisma from './db';
import { connectMqtt } from './services/wled';
import magazinesPlugin from './routes/magazines';
import partsPlugin from './routes/parts';
import searchPlugin from './routes/search';
import wledPlugin from './routes/wled';
import voicePlugin from './routes/voice';
import settingsPlugin from './routes/settings';
import tagsPlugin from './routes/tags';
import wsPlugin from './routes/ws';

const PORT = parseInt(process.env.PORT || '3000', 10);

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
  const app = Fastify({ logger: process.env.NODE_ENV !== 'production' });

  await app.register(cors, { origin: true });

  await app.register(swagger, {
    openapi: {
      info: { title: 'Pick·n·Light API', version: '1.0.0' },
      tags: [
        { name: 'magazines', description: 'Magazin-Verwaltung' },
        { name: 'parts', description: 'Teile-Verwaltung' },
        { name: 'search', description: 'Suche & LED-Steuerung' },
        { name: 'wled', description: 'WLED Geräte & MQTT' },
        { name: 'voice', description: 'Sprachsteuerung Webhook' },
        { name: 'settings', description: 'Einstellungen' },
        { name: 'tags', description: 'Tags' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  await app.register(magazinesPlugin, { prefix: '/api/magazines' });
  await app.register(partsPlugin, { prefix: '/api/parts' });
  await app.register(searchPlugin, { prefix: '/api/search' });
  await app.register(wledPlugin, { prefix: '/api/wled' });
  await app.register(voicePlugin, { prefix: '/api/voice' });
  await app.register(settingsPlugin, { prefix: '/api/settings' });
  await app.register(tagsPlugin, { prefix: '/api/tags' });
  await app.register(wsPlugin, { prefix: '/api' });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    await seedDefaultSettings();

    const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    connectMqtt(mqttUrl);

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[API] Server running on port ${PORT}`);
    console.log(`[API] Swagger docs: http://localhost:${PORT}/api/docs`);
  } catch (err) {
    console.error('[STARTUP] Fatal error:', err);
    process.exit(1);
  }
}

main();
