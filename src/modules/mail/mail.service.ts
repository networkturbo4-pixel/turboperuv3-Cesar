import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import { mailQuery } from "./mail.db";
import { encryptMailSecret, decryptMailSecret } from "./mail.crypto";
import { autodetectMailProvider } from "./mail.providers";
import {
  sanitizeMailHtml,
  blockRemoteImagesInHtml,
  extractMailSnippet,
  normalizeSubjectForThread,
} from "./mail.sanitizer";
import { getTenantDataDir, loadTenantsFromDisk } from "../tenants/tenants.service";
import type { AuthenticatedUserPayload } from "../../middleware/auth.guard";

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailAccountDTO {
  id: number;
  tenantId: string;
  ownerUserId: number;
  email: string;
  displayName: string;
  provider: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  signatureHtml: string;
  signatureDefaultNew: boolean;
  signatureDefaultReply: boolean;
  color: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string;
  sharedUserIds: number[];
  unreadCount?: number;
}

export const mailEvents = new EventEmitter();
mailEvents.setMaxListeners(100);

const activeSyncLocks = new Set<number>();
let backgroundSyncTimer: NodeJS.Timeout | null = null;

function isAdminUser(user?: AuthenticatedUserPayload | null): boolean {
  if (!user) return false;
  return Boolean(user.isSuperAdmin || user.roleId === 1);
}

function mapAccountRow(row: any): MailAccountDTO {
  return {
    id: Number(row.id),
    tenantId: row.tenant_id,
    ownerUserId: Number(row.owner_user_id),
    email: row.email,
    displayName: row.display_name || "",
    provider: row.provider || "custom",
    imapHost: row.imap_host,
    imapPort: Number(row.imap_port),
    imapSecure: Boolean(row.imap_secure),
    smtpHost: row.smtp_host,
    smtpPort: Number(row.smtp_port),
    smtpSecure: Boolean(row.smtp_secure),
    username: row.username,
    signatureHtml: row.signature_html || "",
    signatureDefaultNew: Boolean(row.signature_default_new),
    signatureDefaultReply: Boolean(row.signature_default_reply),
    color: row.color || "#3b82f6",
    status: row.status || "active",
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
    lastError: row.last_error || "",
    sharedUserIds: Array.isArray(row.shared_user_ids) ? row.shared_user_ids.map(Number) : [],
    unreadCount: row.unread_count !== undefined ? Number(row.unread_count) : undefined,
  };
}

function parseAddressList(obj?: AddressObject | AddressObject[] | null): MailAddress[] {
  if (!obj) return [];
  const arr = Array.isArray(obj) ? obj : [obj];
  const out: MailAddress[] = [];
  for (const item of arr) {
    for (const v of item.value || []) {
      if (v.address) {
        out.push({ name: v.name || "", address: v.address.toLowerCase() });
      }
    }
  }
  return out;
}

function resolveFolderRole(pathStr: string, nameStr: string, specialUse?: string): string {
  const su = (specialUse || "").toLowerCase();
  if (su === "\\inbox") return "inbox";
  if (su === "\\sent") return "sent";
  if (su === "\\drafts") return "drafts";
  if (su === "\\junk") return "spam";
  if (su === "\\trash") return "trash";
  if (su === "\\archive" || su === "\\all") return "archive";

  const p = `${pathStr} ${nameStr}`.toLowerCase();
  if (pathStr.toUpperCase() === "INBOX" || p.trim() === "inbox") return "inbox";
  if (/\b(sent|enviados|sent items|sent messages)\b/.test(p)) return "sent";
  if (/\b(draft|drafts|borrador|borradores)\b/.test(p)) return "drafts";
  if (/\b(spam|junk|correo no deseado|bulk)\b/.test(p)) return "spam";
  if (/\b(trash|deleted|papelera|eliminados)\b/.test(p)) return "trash";
  if (/\b(archive|archivo|all mail|todos)\b/.test(p)) return "archive";
  return "custom";
}

function createImapClient(cfg: {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  username: string;
  password: string;
}): ImapFlow {
  return new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapSecure,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

function createSmtpTransporter(cfg: {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string;
}) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.username, pass: cfg.password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

export async function listAccessibleAccounts(
  tenantId: string,
  user: AuthenticatedUserPayload
): Promise<MailAccountDTO[]> {
  const res = await mailQuery(
    `SELECT a.*,
       COALESCE((
         SELECT SUM(f.unread_count) FROM mail_folders f
         WHERE f.account_id = a.id AND f.role = 'inbox'
       ), 0) AS unread_count
     FROM mail_accounts a
     WHERE a.tenant_id = $1
     ORDER BY a.id ASC`,
    [tenantId]
  );

  const admin = isAdminUser(user);
  return res.rows
    .map(mapAccountRow)
    .filter((acc) => admin || acc.ownerUserId === user.sub || acc.sharedUserIds.includes(user.sub));
}

async function getAccessibleAccountRow(
  tenantId: string,
  user: AuthenticatedUserPayload,
  accountId: number
): Promise<any> {
  const res = await mailQuery(
    `SELECT * FROM mail_accounts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [accountId, tenantId]
  );
  const row = res.rows[0];
  if (!row) {
    throw Object.assign(new Error("Cuenta de correo no encontrada."), { statusCode: 404 });
  }
  const shared: number[] = Array.isArray(row.shared_user_ids) ? row.shared_user_ids.map(Number) : [];
  if (!isAdminUser(user) && Number(row.owner_user_id) !== user.sub && !shared.includes(user.sub)) {
    throw Object.assign(new Error("No tienes acceso a esta cuenta de correo."), { statusCode: 403 });
  }
  return row;
}

export async function testMailConnection(input: {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string;
}): Promise<{ imapOk: boolean; smtpOk: boolean; foldersCount: number; error?: string }> {
  const imap = createImapClient(input);
  let foldersCount = 0;
  try {
    await imap.connect();
    const list = await imap.list();
    foldersCount = list.length;
    await imap.logout();
  } catch (err: any) {
    try { imap.close(); } catch {}
    return {
      imapOk: false,
      smtpOk: false,
      foldersCount: 0,
      error: `Error IMAP (${input.imapHost}:${input.imapPort}): ${err?.responseText || err?.message || "No se pudo conectar"}`,
    };
  }

  try {
    const transporter = createSmtpTransporter(input);
    await transporter.verify();
  } catch (err: any) {
    return {
      imapOk: true,
      smtpOk: false,
      foldersCount,
      error: `IMAP OK, pero falló SMTP (${input.smtpHost}:${input.smtpPort}): ${err?.message || "No se pudo verificar"}`,
    };
  }

  return { imapOk: true, smtpOk: true, foldersCount };
}

export async function createMailAccount(
  tenantId: string,
  user: AuthenticatedUserPayload,
  body: any
): Promise<MailAccountDTO> {
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw Object.assign(new Error("Correo electrónico inválido."), { statusCode: 400 });
  }
  const preset = autodetectMailProvider(email);
  const imapHost = String(body.imapHost || preset.imapHost).trim();
  const imapPort = Number(body.imapPort || preset.imapPort);
  const imapSecure = body.imapSecure !== undefined ? Boolean(body.imapSecure) : preset.imapSecure;
  const smtpHost = String(body.smtpHost || preset.smtpHost).trim();
  const smtpPort = Number(body.smtpPort || preset.smtpPort);
  const smtpSecure = body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : preset.smtpSecure;
  const username = String(body.username || email).trim();
  const password = String(body.password || "");
  if (!password) {
    throw Object.assign(new Error("La contraseña o contraseña de aplicación es obligatoria."), { statusCode: 400 });
  }

  // Verificar conexión antes de guardar (a menos que skipVerify sea true en tests)
  if (!body.skipVerify) {
    const test = await testMailConnection({
      email,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      username,
      password,
    });
    if (!test.imapOk || !test.smtpOk) {
      throw Object.assign(new Error(test.error || "No se pudo validar la conexión."), { statusCode: 400 });
    }
  }

  const passwordEnc = encryptMailSecret(password);
  const sharedUserIds = Array.isArray(body.sharedUserIds)
    ? body.sharedUserIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  const ins = await mailQuery(
    `INSERT INTO mail_accounts (
      tenant_id, owner_user_id, email, display_name, provider,
      imap_host, imap_port, imap_secure,
      smtp_host, smtp_port, smtp_secure,
      username, password_enc, signature_html,
      signature_default_new, signature_default_reply,
      color, status, shared_user_ids
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14,
      $15, $16,
      $17, 'active', $18::jsonb
    )
    RETURNING *`,
    [
      tenantId,
      user.sub,
      email,
      String(body.displayName || email.split("@")[0]).trim(),
      String(body.provider || preset.provider),
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      username,
      passwordEnc,
      sanitizeMailHtml(String(body.signatureHtml || "")),
      body.signatureDefaultNew !== false,
      body.signatureDefaultReply !== false,
      String(body.color || "#3b82f6"),
      JSON.stringify(sharedUserIds),
    ]
  );

  const account = mapAccountRow(ins.rows[0]);
  if (!body.skipVerify) {
    // Disparar sincronización inicial en segundo plano
    syncAccount(tenantId, account.id).catch((err) => {
      console.warn(`[Mail] Sync inicial falló para ${account.email}:`, err?.message);
    });
  }
  return account;
}

export async function updateMailAccount(
  tenantId: string,
  user: AuthenticatedUserPayload,
  accountId: number,
  body: any
): Promise<MailAccountDTO> {
  const existing = await getAccessibleAccountRow(tenantId, user, accountId);

  const displayName = body.displayName !== undefined ? String(body.displayName).trim() : existing.display_name;
  const imapHost = body.imapHost !== undefined ? String(body.imapHost).trim() : existing.imap_host;
  const imapPort = body.imapPort !== undefined ? Number(body.imapPort) : Number(existing.imap_port);
  const imapSecure = body.imapSecure !== undefined ? Boolean(body.imapSecure) : Boolean(existing.imap_secure);
  const smtpHost = body.smtpHost !== undefined ? String(body.smtpHost).trim() : existing.smtp_host;
  const smtpPort = body.smtpPort !== undefined ? Number(body.smtpPort) : Number(existing.smtp_port);
  const smtpSecure = body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : Boolean(existing.smtp_secure);
  const username = body.username !== undefined ? String(body.username).trim() : existing.username;
  const passwordEnc = body.password ? encryptMailSecret(String(body.password)) : existing.password_enc;
  const signatureHtml =
    body.signatureHtml !== undefined ? sanitizeMailHtml(String(body.signatureHtml)) : existing.signature_html;
  const signatureDefaultNew =
    body.signatureDefaultNew !== undefined ? Boolean(body.signatureDefaultNew) : Boolean(existing.signature_default_new);
  const signatureDefaultReply =
    body.signatureDefaultReply !== undefined
      ? Boolean(body.signatureDefaultReply)
      : Boolean(existing.signature_default_reply);
  const color = body.color !== undefined ? String(body.color) : existing.color;
  const status = body.status !== undefined ? String(body.status) : existing.status;
  const sharedUserIds =
    body.sharedUserIds !== undefined && Array.isArray(body.sharedUserIds)
      ? body.sharedUserIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
      : existing.shared_user_ids;

  const upd = await mailQuery(
    `UPDATE mail_accounts SET
      display_name = $1, imap_host = $2, imap_port = $3, imap_secure = $4,
      smtp_host = $5, smtp_port = $6, smtp_secure = $7,
      username = $8, password_enc = $9,
      signature_html = $10, signature_default_new = $11, signature_default_reply = $12,
      color = $13, status = $14, shared_user_ids = $15::jsonb, updated_at = NOW()
     WHERE id = $16 AND tenant_id = $17
     RETURNING *`,
    [
      displayName,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      username,
      passwordEnc,
      signatureHtml,
      signatureDefaultNew,
      signatureDefaultReply,
      color,
      status,
      JSON.stringify(sharedUserIds),
      accountId,
      tenantId,
    ]
  );

  return mapAccountRow(upd.rows[0]);
}

export async function deleteMailAccount(
  tenantId: string,
  user: AuthenticatedUserPayload,
  accountId: number
): Promise<void> {
  await getAccessibleAccountRow(tenantId, user, accountId);
  await mailQuery(`DELETE FROM mail_accounts WHERE id = $1 AND tenant_id = $2`, [accountId, tenantId]);
  const attachDir = path.join(getTenantDataDir(tenantId), "mail-attachments", String(accountId));
  try {
    if (fs.existsSync(attachDir)) {
      fs.rmSync(attachDir, { recursive: true, force: true });
    }
  } catch {
    // ignorar
  }
}

async function saveParsedMessage(
  tenantId: string,
  accountId: number,
  folderId: number,
  uid: number,
  flags: Set<string>,
  parsed: ParsedMail
): Promise<number> {
  const fromList = parseAddressList(parsed.from);
  const fromObj = fromList[0] || { name: "", address: "" };
  const toList = parseAddressList(parsed.to);
  const ccList = parseAddressList(parsed.cc);
  const bccList = parseAddressList(parsed.bcc);
  const replyToList = parseAddressList(parsed.replyTo);

  const messageId = (parsed.messageId || "").trim();
  const inReplyTo = (parsed.inReplyTo || "").trim();
  const refs = Array.isArray(parsed.references)
    ? parsed.references.join(" ")
    : String(parsed.references || "");
  const firstRef = refs.split(/\s+/).filter(Boolean)[0] || "";
  const subject = (parsed.subject || "(sin asunto)").trim() || "(sin asunto)";
  const threadId = firstRef || inReplyTo || messageId || `subj:${normalizeSubjectForThread(subject)}`;

  const rawHtml = typeof parsed.html === "string" ? parsed.html : "";
  const bodyText = (parsed.text || "").trim();
  const sanitized = sanitizeMailHtml(rawHtml || (bodyText ? `<pre style="white-space:pre-wrap;font-family:inherit;">${bodyText.replace(/</g, "&lt;")}</pre>` : ""));
  const { html: safeHtml, hasBlockedImages } = blockRemoteImagesInHtml(sanitized);
  const snippet = extractMailSnippet(bodyText, rawHtml);
  const dateIso = (parsed.date ? new Date(parsed.date) : new Date()).toISOString();

  const isRead = flags.has("\\Seen");
  const isStarred = flags.has("\\Flagged");
  const isDraft = flags.has("\\Draft");
  const attachments = parsed.attachments || [];
  const hasAttachments = attachments.some((a) => !a.cid || a.contentDisposition === "attachment");

  // Si existe un envío optimista (uid < 0) con el mismo message_id en esta carpeta, actualizarlo
  if (messageId) {
    const optimistic = await mailQuery<{ id: number }>(
      `SELECT id FROM mail_messages WHERE account_id = $1 AND folder_id = $2 AND message_id = $3 AND uid < 0 LIMIT 1`,
      [accountId, folderId, messageId]
    );
    if (optimistic.rows[0]) {
      const existingId = optimistic.rows[0].id;
      await mailQuery(
        `UPDATE mail_messages SET uid = $1, is_read = $2, is_starred = $3 WHERE id = $4`,
        [uid, isRead, isStarred, existingId]
      );
      return existingId;
    }
  }

  const res = await mailQuery<{ id: number }>(
    `INSERT INTO mail_messages (
      tenant_id, account_id, folder_id, uid, message_id, in_reply_to, references_header, thread_id,
      from_name, from_email, to_list, cc_list, bcc_list, reply_to,
      subject, snippet, body_html_sanitized, body_text, has_remote_images,
      date, is_read, is_starred, is_draft, has_attachments
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14,
      $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24
    )
    ON CONFLICT (account_id, folder_id, uid) DO UPDATE SET
      is_read = EXCLUDED.is_read,
      is_starred = EXCLUDED.is_starred
    RETURNING id`,
    [
      tenantId,
      accountId,
      folderId,
      uid,
      messageId,
      inReplyTo,
      refs,
      threadId,
      fromObj.name,
      fromObj.address,
      JSON.stringify(toList),
      JSON.stringify(ccList),
      JSON.stringify(bccList),
      replyToList[0]?.address || "",
      subject,
      snippet,
      safeHtml,
      bodyText,
      hasBlockedImages,
      dateIso,
      isRead,
      isStarred,
      isDraft,
      hasAttachments,
    ]
  );

  const dbMsgId = Number(res.rows[0].id);

  // Guardar adjuntos si aún no existen para este mensaje
  if (attachments.length > 0) {
    const existingAtt = await mailQuery(
      `SELECT id FROM mail_attachments WHERE message_id = $1 LIMIT 1`,
      [dbMsgId]
    );
    if (existingAtt.rowCount === 0) {
      const msgDir = path.join(getTenantDataDir(tenantId), "mail-attachments", String(accountId), String(dbMsgId));
      fs.mkdirSync(msgDir, { recursive: true });
      for (let idx = 0; idx < attachments.length; idx++) {
        const att = attachments[idx];
        const safeName = (att.filename || `adjunto_${idx + 1}`).replace(/[^a-zA-Z0-9._-]/g, "_");
        const diskPath = path.join(msgDir, `${idx}_${safeName}`);
        try {
          fs.writeFileSync(diskPath, att.content);
          await mailQuery(
            `INSERT INTO mail_attachments (
              tenant_id, account_id, message_id, filename, mime_type, size_bytes, storage_path, content_id, is_inline
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              tenantId,
              accountId,
              dbMsgId,
              att.filename || safeName,
              att.contentType || "application/octet-stream",
              att.size || att.content.length,
              diskPath,
              att.cid || "",
              att.contentDisposition === "inline",
            ]
          );
        } catch {
          // continuar con los demás adjuntos
        }
      }
    }
  }

  return dbMsgId;
}

export async function syncAccount(
  tenantId: string,
  accountId: number
): Promise<{ syncedMessages: number; foldersCount: number }> {
  if (activeSyncLocks.has(accountId)) {
    return { syncedMessages: 0, foldersCount: 0 };
  }
  activeSyncLocks.add(accountId);

  let client: ImapFlow | null = null;
  let syncedMessages = 0;
  let foldersCount = 0;

  try {
    const accRes = await mailQuery(
      `SELECT * FROM mail_accounts WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [accountId, tenantId]
    );
    const acc = accRes.rows[0];
    if (!acc) throw new Error("Cuenta no encontrada.");

    const password = decryptMailSecret(acc.password_enc);
    client = createImapClient({
      imapHost: acc.imap_host,
      imapPort: Number(acc.imap_port),
      imapSecure: Boolean(acc.imap_secure),
      username: acc.username,
      password,
    });

    await client.connect();
    const imapFolders = await client.list();

    // Guardar/actualizar carpetas
    const rolePriority: Record<string, number> = {
      inbox: 1,
      sent: 2,
      drafts: 3,
      spam: 4,
      trash: 5,
      archive: 6,
      custom: 7,
    };

    const syncedFolderRows: Array<{ id: number; path: string; role: string; lastUid: number }> = [];

    for (const f of imapFolders) {
      if (f.flags?.has("\\Noselect")) continue;
      const role = resolveFolderRole(f.path, f.name, f.specialUse);
      const up = await mailQuery<{ id: number; last_uid: string }>(
        `INSERT INTO mail_folders (tenant_id, account_id, name, path, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, path) DO UPDATE SET
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           updated_at = NOW()
         RETURNING id, last_uid`,
        [tenantId, accountId, f.name, f.path, role]
      );
      syncedFolderRows.push({
        id: Number(up.rows[0].id),
        path: f.path,
        role,
        lastUid: Number(up.rows[0].last_uid || 0),
      });
      foldersCount++;
    }

    syncedFolderRows.sort((a, b) => (rolePriority[a.role] || 9) - (rolePriority[b.role] || 9));

    // Sincronizar carpetas principales (inbox, sent, drafts, spam, trash, archive)
    const foldersToSync = syncedFolderRows.filter((f) => f.role !== "custom");

    for (const folder of foldersToSync) {
      let lock: any = null;
      try {
        lock = await client.getMailboxLock(folder.path);
        const status = client.mailbox;
        const exists = status && typeof status === "object" ? Number((status as any).exists || 0) : 0;
        const uidNext = status && typeof status === "object" ? Number((status as any).uidNext || 1) : 1;

        if (exists > 0) {
          // En primera sincronización traer los últimos 35 correos; luego incremental por UID
          let fetchRange: string;
          let useUid = true;
          if (folder.lastUid > 0) {
            if (uidNext <= folder.lastUid + 1) {
              fetchRange = "";
            } else {
              fetchRange = `${folder.lastUid + 1}:*`;
            }
          } else {
            const startSeq = Math.max(1, exists - 34);
            fetchRange = `${startSeq}:*`;
            useUid = false;
          }

          let maxUid = folder.lastUid;
          if (fetchRange) {
            for await (const msg of client.fetch(fetchRange, { uid: true, flags: true, source: true }, { uid: useUid })) {
              if (!msg.source) continue;
              if (msg.uid > maxUid) maxUid = msg.uid;
              try {
                const parsed = await simpleParser(msg.source);
                await saveParsedMessage(
                  tenantId,
                  accountId,
                  folder.id,
                  msg.uid,
                  msg.flags || new Set<string>(),
                  parsed
                );
                syncedMessages++;
              } catch {
                // ignorar mensaje malformado puntual
              }
            }
          }

          if (maxUid > folder.lastUid) {
            await mailQuery(`UPDATE mail_folders SET last_uid = $1, updated_at = NOW() WHERE id = $2`, [
              maxUid,
              folder.id,
            ]);
          }
        }

        // Recalcular contadores en BD
        await mailQuery(
          `UPDATE mail_folders SET
            unread_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = $1 AND is_read = FALSE),
            total_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = $1),
            updated_at = NOW()
           WHERE id = $1`,
          [folder.id]
        );
      } catch {
        // continuar con la siguiente carpeta
      } finally {
        if (lock) {
          try { lock.release(); } catch {}
        }
      }
    }

    await mailQuery(
      `UPDATE mail_accounts SET status = 'active', last_error = '', last_sync_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [accountId]
    );

    if (syncedMessages > 0) {
      mailEvents.emit("mail_update", { tenantId, accountId, syncedMessages });
    }

    return { syncedMessages, foldersCount };
  } catch (err: any) {
    const errMsg = err?.responseText || err?.message || "Error de sincronización IMAP";
    await mailQuery(
      `UPDATE mail_accounts SET status = 'error', last_error = $1, updated_at = NOW() WHERE id = $2`,
      [errMsg.slice(0, 300), accountId]
    ).catch(() => {});
    throw err;
  } finally {
    if (client) {
      try { await client.logout(); } catch { try { client.close(); } catch {} }
    }
    activeSyncLocks.delete(accountId);
  }
}

export async function listMailFolders(
  tenantId: string,
  user: AuthenticatedUserPayload,
  accountId?: number
): Promise<any[]> {
  const accounts = await listAccessibleAccounts(tenantId, user);
  const allowedIds = accounts.map((a) => a.id);
  if (allowedIds.length === 0) return [];

  if (accountId && !allowedIds.includes(accountId)) {
    throw Object.assign(new Error("Cuenta no autorizada."), { statusCode: 403 });
  }

  const targetIds = accountId ? [accountId] : allowedIds;
  const res = await mailQuery(
    `SELECT f.*, a.email AS account_email, a.color AS account_color
     FROM mail_folders f
     JOIN mail_accounts a ON a.id = f.account_id
     WHERE f.tenant_id = $1 AND f.account_id = ANY($2::int[])
     ORDER BY f.account_id ASC, f.role ASC, f.name ASC`,
    [tenantId, targetIds]
  );
  return res.rows;
}

export async function listMailMessages(
  tenantId: string,
  user: AuthenticatedUserPayload,
  opts: {
    accountId?: number;
    folderRole?: string;
    folderId?: number;
    q?: string;
    unread?: boolean;
    starred?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: any[]; total: number }> {
  const accounts = await listAccessibleAccounts(tenantId, user);
  const allowedIds = accounts.map((a) => a.id);
  if (allowedIds.length === 0) return { items: [], total: 0 };

  if (opts.accountId && !allowedIds.includes(opts.accountId)) {
    throw Object.assign(new Error("Cuenta no autorizada."), { statusCode: 403 });
  }

  const targetIds = opts.accountId ? [opts.accountId] : allowedIds;
  const where: string[] = [`m.tenant_id = $1`, `m.account_id = ANY($2::int[])`];
  const params: any[] = [tenantId, targetIds];
  let idx = 3;

  if (opts.folderId) {
    where.push(`m.folder_id = $${idx++}`);
    params.push(opts.folderId);
  } else if (opts.starred) {
    where.push(`m.is_starred = TRUE`);
    where.push(`f.role NOT IN ('trash', 'spam')`);
  } else {
    const role = opts.folderRole || "inbox";
    where.push(`f.role = $${idx++}`);
    params.push(role);
  }

  if (opts.unread) {
    where.push(`m.is_read = FALSE`);
  }

  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(`(m.subject ILIKE $${idx} OR m.from_name ILIKE $${idx} OR m.from_email ILIKE $${idx} OR m.snippet ILIKE $${idx})`);
    params.push(like);
    idx++;
  }

  const limit = Math.min(Math.max(Number(opts.limit || 40), 1), 100);
  const offset = Math.max(Number(opts.offset || 0), 0);

  const countRes = await mailQuery<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt
     FROM mail_messages m
     JOIN mail_folders f ON f.id = m.folder_id
     WHERE ${where.join(" AND ")}`,
    params
  );

  const rowsRes = await mailQuery(
    `SELECT
       m.id, m.account_id, m.folder_id, m.uid, m.message_id, m.thread_id,
       m.from_name, m.from_email, m.to_list, m.subject, m.snippet,
       m.date, m.is_read, m.is_starred, m.is_draft, m.has_attachments,
       f.role AS folder_role, f.name AS folder_name,
       a.email AS account_email, a.display_name AS account_name, a.color AS account_color
     FROM mail_messages m
     JOIN mail_folders f ON f.id = m.folder_id
     JOIN mail_accounts a ON a.id = m.account_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.date DESC, m.id DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.cnt || 0),
  };
}

export async function getMailMessageDetail(
  tenantId: string,
  user: AuthenticatedUserPayload,
  messageId: number
): Promise<{ message: any; attachments: any[]; thread: any[] }> {
  const res = await mailQuery(
    `SELECT m.*, f.role AS folder_role, f.path AS folder_path, a.email AS account_email, a.display_name AS account_name, a.color AS account_color
     FROM mail_messages m
     JOIN mail_folders f ON f.id = m.folder_id
     JOIN mail_accounts a ON a.id = m.account_id
     WHERE m.id = $1 AND m.tenant_id = $2
     LIMIT 1`,
    [messageId, tenantId]
  );
  const msg = res.rows[0];
  if (!msg) {
    throw Object.assign(new Error("Correo no encontrado."), { statusCode: 404 });
  }
  await getAccessibleAccountRow(tenantId, user, Number(msg.account_id));

  const attRes = await mailQuery(
    `SELECT id, filename, mime_type, size_bytes, content_id, is_inline
     FROM mail_attachments WHERE message_id = $1 ORDER BY id ASC`,
    [messageId]
  );

  let threadRows: any[] = [];
  if (msg.thread_id) {
    const tRes = await mailQuery(
      `SELECT m.id, m.from_name, m.from_email, m.to_list, m.cc_list, m.subject, m.snippet,
              m.body_html_sanitized, m.body_text, m.has_remote_images, m.date, m.is_read, m.has_attachments,
              f.role AS folder_role
       FROM mail_messages m
       JOIN mail_folders f ON f.id = m.folder_id
       WHERE m.tenant_id = $1 AND m.account_id = $2 AND m.thread_id = $3 AND f.role <> 'trash'
       ORDER BY m.date ASC, m.id ASC
       LIMIT 30`,
      [tenantId, msg.account_id, msg.thread_id]
    );
    threadRows = tRes.rows;
  }

  return {
    message: msg,
    attachments: attRes.rows,
    thread: threadRows,
  };
}

export async function getMailAttachment(
  tenantId: string,
  user: AuthenticatedUserPayload,
  messageId: number,
  attachmentId: number
) {
  const res = await mailQuery(
    `SELECT * FROM mail_attachments WHERE id = $1 AND message_id = $2 AND tenant_id = $3 LIMIT 1`,
    [attachmentId, messageId, tenantId]
  );
  const att = res.rows[0];
  if (!att) {
    throw Object.assign(new Error("Adjunto no encontrado."), { statusCode: 404 });
  }
  await getAccessibleAccountRow(tenantId, user, Number(att.account_id));
  if (!fs.existsSync(att.storage_path)) {
    throw Object.assign(new Error("El archivo adjunto ya no existe en disco."), { statusCode: 404 });
  }
  return att;
}

async function syncFlagsToImap(
  acc: any,
  folderPath: string,
  uid: number,
  op: { addFlags?: string[]; removeFlags?: string[]; moveToPath?: string; deletePermanent?: boolean }
) {
  if (uid <= 0) return;
  const password = decryptMailSecret(acc.password_enc);
  const client = createImapClient({
    imapHost: acc.imap_host,
    imapPort: Number(acc.imap_port),
    imapSecure: Boolean(acc.imap_secure),
    username: acc.username,
    password,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folderPath);
    try {
      if (op.addFlags?.length) {
        await client.messageFlagsAdd({ uid }, op.addFlags, { uid: true });
      }
      if (op.removeFlags?.length) {
        await client.messageFlagsRemove({ uid }, op.removeFlags, { uid: true });
      }
      if (op.moveToPath) {
        await client.messageMove({ uid }, op.moveToPath, { uid: true });
      }
      if (op.deletePermanent) {
        await client.messageDelete({ uid }, { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: any) {
    try { client.close(); } catch {}
    console.warn(`[Mail] Error sincronizando acción IMAP (uid=${uid}):`, err?.message);
  }
}

export async function updateMailMessage(
  tenantId: string,
  user: AuthenticatedUserPayload,
  messageId: number,
  patch: { isRead?: boolean; isStarred?: boolean; moveToRole?: string }
): Promise<any> {
  const res = await mailQuery(
    `SELECT m.*, f.path AS folder_path, f.role AS folder_role
     FROM mail_messages m
     JOIN mail_folders f ON f.id = m.folder_id
     WHERE m.id = $1 AND m.tenant_id = $2 LIMIT 1`,
    [messageId, tenantId]
  );
  const msg = res.rows[0];
  if (!msg) throw Object.assign(new Error("Correo no encontrado."), { statusCode: 404 });
  const acc = await getAccessibleAccountRow(tenantId, user, Number(msg.account_id));

  const addFlags: string[] = [];
  const removeFlags: string[] = [];

  if (patch.isRead !== undefined) {
    await mailQuery(`UPDATE mail_messages SET is_read = $1 WHERE id = $2`, [Boolean(patch.isRead), messageId]);
    if (patch.isRead) addFlags.push("\\Seen");
    else removeFlags.push("\\Seen");
  }

  if (patch.isStarred !== undefined) {
    await mailQuery(`UPDATE mail_messages SET is_starred = $1 WHERE id = $2`, [Boolean(patch.isStarred), messageId]);
    if (patch.isStarred) addFlags.push("\\Flagged");
    else removeFlags.push("\\Flagged");
  }

  let moveToPath: string | undefined;
  if (patch.moveToRole) {
    const destFolder = await mailQuery(
      `SELECT id, path FROM mail_folders WHERE account_id = $1 AND role = $2 LIMIT 1`,
      [msg.account_id, patch.moveToRole]
    );
    if (destFolder.rows[0]) {
      const destId = Number(destFolder.rows[0].id);
      moveToPath = destFolder.rows[0].path;
      await mailQuery(`UPDATE mail_messages SET folder_id = $1 WHERE id = $2`, [destId, messageId]);
      await mailQuery(
        `UPDATE mail_folders SET
          unread_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = mail_folders.id AND is_read = FALSE),
          total_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = mail_folders.id)
         WHERE id IN ($1, $2)`,
        [msg.folder_id, destId]
      );
    }
  } else if (patch.isRead !== undefined) {
    await mailQuery(
      `UPDATE mail_folders SET
        unread_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = $1 AND is_read = FALSE)
       WHERE id = $1`,
      [msg.folder_id]
    );
  }

  // Reflejar en IMAP en segundo plano sin bloquear la UI
  if (addFlags.length || removeFlags.length || moveToPath) {
    syncFlagsToImap(acc, msg.folder_path, Number(msg.uid), { addFlags, removeFlags, moveToPath }).catch(() => {});
  }

  return { ok: true, id: messageId };
}

export async function deleteMailMessage(
  tenantId: string,
  user: AuthenticatedUserPayload,
  messageId: number,
  permanent = false
): Promise<{ ok: boolean; deletedPermanent: boolean }> {
  const res = await mailQuery(
    `SELECT m.*, f.path AS folder_path, f.role AS folder_role
     FROM mail_messages m
     JOIN mail_folders f ON f.id = m.folder_id
     WHERE m.id = $1 AND m.tenant_id = $2 LIMIT 1`,
    [messageId, tenantId]
  );
  const msg = res.rows[0];
  if (!msg) throw Object.assign(new Error("Correo no encontrado."), { statusCode: 404 });
  const acc = await getAccessibleAccountRow(tenantId, user, Number(msg.account_id));

  if (!permanent && msg.folder_role !== "trash") {
    await updateMailMessage(tenantId, user, messageId, { moveToRole: "trash" });
    return { ok: true, deletedPermanent: false };
  }

  const atts = await mailQuery(`SELECT storage_path FROM mail_attachments WHERE message_id = $1`, [messageId]);
  await mailQuery(`DELETE FROM mail_messages WHERE id = $1 AND tenant_id = $2`, [messageId, tenantId]);
  await mailQuery(
    `UPDATE mail_folders SET
      unread_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = $1 AND is_read = FALSE),
      total_count = (SELECT COUNT(*)::int FROM mail_messages WHERE folder_id = $1)
     WHERE id = $1`,
    [msg.folder_id]
  );

  for (const a of atts.rows) {
    try {
      if (a.storage_path && fs.existsSync(a.storage_path)) fs.unlinkSync(a.storage_path);
    } catch {}
  }

  syncFlagsToImap(acc, msg.folder_path, Number(msg.uid), { deletePermanent: true }).catch(() => {});
  return { ok: true, deletedPermanent: true };
}

export async function sendMailMessage(
  tenantId: string,
  user: AuthenticatedUserPayload,
  payload: {
    accountId: number;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyToMessageId?: number;
    includeSignature?: boolean;
    attachments?: Array<{ filename: string; contentBase64: string; contentType?: string }>;
  }
): Promise<{ ok: boolean; messageId: string; dbMessageId?: number }> {
  const acc = await getAccessibleAccountRow(tenantId, user, Number(payload.accountId));
  const password = decryptMailSecret(acc.password_enc);

  const normalizeRecipients = (val?: string | string[]): string[] => {
    if (!val) return [];
    const list = Array.isArray(val) ? val : val.split(/[,;]+/);
    return list.map((s) => s.trim()).filter(Boolean);
  };

  const to = normalizeRecipients(payload.to);
  if (to.length === 0) {
    throw Object.assign(new Error("Debes indicar al menos un destinatario."), { statusCode: 400 });
  }
  const cc = normalizeRecipients(payload.cc);
  const bcc = normalizeRecipients(payload.bcc);

  let inReplyTo: string | undefined;
  let references: string | undefined;
  let threadId = "";

  if (payload.replyToMessageId) {
    const refRes = await mailQuery(
      `SELECT message_id, references_header, thread_id FROM mail_messages WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [payload.replyToMessageId, tenantId]
    );
    const refMsg = refRes.rows[0];
    if (refMsg?.message_id) {
      inReplyTo = refMsg.message_id;
      references = [refMsg.references_header, refMsg.message_id].filter(Boolean).join(" ").trim();
      threadId = refMsg.thread_id || refMsg.message_id;
    }
  }

  let finalHtml = sanitizeMailHtml(payload.html || "");
  if (payload.includeSignature !== false && acc.signature_html) {
    finalHtml = `${finalHtml}<br><div class="tn-mail-signature">${acc.signature_html}</div>`;
  }

  const attachments = (payload.attachments || []).map((a) => ({
    filename: a.filename || "adjunto",
    content: Buffer.from(a.contentBase64, "base64"),
    contentType: a.contentType || "application/octet-stream",
  }));

  const transporter = createSmtpTransporter({
    smtpHost: acc.smtp_host,
    smtpPort: Number(acc.smtp_port),
    smtpSecure: Boolean(acc.smtp_secure),
    username: acc.username,
    password,
  });

  const fromHeader = acc.display_name ? `"${acc.display_name.replace(/"/g, "")}" <${acc.email}>` : acc.email;
  const info = await transporter.sendMail({
    from: fromHeader,
    to: to.join(", "),
    cc: cc.length ? cc.join(", ") : undefined,
    bcc: bcc.length ? bcc.join(", ") : undefined,
    subject: payload.subject || "(sin asunto)",
    html: finalHtml,
    text: payload.text || extractMailSnippet("", finalHtml, 5000),
    inReplyTo,
    references,
    attachments,
  });

  // Guardar copia local inmediata en carpeta Enviados
  let dbMessageId: number | undefined;
  const sentFolder = await mailQuery(
    `SELECT id FROM mail_folders WHERE account_id = $1 AND role = 'sent' LIMIT 1`,
    [acc.id]
  );
  if (sentFolder.rows[0]) {
    const folderId = Number(sentFolder.rows[0].id);
    const tempUid = -Date.now();
    const sentMsgId = info.messageId || `<local-${Date.now()}@${acc.email.split("@")[1] || "mail"}>`;
    const ins = await mailQuery<{ id: number }>(
      `INSERT INTO mail_messages (
        tenant_id, account_id, folder_id, uid, message_id, in_reply_to, references_header, thread_id,
        from_name, from_email, to_list, cc_list, bcc_list,
        subject, snippet, body_html_sanitized, body_text,
        date, is_read, is_starred, has_attachments
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11::jsonb, $12::jsonb, $13::jsonb,
        $14, $15, $16, $17,
        NOW(), TRUE, FALSE, $18
      ) RETURNING id`,
      [
        tenantId,
        acc.id,
        folderId,
        tempUid,
        sentMsgId,
        inReplyTo || "",
        references || "",
        threadId || sentMsgId,
        acc.display_name || "",
        acc.email,
        JSON.stringify(to.map((addr) => ({ name: "", address: addr }))),
        JSON.stringify(cc.map((addr) => ({ name: "", address: addr }))),
        JSON.stringify(bcc.map((addr) => ({ name: "", address: addr }))),
        payload.subject || "(sin asunto)",
        extractMailSnippet(payload.text, finalHtml),
        finalHtml,
        payload.text || extractMailSnippet("", finalHtml, 5000),
        attachments.length > 0,
      ]
    );
    dbMessageId = Number(ins.rows[0]?.id);
  }

  mailEvents.emit("mail_update", { tenantId, accountId: acc.id, sent: true });

  return { ok: true, messageId: info.messageId || "", dbMessageId };
}

export function startMailBackgroundWorkers(): void {
  if (backgroundSyncTimer) return;

  const runCycle = async () => {
    try {
      const res = await mailQuery<{ id: number; tenant_id: string }>(
        `SELECT id, tenant_id FROM mail_accounts WHERE status <> 'disabled' ORDER BY id ASC`
      );
      for (const row of res.rows) {
        if (activeSyncLocks.has(Number(row.id))) continue;
        await syncAccount(row.tenant_id, Number(row.id)).catch(() => {});
      }
    } catch {
      // ignorar si aún no hay cuentas o BD inicializando
    }
  };

  // Primera sincronización 8s tras arrancar, luego cada 60s
  setTimeout(() => {
    runCycle().catch(() => {});
  }, 8000);
  backgroundSyncTimer = setInterval(() => {
    runCycle().catch(() => {});
  }, 60000);
  // Asegurar que tenants estén cargados al menos una vez
  try {
    loadTenantsFromDisk();
  } catch {}
}
