import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import QRCode from 'qrcode';
import pino from 'pino';
import { omnichannelDb as db } from './omnichannel-db';
import { normalizeChannelHandle } from './handle-utils';
import { deliveryStatusFromBaileys, applyReaction } from './message-utils';

export interface InboxRealtimeEvent {
  type: 'new_message' | 'inbound_message' | 'message_status' | 'sync_update' | 'connection_status';
  tenantId?: string;
  conversationId?: number;
  messageId?: number;
  channel?: string;
  waMessageId?: string;
  status?: string;
}

const inboxRealtimeListeners = new Set<(event: InboxRealtimeEvent) => void>();

export function subscribeInboxEvents(listener: (event: InboxRealtimeEvent) => void): () => void {
  inboxRealtimeListeners.add(listener);
  return () => {
    inboxRealtimeListeners.delete(listener);
  };
}

export function emitInboxEvent(event: InboxRealtimeEvent): void {
  for (const listener of inboxRealtimeListeners) {
    try {
      listener(event);
    } catch {
      // Ignorar errores de suscriptores cerrados
    }
  }
}

const convUpsertLocks = new Map<string, Promise<number>>();
let reconnectAttempts = 0;

const execPromise = promisify(exec);

// Ruta al binario ffmpeg empaquetado para conversión directa de notas de voz
let ffmpegBinaryPath: string | null = null;
try {
  ffmpegBinaryPath = require('ffmpeg-static');
} catch {
  // Ignorar si no está instalado
}

async function convertAudioBufferToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
  // Si ya es un contenedor OggS nativo (bytes: 0x4F, 0x67, 0x67, 0x53), retornar directo
  if (
    inputBuffer.length > 4 &&
    inputBuffer[0] === 0x4f &&
    inputBuffer[1] === 0x67 &&
    inputBuffer[2] === 0x67 &&
    inputBuffer[3] === 0x53
  ) {
    return inputBuffer;
  }

  if (!ffmpegBinaryPath) {
    return inputBuffer;
  }

  const tmpIn = path.join(
    os.tmpdir(),
    `wa_audio_in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`
  );
  const tmpOut = path.join(
    os.tmpdir(),
    `wa_audio_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`
  );

  try {
    await fs.promises.writeFile(tmpIn, inputBuffer);
    const cmd = `"${ffmpegBinaryPath}" -i "${tmpIn}" -c:a libopus -b:a 32k -vbr on -compression_level 10 -application voip -y "${tmpOut}"`;
    await execPromise(cmd);
    const converted = await fs.promises.readFile(tmpOut);
    return converted;
  } catch (err) {
    console.error('[WA-QR] Error convirtiendo audio a Ogg Opus con FFmpeg:', err);
    return inputBuffer;
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {});
    fs.promises.unlink(tmpOut).catch(() => {});
  }
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

const AUTH_DIR = path.join(process.cwd(), 'data', 'whatsapp-qr-session');
const CREDS_FILE = path.join(AUTH_DIR, 'creds.json');
const CREDS_BACKUP_FILE = path.join(AUTH_DIR, 'creds.backup.json');

let activeSocket: any = null;
let currentQrDataUrl: string | null = null;
let currentStatus: 'connected' | 'awaiting_scan' | 'disconnected' = 'awaiting_scan';
let connectedPhone: string | null = null;
let connectedDeviceName: string | null = null;
let isStarting = false;
let socketGenerationId = 0;
let cachedWaVersion: [number, number, number] | null = null;
let qrWaiters: Array<(qr: string | null) => void> = [];

interface KnownContact {
  id?: string;
  lid?: string;
  name?: string;
  notify?: string;
  verifiedName?: string;
  phoneNumber?: string;
}

const contactsByLid = new Map<string, KnownContact>();
const contactsByPn = new Map<string, KnownContact>();
const jidByHandle = new Map<string, string>();
const diskMappedPns = new Set<string>();
const crmSentWaMessageIds = new Set<string>();

const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

let baileysDownloadMediaMessage: any = null;

async function downloadAndPersistMedia(
  msg: any,
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker'
): Promise<{ mediaUrl: string; mimetype: string; filename?: string } | null> {
  if (!baileysDownloadMediaMessage) return null;
  try {
    let buffer: any = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3 && !buffer; attempt++) {
      try {
        buffer = await baileysDownloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            logger: pino({ level: 'silent' }) as any,
            reuploadRequest: activeSocket?.updateMediaMessage,
          }
        );
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    if (!buffer && lastErr) throw lastErr;

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    const m = msg.message;
    let ext = 'bin';
    let mime = 'application/octet-stream';
    let filename = '';

    if (mediaType === 'image') {
      mime = m?.imageMessage?.mimetype || 'image/jpeg';
      ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      filename = `foto_${Date.now()}.${ext}`;
    } else if (mediaType === 'sticker') {
      mime = m?.stickerMessage?.mimetype || 'image/webp';
      ext = 'webp';
      filename = `sticker_${Date.now()}.webp`;
    } else if (mediaType === 'audio') {
      mime = m?.audioMessage?.mimetype || 'audio/ogg';
      ext = 'ogg';
      filename = `audio_${Date.now()}.${ext}`;
    } else if (mediaType === 'video') {
      mime = m?.videoMessage?.mimetype || 'video/mp4';
      ext = 'mp4';
      filename = `video_${Date.now()}.${ext}`;
    } else if (mediaType === 'document') {
      mime = m?.documentMessage?.mimetype || 'application/pdf';
      const orig = m?.documentMessage?.fileName || 'documento';
      filename = orig;
      const dot = orig.lastIndexOf('.');
      ext = dot !== -1 ? orig.substring(dot + 1).toLowerCase() : 'pdf';
    }

    const cleanWaId = (msg.key?.id || String(Date.now())).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `wa_${mediaType}_${cleanWaId}.${ext}`;
    const targetPath = path.join(MEDIA_DIR, safeFilename);
    fs.writeFileSync(targetPath, buffer);

    return {
      mediaUrl: `/media/${safeFilename}`,
      mimetype: mime,
      filename,
    };
  } catch (err: any) {
    console.warn('[WA-QR] Fallo descarga '+mediaType+' ('+(msg?.key?.id||'?')+'):', err?.message||err);
    return null;
  }
}

const AVATAR_PALETTE = [
  '#10b981',
  '#059669',
  '#0ea5e9',
  '#4f46e5',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#14b8a6',
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function notifyQrWaiters(qr: string | null) {
  const list = [...qrWaiters];
  qrWaiters = [];
  for (const resolve of list) {
    resolve(qr);
  }
}

function clearAuthDirectory() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[WA-QR] Error limpiando carpeta de sesion:', err);
  }
}

function clearAppStateVersionFilesOnly() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    for (const file of fs.readdirSync(AUTH_DIR)) {
      if (file.startsWith('app-state-sync-version-')) {
        fs.unlinkSync(path.join(AUTH_DIR, file));
      }
    }
  } catch (err) {
    console.error('[WA-QR] Error limpiando versiones de app-state:', err);
  }
}

function ensureCredsIntegrity(): boolean {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const raw = fs.readFileSync(CREDS_FILE, 'utf-8').trim();
      if (raw.length > 50) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.me && parsed.me.id) {
          fs.writeFileSync(CREDS_BACKUP_FILE, raw, 'utf-8');
          return true;
        }
      }
    }
    if (fs.existsSync(CREDS_BACKUP_FILE)) {
      const backupRaw = fs.readFileSync(CREDS_BACKUP_FILE, 'utf-8').trim();
      if (backupRaw.length > 50) {
        fs.writeFileSync(CREDS_FILE, backupRaw, 'utf-8');
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function formatPrettyPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.startsWith('51') && clean.length === 11) {
    return `+51 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return `+${clean}`;
}

function formatJidToPhone(jid?: string | null): string {
  if (!jid) return '';
  const clean = jid.split(':')[0].split('@')[0].replace(/\D/g, '');
  if (!clean) return '';
  return `+${clean}`;
}

function formatUnixTimestampLabel(tsSeconds?: number | string | null): {
  label: string;
  isoDate: Date;
} {
  const sec = Number(tsSeconds || 0);
  const date = sec > 100000000 ? new Date(sec * 1000) : new Date();
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return { label: date.toTimeString().slice(0, 5), isoDate: date };
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return { label: 'Ayer', isoDate: date };
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return { label: `${dd}/${mm}`, isoDate: date };
}

function loadLidMappingsFromDisk() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    for (const file of files) {
      if (file.startsWith('lid-mapping-') && file.endsWith('_reverse.json')) {
        const lidDigits = file.replace('lid-mapping-', '').replace('_reverse.json', '');
        const lidJid = `${lidDigits}@lid`;
        const pnDigits = String(
          JSON.parse(fs.readFileSync(path.join(AUTH_DIR, file), 'utf-8'))
        ).replace(/\D/g, '');
        if (pnDigits) {
          diskMappedPns.add(pnDigits);
          const existing = contactsByLid.get(lidJid) || {};
          existing.lid = lidJid;
          existing.phoneNumber = `${pnDigits}@s.whatsapp.net`;
          contactsByLid.set(lidJid, existing);

          const byPn = contactsByPn.get(pnDigits) || {};
          byPn.lid = lidJid;
          byPn.phoneNumber = `${pnDigits}@s.whatsapp.net`;
          contactsByPn.set(pnDigits, byPn);
        }
      }
    }
  } catch (err) {
    console.error('[WA-QR] Error leyendo lid-mapping desde disco:', err);
  }
}

function registerContactsInMemory(contacts: any[]) {
  if (!Array.isArray(contacts)) return;
  for (const c of contacts) {
    if (!c) continue;
    const lid: string | undefined =
      c.lid || (typeof c.id === 'string' && c.id.endsWith('@lid') ? c.id : undefined);
    const pnJid: string | undefined =
      c.phoneNumber ||
      (typeof c.id === 'string' && c.id.endsWith('@s.whatsapp.net') ? c.id : undefined);
    const pnDigits = pnJid ? pnJid.split(':')[0].split('@')[0].replace(/\D/g, '') : '';

    const prevLid = lid ? contactsByLid.get(lid) : undefined;
    const prevPn = pnDigits ? contactsByPn.get(pnDigits) : undefined;

    const merged: KnownContact = {
      ...prevLid,
      ...prevPn,
      id: c.id || pnJid || prevPn?.id,
      lid: lid || prevPn?.lid,
      name:
        c.name ||
        c.verifiedName ||
        c.notify ||
        prevLid?.name ||
        prevPn?.name,
      notify: c.notify || prevLid?.notify || prevPn?.notify,
      verifiedName: c.verifiedName || prevLid?.verifiedName || prevPn?.verifiedName,
      phoneNumber: pnJid || prevLid?.phoneNumber || prevPn?.phoneNumber,
    };

    if (merged.lid) {
      contactsByLid.set(merged.lid, merged);
    }
    if (pnDigits) {
      contactsByPn.set(pnDigits, merged);
    }
  }
}

// ===== Estado de sincronización de historial (para el indicador de progreso en el CRM) =====
const syncState = {
  active: false,
  chats: 0,
  totalMessages: 0,
  processedMessages: 0,
  startedAt: 0,
};
let syncIdleTimer: NodeJS.Timeout | null = null;
let historyQueue: Promise<void> = Promise.resolve();

function touchSync(idleMs = 10000) {
  if (!syncState.active) {
    syncState.active = true;
    syncState.chats = 0;
    syncState.totalMessages = 0;
    syncState.processedMessages = 0;
    syncState.startedAt = Date.now();
  }
  if (syncIdleTimer) clearTimeout(syncIdleTimer);
  syncIdleTimer = setTimeout(() => {
    historyQueue
      .then(() => {
        syncState.active = false;
      })
      .catch(() => {
        syncState.active = false;
      });
  }, idleMs);
}

export function getWhatsAppSyncState() {
  return {
    active: syncState.active,
    chats: syncState.chats,
    totalMessages: syncState.totalMessages,
    processedMessages: syncState.processedMessages,
    elapsedMs: syncState.active ? Date.now() - syncState.startedAt : 0,
  };
}
function registerLidPnMappings(mappings: any[] | undefined) {
  if (!Array.isArray(mappings)) return;
  for (const m of mappings) {
    const lidRaw: string = m?.lid || '';
    const pnRaw: string = m?.pn || '';
    if (!lidRaw || !pnRaw) continue;
    const lidJid = `${lidRaw.split(':')[0].split('@')[0]}@lid`;
    const pnDigits = pnRaw.split(':')[0].split('@')[0].replace(/\D/g, '');
    if (!pnDigits) continue;
    const byLid = contactsByLid.get(lidJid) || {};
    byLid.lid = lidJid;
    byLid.phoneNumber = `${pnDigits}@s.whatsapp.net`;
    contactsByLid.set(lidJid, byLid);
    const byPn = contactsByPn.get(pnDigits) || {};
    byPn.lid = lidJid;
    byPn.phoneNumber = `${pnDigits}@s.whatsapp.net`;
    contactsByPn.set(pnDigits, byPn);
  }
}

// Convierte conversaciones guardadas con handle @lid a su número real (o fusiona con la existente)
async function reconcileLidConversations() {
  try {
    const res = await db.query<{ id: number; contact_handle: string; contact_name: string }>(
      "SELECT id, contact_handle, contact_name FROM omnichannel_conversations WHERE channel = 'whatsapp' AND contact_handle LIKE '%@lid'"
    );
    for (const row of res.rows) {
      const identity = resolveJidIdentity(row.contact_handle);
      if (!identity.handle.startsWith('+')) continue;
      const dup = await db.query<{ id: number }>(
        "SELECT id FROM omnichannel_conversations WHERE channel = 'whatsapp' AND contact_handle = $1 LIMIT 1",
        [identity.handle]
      );
      const rawName = row.contact_name.endsWith('@lid') ? '' : row.contact_name;
      const name = rawName || identity.displayName;
      if ((dup.rowCount ?? 0) > 0) {
        const targetId = dup.rows[0].id;
        await db.query('UPDATE omnichannel_messages SET conversation_id = $1 WHERE conversation_id = $2', [targetId, row.id]);
        await db.query('DELETE FROM omnichannel_conversations WHERE id = $1', [row.id]);
      } else {
        await db.query(
          'UPDATE omnichannel_conversations SET contact_handle = $1, contact_name = $2 WHERE id = $3',
          [identity.handle, name, row.id]
        );
      }
    }
  } catch (err) {
    console.error('[WA-QR] Error reconciliando chats @lid:', err);
  }
}
function resolveJidIdentity(
  rawJid: string,
  altJid?: string,
  pushName?: string
): {
  handle: string;
  displayName: string;
  targetJid: string;
  isGroup: boolean;
} {
  const isGroup = rawJid.endsWith('@g.us');
  if (isGroup) {
    const groupHandle = rawJid;
    jidByHandle.set(groupHandle, rawJid);
    return {
      handle: groupHandle,
      displayName: pushName || `Grupo WhatsApp`,
      targetJid: rawJid,
      isGroup: true,
    };
  }

  let lid = rawJid.endsWith('@lid') ? rawJid.split(':')[0] : '';
  if (lid && !lid.endsWith('@lid')) lid = `${lid}@lid`;

  let pnDigits = '';
  if (rawJid.endsWith('@s.whatsapp.net')) {
    pnDigits = rawJid.split(':')[0].split('@')[0].replace(/\D/g, '');
  } else if (altJid && altJid.endsWith('@s.whatsapp.net')) {
    pnDigits = altJid.split(':')[0].split('@')[0].replace(/\D/g, '');
  }

  if (!pnDigits && lid) {
    const fromMem = contactsByLid.get(lid);
    if (fromMem?.phoneNumber) {
      pnDigits = fromMem.phoneNumber.split(':')[0].split('@')[0].replace(/\D/g, '');
    } else {
      const lidNum = lid.split('@')[0];
      const revFile = path.join(AUTH_DIR, `lid-mapping-${lidNum}_reverse.json`);
      if (fs.existsSync(revFile)) {
        try {
          pnDigits = String(JSON.parse(fs.readFileSync(revFile, 'utf-8'))).replace(/\D/g, '');
        } catch {
          // ignore
        }
      }
    }
  }

  const contact =
    (lid ? contactsByLid.get(lid) : undefined) ||
    (pnDigits ? contactsByPn.get(pnDigits) : undefined);

  if (!pnDigits && contact?.id?.endsWith('@s.whatsapp.net')) {
    pnDigits = contact.id.split(':')[0].split('@')[0].replace(/\D/g, '');
  }

  const handle = pnDigits ? `+${pnDigits}` : lid || rawJid;
  const targetJid = pnDigits ? `${pnDigits}@s.whatsapp.net` : rawJid;
  jidByHandle.set(handle, targetJid);

  const savedName =
    contact?.name ||
    contact?.notify ||
    contact?.verifiedName ||
    pushName;

  const displayName =
    savedName || (pnDigits ? formatPrettyPhone(pnDigits) : handle);

  return {
    handle,
    displayName,
    targetJid,
    isGroup: false,
  };
}

async function upsertConversationInDb(params: {
  handle: string;
  displayName: string;
  lastMessageText: string;
  timeLabel: string;
  updatedAt?: Date;
  unreadIncrement?: number;
  tag?: string;
}): Promise<number> {
  const normalizedHandle = normalizeChannelHandle('whatsapp', params.handle);
  const normalizedParams = { ...params, handle: normalizedHandle };
  const lockKey = `whatsapp:${normalizedHandle}`;
  const prev = convUpsertLocks.get(lockKey) || Promise.resolve(0);
  const next = prev.catch(() => 0).then(() => upsertConversationInDbUnlocked(normalizedParams));
  convUpsertLocks.set(lockKey, next);
  try {
    return await next;
  } finally {
    if (convUpsertLocks.get(lockKey) === next) {
      convUpsertLocks.delete(lockKey);
    }
  }
}

async function upsertConversationInDbUnlocked(params: {
  handle: string;
  displayName: string;
  lastMessageText: string;
  timeLabel: string;
  updatedAt?: Date;
  unreadIncrement?: number;
  tag?: string;
  tenantId?: string;
}): Promise<number> {
  const {
    handle,
    displayName,
    lastMessageText,
    timeLabel,
    updatedAt = new Date(),
    unreadIncrement = 0,
    tag = 'WhatsApp Directo',
    tenantId = 'turbonetwork',
  } = params;

  const existing = await db.query<{
    id: number;
    contact_name: string;
    last_message_text: string;
  }>(
    `SELECT id, contact_name, last_message_text
     FROM omnichannel_conversations
     WHERE tenant_id = $1 AND channel = 'whatsapp' AND contact_handle = $2
     LIMIT 1`,
    [tenantId, handle]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const row = existing.rows[0];
    const isCurrentGeneric =
      row.contact_name.startsWith('+') || row.contact_name.endsWith('@lid');
    const isNewNamed =
      displayName &&
      !displayName.startsWith('+') &&
      !displayName.endsWith('@lid');

    const nextName = isNewNamed || isCurrentGeneric ? displayName : row.contact_name;
    const nextText =
      lastMessageText &&
      !lastMessageText.startsWith('Conversación sincronizada') &&
      !lastMessageText.startsWith('Contacto de WhatsApp')
        ? lastMessageText
        : row.last_message_text || lastMessageText;

    await db.query(
      `UPDATE omnichannel_conversations
       SET contact_name = $1,
           last_message_text = $2,
           last_message_time = $3,
           unread_count = GREATEST(0, unread_count + $4),
           updated_at = $5
       WHERE id = $6`,
      [
        nextName,
        nextText,
        timeLabel,
        unreadIncrement,
        updatedAt.toISOString(),
        row.id,
      ]
    );
    return row.id;
  }

  const color = pickAvatarColor(handle + displayName);
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO omnichannel_conversations
     (tenant_id, channel, contact_name, contact_handle, avatar_color, unread_count, estimated_value, tag, last_message_text, last_message_time, updated_at)
     VALUES ($1, 'whatsapp', $2, $3, $4, $5, 0, $6, $7, $8, $9)
     RETURNING id`,
    [
      tenantId,
      displayName || handle,
      handle,
      color,
      Math.max(0, unreadIncrement),
      tag,
      lastMessageText || 'Conversación sincronizada con WhatsApp Web',
      timeLabel,
      updatedAt.toISOString(),
    ]
  );

  const insertedId = inserted.rows?.[0]?.id;
  if (!insertedId) {
    const fallback = await db.query<{ id: number }>(
      `SELECT id FROM omnichannel_conversations WHERE tenant_id = $1 AND channel = 'whatsapp' AND contact_handle = $2 LIMIT 1`,
      [tenantId, handle]
    );
    return fallback.rows?.[0]?.id || 0;
  }
  return insertedId;
}

async function ensureSeedMessageIfEmpty(
  convId: number,
  senderName: string,
  bodyText: string,
  timeLabel: string
) {
  const msgCount = await db.query(
    'SELECT COUNT(*) as cnt FROM omnichannel_messages WHERE conversation_id = $1',
    [convId]
  );
  if (Number(msgCount.rows[0]?.cnt ?? 0) === 0) {
    await db.query(
      `INSERT INTO omnichannel_messages (conversation_id, sender_type, sender_name, body, delivery_via, time_label)
       VALUES ($1, 'contact', $2, $3, 'wa-qr', $4)`,
      [convId, senderName, bodyText, timeLabel]
    );
  }
}

export async function syncRecentChatsFromSessionDiskAndContacts(sock?: any) {
  try {
    loadLidMappingsFromDisk();
    const mePhone = connectedPhone?.replace(/\D/g, '') || '';

    // Limpiar contactos falsos del directorio telefónico que no son conversaciones activas
    await db.query("DELETE FROM omnichannel_conversations WHERE last_message_text LIKE 'Contacto de WhatsApp%'").catch(() => {});
    await db.query("UPDATE omnichannel_messages SET body = '' WHERE media_type = 'audio' AND body = '[Audio enviado]'").catch(() => {});

    await reconcileLidConversations();

    if (sock?.groupFetchAllParticipating) {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const entries = Object.values(groups || {}) as any[];
        for (const g of entries) {
          if (!g?.id || !String(g.id).endsWith('@g.us')) continue;
          const { label, isoDate } = formatUnixTimestampLabel(g.creation || Math.floor(Date.now() / 1000));
          await upsertConversationInDb({
            handle: g.id,
            displayName: g.subject || 'Grupo WhatsApp',
            lastMessageText: 'Grupo de WhatsApp sincronizado',
            timeLabel: label,
            updatedAt: isoDate,
            unreadIncrement: 0,
            tag: 'Grupo WhatsApp',
          });
        }
        if (entries.length > 0) emitInboxEvent({ type: 'sync_update' });
      } catch {
        // Ignorar si la sesión aún no está lista para listar grupos
      }
    }

    // Los chats se sincronizan únicamente desde los eventos reales de WhatsApp (messaging-history.set, chats.upsert, messages.upsert).
    // No se inyectan chats de ejemplo ni se infieren desde archivos de sesión o grupos sin conversación.
  } catch (err) {
    console.error('[WA-QR] Error sincronizando chats recientes:', err);
  }
}

async function processIncomingOrHistoryMessages(messages: any[], isHistorySync = false) {
  if (!Array.isArray(messages)) return;

  let existingWaIds: Set<string> | null = null;
  if (isHistorySync && messages.length > 5) {
    try {
      const idsRes = await db.query<{ wa_message_id: string }>(
        "SELECT wa_message_id FROM omnichannel_messages WHERE wa_message_id <> ''"
      );
      existingWaIds = new Set(idsRes.rows.map((r) => r.wa_message_id));
    } catch {
      existingWaIds = null;
    }
    await db.query(
      "DELETE FROM omnichannel_messages WHERE body LIKE 'Chat activo de WhatsApp%' OR body LIKE 'Conversación de WhatsApp con%'"
    ).catch(() => {});
  }

  for (const msg of messages) {
    syncState.processedMessages++;
    if (syncState.processedMessages % 25 === 0) {
      if (isHistorySync) emitInboxEvent({ type: 'sync_update' });
      await new Promise<void>((r) => setImmediate(r));
    }
    try {
      const waMsgId: string = msg?.key?.id || '';
      if (waMsgId && crmSentWaMessageIds.has(waMsgId)) {
        continue;
      }

      const remoteJid: string = msg?.message?.deviceSentMessage?.destinationJid || msg?.key?.remoteJid || '';
      if (
        !remoteJid ||
        remoteJid === 'status@broadcast' ||
        remoteJid.endsWith('@newsletter') ||
        remoteJid.endsWith('@broadcast')
      ) {
        continue;
      }

      let m = msg.message;
      if (m) {
        while (
          m?.deviceSentMessage?.message ||
          m?.ephemeralMessage?.message ||
          m?.viewOnceMessage?.message ||
          m?.viewOnceMessageV2?.message ||
          m?.viewOnceMessageV2Extension?.message ||
          m?.documentWithCaptionMessage?.message ||
          m?.editedMessage?.message?.protocolMessage?.editedMessage
        ) {
          m =
            m.deviceSentMessage?.message ||
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message ||
            m.editedMessage?.message?.protocolMessage?.editedMessage;
        }
      }
      if (!m) continue;

      // Reacción con emoji a un mensaje existente (no crea un mensaje nuevo en la bandeja)
      if (m.reactionMessage) {
        const targetWaId: string = m.reactionMessage.key?.id || '';
        if (targetWaId) {
          const by: 'agent' | 'contact' = msg.key?.fromMe ? 'agent' : 'contact';
          const cur = await db.query('SELECT id, conversation_id, reactions_json FROM omnichannel_messages WHERE wa_message_id = $1 LIMIT 1', [targetWaId]);
          const row = cur.rows[0];
          if (row) {
            const next = applyReaction(row.reactions_json, by, m.reactionMessage.text || '');
            await db.query('UPDATE omnichannel_messages SET reactions_json = $1::jsonb WHERE id = $2', [JSON.stringify(next), row.id]);
            emitInboxEvent({ type: 'new_message', conversationId: row.conversation_id });
          }
        }
        continue;
      }

      let mediaType: 'none' | 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'none';
      let mediaFilename = '';
      let mediaMimetype = '';
      let mediaUrl = '';

      if (m.imageMessage) {
        mediaType = 'image';
        mediaMimetype = m.imageMessage.mimetype || 'image/jpeg';
      } else if (m.stickerMessage) {
        mediaType = 'sticker';
        mediaMimetype = m.stickerMessage.mimetype || 'image/webp';
        mediaFilename = 'sticker.webp';
      } else if (m.videoMessage) {
        mediaType = 'video';
        mediaMimetype = m.videoMessage.mimetype || 'video/mp4';
      } else if (m.audioMessage) {
        mediaType = 'audio';
        mediaMimetype = m.audioMessage.mimetype || 'audio/ogg';
      } else if (m.documentMessage) {
        mediaType = 'document';
        mediaFilename = m.documentMessage.fileName || 'Documento';
        mediaMimetype = m.documentMessage.mimetype || 'application/pdf';
      }

      // Descargar media real de WhatsApp para guardarlo localmente en /media
      if (mediaType !== 'none' && !isHistorySync) {
        const dl = await downloadAndPersistMedia(msg, mediaType);
        if (dl) {
          mediaUrl = dl.mediaUrl;
          if (dl.mimetype) mediaMimetype = dl.mimetype;
          if (dl.filename && !mediaFilename) mediaFilename = dl.filename;
        }
      }

      const textBody =
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        (m.imageMessage ? '📷 Foto' : '') ||
        (m.audioMessage ? '🎙️ Nota de voz' : '') ||
        (m.videoMessage ? '🎥 Video' : '') ||
        (m.documentMessage ? `📄 Documento: ${m.documentMessage.fileName || 'Archivo'}` : '') ||
        (m.buttonsResponseMessage?.selectedDisplayText || '') ||
        (m.listResponseMessage?.title || '') ||
        (m.templateButtonReplyMessage?.selectedDisplayText || '') ||
        (m.stickerMessage ? '🏷️ Sticker' : '');

      if (!textBody || !String(textBody).trim()) continue;

      if (waMsgId) {
        const dup = await db.query(
          'SELECT id FROM omnichannel_messages WHERE wa_message_id = $1 LIMIT 1',
          [waMsgId]
        );
        if ((dup.rowCount ?? 0) > 0) continue;
      }

      const isFromMe = Boolean(msg.key?.fromMe);
      const altJid: string | undefined = msg.key?.remoteJidAlt || msg.key?.participantAlt;
      const identity = resolveJidIdentity(
        remoteJid,
        altJid,
        !isFromMe ? msg.pushName : undefined
      );

      const { label, isoDate } = formatUnixTimestampLabel(msg.messageTimestamp);

      const convId = await upsertConversationInDb({
        handle: identity.handle,
        displayName: identity.displayName,
        lastMessageText: String(textBody).trim(),
        timeLabel: label,
        updatedAt: isoDate,
        unreadIncrement: isFromMe ? 0 : 1,
        tag: identity.isGroup ? 'Grupo WhatsApp' : 'WhatsApp Directo',
      });

      await db.query(
        `DELETE FROM omnichannel_messages
         WHERE conversation_id = $1
           AND (body LIKE 'Chat activo de WhatsApp%' OR body LIKE 'Conversación de WhatsApp con%')`,
        [convId]
      );

      const insertedMsg = await db.query<{ id: number }>(
        `INSERT INTO omnichannel_messages
         (conversation_id, sender_type, sender_name, body, delivery_via, time_label, media_type, media_url, media_filename, media_mimetype, wa_message_id, created_at)
         VALUES ($1, $2, $3, $4, 'wa-qr', $5, $6, $7, $8, $9, $10, $11::timestamptz)
         RETURNING id`,
        [
          convId,
          isFromMe ? 'agent' : 'contact',
          isFromMe ? connectedDeviceName || 'WhatsApp Vinculado' : msg.pushName || identity.displayName,
          String(textBody).trim(),
          label,
          mediaType,
          mediaUrl,
          mediaFilename,
          mediaMimetype,
          waMsgId,
          isoDate instanceof Date ? isoDate.toISOString() : new Date().toISOString(),
        ]
      );
      if (isHistorySync && mediaType !== 'none' && !mediaUrl && insertedMsg.rows?.[0]?.id) {
        const msgRowId = insertedMsg.rows[0].id;
        void downloadAndPersistMedia(msg, mediaType).then(async (dl) => {
          if (dl?.mediaUrl) {
            await db.query(
              `UPDATE omnichannel_messages SET media_url = $1, media_mimetype = COALESCE(NULLIF($2, ''), media_mimetype), media_filename = COALESCE(NULLIF($3, ''), media_filename) WHERE id = $4`,
              [dl.mediaUrl, dl.mimetype || '', dl.filename || '', msgRowId]
            ).catch(() => {});
            emitInboxEvent({ type: 'new_message', conversationId: convId, waMessageId: waMsgId });
          }
        }).catch(() => {});
      }
      if (!isHistorySync) {
        emitInboxEvent({ type: 'new_message', tenantId: 'turbonetwork', conversationId: convId, waMessageId: waMsgId });
        if (!isFromMe && !identity.isGroup && insertedMsg.rows?.[0]?.id) {
          emitInboxEvent({
            type: 'inbound_message',
            tenantId: 'turbonetwork',
            conversationId: convId,
            messageId: insertedMsg.rows[0].id,
            channel: 'whatsapp',
          });
        }
      }
    } catch (err) {
      console.error('[WA-QR] Error guardando mensaje de WhatsApp:', err);
    }
  }
}

async function syncStateToDb(
  status: 'connected' | 'awaiting_scan' | 'disconnected',
  sessionCode: string,
  phone?: string | null,
  device?: string | null,
  tenantId = 'turbonetwork'
) {
  try {
    await db.getOrCreateChannelConnection(tenantId);
    await db.query(
      `UPDATE channel_connections SET
        wa_qr_status = $1,
        wa_qr_session_code = $2,
        wa_qr_phone = COALESCE($3, wa_qr_phone),
        wa_qr_device = COALESCE($4, wa_qr_device),
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $5`,
      [status, sessionCode, phone || null, device || null, tenantId]
    );
  } catch (err) {
    console.error('[WA-QR] Error sincronizando estado en DB:', err);
  }
}

export function getWhatsAppQrRuntimeState() {
  return {
    status: currentStatus,
    qrDataUrl: currentQrDataUrl,
    phone: connectedPhone,
    device: connectedDeviceName,
  };
}

export async function startWhatsAppQrSocket(forceReset = false): Promise<void> {
  if (isStarting && !forceReset) return;
  isStarting = true;
  const myGenId = ++socketGenerationId;

  try {
    if (activeSocket) {
      try {
        activeSocket.ev?.removeAllListeners?.('connection.update');
        activeSocket.ev?.removeAllListeners?.('creds.update');
        activeSocket.ev?.removeAllListeners?.('messages.upsert');
        activeSocket.ev?.removeAllListeners?.('messaging-history.set');
        activeSocket.ev?.removeAllListeners?.('contacts.upsert');
        activeSocket.ev?.removeAllListeners?.('contacts.update');
        activeSocket.ev?.removeAllListeners?.('chats.upsert');
        activeSocket.ev?.removeAllListeners?.('chats.update');
        activeSocket.end?.(undefined);
      } catch {
        // Ignore cleanup errors
      }
      activeSocket = null;
    }

    if (forceReset) {
      clearAuthDirectory();
      currentQrDataUrl = null;
      currentStatus = 'awaiting_scan';
      await db.query("DELETE FROM omnichannel_conversations WHERE channel = 'whatsapp'").catch(() => {});
    } else {
      ensureCredsIntegrity();
    }

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    loadLidMappingsFromDisk();

    const baileys = await dynamicImport('@whiskeysockets/baileys');
    const {
      makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestWaWebVersion,
      fetchLatestBaileysVersion,
      Browsers,
      downloadMediaMessage,
      makeCacheableSignalKeyStore,
      DEFAULT_CONNECTION_CONFIG,
    } = baileys;
    baileysDownloadMediaMessage = downloadMediaMessage;

    if (!cachedWaVersion) {
      try {
        const waWeb = await fetchLatestWaWebVersion();
        if (waWeb?.version) {
          cachedWaVersion = waWeb.version;
        }
      } catch {
        // Try fallback
      }
      if (!cachedWaVersion) {
        try {
          const latest = await fetchLatestBaileysVersion();
          if (latest?.version) {
            cachedWaVersion = latest.version;
          }
        } catch {
          // Fallback version if offline
        }
      }
    }

    const version: [number, number, number] = cachedWaVersion || [2, 3000, 1051891131];

    if (myGenId !== socketGenerationId) {
      return;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const silentLogger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version: cachedWaVersion || DEFAULT_CONNECTION_CONFIG?.version || version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore
          ? makeCacheableSignalKeyStore(state.keys, silentLogger)
          : state.keys,
      },
      logger: silentLogger,
      printQRInTerminal: false,
      browser: Browsers?.ubuntu ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04.4'],
      syncFullHistory: true,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 350,
      connectTimeoutMs: 30000,
      getMessage: async (key: any) => {
        if (!key?.id) return undefined;
        try {
          const res = await db.query<{ body: string }>(
            'SELECT body FROM omnichannel_messages WHERE wa_message_id = $1 LIMIT 1',
            [key.id]
          );
          if (res.rows?.[0]?.body) {
            return { conversation: res.rows[0].body };
          }
        } catch {
          // ignore
        }
        return undefined;
      },
    });

    activeSocket = sock;

    sock.ev.on('creds.update', async () => {
      if (myGenId !== socketGenerationId) return;
      await saveCreds();
      ensureCredsIntegrity();
    });

    sock.ev.on('contacts.upsert', async (contacts: any[]) => {
      registerContactsInMemory(contacts);
      await syncRecentChatsFromSessionDiskAndContacts(sock);
    });

    sock.ev.on('lid-mapping.update', async (mapping: any) => {
      registerLidPnMappings([mapping]);
      await reconcileLidConversations();
    });

    sock.ev.on('contacts.update', async (contacts: any[]) => {
      registerContactsInMemory(contacts);
    });

    sock.ev.on('messaging-history.set', (history: any) => {
      touchSync();
      syncState.totalMessages += Array.isArray(history?.messages) ? history.messages.length : 0;
      syncState.chats += Array.isArray(history?.chats) ? history.chats.length : 0;
      historyQueue = historyQueue.then(async () => {
      console.log(`[WA-QR] Historial recibido: ${history?.chats?.length || 0} chats, ${history?.contacts?.length || 0} contactos, ${history?.messages?.length || 0} mensajes (tipo ${history?.syncType ?? 'n/a'})`);
      registerLidPnMappings(history?.lidPnMappings);
      if (history?.contacts) {
        registerContactsInMemory(history.contacts);
      }
      if (history?.chats && Array.isArray(history.chats)) {
        for (const chat of history.chats) {
          if (!chat?.id || chat.id === 'status@broadcast' || chat.id.endsWith('@newsletter') || chat.id.startsWith('0@')) {
            continue;
          }
          const identity = resolveJidIdentity(chat.id, chat.pnJid || undefined, chat.name || chat.subject);
          const rawTs = chat.conversationTimestamp || chat.lastMessageRecvTimestamp || Math.floor(Date.now() / 1000);
          const { label, isoDate } = formatUnixTimestampLabel(rawTs);
          const histConvId = await upsertConversationInDb({
            handle: identity.handle,
            displayName: chat.name || chat.subject || identity.displayName,
            lastMessageText: 'Chat sincronizado desde WhatsApp',
            timeLabel: label,
            updatedAt: isoDate,
            unreadIncrement: 0,
            tag: identity.isGroup ? 'Grupo WhatsApp' : 'WhatsApp Directo',
          });
          await db.query('UPDATE omnichannel_conversations SET unread_count = $1 WHERE id = $2', [Math.max(0, Number(chat.unreadCount || 0)), histConvId]).catch(() => {});
        }
      }
      if (history?.messages && Array.isArray(history.messages)) {
        await processIncomingOrHistoryMessages(history.messages, true);
      }
      await reconcileLidConversations();
      touchSync();
      emitInboxEvent({ type: 'sync_update' });
      }).catch((err) => console.error('[WA-QR] Error procesando historial:', err));
    });

    sock.ev.on('chats.upsert', async (chats: any[]) => {
      if (!Array.isArray(chats)) return;
      for (const chat of chats) {
        if (!chat?.id || chat.id === 'status@broadcast' || chat.id.endsWith('@newsletter') || chat.id.startsWith('0@')) continue;
        const identity = resolveJidIdentity(chat.id, chat.pnJid || undefined, chat.name || chat.subject);
        const rawTs = chat.conversationTimestamp || chat.lastMessageRecvTimestamp || Math.floor(Date.now() / 1000);
        const { label, isoDate } = formatUnixTimestampLabel(rawTs);
        await upsertConversationInDb({
          handle: identity.handle,
          displayName: chat.name || chat.subject || identity.displayName,
          lastMessageText: 'Chat activo en WhatsApp',
          timeLabel: label,
          updatedAt: isoDate,
          unreadIncrement: Number(chat.unreadCount || 0),
        });
      }
    });

    sock.ev.on('connection.update', async (update: any) => {
      if (myGenId !== socketGenerationId) return;
      const { connection, lastDisconnect, qr } = update;
      if (connection) console.log(`[WA-QR] connection.update: ${connection}${connection === 'close' ? ' -> ' + ((lastDisconnect?.error as any)?.message || 'sin detalle') + ' (code ' + ((lastDisconnect?.error as any)?.output?.statusCode ?? 'n/a') + ')' : ''}`);
      if (qr) console.log('[WA-QR] QR recibido de WhatsApp');

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 280,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          currentQrDataUrl = qrDataUrl;
          currentStatus = 'awaiting_scan';
          await syncStateToDb('awaiting_scan', qrDataUrl);
          emitInboxEvent({ type: 'connection_status', status: 'awaiting_scan' });
          notifyQrWaiters(qrDataUrl);
        } catch (qrErr) {
          console.error('[WA-QR] Error generando imagen QR:', qrErr);
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        currentQrDataUrl = null;
        currentStatus = 'connected';
        const userJid = sock.user?.id || state.creds?.me?.id || '';
        const userName = sock.user?.name || state.creds?.me?.name || 'WhatsApp Vinculado';
        const formattedPhone = formatJidToPhone(userJid) || '+51 987 654 321';
        const deviceLabel = `WhatsApp Web (${userName})`;

        connectedPhone = formattedPhone;
        connectedDeviceName = deviceLabel;

        ensureCredsIntegrity();
        await syncStateToDb(
          'connected',
          `WA-LINKED-${formattedPhone}`,
          formattedPhone,
          deviceLabel
        );
        touchSync(25000);
        notifyQrWaiters(null);
        emitInboxEvent({ type: 'connection_status', status: 'connected' });
        console.log(`[WA-QR] Sesion de WhatsApp vinculada exitosamente: ${formattedPhone} (${userName})`);

        // Sincronizar contactos agendados, chats activos y grupos de la cuenta vinculada
        setTimeout(async () => {
          try {
            await sock.resyncAppState(
              ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'],
              true
            );
          } catch (resyncErr) {
            console.error('[WA-QR] Error en resyncAppState:', resyncErr);
          }
          await syncRecentChatsFromSessionDiskAndContacts(sock);
        }, 500);
      }

      if (connection === 'close') {
        const statusCode =
          (lastDisconnect?.error as any)?.output?.statusCode ||
          (lastDisconnect?.error as any)?.data?.statusCode;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        if (isLoggedOut) {
          console.log('[WA-QR] Sesion cerrada desde el dispositivo movil o panel. Generando nuevo QR...');
          clearAuthDirectory();
          currentQrDataUrl = null;
          currentStatus = 'awaiting_scan';
          await syncStateToDb('awaiting_scan', 'GENERATING_NEW_QR', '', '');
          await db.query("DELETE FROM omnichannel_conversations WHERE channel = 'whatsapp'").catch(() => {});
          isStarting = false;
          setTimeout(() => {
            startWhatsAppQrSocket(true).catch(() => {});
          }, 1200);
        } else {
          isStarting = false;
          const delayMs = Math.min(15000, Math.round(1000 * Math.pow(1.7, reconnectAttempts++)));
          emitInboxEvent({ type: 'connection_status', status: 'reconnecting' });
          setTimeout(() => {
            startWhatsAppQrSocket(false).catch(() => {});
          }, delayMs);
        }
      }
    });

    sock.ev.on('messages.upsert', async (event: any) => {
      if (!event?.messages) return;
      console.log(`[WA-QR] messages.upsert (${event.type || 'notify'}): ${event.messages.length} mensaje(s)`);
      await processIncomingOrHistoryMessages(event.messages);
    });

    // Actualización de estado de entrega de WhatsApp (1 check sent, 2 check gray delivered, 2 check blue read)
    sock.ev.on('messages.update', async (updates: any[]) => {
      if (!Array.isArray(updates)) return;
      for (const update of updates) {
        const id = update.key?.id;
        const status = update.update?.status;
        if (!id || status === undefined) continue;
        const deliveryStatus = deliveryStatusFromBaileys(status);
        await db.query(
          `UPDATE omnichannel_messages SET delivery_status = $1::text
           WHERE wa_message_id = $2
             AND (CASE delivery_status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 WHEN 'queued' THEN 1 ELSE 0 END)
               < (CASE $1::text WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 ELSE 0 END)`,
          [deliveryStatus, id]
        ).catch(() => {});
        emitInboxEvent({ type: 'message_status', waMessageId: id, status: deliveryStatus });
      }
    });
  } catch (err) {
    console.error('[WA-QR] Error iniciando motor Baileys WhatsApp:', err);
  } finally {
    if (myGenId === socketGenerationId) {
      isStarting = false;
    }
  }
}

export async function generateNewWhatsAppQrSession(): Promise<{
  status: string;
  qrDataUrl: string | null;
}> {
  const waitPromise = new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(currentQrDataUrl), 6000);
    qrWaiters.push((qr) => {
      clearTimeout(timer);
      resolve(qr);
    });
  });

  await startWhatsAppQrSocket(true);
  const qr = await waitPromise;
  return {
    status: currentStatus,
    qrDataUrl: qr || currentQrDataUrl,
  };
}

export async function disconnectWhatsAppQrSession(): Promise<void> {
  try {
    if (activeSocket) {
      try {
        await activeSocket.logout();
      } catch {
        // Ignore logout errors if already closed
      }
      try {
        activeSocket.end?.(undefined);
      } catch {
        // Ignore end errors
      }
      activeSocket = null;
    }
  } finally {
    clearAuthDirectory();
    currentQrDataUrl = null;
    currentStatus = 'disconnected';
    connectedPhone = null;
    connectedDeviceName = null;
    await syncStateToDb('disconnected', 'DISCONNECTED', '', '');
    await db.query("DELETE FROM omnichannel_conversations WHERE channel = 'whatsapp'").catch(() => {});
  }
}

export interface WhatsAppMediaAttachment {
  mediaType?: 'none' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mediaUrl?: string;
  mediaFilename?: string;
  mediaMimetype?: string;
}

function parseDataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } | null {
  try {
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:')) {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      const meta = dataUrl.slice(5, commaIdx);
      const rawData = dataUrl.slice(commaIdx + 1);
      const isBase64 = meta.includes(';base64');
      const mime = meta.split(';')[0] || 'application/octet-stream';
      const buffer = isBase64
        ? Buffer.from(rawData, 'base64')
        : Buffer.from(decodeURIComponent(rawData), 'utf-8');
      return { buffer, mime };
    }
    // Soporte para archivos multimedia locales previamente guardados en /media/ (para reenviar stickers, fotos, audios)
    if (dataUrl.startsWith('/media/') || dataUrl.startsWith('media/')) {
      const cleanName = path.basename(dataUrl);
      const localPath = path.join(MEDIA_DIR, cleanName);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(cleanName).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.ogg' || ext === '.opus') mime = 'audio/ogg';
        else if (ext === '.mp4') mime = 'video/mp4';
        else if (ext === '.pdf') mime = 'application/pdf';
        else if (ext === '.webm') mime = 'audio/webm';
        else if (ext === '.mp3') mime = 'audio/mpeg';
        else if (ext === '.m4a') mime = 'audio/mp4';
        else if (ext === '.wav') mime = 'audio/wav';
        else if (ext === '.mov') mime = 'video/quicktime';
        else if (ext === '.gif') mime = 'image/gif';
        return { buffer, mime };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendWhatsAppQrDirectMessage(
  contactHandle: string,
  textBody: string,
  media?: WhatsAppMediaAttachment,
  options?: {
    isForwarded?: boolean;
    quoted?: { waMessageId: string; fromMe: boolean; body: string };
  }
): Promise<{ success: boolean; waMessageId?: string }> {
  if ((!activeSocket || currentStatus !== 'connected') && ensureCredsIntegrity()) {
    startWhatsAppQrSocket(false).catch(() => {});
    for (let i = 0; i < 20; i++) {
      if (activeSocket && currentStatus === 'connected') break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!activeSocket || currentStatus !== 'connected') {
    return { success: false };
  }
  try {
    const canonicalHandle = normalizeChannelHandle('whatsapp', contactHandle);
    let jid = jidByHandle.get(canonicalHandle) || jidByHandle.get(contactHandle) || '';
    if (!jid) {
      if (
        contactHandle.endsWith('@g.us') ||
        contactHandle.endsWith('@lid') ||
        contactHandle.endsWith('@s.whatsapp.net')
      ) {
        jid = contactHandle;
      } else {
        const digits = contactHandle.replace(/\D/g, '');
        if (digits.length < 8) return { success: false };
        jid = `${digits}@s.whatsapp.net`;
      }
    }

    const mediaType = media?.mediaType || 'none';
    const mediaUrl = media?.mediaUrl || '';
    const parsedMedia = mediaType !== 'none' && mediaUrl ? parseDataUrlToBuffer(mediaUrl) : null;
    const quotedMsg = options?.quoted?.waMessageId
      ? {
          key: { remoteJid: jid, fromMe: options.quoted.fromMe, id: options.quoted.waMessageId },
          message: { conversation: options.quoted.body || '' },
        }
      : undefined;
    const sendToJid = (content: any) =>
      activeSocket!.sendMessage(jid, content, quotedMsg ? ({ quoted: quotedMsg } as any) : undefined);
    const contextInfo = options?.isForwarded ? { forwardingScore: 1, isForwarded: true } : undefined;

    let sentResult: any = null;

    if (parsedMedia && mediaType === 'sticker') {
      sentResult = await sendToJid({
        sticker: parsedMedia.buffer,
        contextInfo,
      });
    } else if (parsedMedia && mediaType === 'image' && !parsedMedia.mime.includes('svg')) {
      sentResult = await sendToJid({
        image: parsedMedia.buffer,
        caption: textBody || undefined,
        mimetype: media?.mediaMimetype || parsedMedia.mime || 'image/jpeg',
        contextInfo,
      });
    } else if (parsedMedia && mediaType === 'video') {
      sentResult = await sendToJid({
        video: parsedMedia.buffer,
        caption: textBody || undefined,
        mimetype: media?.mediaMimetype || parsedMedia.mime || 'video/mp4',
        contextInfo,
      });
    } else if (parsedMedia && mediaType === 'audio') {
      const oggOpusBuffer = await convertAudioBufferToOggOpus(parsedMedia.buffer);
      sentResult = await sendToJid({
        audio: oggOpusBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        contextInfo,
      });
      if (sentResult?.key?.id) {
        crmSentWaMessageIds.add(sentResult.key.id);
      }
      if (textBody && textBody.trim()) {
        const txtRes = await sendToJid({ text: textBody });
        if (txtRes?.key?.id) crmSentWaMessageIds.add(txtRes.key.id);
      }
      return { success: true, waMessageId: sentResult?.key?.id || '' };
    } else if (parsedMedia && (mediaType === 'document' || parsedMedia.mime.includes('svg'))) {
      sentResult = await sendToJid({
        document: parsedMedia.buffer,
        fileName: media?.mediaFilename || 'Documento',
        mimetype: media?.mediaMimetype || parsedMedia.mime || 'application/pdf',
        caption: textBody || undefined,
        contextInfo,
      });
    } else {
      sentResult = await sendToJid({ text: textBody, contextInfo });
    }

    const waMsgId = sentResult?.key?.id || '';
    if (waMsgId) {
      crmSentWaMessageIds.add(waMsgId);
    }
    return { success: true, waMessageId: waMsgId };
  } catch (err) {
    console.error('[WA-QR] No se pudo enviar mensaje real por socket QR:', err);
    return { success: false };
  }
}

/** Envía (o quita, con emoji vacío) una reacción a un mensaje de WhatsApp ya enviado/recibido. */
export async function sendWhatsAppQrReaction(
  contactHandle: string,
  waMessageId: string,
  fromMe: boolean,
  emoji: string
): Promise<boolean> {
  if (!activeSocket || currentStatus !== 'connected' || !waMessageId) return false;
  try {
    const canonicalHandle = normalizeChannelHandle('whatsapp', contactHandle);
    let jid = jidByHandle.get(canonicalHandle) || jidByHandle.get(contactHandle) || '';
    if (!jid) {
      if (contactHandle.endsWith('@g.us') || contactHandle.endsWith('@lid') || contactHandle.endsWith('@s.whatsapp.net')) {
        jid = contactHandle;
      } else {
        const digits = contactHandle.replace(/\D/g, '');
        if (digits.length < 8) return false;
        jid = `${digits}@s.whatsapp.net`;
      }
    }
    await activeSocket.sendMessage(jid, {
      react: { text: emoji || '', key: { remoteJid: jid, fromMe, id: waMessageId } },
    });
    return true;
  } catch (err) {
    console.warn('[WA-QR] No se pudo enviar reacción:', (err as Error).message);
    return false;
  }
}
export async function triggerManualWhatsAppFullSync(): Promise<{
  synced: boolean;
  totalConversations: number;
  message?: string;
}> {
  try {
    touchSync(3000);
    if (activeSocket && currentStatus === 'connected') {
      // Mantener app-state-sync-version intacto para evitar corrupción LTHash en Baileys v7
      try {
        await activeSocket.resyncAppState(
          ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'],
          true
        );
      } catch {
        // Ignore partial resync warnings
      }
      await syncRecentChatsFromSessionDiskAndContacts(activeSocket);
    } else {
      await syncRecentChatsFromSessionDiskAndContacts(null);
    }
    if (syncState.totalMessages === 0 && syncState.chats === 0) { syncState.active = false; if (syncIdleTimer) { clearTimeout(syncIdleTimer); syncIdleTimer = null; } }
    const countRes = await db.query("SELECT COUNT(*) as count FROM omnichannel_conversations WHERE channel = 'whatsapp'");
    const total = Number(countRes.rows[0]?.count ?? 0);
    return {
      synced: true,
      totalConversations: total,
      message: `${total} conversación(es) de WhatsApp en bandeja.`,
    };
  } catch (err) {
    console.error('[WA-QR] Error en sincronizacion manual:', err);
    return { synced: false, totalConversations: 0 };
  }
}

export async function initWhatsAppQrEngineOnBoot(): Promise<void> {
  const alreadyLinked = ensureCredsIntegrity();
  if (!alreadyLinked) {
    currentStatus = 'awaiting_scan';
    await syncStateToDb('awaiting_scan', 'INITIALIZING_QR');
  } else {
    currentStatus = 'connected';
    await syncRecentChatsFromSessionDiskAndContacts(null);
  }
  startWhatsAppQrSocket(false).catch((err) => {
    console.error('[WA-QR] Error en arranque inicial de WhatsApp QR:', err);
  });
}
