import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { slotId, name, description, quantity, unit, minQuantity, tags } = req.body;

    if (!slotId || !name) {
      res.status(400).json({ error: 'slotId and name are required' });
      return;
    }

    const slot = await prisma.slot.findUnique({ where: { id: slotId } });
    if (!slot) {
      res.status(404).json({ error: 'Slot not found' });
      return;
    }

    const existing = await prisma.part.findUnique({ where: { slotId } });
    if (existing) {
      res.status(409).json({ error: 'Slot already has a part. Use PUT to update.' });
      return;
    }

    const part = await prisma.part.create({
      data: {
        slotId,
        name,
        description: description || null,
        quantity: quantity ?? 0,
        unit: unit || 'Stk',
        minQuantity: minQuantity ?? null,
        tags: tags || [],
      },
      include: { slot: true },
    });

    res.status(201).json(part);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create part' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const part = await prisma.part.findUnique({
      where: { id },
      include: { slot: { include: { magazine: true } } },
    });

    if (!part) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.json(part);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch part' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description, quantity, unit, minQuantity, tags } = req.body;

    const part = await prisma.part.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(quantity !== undefined && { quantity }),
        ...(unit !== undefined && { unit }),
        ...(minQuantity !== undefined && { minQuantity }),
        ...(tags !== undefined && { tags }),
      },
      include: { slot: { include: { magazine: true } } },
    });

    res.json(part);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update part' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.part.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete part' });
  }
});

export default router;
