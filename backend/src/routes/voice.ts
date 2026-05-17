import { Router, Request, Response } from 'express';
import prisma from '../db';
import { lightSlot, blinkAllRed } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

const router = Router();

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        error: 'query is required',
        alexa: {
          version: '1.0',
          response: {
            outputSpeech: { type: 'PlainText', text: 'Bitte gib einen Suchbegriff an.' },
            shouldEndSession: true,
          },
        },
      });
      return;
    }

    const q = query.trim();

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
            magazine: { include: { wledDevices: true } },
          },
        },
      },
      take: 5,
    });

    if (results.length === 0) {
      const allDevices = await prisma.wledDevice.findMany({ include: { magazine: true } });
      for (const device of allDevices) {
        const leds = totalLedCount(device.magazine.rows, device.magazine.columns, device.magazine.ledsPerSlot, device.magazine.bottomRowLarge, device.magazine.ledGap);
        blinkAllRed(device.mqttTopic, leds);
      }

      res.json({
        found: false,
        message: `Kein Teil für "${q}" gefunden.`,
        alexa: {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `Ich habe kein Teil gefunden für ${q}.`,
            },
            shouldEndSession: true,
          },
        },
      });
      return;
    }

    const autoOffSetting = await prisma.setting.findUnique({ where: { key: 'led_auto_off_seconds' } });
    const autoOffSeconds = parseInt(autoOffSetting?.value || '30', 10);
    const colorSetting = await prisma.setting.findUnique({ where: { key: 'search_highlight_color' } });
    const colorParts = (colorSetting?.value || '255,165,0').split(',').map(Number);
    const color: [number, number, number] = [colorParts[0] ?? 255, colorParts[1] ?? 165, colorParts[2] ?? 0];

    for (const part of results) {
      const mag = part.slot.magazine;
      const leds = totalLedCount(mag.rows, mag.columns, mag.ledsPerSlot, mag.bottomRowLarge, mag.ledGap);
      for (const device of mag.wledDevices) {
        lightSlot(device.mqttTopic, part.slot.ledStart, part.slot.ledCount, leds, color, autoOffSeconds);
      }
    }

    const first = results[0];
    const locationText = `Magazin ${first.slot.magazine.name}, Reihe ${first.slot.row + 1}, Spalte ${first.slot.col + 1}`;

    res.json({
      found: true,
      count: results.length,
      results: results.map((r) => ({
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        magazine: r.slot.magazine.name,
        row: r.slot.row + 1,
        col: r.slot.col + 1,
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
    });
  } catch (err) {
    res.status(500).json({ error: 'Voice search failed' });
  }
});

export default router;
