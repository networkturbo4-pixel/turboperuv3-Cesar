import { FastifyPluginAsync } from "fastify";
import fs from "fs";
import path from "path";
import { omnichannelDb as db } from "./omnichannel-db";
import {
  getWhatsAppQrRuntimeState,
  startWhatsAppQrSocket,
  disconnectWhatsAppQrSession,
  generateNewWhatsAppQrSession,
  sendWhatsAppQrDirectMessage,
  sendWhatsAppQrReaction,
  triggerManualWhatsAppFullSync,
  getWhatsAppSyncState,
  subscribeInboxEvents,
  emitInboxEvent,
} from "./whatsapp-qr-service";
import { processWhatsAppSendQueue } from "./send-queue";
import { applyReaction } from "./message-utils";
import { normalizeChannelHandle } from "./handle-utils";
import {
  resolveFacebookPageToken,
  syncFacebookConversations,
  sendFacebookMessage,
} from "./facebook-service";
import {
  syncInstagramConversations,
  sendInstagramMessage,
} from "./instagram-service";

interface NetworkSyncTaskState {
  active: boolean;
  channel: "whatsapp" | "instagram" | "facebook" | "all";
  title: string;
  detail: string;
  pct: number;
  startedAt: number;
}

let activeNetworkSync: NetworkSyncTaskState | null = null;
let networkSyncTimeout: NodeJS.Timeout | null = null;

function setNetworkSync(
  channel: "whatsapp" | "instagram" | "facebook" | "all",
  title: string,
  detail: string,
  pct = 35
) {
  if (networkSyncTimeout) clearTimeout(networkSyncTimeout);
  activeNetworkSync = {
    active: true,
    channel,
    title,
    detail,
    pct,
    startedAt: Date.now(),
  };
  networkSyncTimeout = setTimeout(() => {
    activeNetworkSync = null;
  }, 45000);
}

function clearNetworkSync() {
  if (networkSyncTimeout) clearTimeout(networkSyncTimeout);
  activeNetworkSync = null;
}

function loadActiveSystemUsers(): Array<{
  id: number;
  full_name: string;
  email: string;
  job_title: string;
  avatar_url: string;
  tags_json: string;
}> {
  try {
    const usersFile = path.resolve(process.cwd(), "data", "users.json");
    if (!fs.existsSync(usersFile)) return [];
    const raw = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((u: any) => u && u.active !== false && u.status !== "inactive")
      .map((u: any) => ({
        id: Number(u.id),
        full_name: String(u.name || u.full_name || "Agente"),
        email: String(u.email || ""),
        job_title: String(u.roleName || u.job_title || "Operador"),
        avatar_url: String(u.avatarUrl || u.avatar_url || ""),
        tags_json:
          typeof u.tags_json === "string"
            ? u.tags_json
            : JSON.stringify(Array.isArray(u.tags_json) ? u.tags_json : []),
      }));
  } catch {
    return [];
  }
}

const linkPreviewCache = new Map<string, { data: any; ts: number }>();

export const omnichannelRoutes: FastifyPluginAsync = async (fastify) => {
  // db.ensureReady() se ejecuta bajo demanda en la primera consulta db.query()

  // ==========================================================================
  // STICKERS RECIENTES / GUARDADOS (Bandeja Omnicanal)
  // ==========================================================================
  fastify.get("/inbox/stickers", async (_request, reply) => {
    try {
      const res = await db.query(
        `SELECT media_url, MAX(media_filename) AS media_filename, MAX(id) AS max_id
         FROM omnichannel_messages
         WHERE media_type = 'sticker' AND media_url IS NOT NULL AND media_url <> ''
         GROUP BY media_url
         ORDER BY max_id DESC
         LIMIT 40`
      );
      return reply.send({ stickers: res.rows });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ==========================================================================
  // CONEXIONES OMNICANAL (WhatsApp QR/API, Facebook, Instagram, TikTok)
  // ==========================================================================
  fastify.get("/connections", async (_request, reply) => {
    try {
      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const row = connRes.rows[0] || {};
      const runtime = getWhatsAppQrRuntimeState();

      if (runtime.status === "awaiting_scan" && !runtime.qrDataUrl) {
        startWhatsAppQrSocket(false).catch(() => {});
      }

      const mergedConnections = {
        ...row,
        wa_qr_status: runtime.status,
        wa_qr_session_code:
          runtime.qrDataUrl ||
          (row.wa_qr_session_code?.startsWith("data:image/") ? row.wa_qr_session_code : ""),
        wa_qr_phone: runtime.phone || row.wa_qr_phone,
        wa_qr_device: runtime.device || row.wa_qr_device,
      };

      return reply.send({ connections: mergedConnections });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/connections", async (request, reply) => {
    try {
      const b = (request.body as any) || {};

      if (b.fb_access_token && String(b.fb_access_token).trim() !== "") {
        try {
          const resolved = await resolveFacebookPageToken(b.fb_access_token, b.fb_page_id);
          if (resolved.ok) {
            b.fb_access_token = resolved.pageToken;
            b.fb_page_id = resolved.pageId;
            b.fb_page_name = resolved.pageName;
            b.fb_connected = true;
            syncFacebookConversations(resolved.pageId, resolved.pageToken).catch((e) => {
              console.warn("[FB-AUTO-SYNC] Aviso al sincronizar en guardado:", e);
            });
          }
        } catch (fbErr) {
          console.warn("[FB-PAGE-RESOLVE] Error resolviendo token de página:", fbErr);
        }
      }

      if (
        b.ig_access_token !== undefined &&
        (!b.ig_access_token ||
          b.ig_access_token.includes("Demo") ||
          b.ig_access_token === "IGQVJTokenDirectMessagesSync2026")
      ) {
        b.ig_connected = false;
      }
      if (
        b.tt_access_token !== undefined &&
        (!b.tt_access_token ||
          b.tt_access_token.includes("Demo") ||
          b.tt_access_token === "act.TikTokBusinessMessagingToken2026")
      ) {
        b.tt_connected = false;
      }

      const updated = await db.query(
        `UPDATE channel_connections SET
          wa_active_mode = COALESCE($1, wa_active_mode),
          wa_qr_status = COALESCE($2, wa_qr_status),
          wa_qr_phone = COALESCE($3, wa_qr_phone),
          wa_qr_device = COALESCE($4, wa_qr_device),
          wa_qr_session_code = COALESCE($5, wa_qr_session_code),
          wa_api_status = COALESCE($6, wa_api_status),
          wa_phone_number_id = COALESCE($7, wa_phone_number_id),
          wa_business_account_id = COALESCE($8, wa_business_account_id),
          wa_access_token = COALESCE($9, wa_access_token),
          wa_verify_token = COALESCE($10, wa_verify_token),
          wa_mass_messaging_enabled = COALESCE($11, wa_mass_messaging_enabled),
          wa_chatbot_enabled = COALESCE($12, wa_chatbot_enabled),
          wa_chatbot_prompt = COALESCE($13, wa_chatbot_prompt),
          fb_connected = COALESCE($14, fb_connected),
          fb_page_name = COALESCE($15, fb_page_name),
          fb_page_id = COALESCE($16, fb_page_id),
          fb_access_token = COALESCE($17, fb_access_token),
          fb_auto_sync = COALESCE($18, fb_auto_sync),
          ig_connected = COALESCE($19, ig_connected),
          ig_username = COALESCE($20, ig_username),
          ig_account_id = COALESCE($21, ig_account_id),
          ig_access_token = COALESCE($22, ig_access_token),
          ig_sync_stories = COALESCE($23, ig_sync_stories),
          tt_connected = COALESCE($24, tt_connected),
          tt_account_handle = COALESCE($25, tt_account_handle),
          tt_client_key = COALESCE($26, tt_client_key),
          tt_access_token = COALESCE($27, tt_access_token),
          tt_sync_leads = COALESCE($28, tt_sync_leads),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING *`,
        [
          b.wa_active_mode ?? null,
          b.wa_qr_status ?? null,
          b.wa_qr_phone ?? null,
          b.wa_qr_device ?? null,
          b.wa_qr_session_code ?? null,
          b.wa_api_status ?? null,
          b.wa_phone_number_id ?? null,
          b.wa_business_account_id ?? null,
          b.wa_access_token ?? null,
          b.wa_verify_token ?? null,
          typeof b.wa_mass_messaging_enabled === "boolean" ? b.wa_mass_messaging_enabled : null,
          typeof b.wa_chatbot_enabled === "boolean" ? b.wa_chatbot_enabled : null,
          b.wa_chatbot_prompt ?? null,
          typeof b.fb_connected === "boolean" ? b.fb_connected : null,
          b.fb_page_name ?? null,
          b.fb_page_id ?? null,
          b.fb_access_token ?? null,
          typeof b.fb_auto_sync === "boolean" ? b.fb_auto_sync : null,
          typeof b.ig_connected === "boolean" ? b.ig_connected : null,
          b.ig_username ?? null,
          b.ig_account_id ?? null,
          b.ig_access_token ?? null,
          typeof b.ig_sync_stories === "boolean" ? b.ig_sync_stories : null,
          typeof b.tt_connected === "boolean" ? b.tt_connected : null,
          b.tt_account_handle ?? null,
          b.tt_client_key ?? null,
          b.tt_access_token ?? null,
          typeof b.tt_sync_leads === "boolean" ? b.tt_sync_leads : null,
        ]
      );
      return reply.send({ connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/facebook/verify", async (request, reply) => {
    try {
      const { token, page_id, page_name } = (request.body as any) || {};
      const cleanToken = String(token || "").trim();
      const cleanPageId = String(page_id || "").trim();

      if (!cleanToken) {
        return reply.status(400).send({ error: "Ingrese el Token de Acceso de Meta o Facebook." });
      }

      const resolved = await resolveFacebookPageToken(cleanToken, cleanPageId);
      if (!resolved.ok) {
        await db.query("UPDATE channel_connections SET fb_connected = false WHERE id = 1");
        return reply.status(400).send({ error: resolved.error || "Token de Meta o Facebook inválido." });
      }

      const updated = await db.query(
        `UPDATE channel_connections SET
          fb_connected = true,
          fb_page_name = $1,
          fb_page_id = $2,
          fb_access_token = $3
        WHERE id = 1
        RETURNING *`,
        [resolved.pageName || page_name || "Página de Facebook", resolved.pageId, resolved.pageToken]
      );

      const syncRes = await syncFacebookConversations(resolved.pageId, resolved.pageToken);

      return reply.send({
        success: true,
        connections: updated.rows[0],
        pageName: resolved.pageName,
        pageId: resolved.pageId,
        syncedConversations: syncRes.conversationsCount,
        syncedMessages: syncRes.messagesCount,
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/facebook/disconnect", async (_request, reply) => {
    try {
      const updated = await db.query(
        "UPDATE channel_connections SET fb_connected = false WHERE id = 1 RETURNING *"
      );
      return reply.send({ success: true, connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/instagram/verify", async (request, reply) => {
    try {
      const { username, account_id, token } = (request.body as any) || {};
      const cleanToken = String(token || "").trim();
      const cleanId = String(account_id || "").trim();

      if (!cleanToken || cleanToken === "IGQVJTokenDirectMessagesSync2026" || cleanToken.includes("Demo")) {
        await db.query("UPDATE channel_connections SET ig_connected = false WHERE id = 1");
        return reply.status(400).send({
          error: "Token de Instagram inválido o sin configurar. Ingrese un token real de Instagram Graph API.",
        });
      }

      const updated = await db.query(
        `UPDATE channel_connections SET
          ig_connected = true,
          ig_username = COALESCE($1, ig_username),
          ig_account_id = COALESCE($2, ig_account_id),
          ig_access_token = $3
        WHERE id = 1
        RETURNING *`,
        [username || null, cleanId || null, cleanToken]
      );

      return reply.send({ success: true, connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/instagram/disconnect", async (_request, reply) => {
    try {
      const updated = await db.query(
        "UPDATE channel_connections SET ig_connected = false WHERE id = 1 RETURNING *"
      );
      return reply.send({ success: true, connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/tiktok/verify", async (request, reply) => {
    try {
      const { handle, client_key, token } = (request.body as any) || {};
      const cleanToken = String(token || "").trim();

      if (
        !cleanToken ||
        cleanToken === "act.TikTokBusinessMessagingToken2026" ||
        cleanToken.includes("Demo")
      ) {
        await db.query("UPDATE channel_connections SET tt_connected = false WHERE id = 1");
        return reply.status(400).send({
          error:
            "Token de TikTok Business inválido o sin configurar. Ingrese un Access Token comercial real de TikTok Developers.",
        });
      }

      const updated = await db.query(
        `UPDATE channel_connections SET
          tt_connected = true,
          tt_account_handle = COALESCE($1, tt_account_handle),
          tt_client_key = COALESCE($2, tt_client_key),
          tt_access_token = $3
        WHERE id = 1
        RETURNING *`,
        [handle || null, client_key || null, cleanToken]
      );

      return reply.send({ success: true, connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/tiktok/disconnect", async (_request, reply) => {
    try {
      const updated = await db.query(
        "UPDATE channel_connections SET tt_connected = false WHERE id = 1 RETURNING *"
      );
      return reply.send({ success: true, connections: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/connections/whatsapp-qr/action", async (request, reply) => {
    try {
      const { action, phone } = (request.body as any) || {};

      if (action === "disconnect") {
        await disconnectWhatsAppQrSession();
        await db.query("DELETE FROM omnichannel_conversations WHERE channel = 'whatsapp'").catch(() => {});
      } else if (action === "generate_qr") {
        await generateNewWhatsAppQrSession();
        await db.query("DELETE FROM omnichannel_conversations WHERE channel = 'whatsapp'").catch(() => {});
      }

      const runtime = getWhatsAppQrRuntimeState();
      const updated = await db.query(
        `UPDATE channel_connections SET
          wa_active_mode = 'qr',
          wa_qr_status = $1,
          wa_qr_session_code = $2,
          wa_qr_phone = COALESCE($3, wa_qr_phone),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING *`,
        [runtime.status, runtime.qrDataUrl || "AWAITING_QR", phone || runtime.phone || null]
      );

      const row = updated.rows[0] || {};
      return reply.send({
        connections: {
          ...row,
          wa_qr_status: runtime.status,
          wa_qr_session_code: runtime.qrDataUrl || "",
          wa_qr_phone: runtime.phone || row.wa_qr_phone,
          wa_qr_device: runtime.device || row.wa_qr_device,
        },
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ==========================================================================
  // BANDEJA DE MENSAJES OMNICANAL
  // ==========================================================================
  fastify.get("/inbox/sync-status", async (_request, reply) => {
    const wa = getWhatsAppSyncState();

    if (activeNetworkSync && activeNetworkSync.active) {
      return reply.send({
        active: true,
        channel: activeNetworkSync.channel,
        title: activeNetworkSync.title,
        detail: activeNetworkSync.detail,
        pct: activeNetworkSync.pct,
        chats: wa.chats || 0,
        totalMessages: wa.totalMessages || 0,
        processedMessages: wa.processedMessages || 0,
        elapsedMs: Date.now() - activeNetworkSync.startedAt,
      });
    }

    if (wa.active) {
      const total = wa.totalMessages;
      const pct = total > 0 ? Math.min(99, Math.round((wa.processedMessages / total) * 100)) : 20;
      const detail =
        total > 0
          ? `${wa.processedMessages.toLocaleString("es-PE")} de ${total.toLocaleString("es-PE")} mensajes · ${wa.chats.toLocaleString("es-PE")} chats`
          : "Conectando con WhatsApp y recibiendo mensajes...";
      return reply.send({
        active: true,
        channel: "whatsapp",
        title: "Sincronizando chats de WhatsApp",
        detail,
        pct,
        chats: wa.chats,
        totalMessages: wa.totalMessages,
        processedMessages: wa.processedMessages,
        elapsedMs: wa.elapsedMs,
      });
    }

    return reply.send({
      active: false,
      channel: "all",
      title: "",
      detail: "",
      pct: 0,
      chats: 0,
      totalMessages: 0,
      processedMessages: 0,
      elapsedMs: 0,
    });
  });

  fastify.get("/inbox/events", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write("event: connected\ndata: {}\n\n");

    const unsubscribe = subscribeInboxEvents((ev) => {
      try {
        reply.raw.write(`event: inbox\ndata: ${JSON.stringify(ev)}\n\n`);
      } catch {
        // Cliente desconectado
      }
    });

    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        // Ignorar
      }
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    return reply;
  });

  fastify.get("/link-preview", async (request, reply) => {
    const query = request.query as Record<string, any>;
    const targetUrl = String(query?.url || "").trim();
    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return reply.status(400).send({ error: "URL requerida con protocolo http o https" });
    }

    const cached = linkPreviewCache.get(targetUrl);
    if (cached && Date.now() - cached.ts < 3600000) {
      return reply.send(cached.data);
    }

    try {
      const parsed = new URL(targetUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TurboNetworkBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);

      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok || !contentType.includes("text/html")) {
        const fallback = {
          url: targetUrl,
          domain: parsed.hostname.replace(/^www\./, ""),
          title: parsed.hostname.replace(/^www\./, ""),
          description: targetUrl,
          image: "",
          siteName: parsed.hostname.replace(/^www\./, ""),
        };
        linkPreviewCache.set(targetUrl, { data: fallback, ts: Date.now() });
        return reply.send(fallback);
      }

      const html = (await resp.text()).slice(0, 60000);
      const getMeta = (prop: string): string => {
        const rx1 = new RegExp(
          `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          "i"
        );
        const rx2 = new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
          "i"
        );
        const m = html.match(rx1) || html.match(rx2);
        return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim() : "";
      };

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title =
        getMeta("og:title") ||
        getMeta("twitter:title") ||
        (titleMatch ? titleMatch[1].trim() : parsed.hostname);
      const description =
        getMeta("og:description") ||
        getMeta("twitter:description") ||
        getMeta("description") ||
        "";
      let image = getMeta("og:image") || getMeta("twitter:image") || "";
      if (image && image.startsWith("/")) {
        image = `${parsed.protocol}//${parsed.host}${image}`;
      }
      const siteName =
        getMeta("og:site_name") || parsed.hostname.replace(/^www\./, "");

      const data = {
        url: targetUrl,
        domain: parsed.hostname.replace(/^www\./, ""),
        title: title.slice(0, 120),
        description: description.slice(0, 200),
        image,
        siteName: siteName.slice(0, 60),
      };
      linkPreviewCache.set(targetUrl, { data, ts: Date.now() });
      return reply.send(data);
    } catch {
      try {
        const parsed = new URL(targetUrl);
        return reply.send({
          url: targetUrl,
          domain: parsed.hostname.replace(/^www\./, ""),
          title: parsed.hostname.replace(/^www\./, ""),
          description: "",
          image: "",
          siteName: parsed.hostname.replace(/^www\./, ""),
        });
      } catch {
        return reply.status(400).send({ error: "URL inválida" });
      }
    }
  });

  fastify.get("/inbox", async (request, reply) => {
    try {
      const query = request.query as Record<string, any>;
      const activeConvId = query?.active_conv_id
        ? Number(query.active_conv_id)
        : query?.conversation_id
        ? Number(query.conversation_id)
        : null;
      const includeAll = query?.all_messages === "true";

      // Paginación: solo se envían los últimos N mensajes de la conversación activa (carga por tramos)
      const msgLimit = Math.min(2000, Math.max(50, Number(query?.msg_limit) || 250));
      let messagesQuery = "SELECT * FROM omnichannel_messages ORDER BY id ASC";
      let messagesParams: any[] = [];

      if (!includeAll) {
        if (activeConvId) {
          messagesQuery =
            "SELECT * FROM (SELECT * FROM omnichannel_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2) t ORDER BY id ASC";
          messagesParams = [activeConvId, msgLimit];
        } else {
          messagesQuery = `
            SELECT * FROM (
              SELECT * FROM omnichannel_messages
              WHERE conversation_id = (SELECT id FROM omnichannel_conversations ORDER BY updated_at DESC LIMIT 1)
              ORDER BY id DESC LIMIT $1
            ) t ORDER BY id ASC
          `;
          messagesParams = [msgLimit];
        }
      }

      const [convRes, msgRes, connRes, qrRes, tagsRes, notesRes] = await Promise.all([
        db.query("SELECT * FROM omnichannel_conversations ORDER BY updated_at DESC, id ASC"),
        db.query(messagesQuery, messagesParams),
        db.query("SELECT * FROM channel_connections WHERE id = 1"),
        db.query("SELECT * FROM quick_replies ORDER BY shortcut ASC"),
        db.query("SELECT * FROM crm_tags ORDER BY id ASC"),
        db.query("SELECT * FROM conversation_notes ORDER BY created_at DESC"),
      ]);

      const row = connRes.rows[0] || {};
      const runtime = getWhatsAppQrRuntimeState();
      const users = loadActiveSystemUsers();

      return reply.send({
        conversations: convRes.rows.map((c) => ({
          ...c,
          estimated_value: Number(c.estimated_value),
          tags_json:
            typeof c.tags_json === "string"
              ? c.tags_json
              : JSON.stringify(Array.isArray(c.tags_json) ? c.tags_json : []),
        })),
        messages: msgRes.rows,
        connections: {
          ...row,
          wa_qr_status: runtime.status,
          wa_qr_session_code: runtime.qrDataUrl || "",
          wa_qr_phone: runtime.phone || row.wa_qr_phone,
          wa_qr_device: runtime.device || row.wa_qr_device,
        },
        quickReplies: qrRes.rows,
        tags: tagsRes.rows,
        notes: notesRes.rows,
        users,
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/sync-whatsapp", async (_request, reply) => {
    try {
      const result = await triggerManualWhatsAppFullSync();
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/sync-facebook", async (_request, reply) => {
    try {
      const connRes = await db.query(
        "SELECT fb_connected, fb_page_id, fb_access_token FROM channel_connections WHERE id = 1"
      );
      const conn = connRes.rows[0];
      if (!conn || !conn.fb_connected || !conn.fb_access_token) {
        return reply.status(400).send({
          error:
            "Facebook Messenger no está conectado. Conéctelo en Configuración -> Conexiones.",
        });
      }

      setNetworkSync(
        "facebook",
        "Sincronizando Facebook Messenger",
        "Descargando conversaciones y mensajes de la Fan Page...",
        45
      );

      try {
        const syncRes = await syncFacebookConversations(conn.fb_page_id, conn.fb_access_token);
        if (!syncRes.success) {
          return reply.status(400).send({ error: syncRes.error || "Error al sincronizar Facebook." });
        }

        const countRes = await db.query(
          "SELECT COUNT(*) as count FROM omnichannel_conversations WHERE channel = 'facebook'"
        );
        return reply.send({
          synced: true,
          totalConversations: Number(countRes.rows[0]?.count ?? 0),
          syncedConversations: syncRes.conversationsCount,
          syncedMessages: syncRes.messagesCount,
        });
      } finally {
        clearNetworkSync();
      }
    } catch (err) {
      clearNetworkSync();
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/sync-instagram", async (_request, reply) => {
    try {
      const connRes = await db.query(
        "SELECT ig_connected, ig_account_id, ig_username, ig_access_token, fb_page_id, fb_access_token FROM channel_connections WHERE id = 1"
      );
      const conn = connRes.rows[0];
      if (!conn || !conn.ig_connected || !conn.ig_access_token) {
        return reply.status(400).send({
          error: "Instagram no está conectado. Conéctelo en Configuración -> Conexiones.",
        });
      }

      setNetworkSync(
        "instagram",
        `Sincronizando ${conn.ig_username || "Instagram Direct"}`,
        "Consultando mensajes y conversaciones de Meta Graph API...",
        40
      );

      try {
        const syncRes = await syncInstagramConversations(
          conn.ig_account_id,
          conn.ig_access_token,
          conn.fb_page_id,
          conn.fb_access_token
        );

        const countRes = await db.query(
          "SELECT COUNT(*) as count FROM omnichannel_conversations WHERE channel = 'instagram'"
        );

        return reply.send({
          synced: syncRes.success,
          totalConversations: Number(countRes.rows[0]?.count ?? 0),
          syncedConversations: syncRes.conversationsCount,
          syncedMessages: syncRes.messagesCount,
          message:
            syncRes.conversationsCount > 0
              ? `Se sincronizaron ${syncRes.conversationsCount} conversaciones y ${syncRes.messagesCount} mensajes de Instagram.`
              : 'Instagram sincronizado correctamente. Si tienes DMs que no aparecen, asegúrate de activar "Permitir acceso a los mensajes" en la app de Instagram.',
          error: syncRes.error,
        });
      } finally {
        clearNetworkSync();
      }
    } catch (err) {
      clearNetworkSync();
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/sync-all", async (_request, reply) => {
    try {
      setNetworkSync(
        "all",
        "Sincronizando todas las redes",
        "Descargando mensajes de WhatsApp, Instagram y Facebook...",
        30
      );

      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const conn = connRes.rows[0] || {};

      const tasks: Promise<any>[] = [];

      if (conn.wa_qr_status === "connected") {
        tasks.push(
          triggerManualWhatsAppFullSync().catch((e) => ({
            channel: "whatsapp",
            error: (e as Error).message,
          }))
        );
      }

      if (conn.ig_connected && conn.ig_access_token) {
        tasks.push(
          syncInstagramConversations(
            conn.ig_account_id,
            conn.ig_access_token,
            conn.fb_page_id,
            conn.fb_access_token
          ).catch((e) => ({
            channel: "instagram",
            error: (e as Error).message,
          }))
        );
      }

      if (conn.fb_connected && conn.fb_access_token) {
        tasks.push(
          syncFacebookConversations(conn.fb_page_id, conn.fb_access_token).catch((e) => ({
            channel: "facebook",
            error: (e as Error).message,
          }))
        );
      }

      const results = await Promise.allSettled(tasks);
      clearNetworkSync();

      const counts = await db.query(
        "SELECT channel, COUNT(*) as count FROM omnichannel_conversations GROUP BY channel"
      );

      return reply.send({
        synced: true,
        channelsCount: counts.rows,
        tasksRan: tasks.length,
        results,
      });
    } catch (err) {
      clearNetworkSync();
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/conversations", async (request, reply) => {
    try {
      const { contact_name, contact_handle, channel = "whatsapp" } = (request.body as any) || {};
      if (!contact_name || !contact_handle) {
        return reply.status(400).send({ error: "Nombre y número o contacto son obligatorios." });
      }
      const cleanName = String(contact_name).trim();
      const cleanHandle = normalizeChannelHandle(channel, String(contact_handle));

      const existing = await db.query(
        "SELECT id FROM omnichannel_conversations WHERE channel = $1 AND contact_handle = $2 LIMIT 1",
        [channel, cleanHandle]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await db.query(
          `UPDATE omnichannel_conversations
           SET contact_name = CASE
             WHEN contact_name LIKE '+%' OR contact_name LIKE '%@lid' THEN $1
             ELSE contact_name
           END
           WHERE id = $2`,
          [cleanName, existing.rows[0].id]
        ).catch(() => {});
        return reply.send({ id: existing.rows[0].id, alreadyExists: true });
      }

      const colors = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#0d9488"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const ins = await db.query(
        `INSERT INTO omnichannel_conversations
         (channel, contact_name, contact_handle, avatar_color, unread_count, estimated_value, tag, tags_json, last_message_text, last_message_time)
         VALUES ($1, $2, $3, $4, 0, 0, 'Nuevo', '[]', 'Conversación iniciada', 'Ahora')
         RETURNING id`,
        [channel, cleanName, cleanHandle, randomColor]
      );

      return reply.send({ id: ins.rows[0].id, success: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/conversations/:id/messages", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const convId = Number(params.id);
      const {
        body,
        media_type = "none",
        media_url = "",
        media_filename = "",
        media_mimetype = "",
        reply_to_id = null,
        reply_to_sender = "",
        reply_to_body = "",
        reply_to_media_url = "",
        reply_to_media_type = "none",
      } = (request.body as any) || {};

      const cleanBody = String(body || "").trim();
      const hasMedia = media_type && media_type !== "none" && Boolean(media_url);

      if (!cleanBody && !hasMedia) {
        return reply.status(400).send({ error: "El mensaje o archivo adjunto no puede estar vacío." });
      }

      const convRes = await db.query("SELECT * FROM omnichannel_conversations WHERE id = $1", [convId]);
      if (convRes.rowCount === 0) {
        return reply.status(404).send({ error: "Conversación no encontrada." });
      }

      const conv = convRes.rows[0];
      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const conn = connRes.rows[0] || {};
      const agentName = request.authUser?.name || "Agente";

      const mediaFallbackLabel =
        media_type === "image"
          ? "[Foto]"
          : media_type === "sticker"
          ? ""
          : media_type === "video"
          ? "[Video]"
          : media_type === "audio"
          ? ""
          : media_type === "document"
          ? `[Documento: ${media_filename || "Archivo"}]`
          : "";
      const finalBody = cleanBody || mediaFallbackLabel;

      let persistedMediaUrl = String(media_url || "");
      let persistedMediaFilename = String(media_filename || "");
      let persistedMediaMimetype = String(media_mimetype || "");

      // Guardar en disco cualquier multimedia enviada como data URL (fotos, audios, videos, documentos, stickers)
      // para no inflar la base de datos y poder servirla/reenviarla por /media/*
      if (media_type && media_type !== "none" && persistedMediaUrl.startsWith("data:") && persistedMediaUrl.includes(";base64,")) {
        try {
          const mediaDir = path.join(process.cwd(), "data", "media");
          if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
          const meta = persistedMediaUrl.slice(5, persistedMediaUrl.indexOf(";base64,"));
          const dataMime = (meta.split(";")[0] || "application/octet-stream").toLowerCase();
          const extByMime: Record<string, string> = {
            "image/webp": "webp",
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/gif": "gif",
            "audio/ogg": "ogg",
            "audio/webm": "webm",
            "audio/mpeg": "mp3",
            "audio/mp4": "m4a",
            "audio/wav": "wav",
            "video/mp4": "mp4",
            "video/webm": "webm",
            "video/quicktime": "mov",
            "application/pdf": "pdf",
          };
          let ext = extByMime[dataMime] || "";
          if (!ext && persistedMediaFilename.includes(".")) {
            ext = persistedMediaFilename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
          }
          if (!ext) ext = "bin";
          const buf = Buffer.from(persistedMediaUrl.slice(persistedMediaUrl.indexOf(";base64,") + 8), "base64");
          const savedFile = `crm_${media_type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(mediaDir, savedFile), buf);
          persistedMediaUrl = `/media/${savedFile}`;
          if (!persistedMediaFilename) persistedMediaFilename = savedFile;
          if (!persistedMediaMimetype) persistedMediaMimetype = dataMime;
        } catch (mediaSaveErr) {
          console.warn("[MEDIA-SAVE] No se pudo guardar multimedia en disco:", mediaSaveErr);
        }
      }

      let deliveryVia = "meta";
      let waMsgId = "";
      let initialDeliveryStatus = "sent";

      if (conv.channel === "whatsapp") {
        const useCloudApi =
          conn.wa_active_mode === "api" &&
          Boolean(conn.wa_access_token) &&
          Boolean(conn.wa_phone_number_id);
        deliveryVia = useCloudApi ? "wa-api" : "wa-qr";
        if (!useCloudApi) {
          if (getWhatsAppQrRuntimeState().status !== "connected") {
            await startWhatsAppQrSocket(false).catch(() => {});
          }
          let quotedInfo: { waMessageId: string; fromMe: boolean; body: string } | undefined;
          if (reply_to_id) {
            const origRes = await db.query(
              "SELECT wa_message_id, sender_type, body FROM omnichannel_messages WHERE id = $1 LIMIT 1",
              [Number(reply_to_id)]
            );
            const orig = origRes.rows[0];
            if (orig?.wa_message_id) {
              quotedInfo = {
                waMessageId: String(orig.wa_message_id),
                fromMe: orig.sender_type === "agent",
                body: String(orig.body || reply_to_body || ""),
              };
            }
          }
          const qrRes = await sendWhatsAppQrDirectMessage(
            conv.contact_handle,
            cleanBody,
            {
              mediaType: media_type,
              mediaUrl: persistedMediaUrl,
              mediaFilename: persistedMediaFilename,
              mediaMimetype: persistedMediaMimetype,
            },
            quotedInfo ? { quoted: quotedInfo } : undefined
          );
          if (!qrRes || !qrRes.success) {
            // Socket caído o error transitorio: el mensaje queda en cola y se reenvía solo al reconectar
            initialDeliveryStatus = "queued";
          } else if (qrRes.waMessageId) {
            waMsgId = qrRes.waMessageId;
          }
        }
      } else if (conv.channel === "facebook") {
        deliveryVia = "meta";
        initialDeliveryStatus = "sent";
        if (conn.fb_connected && conn.fb_access_token) {
          const fbRes = await sendFacebookMessage(conn.fb_access_token, conv.contact_handle, cleanBody);
          if (fbRes.success) {
            initialDeliveryStatus = "delivered";
          } else {
            console.warn("[FB-SEND] Aviso enviando a Facebook Messenger:", fbRes.error);
          }
        }
      } else if (conv.channel === "instagram") {
        deliveryVia = "meta";
        initialDeliveryStatus = "sent";
        const igToken = conn.ig_access_token || conn.fb_access_token;
        if (conn.ig_connected && igToken) {
          const igRes = await sendInstagramMessage(igToken, conv.contact_handle, cleanBody);
          if (igRes.success) {
            initialDeliveryStatus = "delivered";
          } else {
            console.warn("[IG-SEND] Aviso enviando a Instagram Direct:", igRes.error);
          }
        }
      } else if (conv.channel === "tiktok") {
        deliveryVia = "tiktok";
        initialDeliveryStatus = "read";
      } else {
        initialDeliveryStatus = "read";
      }

      const now = new Date();
      const timeLabel = now.toTimeString().slice(0, 5);

      await db.query(
        `DELETE FROM omnichannel_messages
         WHERE conversation_id = $1
           AND (body LIKE 'Chat activo de WhatsApp%' OR body LIKE 'Conversación de WhatsApp con%')`,
        [convId]
      );

      let finalReplyMediaUrl = reply_to_media_url || "";
      let finalReplyMediaType = reply_to_media_type || "none";
      if (reply_to_id && (!finalReplyMediaUrl || finalReplyMediaType === "none")) {
        const origMsg = await db.query(
          "SELECT media_url, media_type FROM omnichannel_messages WHERE id = $1 LIMIT 1",
          [Number(reply_to_id)]
        );
        if ((origMsg.rowCount ?? 0) > 0) {
          finalReplyMediaUrl = origMsg.rows[0].media_url || finalReplyMediaUrl;
          finalReplyMediaType = origMsg.rows[0].media_type || finalReplyMediaType;
        }
      }

      const insertedMsg = await db.query(
        `INSERT INTO omnichannel_messages
         (conversation_id, sender_type, sender_name, body, delivery_via, time_label, media_type, media_url, media_filename, media_mimetype, delivery_status, reply_to_id, reply_to_sender, reply_to_body, reply_to_media_url, reply_to_media_type, wa_message_id, queued_at)
         VALUES ($1, 'agent', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::timestamptz)
         RETURNING *`,
        [
          convId,
          agentName,
          finalBody,
          deliveryVia,
          timeLabel,
          media_type || "none",
          persistedMediaUrl,
          persistedMediaFilename,
          persistedMediaMimetype,
          initialDeliveryStatus,
          reply_to_id ? Number(reply_to_id) : null,
          reply_to_sender || "",
          reply_to_body || "",
          finalReplyMediaUrl,
          finalReplyMediaType,
          waMsgId,
          initialDeliveryStatus === "queued" ? new Date().toISOString() : null,
        ]
      );

      await db.query(
        `UPDATE omnichannel_conversations
         SET last_message_text = $1,
             last_message_time = $2,
             unread_count = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [finalBody, timeLabel, convId]
      );

      emitInboxEvent({ type: "new_message", conversationId: convId });
      return reply.status(201).send({ message: insertedMsg.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Reacción con emoji del agente a un mensaje (se envía a WhatsApp si el chat es de WhatsApp QR)
  fastify.post("/inbox/messages/:id/reaction", async (request, reply) => {
    try {
      const msgId = Number((request.params as { id: string }).id);
      const emoji = String(((request.body as any) || {}).emoji ?? "").slice(0, 16);
      const found = await db.query(
        `SELECT m.id, m.conversation_id, m.sender_type, m.wa_message_id, m.reactions_json, c.channel, c.contact_handle
         FROM omnichannel_messages m
         JOIN omnichannel_conversations c ON c.id = m.conversation_id
         WHERE m.id = $1`,
        [msgId]
      );
      if (found.rowCount === 0) {
        return reply.status(404).send({ error: "Mensaje no encontrado." });
      }
      const row = found.rows[0];

      if (row.channel === "whatsapp" && row.wa_message_id) {
        const ok = await sendWhatsAppQrReaction(
          row.contact_handle,
          row.wa_message_id,
          row.sender_type === "agent",
          emoji
        );
        if (!ok) {
          return reply.status(502).send({
            error: "No se pudo enviar la reacción a WhatsApp. Verifica que esté conectado.",
          });
        }
      }

      const next = applyReaction(row.reactions_json, "agent", emoji);
      await db.query("UPDATE omnichannel_messages SET reactions_json = $1::jsonb WHERE id = $2", [
        JSON.stringify(next),
        msgId,
      ]);
      emitInboxEvent({ type: "new_message", conversationId: row.conversation_id });
      return reply.send({ success: true, reactions: next });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Reintento manual de un mensaje que falló (o sigue en cola) hacia WhatsApp
  fastify.post("/inbox/messages/:id/retry", async (request, reply) => {
    try {
      const msgId = Number((request.params as { id: string }).id);
      const found = await db.query(
        "SELECT id, delivery_via, delivery_status, conversation_id FROM omnichannel_messages WHERE id = $1",
        [msgId]
      );
      if (found.rowCount === 0) {
        return reply.status(404).send({ error: "Mensaje no encontrado." });
      }
      const row = found.rows[0];
      if (row.delivery_via !== "wa-qr" || !["failed", "queued"].includes(row.delivery_status)) {
        return reply.status(400).send({ error: "Este mensaje no admite reintento." });
      }
      await db.query(
        "UPDATE omnichannel_messages SET delivery_status = 'queued', send_attempts = 0, queued_at = CURRENT_TIMESTAMP WHERE id = $1",
        [msgId]
      );
      if (getWhatsAppQrRuntimeState().status !== "connected") {
        startWhatsAppQrSocket(false).catch(() => {});
      }
      await processWhatsAppSendQueue();
      const updated = await db.query("SELECT * FROM omnichannel_messages WHERE id = $1", [msgId]);
      emitInboxEvent({ type: "new_message", conversationId: row.conversation_id });
      return reply.send({ message: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.get("/inbox/conversations/:id/messages", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const convId = Number(params.id);
      const listQuery = request.query as Record<string, any>;
      const listLimit = Math.min(2000, Math.max(50, Number(listQuery?.limit) || 250));
      const msgRes = await db.query(
        "SELECT * FROM (SELECT * FROM omnichannel_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2) t ORDER BY id ASC",
        [convId, listLimit]
      );
      return reply.send(msgRes.rows);
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Error al obtener mensajes de la conversación" });
    }
  });

  fastify.post("/inbox/messages/:id/forward", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const origMsgId = Number(params.id);
      const { target_conversation_ids } = (request.body as any) || {};
      if (!Array.isArray(target_conversation_ids) || target_conversation_ids.length === 0) {
        return reply.status(400).send({ error: "Debe seleccionar al menos un chat de destino." });
      }

      const origMsgRes = await db.query("SELECT * FROM omnichannel_messages WHERE id = $1", [origMsgId]);
      if (origMsgRes.rowCount === 0) {
        return reply.status(404).send({ error: "Mensaje original no encontrado." });
      }
      const origMsg = origMsgRes.rows[0];

      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const conn = connRes.rows[0] || {};
      const agentName = request.authUser?.name || "Agente";

      const now = new Date();
      const timeLabel = now.toTimeString().slice(0, 5);

      let forwardedCount = 0;
      const insertedMessages = [];

      for (const targetId of target_conversation_ids) {
        const convRes = await db.query("SELECT * FROM omnichannel_conversations WHERE id = $1", [
          Number(targetId),
        ]);
        if (convRes.rowCount === 0) continue;
        const conv = convRes.rows[0];

        let deliveryVia = "meta";
        let waMsgId = "";
        let initialDeliveryStatus = "sent";

        if (conv.channel === "whatsapp") {
          deliveryVia = conn.wa_active_mode === "api" ? "wa-api" : "wa-qr";
          if (conn.wa_active_mode !== "api") {
            try {
              const qrRes = await sendWhatsAppQrDirectMessage(
                conv.contact_handle,
                origMsg.body,
                {
                  mediaType: origMsg.media_type,
                  mediaUrl: origMsg.media_url,
                  mediaFilename: origMsg.media_filename,
                  mediaMimetype: origMsg.media_mimetype,
                },
                { isForwarded: true }
              );
              if (qrRes && qrRes.waMessageId) {
                waMsgId = qrRes.waMessageId;
              } else {
                initialDeliveryStatus = "queued";
              }
            } catch (sendErr) {
              console.error("[FORWARD-WA-ERR]", sendErr);
              initialDeliveryStatus = "queued";
            }
          }
        } else {
          initialDeliveryStatus = "read";
        }

        const inserted = await db.query(
          `INSERT INTO omnichannel_messages
           (conversation_id, sender_type, sender_name, body, delivery_via, time_label, media_type, media_url, media_filename, media_mimetype, delivery_status, is_forwarded, wa_message_id)
           VALUES ($1, 'agent', $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
           RETURNING *`,
          [
            conv.id,
            agentName,
            origMsg.body,
            deliveryVia,
            timeLabel,
            origMsg.media_type || "none",
            origMsg.media_url || "",
            origMsg.media_filename || "",
            origMsg.media_mimetype || "",
            initialDeliveryStatus,
            waMsgId,
          ]
        );
        insertedMessages.push(inserted.rows[0]);

        const snippet =
          origMsg.body || (origMsg.media_type === "image" ? "[Foto]" : `[${origMsg.media_type}]`);
        await db.query(
          `UPDATE omnichannel_conversations
           SET last_message_text = $1,
               last_message_time = $2,
               unread_count = 0,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [snippet, timeLabel, conv.id]
        );

        forwardedCount++;
      }

      return reply.send({ success: true, count: forwardedCount, messages: insertedMessages });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Error reenviando mensaje" });
    }
  });

  fastify.put("/inbox/messages/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      const { body } = (request.body as any) || {};
      const cleanBody = String(body || "").trim();
      if (!cleanBody) {
        return reply.status(400).send({ error: "El contenido del mensaje no puede estar vacío." });
      }

      const checkRes = await db.query("SELECT * FROM omnichannel_messages WHERE id = $1", [id]);
      if (checkRes.rowCount === 0) {
        return reply.status(404).send({ error: "Mensaje no encontrado." });
      }
      const orig = checkRes.rows[0];

      const updated = await db.query(
        `UPDATE omnichannel_messages
         SET body = $1,
             is_edited = true
         WHERE id = $2
         RETURNING *`,
        [cleanBody, id]
      );

      await db.query(
        `UPDATE omnichannel_conversations
         SET last_message_text = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [cleanBody, orig.conversation_id]
      );

      return reply.send({ success: true, message: updated.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Error al editar mensaje" });
    }
  });

  fastify.delete("/inbox/messages/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      const { permanent = false } = (request.body as any) || {};

      const checkRes = await db.query("SELECT * FROM omnichannel_messages WHERE id = $1", [id]);
      if (checkRes.rowCount === 0) {
        return reply.status(404).send({ error: "Mensaje no encontrado." });
      }
      const orig = checkRes.rows[0];

      if (permanent) {
        await db.query("DELETE FROM omnichannel_messages WHERE id = $1", [id]);
      } else {
        await db.query(
          `UPDATE omnichannel_messages
           SET is_deleted = true,
               body = '🚫 Este mensaje fue eliminado',
               media_type = 'none',
               media_url = '',
               media_filename = '',
               media_mimetype = ''
           WHERE id = $1`,
          [id]
        );
      }

      const lastMsgRes = await db.query(
        "SELECT body, time_label FROM omnichannel_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1",
        [orig.conversation_id]
      );
      if (lastMsgRes.rowCount && lastMsgRes.rowCount > 0) {
        const last = lastMsgRes.rows[0];
        await db.query(
          `UPDATE omnichannel_conversations
           SET last_message_text = $1,
               last_message_time = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [last.body, last.time_label, orig.conversation_id]
        );
      }

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Error al eliminar mensaje" });
    }
  });

  // ==========================================================================
  // RESPUESTAS RÁPIDAS CON SLASH ("/")
  // ==========================================================================
  fastify.post("/inbox/quick-replies", async (request, reply) => {
    try {
      const {
        shortcut,
        title,
        body,
        media_type = "none",
        media_url = "",
        media_filename = "",
        media_mimetype = "",
      } = (request.body as any) || {};

      const cleanShortcut = String(shortcut || "")
        .trim()
        .replace(/^\/+/, "")
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (!cleanShortcut || !title) {
        return reply.status(400).send({ error: "El comando (/atajo) y el título son obligatorios." });
      }

      const created = await db.query(
        `INSERT INTO quick_replies (shortcut, title, body, media_type, media_url, media_filename, media_mimetype)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          cleanShortcut,
          String(title).trim(),
          String(body || "").trim(),
          media_type || "none",
          media_url || "",
          media_filename || "",
          media_mimetype || "",
        ]
      );

      return reply.status(201).send({ quickReply: created.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/inbox/quick-replies/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      const {
        shortcut,
        title,
        body,
        media_type = "none",
        media_url = "",
        media_filename = "",
        media_mimetype = "",
      } = (request.body as any) || {};

      const cleanShortcut = String(shortcut || "")
        .trim()
        .replace(/^\/+/, "")
        .toLowerCase()
        .replace(/\s+/g, "_");

      const updated = await db.query(
        `UPDATE quick_replies
         SET shortcut = $1,
             title = $2,
             body = $3,
             media_type = $4,
             media_url = $5,
             media_filename = $6,
             media_mimetype = $7
         WHERE id = $8
         RETURNING *`,
        [
          cleanShortcut,
          String(title || "").trim(),
          String(body || "").trim(),
          media_type || "none",
          media_url || "",
          media_filename || "",
          media_mimetype || "",
          id,
        ]
      );

      return reply.send({ quickReply: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.delete("/inbox/quick-replies/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      await db.query("DELETE FROM quick_replies WHERE id = $1", [id]);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ==========================================================================
  // ETIQUETAS Y NOTAS INTERNAS
  // ==========================================================================
  fastify.post("/inbox/tags", async (request, reply) => {
    try {
      const { name, color = "#10b981", scope = "both" } = (request.body as any) || {};
      if (!name || !String(name).trim()) {
        return reply.status(400).send({ error: "El nombre de la etiqueta es obligatorio." });
      }
      const created = await db.query(
        "INSERT INTO crm_tags (name, color, scope) VALUES ($1, $2, $3) RETURNING *",
        [String(name).trim(), color, scope]
      );
      return reply.status(201).send({ tag: created.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/inbox/tags/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      const { name, color, scope } = (request.body as any) || {};
      const updated = await db.query(
        `UPDATE crm_tags
         SET name = COALESCE($1, name),
             color = COALESCE($2, color),
             scope = COALESCE($3, scope)
         WHERE id = $4
         RETURNING *`,
        [name ? String(name).trim() : null, color || null, scope || null, id]
      );
      return reply.send({ tag: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.delete("/inbox/tags/:id", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const id = Number(params.id);
      await db.query("DELETE FROM crm_tags WHERE id = $1", [id]);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/inbox/conversations/:id/tags", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const convId = Number(params.id);
      const { tags, tagIds, assigned_user_id } = (request.body as any) || {};
      const rawList = Array.isArray(tags) ? tags : Array.isArray(tagIds) ? tagIds : null;
      const updated = await db.query(
        `UPDATE omnichannel_conversations
         SET tags_json = COALESCE($1, tags_json),
             tag = COALESCE($2, tag),
             assigned_user_id = CASE WHEN $3::boolean THEN $4 ELSE assigned_user_id END
         WHERE id = $5
         RETURNING *`,
        [
          rawList ? JSON.stringify(rawList) : null,
          rawList && rawList.length > 0 ? String(rawList[0]) : null,
          assigned_user_id !== undefined,
          assigned_user_id ?? null,
          convId,
        ]
      );
      return reply.send({ conversation: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/users/:id/tags", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const userId = Number(params.id);
      const { tags, tagIds } = (request.body as any) || {};
      const rawList = Array.isArray(tags) ? tags : Array.isArray(tagIds) ? tagIds : [];

      const usersFile = path.resolve(process.cwd(), "data", "users.json");
      if (fs.existsSync(usersFile)) {
        const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
        if (Array.isArray(users)) {
          const idx = users.findIndex((u: any) => Number(u.id) === userId);
          if (idx !== -1) {
            users[idx].tags_json = JSON.stringify(rawList);
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf-8");
            return reply.send({
              user: { id: userId, full_name: users[idx].name, tags_json: users[idx].tags_json },
            });
          }
        }
      }
      return reply.send({ user: { id: userId, tags_json: JSON.stringify(rawList) } });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/conversations/:id/notes", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const convId = Number(params.id);
      const { content, color = "#f59e0b" } = (request.body as any) || {};
      if (!content || !String(content).trim()) {
        return reply.status(400).send({ error: "El contenido de la nota es obligatorio." });
      }
      const authorName = request.authUser?.name || "Agente";

      const created = await db.query(
        `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [convId, authorName, String(content).trim(), color]
      );
      return reply.status(201).send({ note: created.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.put("/inbox/notes/:noteId", async (request, reply) => {
    try {
      const params = request.params as { noteId: string };
      const noteId = Number(params.noteId);
      const { content, color } = (request.body as any) || {};
      const updated = await db.query(
        `UPDATE conversation_notes
         SET content = COALESCE($1, content),
             color = COALESCE($2, color),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [content ? String(content).trim() : null, color || null, noteId]
      );
      return reply.send({ note: updated.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.delete("/inbox/notes/:noteId", async (request, reply) => {
    try {
      const params = request.params as { noteId: string };
      const noteId = Number(params.noteId);
      await db.query("DELETE FROM conversation_notes WHERE id = $1", [noteId]);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/conversations/:id/read", async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const convId = Number(params.id);
      await db.query("UPDATE omnichannel_conversations SET unread_count = 0 WHERE id = $1", [convId]);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/simulate-incoming", async (request, reply) => {
    try {
      const { channel, customText } = (request.body as any) || {};
      const targetChannel = channel || "whatsapp";

      const convRes = await db.query(
        "SELECT * FROM omnichannel_conversations WHERE channel = $1 ORDER BY id ASC LIMIT 1",
        [targetChannel]
      );

      if (convRes.rowCount === 0) {
        return reply.status(404).send({ error: "No hay conversación para ese canal." });
      }

      const conv = convRes.rows[0];
      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const conn = connRes.rows[0] || {};

      const sampleMessages: Record<string, string> = {
        whatsapp: "Hola, acabo de escanear su catálogo en WhatsApp, ¿tienen disponibilidad inmediata?",
        facebook: "Hola desde Facebook Messenger, ¿nos pueden brindar una demostración hoy?",
        instagram: "Hola, vimos su Reel en Instagram y queremos cotizar el servicio corporativo.",
        tiktok: "Hola, venimos del perfil de TikTok, ¿cómo activamos nuestra cuenta?",
      };

      const incomingBody = customText || sampleMessages[targetChannel] || sampleMessages.whatsapp;
      const now = new Date();
      const timeLabel = now.toTimeString().slice(0, 5);

      const deliveryVia =
        targetChannel === "whatsapp"
          ? conn.wa_active_mode === "api"
            ? "wa-api"
            : "wa-qr"
          : targetChannel === "tiktok"
          ? "tiktok"
          : "meta";

      await db.query(
        `INSERT INTO omnichannel_messages (conversation_id, sender_type, sender_name, body, delivery_via, time_label)
         VALUES ($1, 'contact', $2, $3, $4, $5)`,
        [conv.id, conv.contact_name.split("•")[0].trim(), incomingBody, deliveryVia, timeLabel]
      );

      let lastText = incomingBody;
      let chatbotReplied = false;

      if (targetChannel === "whatsapp" && conn.wa_active_mode === "api" && conn.wa_chatbot_enabled) {
        const botReply =
          conn.wa_chatbot_prompt ||
          "Respuesta automática de Chatbot WhatsApp API: Hemos recibido su mensaje.";
        await db.query(
          `INSERT INTO omnichannel_messages (conversation_id, sender_type, sender_name, body, delivery_via, time_label)
           VALUES ($1, 'chatbot', 'Chatbot IA (WhatsApp API)', $2, 'wa-chatbot', $3)`,
          [conv.id, botReply, timeLabel]
        );
        lastText = `[Chatbot] ${botReply}`;
        chatbotReplied = true;
      }

      await db.query(
        `UPDATE omnichannel_conversations
         SET last_message_text = $1,
             last_message_time = $2,
             unread_count = unread_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [lastText, timeLabel, conv.id]
      );

      return reply.send({
        conversationId: conv.id,
        channel: targetChannel,
        chatbotReplied,
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  fastify.post("/inbox/whatsapp-broadcast", async (request, reply) => {
    try {
      const { messageText } = (request.body as any) || {};
      if (!messageText || !String(messageText).trim()) {
        return reply.status(400).send({ error: "Escriba el contenido del mensaje masivo." });
      }

      const connRes = await db.query("SELECT * FROM channel_connections WHERE id = 1");
      const conn = connRes.rows[0] || {};

      if (conn.wa_active_mode !== "api") {
        return reply.status(400).send({
          error:
            'Los Mensajes Masivos requieren el modo "WhatsApp Cloud API". Actualmente está en modo "Servidor QR (Solo Mensajes)". Cámbielo en Configuración -> Conexiones.',
        });
      }

      if (!conn.wa_mass_messaging_enabled) {
        return reply.status(400).send({
          error: "La función de Mensajes Masivos está deshabilitada en su configuración de WhatsApp API.",
        });
      }

      const waConvs = await db.query(
        "SELECT id FROM omnichannel_conversations WHERE channel = 'whatsapp'"
      );

      const now = new Date();
      const timeLabel = now.toTimeString().slice(0, 5);

      for (const row of waConvs.rows) {
        await db.query(
          `INSERT INTO omnichannel_messages (conversation_id, sender_type, sender_name, body, delivery_via, time_label)
           VALUES ($1, 'broadcast', 'Campaña Masiva (WhatsApp API)', $2, 'wa-broadcast', $3)`,
          [row.id, String(messageText).trim(), timeLabel]
        );
        await db.query(
          `UPDATE omnichannel_conversations
           SET last_message_text = $1,
               last_message_time = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [`[Masivo] ${String(messageText).trim()}`, timeLabel, row.id]
        );
      }

      return reply.send({ sentCount: waConvs.rowCount });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
};
