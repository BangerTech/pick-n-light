import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const obj: Record<string, string> = {};
    for (const s of settings) {
      obj[s.key] = s.value;
    }
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;

    const ops = Object.entries(updates).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
