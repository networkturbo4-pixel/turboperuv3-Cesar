import { FastifyPluginAsync } from "fastify";
import os from "os";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (_request, reply) => {
    const memoryUsage = process.memoryUsage();
    const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    return reply.send({
      status: "operational",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      engine: "Fastify + TypeScript + Drizzle",
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        freeMemory: formatMb(os.freemem()),
        totalMemory: formatMb(os.totalmem()),
      },
      processMemory: {
        rss: formatMb(memoryUsage.rss),
        heapUsed: formatMb(memoryUsage.heapUsed),
        heapTotal: formatMb(memoryUsage.heapTotal),
        external: formatMb(memoryUsage.external),
      },
    });
  });
};
