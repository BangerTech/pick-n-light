import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';
import { calculateSlots, StripOrigin } from '../services/ledCalculator';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: { tags: ['magazines'] } }, async (_request, reply) => {
    try {
      const magazines = await prisma.magazine.findMany({
        include: {
          _count: { select: { slots: true } },
          wledDevices: true,
          slots: { select: { id: true, part: { select: { id: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return magazines.map((mag) => {
        const occupiedSlots = mag.slots.filter((s) => s.part !== null).length;
        const { slots: _slots, ...rest } = mag;
        return { ...rest, occupiedSlots };
      });
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch magazines' };
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['magazines'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const magazine = await prisma.magazine.findUnique({
        where: { id },
        include: {
          slots: { include: { part: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] },
          wledDevices: true,
        },
      });

      if (!magazine) { reply.code(404); return { error: 'Magazine not found' }; }
      return magazine;
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch magazine' };
    }
  });

  fastify.post('/', { schema: { tags: ['magazines'] } }, async (request, reply) => {
    try {
      const {
        name, rows, columns,
        ledsPerSlot = 3, ledGap = 0, ledSkipFirst = 0, rowPadding = 0,
        serpentine = false, stripOrigin = 'top-left',
        bottomRowLarge = false, largeRowLeds = 0,
      } = request.body as {
        name: string; rows: number; columns: number;
        ledsPerSlot?: number; ledGap?: number; ledSkipFirst?: number; rowPadding?: number;
        serpentine?: boolean; stripOrigin?: StripOrigin; bottomRowLarge?: boolean; largeRowLeds?: number;
      };

      if (!name || !rows || !columns) {
        reply.code(400);
        return { error: 'name, rows and columns are required' };
      }

      const magazine = await prisma.magazine.create({
        data: { name, rows, columns, ledsPerSlot, ledGap, ledSkipFirst, rowPadding, serpentine, stripOrigin, bottomRowLarge, largeRowLeds },
      });

      const slotDefs = calculateSlots(rows, columns, ledsPerSlot, bottomRowLarge, ledGap, serpentine, stripOrigin, ledSkipFirst, largeRowLeds, rowPadding);
      await prisma.slot.createMany({
        data: slotDefs.map((s) => ({ magazineId: magazine.id, row: s.row, col: s.col, ledStart: s.ledStart, ledCount: s.ledCount, isLarge: s.isLarge })),
      });

      const full = await prisma.magazine.findUnique({
        where: { id: magazine.id },
        include: { slots: { include: { part: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] }, wledDevices: true },
      });

      reply.code(201);
      return full;
    } catch {
      reply.code(500);
      return { error: 'Failed to create magazine' };
    }
  });

  fastify.put<{ Params: { id: string } }>('/:id', { schema: { tags: ['magazines'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const { name, ledsPerSlot, ledGap, ledSkipFirst, rowPadding, serpentine, stripOrigin, largeRowLeds } =
        request.body as {
          name?: string; ledsPerSlot?: number; ledGap?: number; ledSkipFirst?: number;
          rowPadding?: number; serpentine?: boolean; stripOrigin?: StripOrigin; largeRowLeds?: number;
        };

      const layoutChanged = ledsPerSlot !== undefined || ledGap !== undefined || ledSkipFirst !== undefined
        || rowPadding !== undefined || serpentine !== undefined || stripOrigin !== undefined || largeRowLeds !== undefined;

      if (layoutChanged) {
        const mag = await prisma.magazine.findUnique({ where: { id } });
        if (!mag) { reply.code(404); return { error: 'Magazine not found' }; }

        const newLedsPerSlot = ledsPerSlot ?? mag.ledsPerSlot;
        const newLedGap = ledGap ?? mag.ledGap;
        const newLedSkipFirst = ledSkipFirst ?? mag.ledSkipFirst;
        const newRowPadding = rowPadding ?? mag.rowPadding;
        const newSerpentine = serpentine ?? mag.serpentine;
        const newStripOrigin = (stripOrigin ?? mag.stripOrigin) as StripOrigin;
        const newLargeRowLeds = largeRowLeds ?? mag.largeRowLeds;

        await prisma.slot.deleteMany({ where: { magazineId: id } });
        const slotDefs = calculateSlots(mag.rows, mag.columns, newLedsPerSlot, mag.bottomRowLarge, newLedGap, newSerpentine, newStripOrigin, newLedSkipFirst, newLargeRowLeds, newRowPadding);
        await prisma.slot.createMany({
          data: slotDefs.map((s) => ({ magazineId: id, row: s.row, col: s.col, ledStart: s.ledStart, ledCount: s.ledCount, isLarge: s.isLarge })),
        });

        return prisma.magazine.update({
          where: { id },
          data: {
            ledsPerSlot: newLedsPerSlot, ledGap: newLedGap, ledSkipFirst: newLedSkipFirst,
            rowPadding: newRowPadding, serpentine: newSerpentine, stripOrigin: newStripOrigin,
            largeRowLeds: newLargeRowLeds, ...(name !== undefined && { name }),
          },
        });
      }

      return prisma.magazine.update({ where: { id }, data: { ...(name !== undefined && { name }) } });
    } catch {
      reply.code(500);
      return { error: 'Failed to update magazine' };
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', { schema: { tags: ['magazines'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      await prisma.magazine.delete({ where: { id } });
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to delete magazine' };
    }
  });

  fastify.post<{ Params: { id: string } }>('/:id/duplicate', { schema: { tags: ['magazines'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const source = await prisma.magazine.findUnique({ where: { id }, include: { slots: true } });
      if (!source) { reply.code(404); return { error: 'Magazine not found' }; }

      const copy = await prisma.magazine.create({
        data: {
          name: `${source.name} (Kopie)`, rows: source.rows, columns: source.columns,
          ledsPerSlot: source.ledsPerSlot, ledGap: source.ledGap, ledSkipFirst: source.ledSkipFirst,
          rowPadding: source.rowPadding, serpentine: source.serpentine, stripOrigin: source.stripOrigin,
          bottomRowLarge: source.bottomRowLarge, largeRowLeds: source.largeRowLeds,
        },
      });

      await prisma.slot.createMany({
        data: source.slots.map((s) => ({ magazineId: copy.id, row: s.row, col: s.col, ledStart: s.ledStart, ledCount: s.ledCount, isLarge: s.isLarge })),
      });

      const full = await prisma.magazine.findUnique({
        where: { id: copy.id },
        include: { slots: { include: { part: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] }, wledDevices: true },
      });

      reply.code(201);
      return full;
    } catch {
      reply.code(500);
      return { error: 'Failed to duplicate magazine' };
    }
  });
};

export default plugin;
