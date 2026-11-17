import { omnichannelDb as db } from "../messages/omnichannel-db";
import {
  emitInboxEvent,
  getWhatsAppQrRuntimeState,
  sendWhatsAppQrDirectMessage,
} from "../messages/whatsapp-qr-service";
import { sendFacebookMessage } from "../messages/facebook-service";
import { sendInstagramMessage } from "../messages/instagram-service";
import { BotContext } from "./bot.types";

function computeHumanDelayMs(text: string): number {
  const len = (text || "").length;
  return Math.min(2600, Math.max(700, 600 + len * 8));
}

export class BotOutbox {
  /**
   * Envía un mensaje automático del bot al canal correspondiente, lo persiste en
   * omnichannel_messages y emite el evento en tiempo real al inbox.
   */
  async reply(
    ctx: BotContext,
    botName: string,
    text: string,
    options?: { skipHumanDelay?: boolean }
  ): Promise<{ messageId: number; deliveryStatus: string }> {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      throw new Error("El mensaje del bot está vacío");
    }

    if (!options?.skipHumanDelay) {
      const delay = computeHumanDelayMs(cleanText);
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    const now = new Date();
    const timeLabel = now.toTimeString().slice(0, 5);
    const channel = ctx.conversation.channel;
    const handle = ctx.conversation.contactHandle;
    const senderLabel = `${botName} (Bot)`;

    let deliveryVia = "bot";
    let deliveryStatus = "sent";
    let waMessageId = "";

    if (channel === "whatsapp") {
      deliveryVia = "wa-qr";
      const waState = getWhatsAppQrRuntimeState();
      if (waState.status === "connected") {
        const res = await sendWhatsAppQrDirectMessage(handle, cleanText).catch(() => ({
          success: false as const,
          waMessageId: undefined,
        }));
        if (res && res.success) {
          waMessageId = res.waMessageId || "";
          deliveryStatus = "sent";
        } else {
          deliveryStatus = "queued";
        }
      } else {
        deliveryStatus = "queued";
      }
    } else if (channel === "facebook") {
      deliveryVia = "meta";
      const conn = await db.getOrCreateChannelConnection(ctx.tenantId);
      if (conn.fb_connected && conn.fb_access_token) {
        const res = await sendFacebookMessage(conn.fb_access_token, handle, cleanText).catch(() => ({
          success: false,
        }));
        deliveryStatus = res.success ? "sent" : "failed";
      } else {
        deliveryStatus = "failed";
      }
    } else if (channel === "instagram") {
      deliveryVia = "meta";
      const conn = await db.getOrCreateChannelConnection(ctx.tenantId);
      const token = conn.ig_access_token || conn.fb_access_token;
      if (conn.ig_connected && token) {
        const res = await sendInstagramMessage(token, handle, cleanText).catch(() => ({
          success: false,
        }));
        deliveryStatus = res.success ? "sent" : "failed";
      } else {
        deliveryStatus = "failed";
      }
    }

    const ins = await db.query<{ id: number }>(
      `INSERT INTO omnichannel_messages
       (conversation_id, sender_type, sender_name, body, delivery_via, time_label, wa_message_id, delivery_status, queued_at)
       VALUES ($1, 'bot', $2, $3, $4, $5, $6, $7, $8::timestamptz)
       RETURNING id`,
      [
        ctx.conversation.id,
        senderLabel,
        cleanText,
        deliveryVia,
        timeLabel,
        waMessageId,
        deliveryStatus,
        deliveryStatus === "queued" ? now.toISOString() : null,
      ]
    );

    await db.query(
      `UPDATE omnichannel_conversations
       SET last_message_text = $1,
           last_message_time = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [`[${botName}] ${cleanText}`, timeLabel, ctx.conversation.id]
    );

    emitInboxEvent({
      type: "new_message",
      tenantId: ctx.tenantId,
      conversationId: ctx.conversation.id,
      waMessageId: waMessageId || undefined,
    });

    return {
      messageId: Number(ins.rows[0]?.id || 0),
      deliveryStatus,
    };
  }
}

export const botOutbox = new BotOutbox();
