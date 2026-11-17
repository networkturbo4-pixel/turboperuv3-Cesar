import { omnichannelDb as db } from "../messages/omnichannel-db";
import { subscribeInboxEvents, emitInboxEvent } from "../messages/whatsapp-qr-service";
import { botRepo } from "./bot.repository";
import { ConversationDebouncer } from "./debouncer";
import { getCustomerById, identifyCustomerByHandle } from "./customer-identity";
import { matchDeterministicIntent, matchesHandoffKeyword } from "./intents";
import { respondWithAi } from "./ai-responder";
import { botOutbox } from "./outbox";
import { analyzePaymentReceiptImage, transcribeAudioMessage } from "./media-processor";
import { BotChannel, BotContext, BotDecision, BotSettings } from "./bot.types";

const debouncer = new ConversationDebouncer();
let started = false;

export function isWithinBusinessHours(settings: BotSettings, now = new Date()): boolean {
  const cfg = settings.businessHours;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: cfg.timezone || "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
    const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
    if (Array.isArray(cfg.holidays) && cfg.holidays.includes(dateStr)) {
      return false;
    }

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayNum = weekdayMap[parts.weekday] ?? now.getDay();
    if (!cfg.days.includes(dayNum)) {
      return false;
    }

    const currentHHMM = `${parts.hour}:${parts.minute}`;
    return currentHHMM >= cfg.start && currentHHMM <= cfg.end;
  } catch {
    return true;
  }
}

export async function buildBotContext(conversationId: number): Promise<BotContext | null> {
  const convRes = await db.query(
    `SELECT id, COALESCE(tenant_id, 'turbonetwork') AS tenant_id, channel, contact_name, contact_handle
     FROM omnichannel_conversations WHERE id = $1 LIMIT 1`,
    [conversationId]
  );
  const conv = convRes.rows[0];
  if (!conv) return null;

  const tenantId = conv.tenant_id || "turbonetwork";
  let state = await botRepo.getOrCreateConversationState(conversationId, tenantId);

  const msgsRes = await db.query(
    `SELECT id, sender_type, sender_name, body, media_type, media_url, media_mimetype, created_at
     FROM omnichannel_messages
     WHERE conversation_id = $1 AND is_deleted = FALSE
     ORDER BY id DESC LIMIT 15`,
    [conversationId]
  );
  const recentMessages = [...msgsRes.rows].reverse().map((m) => ({
    id: Number(m.id),
    senderType: String(m.sender_type),
    senderName: String(m.sender_name),
    body: String(m.body || ""),
    mediaType: String(m.media_type || "none"),
    mediaUrl: String(m.media_url || ""),
    mediaMimetype: String(m.media_mimetype || ""),
    createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
  }));

  const latestContact = [...recentMessages].reverse().find((m) => m.senderType === "contact");

  // Identificación automática por teléfono si aún no está vinculado
  let customer = state.customerId ? getCustomerById(tenantId, state.customerId) : null;
  if (!customer) {
    const matched = identifyCustomerByHandle(tenantId, conv.channel, conv.contact_handle);
    if (matched) {
      customer = matched;
      state = await botRepo.updateConversationState(conversationId, tenantId, {
        customerId: matched.id,
        verified: true,
      });
    }
  }

  return {
    tenantId,
    conversation: {
      id: Number(conv.id),
      channel: conv.channel as BotChannel,
      contactName: String(conv.contact_name || ""),
      contactHandle: String(conv.contact_handle || ""),
    },
    state,
    customer,
    recentMessages,
    latestUserText: latestContact?.body || "",
    latestUserMessageId: latestContact?.id ?? null,
    latestUserMediaType: latestContact?.mediaType || "none",
    latestUserMediaUrl: latestContact?.mediaUrl || "",
    latestUserMediaMimetype: latestContact?.mediaMimetype || "",
  };
}

export async function runGuards(
  ctx: BotContext,
  settings: BotSettings
): Promise<{ skip: boolean; reason?: string }> {
  if (!settings.enabled) return { skip: true, reason: "bot_disabled" };
  if (!settings.channels.includes(ctx.conversation.channel)) {
    return { skip: true, reason: "channel_disabled" };
  }
  if (ctx.conversation.contactHandle.endsWith("@g.us")) {
    return { skip: true, reason: "group_chat" };
  }
  if (!ctx.latestUserText.trim()) {
    return { skip: true, reason: "empty_text" };
  }

  const lastMsg = ctx.recentMessages[ctx.recentMessages.length - 1];
  if (lastMsg && lastMsg.senderType !== "contact") {
    return { skip: true, reason: "last_message_not_contact" };
  }

  if (ctx.state.mode === "human") {
    return { skip: true, reason: "mode_human" };
  }

  if (ctx.state.mode === "paused" && ctx.state.pausedUntil) {
    if (new Date(ctx.state.pausedUntil).getTime() > Date.now()) {
      return { skip: true, reason: "mode_paused" };
    }
    await botRepo.updateConversationState(ctx.conversation.id, ctx.tenantId, {
      mode: "bot",
      pausedUntil: null,
    });
    ctx.state.mode = "bot";
  }

  const repliesLastHour = await botRepo.countBotRepliesLastHour(ctx.tenantId, ctx.conversation.id);
  if (repliesLastHour >= settings.maxRepliesPerHour) {
    return { skip: true, reason: "rate_limit_hour" };
  }

  return { skip: false };
}

async function performHandoff(ctx: BotContext, settings: BotSettings, reason: string, startedAt: number): Promise<void> {
  await botRepo.setConversationMode(ctx.conversation.id, ctx.tenantId, "human");
  const handoffText =
    "Con gusto le comunico con uno de nuestros asesores humanos. En breve le atenderán por este mismo medio.";

  await botOutbox.reply(ctx, settings.botName, handoffText);

  await db.query(
    `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
     VALUES ($1, $2, $3, '#f59e0b')`,
    [ctx.conversation.id, settings.botName, `Traspaso automático a humano: ${reason}`]
  ).catch(() => {});

  emitInboxEvent({ type: "new_message", tenantId: ctx.tenantId, conversationId: ctx.conversation.id });

  await botRepo.logRun({
    tenantId: ctx.tenantId,
    conversationId: ctx.conversation.id,
    triggerMessageId: ctx.latestUserMessageId,
    path: "handoff",
    intent: "handoff",
    replyText: handoffText,
    latencyMs: Date.now() - startedAt,
    error: reason,
  });
}

export async function decideForContext(
  ctx: BotContext,
  settings: BotSettings
): Promise<BotDecision> {
  if (matchesHandoffKeyword(ctx.latestUserText, settings)) {
    return {
      path: "handoff",
      intent: "keyword_handoff",
      toolsUsed: [],
      tokens: 0,
      handoff: true,
      reason: "Palabra clave de traspaso detectada",
      text: "",
    };
  }

  const rule = await matchDeterministicIntent(ctx, settings);
  if (rule) return rule;

  if (!settings.aiEnabled) {
    return {
      path: "handoff",
      intent: "ai_disabled",
      toolsUsed: [],
      tokens: 0,
      handoff: true,
      reason: "IA deshabilitada sin coincidencia de regla",
      text: "",
    };
  }

  const tokensUsedToday = await botRepo.sumTokensToday(ctx.tenantId);
  if (settings.dailyTokenBudget > 0 && tokensUsedToday >= settings.dailyTokenBudget) {
    return {
      path: "handoff",
      intent: "daily_budget_exceeded",
      toolsUsed: [],
      tokens: 0,
      handoff: true,
      reason: "Presupuesto diario de tokens agotado",
      text: "",
    };
  }

  return respondWithAi(ctx, settings);
}

export async function processInboundConversation(conversationId: number): Promise<void> {
  const startedAt = Date.now();
  let tenantId = "turbonetwork";
  try {
    const ctx = await buildBotContext(conversationId);
    if (!ctx) return;
    tenantId = ctx.tenantId;

    const settings = await botRepo.getSettings(tenantId);
    const guard = await runGuards(ctx, settings);
    if (guard.skip) {
      await botRepo.logRun({
        tenantId,
        conversationId,
        triggerMessageId: ctx.latestUserMessageId,
        path: "skipped",
        intent: guard.reason || "skipped",
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    // Fase 2: Transcripción de notas de voz y análisis de comprobantes de pago por foto
    if (ctx.latestUserMediaType === "audio" && ctx.latestUserMediaUrl) {
      const audioRes = await transcribeAudioMessage(ctx.latestUserMediaUrl, ctx.latestUserMediaMimetype);
      if (audioRes?.transcript) {
        ctx.latestUserText = audioRes.transcript;
        await db
          .query(
            `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
             VALUES ($1, 'TurboBot (Audio)', $2, '#6366f1')`,
            [conversationId, `Transcripción de nota de voz: "${audioRes.transcript}"`]
          )
          .catch(() => {});
      }
    } else if (ctx.latestUserMediaType === "image" && ctx.latestUserMediaUrl) {
      const receiptRes = await analyzePaymentReceiptImage(
        ctx,
        ctx.latestUserMediaUrl,
        ctx.latestUserMediaMimetype
      );
      if (receiptRes.handled && receiptRes.replyText) {
        await botOutbox.reply(ctx, settings.botName, receiptRes.replyText);
        await botRepo.logRun({
          tenantId,
          conversationId,
          triggerMessageId: ctx.latestUserMessageId,
          path: "ai",
          intent: "payment_receipt_claim",
          toolsUsed: ["analyzePaymentReceiptImage"],
          tokens: receiptRes.tokens,
          replyText: receiptRes.replyText,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }
    }

    if (!isWithinBusinessHours(settings)) {
      const alreadySent = await botRepo.hasOutOfHoursReplyToday(tenantId, conversationId);
      if (!alreadySent && settings.outOfHoursMessage.trim()) {
        await botOutbox.reply(ctx, settings.botName, settings.outOfHoursMessage);
        await botRepo.logRun({
          tenantId,
          conversationId,
          triggerMessageId: ctx.latestUserMessageId,
          path: "out_of_hours",
          intent: "out_of_hours",
          replyText: settings.outOfHoursMessage,
          latencyMs: Date.now() - startedAt,
        });
      }
    }

    const decision = await decideForContext(ctx, settings);

    if (decision.verifiedCustomerId) {
      await botRepo.updateConversationState(conversationId, tenantId, {
        customerId: decision.verifiedCustomerId,
        verified: true,
        pendingFlow: decision.setPendingFlow ?? "",
      });
    } else if (decision.setPendingFlow !== undefined) {
      await botRepo.updateConversationState(conversationId, tenantId, {
        pendingFlow: decision.setPendingFlow,
      });
    }

    if (decision.handoff) {
      await performHandoff(ctx, settings, decision.reason || "Derivado a asesor", startedAt);
      return;
    }

    if (decision.text.trim()) {
      await botOutbox.reply(ctx, settings.botName, decision.text);
    }

    await botRepo.logRun({
      tenantId,
      conversationId,
      triggerMessageId: ctx.latestUserMessageId,
      path: decision.path,
      intent: decision.intent,
      toolsUsed: decision.toolsUsed,
      tokens: decision.tokens,
      replyText: decision.text,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[Bot Engine] Error procesando conversación:", err);
    await botRepo
      .logRun({
        tenantId,
        conversationId,
        triggerMessageId: null,
        path: "skipped",
        intent: "error",
        error: (err as Error).message,
        latencyMs: Date.now() - startedAt,
      })
      .catch(() => {});
  }
}

export function startBotEngine(): void {
  if (started) return;
  started = true;
  subscribeInboxEvents((ev) => {
    if (ev.type !== "inbound_message" || !ev.conversationId) return;
    const convId = ev.conversationId;
    const tenantId = ev.tenantId || "turbonetwork";
    void botRepo
      .getSettings(tenantId)
      .then((settings) => {
        if (!settings.enabled) return;
        debouncer.schedule(convId, settings.debounceMs, () => processInboundConversation(convId));
      })
      .catch(() => {});
  });
  console.log("[Bot Engine] Motor de automatización de mensajes iniciado.");
}
