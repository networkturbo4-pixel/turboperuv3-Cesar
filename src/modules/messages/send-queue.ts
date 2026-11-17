import { omnichannelDb as db } from './omnichannel-db';
import {
  sendWhatsAppQrDirectMessage,
  getWhatsAppQrRuntimeState,
  subscribeInboxEvents,
  emitInboxEvent,
} from './whatsapp-qr-service';
import {
  captionForQueuedBody,
  isQueuedMessageExpired,
  SEND_QUEUE_MAX_ATTEMPTS,
} from './message-utils';

let processing = false;
let workerStarted = false;

/**
 * Reenvía los mensajes de WhatsApp (QR) que quedaron en cola ("queued") porque el socket estaba caído.
 * Los que superan el máximo de intentos o la antigüedad máxima pasan a "failed" (se pueden reintentar a mano).
 */
export async function processWhatsAppSendQueue(): Promise<number> {
  if (processing) return 0;
  if (getWhatsAppQrRuntimeState().status !== 'connected') return 0;
  processing = true;
  let sentCount = 0;
  try {
    const pending = await db.query(
      `SELECT m.*, c.contact_handle
       FROM omnichannel_messages m
       JOIN omnichannel_conversations c ON c.id = m.conversation_id
       WHERE m.delivery_status = 'queued' AND m.delivery_via = 'wa-qr'
       ORDER BY m.id ASC
       LIMIT 20`
    );

    for (const msg of pending.rows) {
      if (getWhatsAppQrRuntimeState().status !== 'connected') break;

      const queuedAt = new Date(msg.queued_at || msg.created_at || Date.now()).getTime();
      if (isQueuedMessageExpired(queuedAt, Date.now())) {
        await db.query("UPDATE omnichannel_messages SET delivery_status = 'failed' WHERE id = $1", [msg.id]);
        emitInboxEvent({ type: 'new_message', conversationId: msg.conversation_id });
        continue;
      }

      let quoted: { waMessageId: string; fromMe: boolean; body: string } | undefined;
      if (msg.reply_to_id) {
        const orig = await db.query(
          'SELECT wa_message_id, sender_type, body FROM omnichannel_messages WHERE id = $1 LIMIT 1',
          [Number(msg.reply_to_id)]
        );
        const o = orig.rows[0];
        if (o?.wa_message_id) {
          quoted = {
            waMessageId: String(o.wa_message_id),
            fromMe: o.sender_type === 'agent',
            body: String(o.body || msg.reply_to_body || ''),
          };
        }
      }

      const res = await sendWhatsAppQrDirectMessage(
        msg.contact_handle,
        captionForQueuedBody(msg.body, msg.media_type),
        {
          mediaType: msg.media_type,
          mediaUrl: msg.media_url,
          mediaFilename: msg.media_filename,
          mediaMimetype: msg.media_mimetype,
        },
        { isForwarded: Boolean(msg.is_forwarded), quoted }
      ).catch(() => ({ success: false as const, waMessageId: undefined }));

      if (res && res.success) {
        await db.query(
          "UPDATE omnichannel_messages SET delivery_status = 'sent', wa_message_id = $1 WHERE id = $2",
          [res.waMessageId || '', msg.id]
        );
        sentCount++;
      } else {
        const attempts = Number(msg.send_attempts || 0) + 1;
        await db.query(
          'UPDATE omnichannel_messages SET send_attempts = $1, delivery_status = $2 WHERE id = $3',
          [attempts, attempts >= SEND_QUEUE_MAX_ATTEMPTS ? 'failed' : 'queued', msg.id]
        );
      }
      emitInboxEvent({ type: 'new_message', conversationId: msg.conversation_id });
    }
  } catch (err) {
    console.warn('[SEND-QUEUE] Error procesando cola de envío:', (err as Error).message);
  } finally {
    processing = false;
  }
  return sentCount;
}

/** Inicia el worker: reintenta al reconectar WhatsApp y cada 15 segundos. Solo se llama desde start() del servidor. */
export function startWhatsAppSendQueueWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  subscribeInboxEvents((ev) => {
    if (ev.type === 'connection_status' && ev.status === 'connected') {
      setTimeout(() => void processWhatsAppSendQueue(), 1500);
    }
  });
  const timer = setInterval(() => void processWhatsAppSendQueue(), 15000);
  timer.unref?.();
}
