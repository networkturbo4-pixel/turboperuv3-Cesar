import { FastifyPluginAsync } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import { loadConnectionsConfig } from "../settings/connections.service";
import { WhatsAppService } from "./whatsapp.service";
import { SystemNotificationsService } from "./system-notifications.service";

export const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Handshake de Verificación para Meta Cloud API (GET)
  fastify.get("/webhooks/whatsapp", async (request, reply) => {
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    const tenantId = (request.query as any)?.tenantId || resolveTenantId(request);
    const config = loadConnectionsConfig(tenantId);
    const expectedToken = config.whatsapp?.meta?.verifyToken || "turbonetwork_webhook_token";

    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === expectedToken) {
      console.log(`[META WEBHOOK] Handshake exitoso verificado para tenant '${tenantId}'`);
      return reply.type("text/plain").send(query["hub.challenge"]);
    }

    console.warn(`[META WEBHOOK] Falló verificación de token. Esperado: '${expectedToken}', Recibido: '${query["hub.verify_token"]}'`);
    return reply.status(403).send("Verificación rechazada");
  });

  // 2. Webhook Universal Receptor de Mensajes WhatsApp (POST)
  fastify.post("/webhooks/whatsapp", async (request, reply) => {
    const tenantId = (request.query as any)?.tenantId || resolveTenantId(request);
    const payload = request.body as any;

    try {
      const result = await WhatsAppService.processInboundWebhook(tenantId, payload);
      return reply.send({
        success: true,
        handled: result.handled,
        conversationId: result.conversationId,
        messageId: result.messageId,
      });
    } catch (err: any) {
      console.error("[WHATSAPP WEBHOOK] Error procesando payload entrante:", err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Obtener Código QR para Evolution API / WAHA (Sesión WhatsApp Web)
  fastify.get("/whatsapp/qr", async (request, reply) => {
    const query = request.query as any;
    const tenantId = (query?.tenantId && query.tenantId !== "undefined" && query.tenantId !== "null") ? query.tenantId : resolveTenantId(request);
    const overrides = {
      apiUrl: query?.apiUrl,
      apiKey: query?.apiKey,
      instanceName: query?.instanceName,
      demo: query?.demo === "true" || query?.demo === true,
    };
    const qrResult = await WhatsAppService.getEvolutionQr(tenantId, overrides);
    return reply.send(qrResult);
  });

  // 4. Probar Conexión con Proveedor Activo o Específico
  fastify.post("/whatsapp/test", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as any) || {};
    const config = loadConnectionsConfig(tenantId);
    const provider = body.provider || config.whatsapp?.activeProvider || "evolution";

    if (provider === "meta") {
      const metaConfig = {
        ...config.whatsapp?.meta,
        ...(body.meta || {}),
      };
      if (body.meta?.accessToken && !body.meta.accessToken.includes("••••")) {
        metaConfig.accessToken = body.meta.accessToken.trim();
      }
      const testRes = await WhatsAppService.testMetaCredentials(metaConfig);
      return reply.send(testRes);
    } else {
      // Probar Evolution API
      const evoConfig = {
        ...config.whatsapp?.evolution,
        ...(body.evolution || {}),
      };
      if (body.evolution?.apiKey && !body.evolution.apiKey.includes("••••")) {
        evoConfig.apiKey = body.evolution.apiKey.trim();
      }
      const qrRes = await WhatsAppService.getEvolutionQr(tenantId, evoConfig);
      return reply.send({
        success: qrRes.status === "connected" || qrRes.status === "qrcode",
        status: qrRes.status,
        message: qrRes.message,
        details: qrRes.details,
        apiUrl: qrRes.apiUrl,
        instance: qrRes.instance,
        qrcode: qrRes.qrcode,
        pairingCode: qrRes.pairingCode,
      });
    }
  });

  // 5. Enviar Mensaje de WhatsApp Directo
  fastify.post("/whatsapp/send", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { to, text, attachmentUrl, attachmentType, caption } = (request.body as any) || {};

    if (!to || !text) {
      return reply.status(400).send({ success: false, message: "Campos 'to' y 'text' son obligatorios" });
    }

    const sendRes = await WhatsAppService.sendMessage(tenantId, {
      to,
      text,
      attachmentUrl,
      attachmentType,
      caption,
    });

    if (sendRes.success) {
      return reply.send({ success: true, message: "Mensaje despachado a WhatsApp", details: sendRes });
    } else {
      return reply.status(400).send({ success: false, message: sendRes.error, details: sendRes });
    }
  });

  // 6. Ejecutar Despacho Automático de Recibos (Motor de Automatización de Facturación)
  fastify.post("/whatsapp/receipt-dispatch/execute", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as any) || {};

    const report = await SystemNotificationsService.executeAutomatedReceiptDispatch(tenantId, {
      forceStage: body.stage,
      dryRun: Boolean(body.dryRun),
    });

    return reply.send(report);
  });
};
