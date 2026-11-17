import { omnichannelDb as db } from "../messages/omnichannel-db";
import {
  BotChannel,
  BotConversationMode,
  BotConversationState,
  BotRunPath,
  BotSettings,
  BusinessHoursConfig,
} from "./bot.types";

const DEFAULT_HOURS: BusinessHoursConfig = {
  timezone: "America/Lima",
  days: [1, 2, 3, 4, 5, 6],
  start: "08:00",
  end: "20:00",
  holidays: [],
};

const DEFAULT_HANDOFF_KEYWORDS = [
  "asesor",
  "humano",
  "persona",
  "agente",
  "operador",
  "hablar con alguien",
];

function parseJsonArray<T>(val: unknown, fallback: T[]): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseHours(val: unknown): BusinessHoursConfig {
  const raw =
    typeof val === "string"
      ? (() => {
          try {
            return JSON.parse(val);
          } catch {
            return {};
          }
        })()
      : (val as Record<string, any>) || {};
  return {
    timezone: typeof raw.timezone === "string" && raw.timezone ? raw.timezone : DEFAULT_HOURS.timezone,
    days: Array.isArray(raw.days) && raw.days.length > 0 ? raw.days.map(Number) : DEFAULT_HOURS.days,
    start: typeof raw.start === "string" && /^\d{2}:\d{2}$/.test(raw.start) ? raw.start : DEFAULT_HOURS.start,
    end: typeof raw.end === "string" && /^\d{2}:\d{2}$/.test(raw.end) ? raw.end : DEFAULT_HOURS.end,
    holidays: Array.isArray(raw.holidays) ? raw.holidays.map(String) : [],
  };
}

function mapSettingsRow(row: any, tenantId: string): BotSettings {
  return {
    tenantId: row?.tenant_id || tenantId,
    enabled: Boolean(row?.enabled ?? false),
    channels: parseJsonArray<BotChannel>(row?.channels_json, ["whatsapp", "facebook", "instagram"]),
    botName: row?.bot_name || "Turbo",
    personaPrompt:
      row?.persona_prompt ||
      "Eres Turbo, el asistente virtual oficial de la empresa. Atiende siempre con trato formal de usted, cordial, claro y conciso.",
    businessHours: parseHours(row?.business_hours_json),
    outOfHoursMessage:
      row?.out_of_hours_message ||
      "Gracias por escribirnos. Nuestro horario de atención con asesores es de lunes a sábado de 08:00 a 20:00. Con gusto puedo ayudarle ahora mismo con su consulta.",
    handoffKeywords: parseJsonArray<string>(row?.handoff_keywords_json, DEFAULT_HANDOFF_KEYWORDS),
    humanPauseMinutes: Number(row?.human_pause_minutes ?? 30),
    debounceMs: Number(row?.debounce_ms ?? 4000),
    maxRepliesPerHour: Number(row?.max_replies_per_hour ?? 20),
    dailyTokenBudget: Number(row?.daily_token_budget ?? 500000),
    aiEnabled: Boolean(row?.ai_enabled ?? true),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function mapStateRow(row: any, conversationId: number, tenantId: string): BotConversationState {
  return {
    conversationId: Number(row?.conversation_id ?? conversationId),
    tenantId: row?.tenant_id || tenantId,
    mode: (row?.mode as BotConversationMode) || "bot",
    pausedUntil: row?.paused_until ? new Date(row.paused_until).toISOString() : null,
    customerId: row?.customer_id != null ? Number(row.customer_id) : null,
    verified: Boolean(row?.verified ?? false),
    pendingFlow: row?.pending_flow || "",
    failedAttempts: Number(row?.failed_attempts ?? 0),
    lastInteractionId: row?.last_interaction_id || "",
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export class BotRepository {
  async getSettings(tenantId = "turbonetwork"): Promise<BotSettings> {
    const tId = (tenantId || "turbonetwork").trim() || "turbonetwork";
    const existing = await db.query("SELECT * FROM bot_settings WHERE tenant_id = $1 LIMIT 1", [tId]);
    if (existing.rows[0]) {
      return mapSettingsRow(existing.rows[0], tId);
    }
    const inserted = await db.query(
      `INSERT INTO bot_settings (tenant_id) VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
       RETURNING *`,
      [tId]
    );
    return mapSettingsRow(inserted.rows[0], tId);
  }

  async updateSettings(tenantId: string, patch: Partial<BotSettings>): Promise<BotSettings> {
    const current = await this.getSettings(tenantId);
    const next: BotSettings = {
      ...current,
      ...patch,
      tenantId: current.tenantId,
      businessHours: patch.businessHours
        ? { ...current.businessHours, ...patch.businessHours }
        : current.businessHours,
    };

    const res = await db.query(
      `UPDATE bot_settings SET
        enabled = $1,
        channels_json = $2::jsonb,
        bot_name = $3,
        persona_prompt = $4,
        business_hours_json = $5::jsonb,
        out_of_hours_message = $6,
        handoff_keywords_json = $7::jsonb,
        human_pause_minutes = $8,
        debounce_ms = $9,
        max_replies_per_hour = $10,
        daily_token_budget = $11,
        ai_enabled = $12,
        updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $13
       RETURNING *`,
      [
        next.enabled,
        JSON.stringify(next.channels),
        next.botName.slice(0, 60),
        next.personaPrompt,
        JSON.stringify(next.businessHours),
        next.outOfHoursMessage,
        JSON.stringify(next.handoffKeywords),
        Math.max(1, Math.min(1440, Number(next.humanPauseMinutes) || 30)),
        Math.max(0, Math.min(15000, Number(next.debounceMs) || 4000)),
        Math.max(1, Math.min(200, Number(next.maxRepliesPerHour) || 20)),
        Math.max(0, Number(next.dailyTokenBudget) || 500000),
        next.aiEnabled,
        current.tenantId,
      ]
    );
    return mapSettingsRow(res.rows[0], current.tenantId);
  }

  async getOrCreateConversationState(conversationId: number, tenantId: string): Promise<BotConversationState> {
    const existing = await db.query(
      "SELECT * FROM bot_conversation_state WHERE conversation_id = $1 LIMIT 1",
      [conversationId]
    );
    if (existing.rows[0]) {
      return mapStateRow(existing.rows[0], conversationId, tenantId);
    }
    const inserted = await db.query(
      `INSERT INTO bot_conversation_state (conversation_id, tenant_id)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id) DO UPDATE SET conversation_id = EXCLUDED.conversation_id
       RETURNING *`,
      [conversationId, tenantId]
    );
    return mapStateRow(inserted.rows[0], conversationId, tenantId);
  }

  async updateConversationState(
    conversationId: number,
    tenantId: string,
    patch: Partial<{
      mode: BotConversationMode;
      pausedUntil: string | null;
      customerId: number | null;
      verified: boolean;
      pendingFlow: string;
      failedAttempts: number;
      lastInteractionId: string;
    }>
  ): Promise<BotConversationState> {
    const cur = await this.getOrCreateConversationState(conversationId, tenantId);
    const mode = patch.mode !== undefined ? patch.mode : cur.mode;
    const pausedUntil = patch.pausedUntil !== undefined ? patch.pausedUntil : cur.pausedUntil;
    const customerId = patch.customerId !== undefined ? patch.customerId : cur.customerId;
    const verified = patch.verified !== undefined ? patch.verified : cur.verified;
    const pendingFlow = patch.pendingFlow !== undefined ? patch.pendingFlow : cur.pendingFlow;
    const failedAttempts = patch.failedAttempts !== undefined ? patch.failedAttempts : cur.failedAttempts;
    const lastInteractionId =
      patch.lastInteractionId !== undefined ? patch.lastInteractionId : cur.lastInteractionId;

    const res = await db.query(
      `UPDATE bot_conversation_state SET
        mode = $1,
        paused_until = $2::timestamptz,
        customer_id = $3,
        verified = $4,
        pending_flow = $5,
        failed_attempts = $6,
        last_interaction_id = $7,
        updated_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $8
       RETURNING *`,
      [mode, pausedUntil, customerId, verified, pendingFlow, failedAttempts, lastInteractionId, conversationId]
    );
    return mapStateRow(res.rows[0], conversationId, tenantId);
  }

  async setConversationMode(
    conversationId: number,
    tenantId: string,
    mode: BotConversationMode,
    pauseMinutes = 30
  ): Promise<BotConversationState> {
    const pausedUntil =
      mode === "paused" ? new Date(Date.now() + Math.max(1, pauseMinutes) * 60_000).toISOString() : null;
    return this.updateConversationState(conversationId, tenantId, {
      mode,
      pausedUntil,
      failedAttempts: mode === "bot" ? 0 : undefined,
    });
  }

  async countBotRepliesLastHour(tenantId: string, conversationId: number): Promise<number> {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await db.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM bot_runs
       WHERE tenant_id = $1 AND conversation_id = $2
         AND path IN ('rule', 'ai', 'out_of_hours')
         AND created_at >= $3::timestamptz`,
      [tenantId, conversationId, since]
    );
    return Number(res.rows[0]?.cnt || 0);
  }

  async sumTokensToday(tenantId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const res = await db.query<{ total: string }>(
      `SELECT COALESCE(SUM(tokens), 0) AS total FROM bot_runs
       WHERE tenant_id = $1 AND created_at >= $2::timestamptz`,
      [tenantId, startOfDay.toISOString()]
    );
    return Number(res.rows[0]?.total || 0);
  }

  async hasOutOfHoursReplyToday(tenantId: string, conversationId: number): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const res = await db.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM bot_runs
       WHERE tenant_id = $1 AND conversation_id = $2
         AND path = 'out_of_hours'
         AND created_at >= $3::timestamptz`,
      [tenantId, conversationId, startOfDay.toISOString()]
    );
    return Number(res.rows[0]?.cnt || 0) > 0;
  }

  async logRun(params: {
    tenantId: string;
    conversationId: number | null;
    triggerMessageId: number | null;
    path: BotRunPath;
    intent?: string;
    toolsUsed?: string[];
    tokens?: number;
    latencyMs?: number;
    replyText?: string;
    error?: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO bot_runs
        (tenant_id, conversation_id, trigger_message_id, path, intent, tools_json, tokens, latency_ms, reply_text, error)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)`,
      [
        params.tenantId,
        params.conversationId,
        params.triggerMessageId,
        params.path,
        params.intent || "",
        JSON.stringify(params.toolsUsed || []),
        Number(params.tokens || 0),
        Number(params.latencyMs || 0),
        (params.replyText || "").slice(0, 2000),
        (params.error || "").slice(0, 1000),
      ]
    );
  }

  async listRuns(tenantId: string, conversationId?: number, limit = 50): Promise<any[]> {
    const lim = Math.max(1, Math.min(200, limit));
    if (conversationId) {
      const res = await db.query(
        `SELECT * FROM bot_runs WHERE tenant_id = $1 AND conversation_id = $2 ORDER BY id DESC LIMIT $3`,
        [tenantId, conversationId, lim]
      );
      return res.rows;
    }
    const res = await db.query(
      `SELECT * FROM bot_runs WHERE tenant_id = $1 ORDER BY id DESC LIMIT $2`,
      [tenantId, lim]
    );
    return res.rows;
  }
}

export const botRepo = new BotRepository();
