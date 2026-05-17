import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { lightSlot, blinkAllRed, turnOffAll } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

const router = Router();

async function getAutoOffSeconds(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'led_auto_off_seconds' } });
  return parseInt(s?.value || '30', 10);
}

async function getSearchColor(): Promise<[number, number, number]> {
  const s = await prisma.setting.findUnique({ where: { key: 'search_highlight_color' } });
  const parts = (s?.value || '255,165,0').split(',').map(Number);
  return [parts[0] ?? 255, parts[1] ?? 165, parts[2] ?? 0];
}

/**
 * Normalize query: collapse ×, x, * between digits to plain x.
 * "2*25" → "2x25", "4 × 25" → "4x25"
 */
function normalizeQ(raw: string): string {
  return raw.replace(/(\d)\s*[×x*]\s*(\d)/g, '$1x$2').trim();
}

/**
 * Build search term variants to cover both x and × notation.
 * "4x25" → ["4x25", "4×25"]
 */
function termVariants(term: string): string[] {
  const norm = normalizeQ(term);
  const cross = norm.replace(/(\d)x(\d)/g, '$1×$2');
  return [...new Set([norm, cross, term.trim()].filter(Boolean))];
}

/**
 * Split query into individual words (min 1 char).
 * Single-word queries skip the split and search as-is.
 */
function splitWords(q: string): string[] {
  return q.split(/\s+/).filter(w => w.length >= 1);
}

/**
 * Core search: word-by-word AND logic with ILIKE on name, description,
 * and unnested tags array. Each word must appear in at least one of those fields.
 *
 * Examples:
 *   "4 Holzschraube"  → part name contains "4" AND (name OR tags contains "holzschraube")
 *   "4x25"            → searches both "4x25" and "4×25" variants
 *   "holzschraube"    → finds parts tagged "holzschrauben" via ILIKE '%holzschraube%'
 */
async function findParts(q: string, take = 20): Promise<typeof import('@prisma/client').Prisma extends never ? never : any[]> {
  const words = splitWords(normalizeQ(q));

  // Build AND clause: each word must match name, description, or any tag
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
    include: {
      slot: {
        include: {
          magazine: { include: { wledDevices: true } },
        },
      },
    },
    take,
  });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) { res.json([]); return; }

    const results = await findParts(q);

    if (results.length === 0) {
      const allDevices = await prisma.wledDevice.findMany({ include: { magazine: true } });
      for (const device of allDevices) {
        const m = device.magazine;
        const leds = totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);
        blinkAllRed(device.mqttTopic, leds);
      }
      res.json([]);
      return;
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

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.post('/highlight/:slotId', async (req: Request, res: Response) => {
  try {
    const slotId = parseInt(req.params.slotId as string);
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { magazine: { include: { wledDevices: true } } },
    });

    if (!slot) { res.status(404).json({ error: 'Slot not found' }); return; }

    const autoOffSeconds = await getAutoOffSeconds();
    const color = await getSearchColor();
    const mag = slot.magazine;
    const leds = totalLedCount(mag.rows, mag.columns, mag.ledsPerSlot, mag.bottomRowLarge, mag.ledGap, mag.ledSkipFirst, mag.largeRowLeds, mag.rowPadding);

    for (const device of mag.wledDevices) {
      lightSlot(device.mqttTopic, slot.ledStart, slot.ledCount, leds, color, autoOffSeconds);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to highlight slot' });
  }
});

router.delete('/highlight', async (_req: Request, res: Response) => {
  try {
    const allDevices = await prisma.wledDevice.findMany();
    for (const device of allDevices) {
      turnOffAll(device.mqttTopic);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to turn off LEDs' });
  }
});

export default router;
