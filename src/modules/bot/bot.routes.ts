import { FastifyPluginAsync } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import { omnichannelDb as db } from "../messages/omnichannel-db";
import { botRepo } from "./bot.repository";
import { kbService } from "./knowledge-base.service";
import { decideForContext, isWithinBusinessHours } from "./bot.engine";
import { getCustomerById, identifyCustomerByHandle } from "./customer-identity";
import { getGeminiClient } from "./llm/gemini.client";
import { BotChannel, BotContext, BotConversationMode } from "./bot.types";

export const botRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/bot/settings", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const settings = await botRepo.getSettings(tenantId);
      const tokensUsedToday = await botRepo.sumTokensToday(tenantId);
      return reply.send({
        settings,
        aiConfigured: getGeminiClient().isConfigured(),
        tokensUsedToday,
        withinBusinessHours: isWithinBusinessHours(settings),
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/bot/settings", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const body = (request.body as any) || {};
      const updated = await botRepo.updateSettings(tenantId, body);
      return reply.send({ settings: updated });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Base de conocimientos
  fastify.get("/bot/kb/articles", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const articles = await kbService.listArticles(tenantId);
      return reply.send({ articles });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/bot/kb/articles", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const body = (request.body as any) || {};
      if (!body.title || !body.content) {
        return reply.status(400).send({ error: "Título y contenido son obligatorios." });
      }
      const keywords = Array.isArray(body.keywords)
        ? body.keywords
        : String(body.keywords || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      const article = await kbService.createArticle(tenantId, {
        title: String(body.title),
        category: String(body.category || "general"),
        content: String(body.content),
        keywords,
        isActive: body.isActive !== false,
      });
      return reply.send({ article });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/bot/kb/articles/:id", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const id = Number((request.params as any).id);
      const body = (request.body as any) || {};
      const keywords =
        body.keywords === undefined
          ? undefined
          : Array.isArray(body.keywords)
          ? body.keywords
          : String(body.keywords)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      const article = await kbService.updateArticle(tenantId, id, {
        title: body.title,
        category: body.category,
        content: body.content,
        keywords,
        isActive: body.isActive,
      });
      if (!article) return reply.status(404).send({ error: "Artículo no encontrado." });
      return reply.send({ article });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.delete("/bot/kb/articles/:id", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const id = Number((request.params as any).id);
      const ok = await kbService.deleteArticle(tenantId, id);
      if (!ok) return reply.status(404).send({ error: "Artículo no encontrado." });
      return reply.send({ deleted: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/bot/kb/reindex", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const stats = await kbService.reindexAll(tenantId);
      return reply.send(stats);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/bot/kb/search", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const { query, topK } = (request.body as any) || {};
      if (!query || !String(query).trim()) {
        return reply.status(400).send({ error: "Escriba una consulta para buscar." });
      }
      const hits = await kbService.search(tenantId, String(query), Number(topK || 4));
      return reply.send({ hits });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Control por conversación (bot | human | paused)
  fastify.get("/bot/conversations/:id/state", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const convId = Number((request.params as any).id);
      const state = await botRepo.getOrCreateConversationState(convId, tenantId);
      return reply.send({ state });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/bot/conversations/:id/mode", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const convId = Number((request.params as any).id);
      const { mode, pauseMinutes } = (request.body as any) || {};
      if (!["bot", "human", "paused"].includes(mode)) {
        return reply.status(400).send({ error: "Modo inválido. Use bot, human o paused." });
      }
      const settings = await botRepo.getSettings(tenantId);
      const state = await botRepo.setConversationMode(
        convId,
        tenantId,
        mode as BotConversationMode,
        Number(pauseMinutes || settings.humanPauseMinutes)
      );
      return reply.send({ state });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Simulador sin envío real
  fastify.post("/bot/simulate", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const { text, phone, customerId, pendingFlow, channel, history } = (request.body as any) || {};
      const userText = String(text || "").trim();
      if (!userText) {
        return reply.status(400).send({ error: "Escriba un mensaje para simular." });
      }

      const settings = await botRepo.getSettings(tenantId);
      const simChannel: BotChannel = ["whatsapp", "facebook", "instagram"].includes(channel)
        ? channel
        : "whatsapp";
      const handle = String(phone || "+51999999999");

      let customer = customerId ? getCustomerById(tenantId, Number(customerId)) : null;
      if (!customer && phone) {
        customer = identifyCustomerByHandle(tenantId, simChannel, handle);
      }

      const recentMessages = Array.isArray(history)
        ? history.map((h: any, idx: number) => ({
            id: idx + 1,
            senderType: h.senderType || "contact",
            senderName: h.senderName || "Cliente",
            body: String(h.body || ""),
            mediaType: "none",
            createdAt: new Date().toISOString(),
          }))
        : [];
      recentMessages.push({
        id: recentMessages.length + 1,
        senderType: "contact",
        senderName: customer?.fullName || "Cliente Simulado",
        body: userText,
        mediaType: "none",
        createdAt: new Date().toISOString(),
      });

      const ctx: BotContext = {
        tenantId,
        conversation: {
          id: 0,
          channel: simChannel,
          contactName: customer?.fullName || "Cliente Simulado",
          contactHandle: handle,
        },
        state: {
          conversationId: 0,
          tenantId,
          mode: "bot",
          pausedUntil: null,
          customerId: customer?.id ?? null,
          verified: Boolean(customer),
          pendingFlow: String(pendingFlow || ""),
          failedAttempts: 0,
          lastInteractionId: "",
        },
        customer,
        recentMessages,
        latestUserText: userText,
        latestUserMessageId: null,
      };

      const startedAt = Date.now();
      const decision = await decideForContext(ctx, settings);
      return reply.send({
        decision,
        latencyMs: Date.now() - startedAt,
        withinBusinessHours: isWithinBusinessHours(settings),
        identifiedCustomer: customer,
        nextPendingFlow:
          decision.setPendingFlow !== undefined ? decision.setPendingFlow : ctx.state.pendingFlow,
        nextCustomerId: decision.verifiedCustomerId ?? customer?.id ?? null,
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Auditoría de ejecuciones
  fastify.get("/bot/runs", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const q = request.query as any;
      const convId = q?.conversationId ? Number(q.conversationId) : undefined;
      const limit = q?.limit ? Number(q.limit) : 40;
      const runs = await botRepo.listRuns(tenantId, convId, limit);
      return reply.send({ runs });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Fase 2: Tickets de soporte generados por el Bot
  fastify.get("/bot/tickets", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const res = await db.query(
        "SELECT * FROM bot_support_tickets WHERE tenant_id = $1 ORDER BY id DESC LIMIT 100",
        [tenantId]
      );
      return reply.send({ tickets: res.rows });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/bot/tickets/:id", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const id = Number((request.params as any).id);
      const { status, assignedTechnician } = (request.body as any) || {};
      const res = await db.query(
        `UPDATE bot_support_tickets SET
          status = COALESCE($1, status),
          assigned_technician = COALESCE($2, assigned_technician),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [status ?? null, assignedTechnician ?? null, id, tenantId]
      );
      if (!res.rows[0]) return reply.status(404).send({ error: "Ticket no encontrado." });
      return reply.send({ ticket: res.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Fase 2: Comprobantes de pago leídos por el Bot (pendientes de validación humana)
  fastify.get("/bot/payment-claims", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const res = await db.query(
        "SELECT * FROM bot_payment_claims WHERE tenant_id = $1 ORDER BY id DESC LIMIT 100",
        [tenantId]
      );
      return reply.send({ claims: res.rows });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/bot/payment-claims/:id", async (request, reply) => {
    try {
      const tenantId = resolveTenantId(request);
      const id = Number((request.params as any).id);
      const { status, notes } = (request.body as any) || {};
      if (!["pending_validation", "approved", "rejected"].includes(status)) {
        return reply.status(400).send({ error: "Estado inválido." });
      }
      const reviewer = request.authUser?.name || "Operador";
      const res = await db.query(
        `UPDATE bot_payment_claims SET
          status = $1,
          notes = COALESCE($2, notes),
          reviewed_by = $3,
          reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [status, notes ?? null, reviewer, id, tenantId]
      );
      if (!res.rows[0]) return reply.status(404).send({ error: "Comprobante no encontrado." });
      return reply.send({ claim: res.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Asegurar que la BD omnicanal está lista al consultar rutas del bot
  fastify.addHook("onRequest", async () => {
    await db.ensureReady();
  });
};
