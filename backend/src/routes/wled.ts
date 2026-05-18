import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';
import { runTestSequence, getMqttStatus, flashAll, lightSlot, turnOffAll } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', { schema: { tags: ['wled'] } }, async () => {
    return { status: getMqttStatus() };
  });

  fastify.get('/devices', { schema: { tags: ['wled'] } }, async (_request, reply) => {
    try {
      const devices = await prisma.wledDevice.findMany({
        include: { magazine: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return devices;
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch WLED devices' };
    }
  });

  fastify.post('/devices', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const { magazineId, name, ipAddress, mqttTopic, ledCount } =
        request.body as { magazineId: number; name: string; ipAddress?: string; mqttTopic: string; ledCount: number };

      if (!magazineId || !name || !mqttTopic || !ledCount) {
        reply.code(400);
        return { error: 'magazineId, name, mqttTopic and ledCount are required' };
      }

      const device = await prisma.wledDevice.create({
        data: { magazineId, name, ipAddress: ipAddress || null, mqttTopic, ledCount },
        include: { magazine: { select: { id: true, name: true } } },
      });
      reply.code(201);
      return device;
    } catch {
      reply.code(500);
      return { error: 'Failed to create WLED device' };
    }
  });

  fastify.put<{ Params: { id: string } }>('/devices/:id', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const { name, ipAddress, mqttTopic, ledCount } =
        request.body as { name?: string; ipAddress?: string; mqttTopic?: string; ledCount?: number };

      const device = await prisma.wledDevice.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(ipAddress !== undefined && { ipAddress }),
          ...(mqttTopic !== undefined && { mqttTopic }),
          ...(ledCount !== undefined && { ledCount }),
        },
        include: { magazine: { select: { id: true, name: true } } },
      });
      return device;
    } catch {
      reply.code(500);
      return { error: 'Failed to update WLED device' };
    }
  });

  fastify.delete<{ Params: { id: string } }>('/devices/:id', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      await prisma.wledDevice.delete({ where: { id } });
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to delete WLED device' };
    }
  });

  fastify.post<{ Params: { id: string } }>('/devices/:id/light-range', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const { ledStart, ledCount, color, totalLedsOverride } =
        request.body as { ledStart: number; ledCount: number; color?: [number, number, number]; totalLedsOverride?: number };

      const device = await prisma.wledDevice.findUnique({ where: { id }, include: { magazine: true } });
      if (!device) { reply.code(404); return { error: 'Device not found' }; }

      const m = device.magazine;
      const leds = typeof totalLedsOverride === 'number' && totalLedsOverride > 0
        ? totalLedsOverride
        : totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);

      const rgb: [number, number, number] =
        Array.isArray(color) && color.length === 3
          ? [Number(color[0]), Number(color[1]), Number(color[2])]
          : [0, 200, 255];

      lightSlot(device.mqttTopic, ledStart, ledCount, leds, rgb);
      return { success: true, totalLeds: leds };
    } catch {
      reply.code(500);
      return { error: 'Failed to light range' };
    }
  });

  fastify.post<{ Params: { id: string } }>('/devices/:id/all-off', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const device = await prisma.wledDevice.findUnique({ where: { id } });
      if (!device) { reply.code(404); return { error: 'Device not found' }; }
      turnOffAll(device.mqttTopic);
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to turn off' };
    }
  });

  fastify.post<{ Params: { id: string } }>('/devices/:id/test', { schema: { tags: ['wled'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const device = await prisma.wledDevice.findUnique({
        where: { id },
        include: { magazine: { include: { slots: { orderBy: [{ row: 'asc' }, { col: 'asc' }] } } } },
      });

      if (!device) { reply.code(404); return { error: 'WLED device not found' }; }

      const m = device.magazine;
      const { mode: modeRaw, delayMs: delayMsRaw, totalLedsOverride, slotOverrides } =
        request.body as { mode?: string; delayMs?: number; totalLedsOverride?: number; slotOverrides?: { ledStart: number; ledCount: number }[] };

      const leds = typeof totalLedsOverride === 'number' && totalLedsOverride > 0
        ? totalLedsOverride
        : totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);

      const mode = modeRaw || 'flash';

      if (mode === 'sequence') {
        const delayMs = typeof delayMsRaw === 'number' ? delayMsRaw : 400;
        const slots = Array.isArray(slotOverrides) && slotOverrides.length > 0
          ? slotOverrides
          : device.magazine.slots.map((s) => ({ ledStart: s.ledStart, ledCount: s.ledCount }));
        runTestSequence(device.mqttTopic, slots, leds, delayMs);
        return { success: true, message: 'Sequence test started', totalLeds: leds, mqttTopic: `${device.mqttTopic}/api` };
      } else {
        flashAll(device.mqttTopic, leds, [0, 200, 255], true);
        return { success: true, message: 'All LEDs on — click "Alle Aus" to turn off', totalLeds: leds, mqttTopic: `${device.mqttTopic}/api` };
      }
    } catch {
      reply.code(500);
      return { error: 'Failed to start test' };
    }
  });
};

export default plugin;
