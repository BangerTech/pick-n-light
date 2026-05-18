import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/client';
import prisma from '../db';
import { lightSlot, blinkAllRed } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

function normalizeQ(raw: string): string {
  return raw.replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2').trim();
}

function termVariants(term: string): string[] {
  const norm = normalizeQ(term);
  const cross = norm.replace(/(\d)x(\d)/g, '$1×$2');
  return [...new Set([norm, cross, term.trim()].filter(Boolean))];
}

async function findParts(q: string, take = 5) {
  const words = q.split(/\s+/).filter(w => w.length >= 1);

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
  fastify.post('/search', { schema: { tags: ['voice'] } }, async (request, reply) => {
    try {
      const { query } = request.body as { query?: string };

      if (!query || typeof query !== 'string') {
        reply.code(400);
        return {
          error: 'query is required',
          alexa: {
            version: '1.0',
            response: {
              outputSpeech: { type: 'PlainText', text: 'Bitte gib einen Suchbegriff an.' },
              shouldEndSession: true,
            },
          },
        };
      }

      const q = normalizeQ(query.trim());
      const results = await findParts(q);

      if (results.length === 0) {
        const allDevices = await prisma.wledDevice.findMany({ include: { magazine: true } });
        for (const device of allDevices) {
          const m = device.magazine;
          const leds = totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);
          blinkAllRed(device.mqttTopic, leds);
        }
        return {
          found: false,
          message: `Kein Teil für "${q}" gefunden.`,
          alexa: {
            version: '1.0',
            response: {
              outputSpeech: { type: 'PlainText', text: `Ich habe kein Teil gefunden für ${q}.` },
              shouldEndSession: true,
            },
          },
        };
      }

      const autoOffSetting = await prisma.setting.findUnique({ where: { key: 'led_auto_off_seconds' } });
      const autoOffSeconds = parseInt(autoOffSetting?.value || '30', 10);
      const colorSetting = await prisma.setting.findUnique({ where: { key: 'search_highlight_color' } });
      const colorParts = (colorSetting?.value || '255,165,0').split(',').map(Number);
      const color: [number, number, number] = [colorParts[0] ?? 255, colorParts[1] ?? 165, colorParts[2] ?? 0];

      for (const part of results) {
        const mag = part.slot.magazine;
        const leds = totalLedCount(mag.rows, mag.columns, mag.ledsPerSlot, mag.bottomRowLarge, mag.ledGap, mag.ledSkipFirst, mag.largeRowLeds, mag.rowPadding);
        for (const device of mag.wledDevices) {
          lightSlot(device.mqttTopic, part.slot.ledStart, part.slot.ledCount, leds, color, autoOffSeconds);
        }
      }

      const first = results[0];
      const locationText = `Magazin ${first.slot.magazine.name}, Reihe ${first.slot.row + 1}, Spalte ${first.slot.col + 1}`;

      return {
        found: true,
        count: results.length,
        results: results.map((r) => ({
          name: r.name, quantity: r.quantity, unit: r.unit,
          magazine: r.slot.magazine.name, row: r.slot.row + 1, col: r.slot.col + 1,
        })),
        alexa: {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `${first.name} gefunden. ${locationText}. Die LED leuchtet jetzt auf.`,
            },
            shouldEndSession: true,
          },
        },
      };
    } catch (err) {
      console.error('Voice search error:', err);
      reply.code(500);
      return { error: 'Voice search failed' };
    }
  });
};

export default plugin;
