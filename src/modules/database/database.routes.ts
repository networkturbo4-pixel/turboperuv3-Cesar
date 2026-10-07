import { FastifyPluginAsync } from "fastify";
import { DatabaseService } from "./database.service";
import { resolveTenantId } from "../tenants/tenants.service";

export const databaseRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Estado y diagnóstico de la base de datos (PostgreSQL vs JSON)
  const statusHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const status = await DatabaseService.getStatus();
    return reply.send({
      success: true,
      tenantId,
      data: status,
    });
  };

  // 2. Ejecutar migración de archivos JSON a PostgreSQL
  const migrateHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const result = await DatabaseService.migrateAllJsonToPostgres();
    const statusCode = result.success ? 200 : 500;
    return reply.status(statusCode).send({
      success: result.success,
      tenantId,
      data: result,
    });
  };

  // 3. Prueba rápida de conexión con PostgreSQL
  const testHandler = async (request: any, reply: any) => {
    const status = await DatabaseService.getStatus();
    if (status.isConnected) {
      return reply.send({
        success: true,
        message: `PostgreSQL conectado exitosamente (${status.postgres.latencyMs}ms).`,
        version: status.postgres.version,
        serverTime: status.postgres.serverTime,
        counts: status.postgres.counts,
      });
    } else {
      return reply.status(503).send({
        success: false,
        message: "No se pudo establecer conexión con PostgreSQL. El sistema opera de forma segura en modo JSON.",
        circuitBreaker: status.circuitBreaker,
      });
    }
  };

  fastify.get("/database/status", statusHandler);
  fastify.get("/database/health", statusHandler);
  fastify.post("/database/migrate", migrateHandler);
  fastify.post("/database/test-connection", testHandler);
};
