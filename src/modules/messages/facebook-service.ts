import { omnichannelDb as db } from './omnichannel-db';
import { emitInboxEvent } from './whatsapp-qr-service';

interface FacebookSender {
  id: string;
  name: string;
  email?: string;
}

interface FacebookMessageItem {
  id: string;
  created_time: string;
  from?: { id: string; name: string; email?: string };
  to?: { data?: FacebookSender[] };
  message?: string;
}

interface FacebookConversationItem {
  id: string;
  updated_time: string;
  unread_count?: number;
  senders?: { data?: FacebookSender[] };
  messages?: { data?: FacebookMessageItem[] };
}

function pickAvatarColor(seed: string): string {
  const colors = [
    '#2563eb', '#3b82f6', '#0284c7', '#0d9488',
    '#10b981', '#16a34a', '#8b5cf6', '#7c3aed',
    '#d97706', '#ea580c', '#e11d48', '#db2777'
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Resuelve y valida el Page Access Token. Si el usuario ingresó un User Token,
 * consulta automáticamente /me/accounts para obtener el Page Access Token correspondiente a la Fan Page.
 */
export async function resolveFacebookPageToken(
  rawToken: string,
  targetPageId?: string
): Promise<{ ok: boolean; pageToken: string; pageId: string; pageName: string; error?: string }> {
  const cleanToken = String(rawToken || '').trim();
  const cleanPageId = String(targetPageId || '').trim();

  if (!cleanToken) {
    return { ok: false, pageToken: '', pageId: '', pageName: '', error: 'Token de acceso no proporcionado.' };
  }

  try {
    // 1. Probar si el token ya es un Page Access Token funcional para leer conversaciones
    if (cleanPageId) {
      const convTestUrl = `https://graph.facebook.com/v20.0/${cleanPageId}/conversations?fields=id&limit=1&access_token=${cleanToken}`;
      const convRes = await fetch(convTestUrl);
      if (convRes.ok) {
        return {
          ok: true,
          pageToken: cleanToken,
          pageId: cleanPageId,
          pageName: 'Roma Agencia',
        };
      }
    }

    // 1. Probar si el token ya es un Page Access Token directamente
    const testUrl = `https://graph.facebook.com/v20.0/me?fields=id,name,category,tasks&access_token=${cleanToken}`;
    const testRes = await fetch(testUrl);
    const testJson = (await testRes.json()) as any;

    if (testRes.ok && testJson?.id) {
      // Si el nodo de Meta tiene 'category' o 'tasks', es definitivamente una Fan Page (no un usuario)
      // O si el ID devuelto coincide con cleanPageId o si cleanPageId está vacío
      const isDefinitelyPage = Boolean(testJson.category || testJson.tasks);
      const isTargetMatch = Boolean(
        !cleanPageId ||
        cleanPageId === testJson.id ||
        (cleanPageId.startsWith('@') && cleanPageId.slice(1).toLowerCase() === String(testJson.name || '').toLowerCase().replace(/\s+/g, ''))
      );

      if (isDefinitelyPage || isTargetMatch) {
        return {
          ok: true,
          pageToken: cleanToken,
          pageId: testJson.id,
          pageName: testJson.name || 'Página de Facebook',
        };
      }
    }

    // 2. Si no es directamente un Page Token o no estamos seguros, consultar /me/accounts para buscar Fan Pages administradas
    const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,category&limit=50&access_token=${cleanToken}`;
    const accRes = await fetch(accountsUrl);
    const accJson = (await accRes.json()) as any;

    if (!accRes.ok) {
      const errMsg = accJson?.error?.message || '';
      // Si el error indica que no existe el campo 'accounts', significa que el token ingresado ERA un Page Token
      if (
        accJson?.error?.code === 100 ||
        errMsg.toLowerCase().includes('accounts') ||
        errMsg.toLowerCase().includes('nonexisting field')
      ) {
        if (testJson?.id) {
          return {
            ok: true,
            pageToken: cleanToken,
            pageId: testJson.id,
            pageName: testJson.name || 'Página de Facebook',
          };
        }
      }
      return { ok: false, pageToken: '', pageId: '', pageName: '', error: errMsg || 'No se pudieron listar las páginas con este token de Meta.' };
    }

    if (!accJson?.data || !Array.isArray(accJson.data)) {
      if (testJson?.id) {
        return {
          ok: true,
          pageToken: cleanToken,
          pageId: testJson.id,
          pageName: testJson.name || 'Página de Facebook',
        };
      }
      return { ok: false, pageToken: '', pageId: '', pageName: '', error: 'No se pudieron listar las páginas con este token de Meta.' };
    }

    const pages = accJson.data;
    if (pages.length === 0) {
      return { ok: false, pageToken: '', pageId: '', pageName: '', error: 'Este token de usuario no administra ninguna página de Facebook.' };
    }

    // Buscar la página por ID o por coincidencia de nombre
    let matchedPage = pages.find((p: any) => p.id === cleanPageId);
    if (!matchedPage && cleanPageId) {
      const normTarget = cleanPageId.toLowerCase().replace(/[^a-z0-9]/g, '');
      matchedPage = pages.find((p: any) => {
        const normName = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normName.includes(normTarget) || normTarget.includes(normName);
      });
    }

    // Si aún no coincide, usar la primera página si solo tiene una
    if (!matchedPage && pages.length === 1) {
      matchedPage = pages[0];
    } else if (!matchedPage) {
      matchedPage = pages.find((p: any) => p.name?.toLowerCase().includes('roma')) || pages[0];
    }

    if (!matchedPage || !matchedPage.access_token) {
      return {
        ok: false,
        pageToken: '',
        pageId: '',
        pageName: '',
        error: `No se encontró la página con ID "${cleanPageId}". Páginas disponibles: ${pages.map((p: any) => p.name).join(', ')}`,
      };
    }

    return {
      ok: true,
      pageToken: matchedPage.access_token,
      pageId: matchedPage.id,
      pageName: matchedPage.name || 'Página de Facebook',
    };
  } catch (err) {
    return { ok: false, pageToken: '', pageId: '', pageName: '', error: (err as Error).message };
  }
}

/**
 * Sincroniza conversaciones reales y mensajes desde la API Graph de Facebook
 */
export async function syncFacebookConversations(
  pageId: string,
  pageToken: string,
  tenantId = 'turbonetwork'
): Promise<{ success: boolean; conversationsCount: number; messagesCount: number; error?: string }> {
  try {
    if (!pageId || !pageToken) {
      return { success: false, conversationsCount: 0, messagesCount: 0, error: 'Credenciales de Facebook incompletas.' };
    }

    const url = `https://graph.facebook.com/v20.0/${pageId}/conversations?fields=id,updated_time,unread_count,senders,messages.limit(20){id,created_time,from,to,message}&limit=30&access_token=${pageToken}`;
    const res = await fetch(url);
    const json = (await res.json()) as any;

    if (!res.ok || !json?.data || !Array.isArray(json.data)) {
      const msg = json?.error?.message || 'Error al obtener conversaciones de Facebook Messenger.';
      return { success: false, conversationsCount: 0, messagesCount: 0, error: msg };
    }

    const conversations = json.data as FacebookConversationItem[];
    let convSaved = 0;
    let msgSaved = 0;

    for (const item of conversations) {
      const customer =
        item.senders?.data?.find((s) => s.id !== pageId) ||
        item.senders?.data?.[0];

      const contactHandle = customer?.id || item.id;
      const contactName = customer?.name || 'Usuario de Facebook';
      const messages = Array.isArray(item.messages?.data) ? item.messages!.data : [];

      // Último mensaje
      const latestMsg = messages[0];
      const lastMessageText = latestMsg?.message || 'Conversación iniciada en Facebook';
      const updatedDate = new Date(item.updated_time || Date.now());
      const timeLabel = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Upsert conversación en omnichannel_conversations
      const existingConv = await db.query(
        `SELECT id FROM omnichannel_conversations WHERE tenant_id = $1 AND channel = 'facebook' AND contact_handle = $2 LIMIT 1`,
        [tenantId, contactHandle]
      );

      let convId: number;
      const isNewConv = !(existingConv.rowCount && existingConv.rowCount > 0);
      if (!isNewConv) {
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
           (tenant_id, channel, contact_name, contact_handle, avatar_color, unread_count, estimated_value, tag, last_message_text, last_message_time, updated_at)
           VALUES ($1, 'facebook', $2, $3, $4, $5, 0, 'Facebook Messenger', $6, $7, $8)
           RETURNING id`,
          [
            tenantId,
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

      // 2. Guardar mensajes de la conversación (en orden cronológico)
      const sortedMessages = [...messages].reverse();
      for (const m of sortedMessages) {
        const text = String(m.message || '').trim();
        if (!text) continue; // ignorar mensajes vacíos o eventos de sistema

        const isFromPage = m.from?.id === pageId;
        const senderType = isFromPage ? 'agent' : 'contact';
        const senderName = isFromPage ? 'Roma Agencia' : contactName;
        const msgDate = new Date(m.created_time || Date.now());
        const msgTimeLabel = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Evitar duplicados por contenido y fecha
        const dupCheck = await db.query(
          `SELECT id FROM omnichannel_messages
           WHERE conversation_id = $1 AND body = $2 AND time_label = $3 LIMIT 1`,
          [convId, text, msgTimeLabel]
        );

        if ((dupCheck.rowCount ?? 0) === 0) {
          const insMsg = await db.query<{ id: number }>(
            `INSERT INTO omnichannel_messages
             (conversation_id, sender_type, sender_name, body, delivery_via, time_label, created_at)
             VALUES ($1, $2, $3, $4, 'meta', $5, $6)
             RETURNING id`,
            [convId, senderType, senderName, text, msgTimeLabel, msgDate.toISOString()]
          );
          msgSaved++;
          if (!isNewConv && senderType === 'contact' && insMsg.rows?.[0]?.id) {
            const ageMs = Date.now() - msgDate.getTime();
            if (ageMs < 5 * 60 * 1000) {
              emitInboxEvent({
                type: 'inbound_message',
                tenantId,
                conversationId: convId,
                messageId: insMsg.rows[0].id,
                channel: 'facebook',
              });
            }
          }
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
 * Enviar mensaje saliente a través de la API oficial de Facebook Messenger
 */
export async function sendFacebookMessage(
  pageToken: string,
  recipientId: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!pageToken || !recipientId || !text) {
      return { success: false, error: 'Parámetros incompletos para Facebook Messenger.' };
    }

    const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${pageToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: 'RESPONSE',
      }),
    });

    const json = (await res.json()) as any;
    if (!res.ok) {
      const errMsg = json?.error?.message || `Error Facebook HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true, messageId: json.message_id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
