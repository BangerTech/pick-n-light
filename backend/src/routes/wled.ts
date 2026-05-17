import { Router, Request, Response } from 'express';
import prisma from '../db';
import { runTestSequence, getMqttStatus, flashAll, lightSlot, turnOffAll } from '../services/wled';
import { totalLedCount } from '../services/ledCalculator';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ status: getMqttStatus() });
});

router.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await prisma.wledDevice.findMany({
      include: { magazine: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch WLED devices' });
  }
});

router.post('/devices', async (req: Request, res: Response) => {
  try {
    const { magazineId, name, ipAddress, mqttTopic, ledCount } = req.body;

    if (!magazineId || !name || !mqttTopic || !ledCount) {
      res.status(400).json({ error: 'magazineId, name, mqttTopic and ledCount are required' });
      return;
    }

    const device = await prisma.wledDevice.create({
      data: { magazineId, name, ipAddress: ipAddress || null, mqttTopic, ledCount },
      include: { magazine: { select: { id: true, name: true } } },
    });

    res.status(201).json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create WLED device' });
  }
});

router.put('/devices/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, ipAddress, mqttTopic, ledCount } = req.body;

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

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update WLED device' });
  }
});

router.delete('/devices/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.wledDevice.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete WLED device' });
  }
});

/**
 * Light a specific LED range.
 * Requires ledStart + ledCount in body. totalLeds is looked up from the device's magazine.
 */
router.post('/devices/:id/light-range', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { ledStart, ledCount, color, totalLedsOverride } = req.body;

    const device = await prisma.wledDevice.findUnique({
      where: { id },
      include: { magazine: true },
    });
    if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

    const m = device.magazine;
    const leds = typeof totalLedsOverride === 'number' && totalLedsOverride > 0
      ? totalLedsOverride
      : totalLedCount(m.rows, m.columns, m.ledsPerSlot, m.bottomRowLarge, m.ledGap, m.ledSkipFirst, m.largeRowLeds, m.rowPadding);

    const rgb: [number, number, number] =
      Array.isArray(color) && color.length === 3
        ? [Number(color[0]), Number(color[1]), Number(color[2])]
        : [0, 200, 255];

    lightSlot(device.mqttTopic, ledStart, ledCount, leds, rgb);
    res.json({ success: true, totalLeds: leds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to light range' });
  }
});

router.post('/devices/:id/all-off', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const device = await prisma.wledDevice.findUnique({ where: { id } });
    if (!device) { res.status(404).json({ error: 'Device not found' }); return; }
    turnOffAll(device.mqttTopic);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to turn off' });
  }
});

router.post('/devices/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const device = await prisma.wledDevice.findUnique({
      where: { id },
      include: {
        magazine: {
          include: {
            slots: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
          },
        },
      },
    });

    if (!device) {
      res.status(404).json({ error: 'WLED device not found' });
      return;
    }

    const m2 = device.magazine;
    const { mode: modeRaw, delayMs: delayMsRaw, totalLedsOverride, slotOverrides } = req.body;
    const leds = typeof totalLedsOverride === 'number' && totalLedsOverride > 0
      ? totalLedsOverride
      : totalLedCount(m2.rows, m2.columns, m2.ledsPerSlot, m2.bottomRowLarge, m2.ledGap, m2.ledSkipFirst, m2.largeRowLeds, m2.rowPadding);

    const mode = (modeRaw as string) || 'flash';

    if (mode === 'sequence') {
      const delayMs = parseInt(delayMsRaw || '400', 10);
      const slots = Array.isArray(slotOverrides) && slotOverrides.length > 0
        ? slotOverrides as { ledStart: number; ledCount: number }[]
        : device.magazine.slots.map((s) => ({ ledStart: s.ledStart, ledCount: s.ledCount }));
      runTestSequence(device.mqttTopic, slots, leds, delayMs);
      res.json({
        success: true,
        message: 'Sequence test started',
        totalLeds: leds,
        mqttTopic: `${device.mqttTopic}/api`,
      });
    } else {
      // Persistent flash: all LEDs on, stay on until user clicks "Alle Aus"
      flashAll(device.mqttTopic, leds, [0, 200, 255], true);
      res.json({
        success: true,
        message: 'All LEDs on — click "Alle Aus" to turn off',
        totalLeds: leds,
        mqttTopic: `${device.mqttTopic}/api`,
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to start test' });
  }
});

export default router;
