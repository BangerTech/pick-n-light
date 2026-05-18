import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: { tags: ['tags'] } }, async (_request, reply) => {
    try {
      const parts = await prisma.part.findMany({ select: { tags: true } });
      const allTags = [...new Set(parts.flatMap((p) => p.tags))].sort();
      return allTags;
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch tags' };
    }
  });
};

export default plugin;
