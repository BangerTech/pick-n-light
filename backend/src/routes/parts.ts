import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { schema: { tags: ['parts'] } }, async (request, reply) => {
    try {
      const { slotId, name, description, quantity, unit, minQuantity, tags } =
        request.body as {
          slotId: number; name: string; description?: string;
          quantity?: number; unit?: string; minQuantity?: number | null; tags?: string[];
        };

      if (!slotId || !name) {
        reply.code(400);
        return { error: 'slotId and name are required' };
      }

      const slot = await prisma.slot.findUnique({ where: { id: slotId } });
      if (!slot) { reply.code(404); return { error: 'Slot not found' }; }

      const existing = await prisma.part.findUnique({ where: { slotId } });
      if (existing) { reply.code(409); return { error: 'Slot already has a part. Use PUT to update.' }; }

      const part = await prisma.part.create({
        data: {
          slotId, name,
          description: description || null,
          quantity: quantity ?? 0,
          unit: unit || 'Stk',
          minQuantity: minQuantity ?? null,
          tags: tags || [],
        },
        include: { slot: true },
      });

      reply.code(201);
      return part;
    } catch {
      reply.code(500);
      return { error: 'Failed to create part' };
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', { schema: { tags: ['parts'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const part = await prisma.part.findUnique({
        where: { id },
        include: { slot: { include: { magazine: true } } },
      });
      if (!part) { reply.code(404); return { error: 'Part not found' }; }
      return part;
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch part' };
    }
  });

  fastify.put<{ Params: { id: string } }>('/:id', { schema: { tags: ['parts'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      const { name, description, quantity, unit, minQuantity, tags } =
        request.body as {
          name?: string; description?: string; quantity?: number;
          unit?: string; minQuantity?: number | null; tags?: string[];
        };

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
      return part;
    } catch {
      reply.code(500);
      return { error: 'Failed to update part' };
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', { schema: { tags: ['parts'] } }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id);
      await prisma.part.delete({ where: { id } });
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to delete part' };
    }
  });
};

export default plugin;
