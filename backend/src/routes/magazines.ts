import { Router, Request, Response } from 'express';
import prisma from '../db';
import { calculateSlots } from '../services/ledCalculator';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const magazines = await prisma.magazine.findMany({
      include: {
        _count: { select: { slots: true } },
        wledDevices: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const withCounts = await Promise.all(
      magazines.map(async (mag) => {
        const occupiedCount = await prisma.slot.count({
          where: { magazineId: mag.id, part: { isNot: null } },
        });
        return { ...mag, occupiedSlots: occupiedCount };
      })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch magazines' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const magazine = await prisma.magazine.findUnique({
      where: { id },
      include: {
        slots: {
          include: { part: true },
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
        wledDevices: true,
      },
    });

    if (!magazine) {
      res.status(404).json({ error: 'Magazine not found' });
      return;
    }

    res.json(magazine);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch magazine' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      rows,
      columns,
      ledsPerSlot = 3,
      ledGap = 0,
      ledSkipFirst = 0,
      rowPadding = 0,
      serpentine = false,
      stripOrigin = 'top-left',
      bottomRowLarge = false,
      largeRowLeds = 0,
    } = req.body;

    if (!name || !rows || !columns) {
      res.status(400).json({ error: 'name, rows and columns are required' });
      return;
    }

    const magazine = await prisma.magazine.create({
      data: { name, rows, columns, ledsPerSlot, ledGap, ledSkipFirst, rowPadding, serpentine, stripOrigin, bottomRowLarge, largeRowLeds },
    });

    const slotDefs = calculateSlots(rows, columns, ledsPerSlot, bottomRowLarge, ledGap, serpentine, stripOrigin, ledSkipFirst, largeRowLeds, rowPadding);

    await prisma.slot.createMany({
      data: slotDefs.map((s) => ({
        magazineId: magazine.id,
        row: s.row,
        col: s.col,
        ledStart: s.ledStart,
        ledCount: s.ledCount,
        isLarge: s.isLarge,
      })),
    });

    const full = await prisma.magazine.findUnique({
      where: { id: magazine.id },
      include: {
        slots: { include: { part: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        wledDevices: true,
      },
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create magazine' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, ledsPerSlot, ledGap, ledSkipFirst, rowPadding, serpentine, stripOrigin, largeRowLeds } = req.body;

    const layoutChanged =
      ledsPerSlot !== undefined ||
      ledGap !== undefined ||
      ledSkipFirst !== undefined ||
      rowPadding !== undefined ||
      serpentine !== undefined ||
      stripOrigin !== undefined ||
      largeRowLeds !== undefined;

    if (layoutChanged) {
      const mag = await prisma.magazine.findUnique({ where: { id } });
      if (!mag) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }

      const newLedsPerSlot = ledsPerSlot ?? mag.ledsPerSlot;
      const newLedGap = ledGap ?? mag.ledGap;
      const newLedSkipFirst = ledSkipFirst ?? mag.ledSkipFirst;
      const newRowPadding = rowPadding ?? mag.rowPadding;
      const newSerpentine = serpentine ?? mag.serpentine;
      const newStripOrigin = (stripOrigin ?? mag.stripOrigin) as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      const newLargeRowLeds = largeRowLeds ?? mag.largeRowLeds;

      await prisma.slot.deleteMany({ where: { magazineId: id } });

      const slotDefs = calculateSlots(
        mag.rows,
        mag.columns,
        newLedsPerSlot,
        mag.bottomRowLarge,
        newLedGap,
        newSerpentine,
        newStripOrigin,
        newLedSkipFirst,
        newLargeRowLeds,
        newRowPadding
      );
      await prisma.slot.createMany({
        data: slotDefs.map((s) => ({
          magazineId: id,
          row: s.row,
          col: s.col,
          ledStart: s.ledStart,
          ledCount: s.ledCount,
          isLarge: s.isLarge,
        })),
      });

      const updated = await prisma.magazine.update({
        where: { id },
        data: {
          ledsPerSlot: newLedsPerSlot,
          ledGap: newLedGap,
          ledSkipFirst: newLedSkipFirst,
          rowPadding: newRowPadding,
          serpentine: newSerpentine,
          stripOrigin: newStripOrigin,
          largeRowLeds: newLargeRowLeds,
          ...(name !== undefined && { name }),
        },
      });

      res.json(updated);
      return;
    }

    const magazine = await prisma.magazine.update({
      where: { id },
      data: { ...(name !== undefined && { name }) },
    });

    res.json(magazine);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update magazine' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.magazine.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete magazine' });
  }
});

router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const source = await prisma.magazine.findUnique({
      where: { id },
      include: { slots: true },
    });

    if (!source) {
      res.status(404).json({ error: 'Magazine not found' });
      return;
    }

    const copy = await prisma.magazine.create({
      data: {
        name: `${source.name} (Kopie)`,
        rows: source.rows,
        columns: source.columns,
        ledsPerSlot: source.ledsPerSlot,
        ledGap: source.ledGap,
        ledSkipFirst: source.ledSkipFirst,
        rowPadding: source.rowPadding,
        serpentine: source.serpentine,
        stripOrigin: source.stripOrigin,
        bottomRowLarge: source.bottomRowLarge,
        largeRowLeds: source.largeRowLeds,
      },
    });

    await prisma.slot.createMany({
      data: source.slots.map((s) => ({
        magazineId: copy.id,
        row: s.row,
        col: s.col,
        ledStart: s.ledStart,
        ledCount: s.ledCount,
        isLarge: s.isLarge,
      })),
    });

    const full = await prisma.magazine.findUnique({
      where: { id: copy.id },
      include: {
        slots: { include: { part: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        wledDevices: true,
      },
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: 'Failed to duplicate magazine' });
  }
});

export default router;
