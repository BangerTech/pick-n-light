import { Router, Request, Response } from 'express';
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

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (!q) {
      res.json([]);
      return;
    }

    const results = await prisma.part.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      },
      include: {
        slot: {
          include: {
            magazine: {
              include: { wledDevices: true },
            },
          },
        },
      },
      take: 20,
    });

    if (results.length === 0) {
      const allDevices = await prisma.wledDevice.findMany({
        include: { magazine: true },
      });
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

    if (!slot) {
      res.status(404).json({ error: 'Slot not found' });
      return;
    }

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
