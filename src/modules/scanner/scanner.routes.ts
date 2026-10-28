import { FastifyPluginAsync } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import {
  createScannerSession,
  getScannerSession,
  connectDeviceToSession,
  submitScanToSession,
  resetSessionForNextScan,
  addSessionListener,
  removeSessionListener,
  getLocalLanIps,
  generatePairingUrls,
} from "./scanner.service";

export const scannerRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Obtener interfaces e IPs de red locales disponibles
   */
  fastify.get("/scanner/network-ips", async (request, reply) => {
    const ips = getLocalLanIps();
    return { success: true, ips };
  });

  /**
   * Crear nueva sesión de emparejamiento para escaneo móvil
   */
  fastify.post("/scanner/session", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as {
      label?: string;
      targetField?: string;
    };

    const host = (request.headers["x-forwarded-host"] as string) || request.headers.host || "localhost:3000";
    const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol || "http";

    const { session, urls } = createScannerSession({
      tenantId,
      label: body.label,
      targetField: body.targetField,
      reqHost: host,
      proto,
    });

    return reply.status(201).send({
      success: true,
      data: {
        session,
        urls,
      },
    });
  });

  /**
   * Consultar información de una sesión existente
   */
  fastify.get("/scanner/session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getScannerSession(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, message: "Sesión de escáner no encontrada o expirada" });
    }

    const host = (request.headers["x-forwarded-host"] as string) || request.headers.host || "localhost:3000";
    const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol || "http";
    const urls = generatePairingUrls(session.sessionId, host, proto);

    return {
      success: true,
      data: {
        session,
        urls,
      },
    };
  });

  /**
   * Notificar que un celular se ha conectado a la sesión
   */
  fastify.post("/scanner/session/:sessionId/connect", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body || {}) as { deviceInfo?: string };

    const session = connectDeviceToSession(sessionId, body.deviceInfo || "Navegador Móvil");
    if (!session) {
      return reply.status(404).send({ success: false, message: "Sesión no encontrada o expirada" });
    }

    return { success: true, data: session };
  });

  /**
   * Recibir código o texto OCR escaneado desde el celular
   */
  fastify.post("/scanner/session/:sessionId/scan", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body || {}) as {
      code: string;
      format?: string;
      raw?: string;
      confidence?: number;
      label?: string;
      preview?: string;
    };

    if (!body || !body.code || !body.code.trim()) {
      return reply.status(400).send({ success: false, message: "El código escaneado es requerido" });
    }

    const session = submitScanToSession(sessionId, body);
    if (!session) {
      return reply.status(404).send({ success: false, message: "Sesión no encontrada o expirada" });
    }

    return {
      success: true,
      message: "Código recibido y transmitido a la PC exitosamente",
      data: session.lastScanned,
    };
  });

  /**
   * Resetear sesión para el siguiente escaneo (modo ráfaga)
   */
  fastify.post("/scanner/session/:sessionId/reset", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = resetSessionForNextScan(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, message: "Sesión no encontrada" });
    }
    return { success: true, data: session };
  });

  /**
   * Polling de estado de sesión (fallback si SSE no está disponible)
   */
  fastify.get("/scanner/session/:sessionId/poll", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getScannerSession(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, message: "Sesión no encontrada" });
    }

    return {
      success: true,
      status: session.status,
      deviceInfo: session.deviceInfo,
      lastScanned: session.lastScanned,
      historyCount: session.history.length,
      lastActiveAt: session.lastActiveAt,
    };
  });

  /**
   * Stream de eventos en tiempo real (Server-Sent Events) para la PC receptora
   */
  fastify.get("/scanner/session/:sessionId/events", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getScannerSession(sessionId);
    if (!session) {
      return reply.status(404).send("Sesión no encontrada o expirada");
    }

    // Configurar cabeceras SSE estándar
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders?.();

    // Evento de bienvenida
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "init",
        sessionId: session.sessionId,
        status: session.status,
        deviceInfo: session.deviceInfo,
        time: Date.now(),
      })}\n\n`
    );

    // Listener para retransmitir eventos de este sessionId hacia este cliente SSE
    const listener = (event: any) => {
      try {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err) {
        console.warn("[ScannerSSE] Error escribiendo evento:", err);
      }
    };

    addSessionListener(sessionId, listener);

    // Heartbeat cada 15 segundos para evitar timeouts de proxies
    const heartbeatTimer = setInterval(() => {
      try {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) {
          reply.raw.write(`: ping ${Date.now()}\n\n`);
        } else {
          cleanup();
        }
      } catch (_) {
        cleanup();
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatTimer);
      removeSessionListener(sessionId, listener);
    };

    request.raw.on("close", cleanup);
    request.raw.on("end", cleanup);
  });
};
