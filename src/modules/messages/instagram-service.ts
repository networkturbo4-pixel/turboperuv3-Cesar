import { omnichannelDb as db } from './omnichannel-db';

interface InstagramParticipant {
  id: string;
  username?: string;
  name?: string;
}

interface InstagramMessageItem {
  id: string;
  created_time: string;
  from?: InstagramParticipant;
  to?: { data?: InstagramParticipant[] };
  message?: string;
}

interface InstagramConversationItem {
  id: string;
  updated_time: string;
  unread_count?: number;
  participants?: { data?: InstagramParticipant[] };
  messages?: { data?: InstagramMessageItem[] };
}

function pickAvatarColor(seed: string): string {
  const colors = [
    '#e1306c', '#c13584', '#833ab4', '#fd1d1d',
    '#f56040', '#f77737', '#fcaf45', '#5851db',
    '#405de6', '#ec4899', '#db2777', '#9333ea'
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Sincroniza conversaciones reales y mensajes directos desde Instagram Graph API
 */
export async function syncInstagramConversations(
  igAccountId: string,
  igToken: string,
  pageId?: string,
  pageToken?: string
): Promise<{ success: boolean; conversationsCount: number; messagesCount: number; error?: string }> {
  try {
    const cleanIgId = String(igAccountId || '').trim();
    const cleanToken = String(igToken || '').trim();
    const cleanPageId = String(pageId || '').trim();
    const cleanPageToken = String(pageToken || cleanToken).trim();

    if (!cleanIgId || !cleanToken) {
      return {
        success: false,
        conversationsCount: 0,
        messagesCount: 0,
        error: 'Credenciales de Instagram incompletas (ID o Token vacío).',
      };
    }

    let conversations: InstagramConversationItem[] = [];
    let fetchError = '';

    // Intento 1: Consultar directamente el endpoint del usuario de Instagram Business
    try {
      const url1 = `https://graph.facebook.com/v20.0/${cleanIgId}/conversations?fields=id,updated_time,unread_count,participants,messages.limit(25){id,created_time,from,to,message}&limit=50&access_token=${cleanToken}`;
      const res1 = await fetch(url1);
      const json1 = (await res1.json()) as any;
      if (res1.ok && Array.isArray(json1?.data)) {
        conversations = json1.data;
      } else if (json1?.error?.message) {
        fetchError = json1.error.message;
      }
    } catch (e) {
      fetchError = (e as Error).message;
    }

    // Intento 2: Si está vacío o falló y tenemos Page ID, consultar vía la Fan Page asociada con platform=instagram
    if (conversations.length === 0 && cleanPageId) {
      try {
        const url2 = `https://graph.facebook.com/v20.0/${cleanPageId}/conversations?platform=instagram&fields=id,updated_time,unread_count,participants,messages.limit(25){id,created_time,from,to,message}&limit=50&access_token=${cleanPageToken}`;
        const res2 = await fetch(url2);
        const json2 = (await res2.json()) as any;
        if (res2.ok && Array.isArray(json2?.data)) {
          conversations = json2.data;
        } else if (!fetchError && json2?.error?.message) {
          fetchError = json2.error.message;
        }
      } catch (e) {
        if (!fetchError) fetchError = (e as Error).message;
      }
    }

    // Intento 3: Si aún está vacío, probar con el pageToken en el endpoint de la cuenta de Instagram
    if (conversations.length === 0 && cleanPageToken && cleanPageToken !== cleanToken) {
      try {
        const url3 = `https://graph.facebook.com/v20.0/${cleanIgId}/conversations?fields=id,updated_time,unread_count,participants,messages.limit(25){id,created_time,from,to,message}&limit=50&access_token=${cleanPageToken}`;
        const res3 = await fetch(url3);
        const json3 = (await res3.json()) as any;
        if (res3.ok && Array.isArray(json3?.data)) {
          conversations = json3.data;
        }
      } catch {
        // ignore
      }
    }

    if (conversations.length === 0) {
      return {
        success: true,
        conversationsCount: 0,
        messagesCount: 0,
        error: fetchError || undefined,
      };
    }

    let convSaved = 0;
    let msgSaved = 0;

    for (const item of conversations) {
      const participants = item.participants?.data || [];
      const customer =
        participants.find((p) => p.id !== cleanIgId && p.id !== cleanPageId) ||
        participants[0];

      const contactHandle = customer?.id || item.id;
      const contactUsername = customer?.username ? `@${customer.username.replace(/^@/, '')}` : '';
      const contactName = customer?.name || contactUsername || 'Usuario de Instagram';
      const messages = Array.isArray(item.messages?.data) ? item.messages!.data : [];

      const latestMsg = messages[0];
      const lastMessageText = latestMsg?.message || 'Conversación iniciada en Instagram Direct';
      const updatedDate = new Date(item.updated_time || Date.now());
      const timeLabel = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Upsert conversación
      const existingConv = await db.query(
        `SELECT id FROM omnichannel_conversations WHERE channel = 'instagram' AND contact_handle = $1 LIMIT 1`,
        [contactHandle]
      );

      let convId: number;
      if (existingConv.rowCount && existingConv.rowCount > 0) {
        convId = existingConv.rows[0].id;
        await db.query(
          `UPDATE omnichannel_conversations
           SET contact_name = $1,
               last_message_text = $2,
               last_message_time = $3,
               unread_count = $4,
               updated_at = $5
           WHERE id = $6`,
          [
            contactName,
            lastMessageText,
            timeLabel,
            Number(item.unread_count || 0),
            updatedDate.toISOString(),
            convId,
          ]
        );
      } else {
        const color = pickAvatarColor(contactHandle + contactName);
        const ins = await db.query(
          `INSERT INTO omnichannel_conversations
           (channel, contact_name, contact_handle, avatar_color, unread_count, estimated_value, tag, last_message_text, last_message_time, updated_at)
           VALUES ('instagram', $1, $2, $3, $4, 0, 'Instagram Direct', $5, $6, $7)
           RETURNING id`,
          [
            contactName,
            contactHandle,
            color,
            Number(item.unread_count || 0),
            lastMessageText,
            timeLabel,
            updatedDate.toISOString(),
          ]
        );
        convId = ins.rows[0].id;
        convSaved++;
      }

      // 2. Guardar mensajes de la conversación
      const sortedMessages = [...messages].reverse();
      for (const m of sortedMessages) {
        const text = String(m.message || '').trim();
        if (!text) continue;

        const isFromPage = m.from?.id === cleanIgId || m.from?.id === cleanPageId;
        const senderType = isFromPage ? 'agent' : 'contact';
        const senderName = isFromPage ? 'Roma Agencia' : contactName;
        const msgDate = new Date(m.created_time || Date.now());
        const msgTimeLabel = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const dupCheck = await db.query(
          `SELECT id FROM omnichannel_messages
           WHERE conversation_id = $1 AND body = $2 AND time_label = $3 LIMIT 1`,
          [convId, text, msgTimeLabel]
        );

        if ((dupCheck.rowCount ?? 0) === 0) {
          await db.query(
            `INSERT INTO omnichannel_messages
             (conversation_id, sender_type, sender_name, body, delivery_via, time_label, created_at)
             VALUES ($1, $2, $3, $4, 'meta', $5, $6)`,
            [convId, senderType, senderName, text, msgTimeLabel, msgDate.toISOString()]
          );
          msgSaved++;
        }
      }
    }

    return {
      success: true,
      conversationsCount: convSaved,
      messagesCount: msgSaved,
    };
  } catch (err) {
    return {
      success: false,
      conversationsCount: 0,
      messagesCount: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * Envía un mensaje directo a un usuario de Instagram mediante Meta Graph API
 */
export async function sendInstagramMessage(
  token: string,
  recipientId: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanToken = String(token || '').trim();
    const cleanRecipient = String(recipientId || '').trim();
    const cleanText = String(text || '').trim();

    if (!cleanToken || !cleanRecipient || !cleanText) {
      return { success: false, error: 'Parámetros incompletos para enviar mensaje a Instagram.' };
    }

    const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${cleanToken}`;
    const payload = {
      recipient: { id: cleanRecipient },
      message: { text: cleanText },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as any;
    if (!res.ok || json?.error) {
      const errMsg = json?.error?.message || 'Error desconocido al enviar a Instagram Direct.';
      return { success: false, error: errMsg };
    }

    return { success: true, messageId: json.message_id || json.recipient_id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
