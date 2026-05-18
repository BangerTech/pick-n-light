import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/client';
import prisma from '../db';
import { lightSlot, blinkAllRed, turnOffAll } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

async function getAutoOffSeconds(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'led_auto_off_seconds' } });
  return parseInt(s?.value || '30', 10);
}

async function getSearchColor(): Promise<[number, number, number]> {
  const s = await prisma.setting.findUnique({ where: { key: 'search_highlight_color' } });
  const parts = (s?.value || '255,165,0').split(',').map(Number);
  return [parts[0] ?? 255, parts[1] ?? 165, parts[2] ?? 0];
}

function normalizeQ(raw: string): string {
  return raw.replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2').trim();
}

function termVariants(term: string): string[] {
  const norm = normalizeQ(term);
  const cross = norm.replace(/(\d)x(\d)/g, '$1×$2');
  return [...new Set([norm, cross, term.trim()].filter(Boolean))];
}

function splitWords(q: string): string[] {
  return q.split(/\s+/).filter(w => w.length >= 1);
}

async function findParts(q: string, take = 20) {
  const words = splitWords(normalizeQ(q));

  const wordConditions = words.map((word) => {
    const variants = termVariants(word);
    const subConds = variants.flatMap((v) => {
      const like = `%${v}%`;
      return [
        Prisma.sql`p.name ILIKE ${like}`,
        Prisma.sql`p.description ILIKE ${like}`,
        Prisma.sql`EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${like})`,
      ];
    });
    return Prisma.sql`(${Prisma.join(subConds, ' OR ')})`;
  });

  const whereClause = Prisma.join(wordConditions, ' AND ');

  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT DISTINCT p.id FROM "parts" p
    WHERE ${whereClause}
    LIMIT ${take}
  `;

  if (rows.length === 0) return [];

  return prisma.part.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: { slot: { include: { magazine: { include: { wledDevices: true } } } } },
    take,
  });
}

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { q?: string } }>('/', { schema: { tags: ['search'] } }, async (request, reply) => {
    try {
      const q = (request.query.q || '').trim();
      if (!q) return [];

      const results = await findParts(q);

      if (results.length === 0) {
        const allDevices = await prisma.wledDevice.findMany({ include: { magazine: true } });
        for (const device of allDevices) {
          const m = device.magazine;
          const leds = totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);
          blinkAllRed(device.mqttTopic, leds);
        }
        return [];
      }

      const autoOffSeconds = await getAutoOffSeconds();
      const color = await getSearchColor();

      for (const part of results) {
        const mag = part.slot.magazine;
        const leds = totalLedCount(mag.rows, mag.columns, mag.ledsPerSlot, mag.bottomRowLarge, mag.ledGap, mag.ledSkipFirst, mag.largeRowLeds, mag.rowPadding);
        for (const device of mag.wledDevices) {
          lightSlot(device.mqttTopic, part.slot.ledStart, part.slot.ledCount, leds, color, autoOffSeconds);
        }
      }

      return results;
    } catch (err) {
      console.error('Search error:', err);
      reply.code(500);
      return { error: 'Search failed' };
    }
  });

  fastify.post<{ Params: { slotId: string } }>('/highlight/:slotId', { schema: { tags: ['search'] } }, async (request, reply) => {
    try {
      const slotId = parseInt(request.params.slotId);
      const slot = await prisma.slot.findUnique({
        where: { id: slotId },
        include: { magazine: { include: { wledDevices: true } } },
      });

      if (!slot) { reply.code(404); return { error: 'Slot not found' }; }

      const autoOffSeconds = await getAutoOffSeconds();
      const color = await getSearchColor();
      const mag = slot.magazine;
      const leds = totalLedCount(mag.rows, mag.columns, mag.ledsPerSlot, mag.bottomRowLarge, mag.ledGap, mag.ledSkipFirst, mag.largeRowLeds, mag.rowPadding);

      for (const device of mag.wledDevices) {
        lightSlot(device.mqttTopic, slot.ledStart, slot.ledCount, leds, color, autoOffSeconds);
      }
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to highlight slot' };
    }
  });

  fastify.delete('/highlight', { schema: { tags: ['search'] } }, async (_request, reply) => {
    try {
      const allDevices = await prisma.wledDevice.findMany();
      for (const device of allDevices) turnOffAll(device.mqttTopic);
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to turn off LEDs' };
    }
  });
};

export default plugin;
