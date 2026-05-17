import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

// GET /api/tags - returns all unique tags across all parts, sorted alphabetically
router.get('/', async (_req: Request, res: Response) => {
  try {
    const parts = await prisma.part.findMany({ select: { tags: true } });
    const allTags = [...new Set(parts.flatMap((p) => p.tags))].sort();
    res.json(allTags);
  } catch {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;
