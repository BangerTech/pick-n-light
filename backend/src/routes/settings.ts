import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: { tags: ['settings'] } }, async (_request, reply) => {
    try {
      const settings = await prisma.setting.findMany();
      const obj: Record<string, string> = {};
      for (const s of settings) obj[s.key] = s.value;
      return obj;
    } catch {
      reply.code(500);
      return { error: 'Failed to fetch settings' };
    }
  });

  fastify.put('/', { schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const updates = request.body as Record<string, string>;
      const ops = Object.entries(updates).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );
      await Promise.all(ops);
      return { success: true };
    } catch {
      reply.code(500);
      return { error: 'Failed to save settings' };
    }
  });
};

export default plugin;
