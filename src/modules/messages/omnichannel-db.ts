import path from "path";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import { queryClient } from "../../db";
import { normalizeChannelHandle } from "./handle-utils";

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

class OmnichannelDatabase {
  private pglite: PGlite | null = null;
  private mode: "postgres" | "pglite" = "pglite";
  private initPromise: Promise<void> | null = null;
  private schemaReady = false;
  private recoveryPromise: Promise<void> | null = null;

  public async ensureReady(): Promise<void> {
    if (this.schemaReady) return;
    if (!this.initPromise) {
      this.initPromise = this.initInternal().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
  }

  private async initInternal(): Promise<void> {
    // 1. Intentar usar PostgreSQL principal si está disponible
    try {
      await Promise.race([
        queryClient.unsafe("SELECT 1"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Postgres timeout")), 1500)
        ),
      ]);
      this.mode = "postgres";
      console.log("[Omnichannel DB] Usando PostgreSQL principal del sistema.");
    } catch {
      // 2. Fallback a PostgreSQL embebido persistente (PGlite) en data/omnichannel-db
      const dataDir = path.join(process.cwd(), "data", "omnichannel-db");
      fs.mkdirSync(dataDir, { recursive: true });

      const pidFile = path.join(dataDir, "postmaster.pid");
      const lockFile = path.join(dataDir, ".s.PGSQL.5432.lock.out");
      for (const f of [pidFile, lockFile]) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            // ignorar
          }
        }
      }

      try {
        this.pglite = new PGlite(dataDir);
        await this.pglite.waitReady;
      } catch (pgErr) {
        console.warn(
          "[Omnichannel DB] Reconstruyendo almacén PGlite tras cierre abrupto:",
          (pgErr as Error).message
        );
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
        } catch {
          // ignorar
        }
        fs.mkdirSync(dataDir, { recursive: true });
        this.pglite = new PGlite(dataDir);
        await this.pglite.waitReady;
      }

      this.mode = "pglite";
      console.log(`[Omnichannel DB] PostgreSQL embebido (PGlite) activo en: ${dataDir}`);
    }

    try {
      await this.initializeSchema();
    } catch (schemaErr) {
      if (this.mode === "pglite" && this.isCorruptionError(schemaErr)) {
        await this.recoverFromCorruption((schemaErr as Error).message);
      } else {
        throw schemaErr;
      }
    }
    this.schemaReady = true;
  }

  private isCorruptionError(err: unknown): boolean {
    const msg = (err as Error)?.message || "";
    return /corrupted page|invalid page in block|could not read block|contains corrupted|unexpected zero page/i.test(msg);
  }

  /**
   * Reparación automática ante corrupción de los catálogos internos de PGlite (suele ocurrir si el proceso se
   * corta a mitad de una escritura, por ejemplo al reiniciar `tsx watch`). Los datos de usuario siguen legibles:
   * se rescatan las tablas, se mueve el almacén dañado a `omnichannel-db.corrupt-<fecha>` (respaldo) y se
   * reconstruye uno limpio con las mismas filas.
   */
  private async recoverFromCorruption(reason: string): Promise<void> {
    const dataDir = path.join(process.cwd(), "data", "omnichannel-db");
    console.warn("[Omnichannel DB] Corrupción detectada, rescatando datos y reconstruyendo almacén:", reason);

    const tables = [
      "channel_connections",
      "omnichannel_conversations",
      "omnichannel_messages",
      "quick_replies",
      "crm_tags",
      "conversation_notes",
    ];
    const salvaged: Record<string, any[]> = {};
    if (this.pglite) {
      for (const t of tables) {
        try {
          const r = await this.pglite.query(`SELECT * FROM ${t}`);
          salvaged[t] = r.rows;
        } catch {
          salvaged[t] = [];
        }
      }
      try {
        await this.pglite.close();
      } catch {
        // ignorar
      }
    }
    this.pglite = null;
    this.schemaReady = false;

    const backupDir = `${dataDir}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(dataDir, backupDir);
      console.warn(`[Omnichannel DB] Almacén dañado respaldado en: ${backupDir}`);
    } catch {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // ignorar
      }
    }
    fs.mkdirSync(dataDir, { recursive: true });
    this.pglite = new PGlite(dataDir);
    await this.pglite.waitReady;
    this.mode = "pglite";
    await this.initializeSchema();

    let restored = 0;
    const pendingReplyLinks: Array<[number, number]> = [];
    for (const t of tables) {
      const rowsToRestore = salvaged[t] || [];
      if (rowsToRestore.length > 0 && t !== "channel_connections") {
        // Quitar datos semilla creados por initializeSchema para no chocar con las llaves primarias rescatadas
        await this.pglite.query(`DELETE FROM ${t}`).catch(() => {});
      }
      for (const row of rowsToRestore) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        if (t === "omnichannel_messages" && row.reply_to_id) {
          pendingReplyLinks.push([Number(row.id), Number(row.reply_to_id)]);
        }
        const values = cols.map((c) => {
          const v = row[c];
          if (t === "omnichannel_messages" && c === "reply_to_id") return null;
          if (v instanceof Date) return v.toISOString();
          if (v !== null && typeof v === "object") return JSON.stringify(v);
          return v;
        });
        try {
          if (t === "channel_connections") {
            await this.pglite.query("DELETE FROM channel_connections WHERE id = $1", [row.id ?? 1]);
          }
          await this.pglite.query(
            `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
            values
          );
          restored++;
        } catch (insErr) {
          console.warn(`[Omnichannel DB] No se pudo restaurar una fila de ${t}:`, (insErr as Error).message);
        }
      }
    }
    for (const [msgId, replyTo] of pendingReplyLinks) {
      await this.pglite
        .query("UPDATE omnichannel_messages SET reply_to_id = $1 WHERE id = $2", [replyTo, msgId])
        .catch(() => {});
    }
    for (const t of tables.filter((x) => x !== "channel_connections")) {
      try {
        await this.pglite.query(
          `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`
        );
      } catch {
        // ignorar
      }
    }
    console.log(`[Omnichannel DB] Reconstrucción completa: ${restored} filas restauradas.`);
    this.schemaReady = true;
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    await this.ensureReady();

    if (this.mode === "postgres") {
      const res = await queryClient.unsafe(sql, params);
      const rows = Array.from(res) as T[];
      return {
        rows,
        rowCount: (res as any).count ?? rows.length,
      };
    }

    if (this.pglite) {
      try {
        const res = await this.pglite.query<T>(sql, params);
        return {
          rows: res.rows,
          rowCount: res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0),
        };
      } catch (err) {
        const msg = (err as Error)?.message || "";
        if (this.isCorruptionError(err)) {
          if (!this.recoveryPromise) {
            this.recoveryPromise = this.recoverFromCorruption(msg).finally(() => {
              this.recoveryPromise = null;
            });
          }
          await this.recoveryPromise;
          const retry = await (this.pglite as PGlite).query<T>(sql, params);
          return {
            rows: retry.rows,
            rowCount: retry.rows.length > 0 ? retry.rows.length : (retry.affectedRows ?? 0),
          };
        }
        if (msg.includes("invalid response")) {
          console.warn("[Omnichannel DB] Reiniciando PGlite tras desincronización:", msg);
          this.schemaReady = false;
          this.initPromise = null;
          try {
            await this.pglite.close();
          } catch {
            // ignorar
          }
          this.pglite = null;
          await this.ensureReady();
          if (this.pglite) {
            const retryRes = await (this.pglite as PGlite).query<T>(sql, params);
            return {
              rows: retryRes.rows,
              rowCount: retryRes.rows.length > 0 ? retryRes.rows.length : (retryRes.affectedRows ?? 0),
            };
          }
        }
        throw err;
      }
    }

    throw new Error("Base de datos omnicanal no inicializada");
  }

  public async exec(sql: string): Promise<void> {
    if (this.mode === "postgres") {
      await queryClient.unsafe(sql);
      return;
    }
    if (this.pglite) {
      await this.pglite.exec(sql);
      return;
    }
    throw new Error("Base de datos omnicanal no inicializada");
  }

  private async initializeSchema(): Promise<void> {
    await this.exec(`
      CREATE TABLE IF NOT EXISTS channel_connections (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        wa_active_mode VARCHAR(20) NOT NULL DEFAULT 'qr',
        wa_qr_status VARCHAR(30) NOT NULL DEFAULT 'awaiting_scan',
        wa_qr_phone VARCHAR(50) NOT NULL DEFAULT '',
        wa_qr_device VARCHAR(120) NOT NULL DEFAULT 'Servidor Interno TurboNetwork-WA',
        wa_qr_session_code TEXT NOT NULL DEFAULT '',

        wa_api_status VARCHAR(30) NOT NULL DEFAULT 'disconnected',
        wa_phone_number_id VARCHAR(80) NOT NULL DEFAULT '',
        wa_business_account_id VARCHAR(80) NOT NULL DEFAULT '',
        wa_access_token TEXT NOT NULL DEFAULT '',
        wa_verify_token VARCHAR(120) NOT NULL DEFAULT 'turbonetwork_verify_webhook_2026',
        wa_mass_messaging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        wa_chatbot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        wa_chatbot_prompt TEXT NOT NULL DEFAULT 'Hola, bienvenido a nuestro canal oficial. Un asesor atenderá tu consulta enseguida.',

        fb_connected BOOLEAN NOT NULL DEFAULT FALSE,
        fb_page_name VARCHAR(150) NOT NULL DEFAULT '',
        fb_page_id VARCHAR(80) NOT NULL DEFAULT '',
        fb_access_token TEXT NOT NULL DEFAULT '',
        fb_auto_sync BOOLEAN NOT NULL DEFAULT TRUE,

        ig_connected BOOLEAN NOT NULL DEFAULT FALSE,
        ig_username VARCHAR(120) NOT NULL DEFAULT '',
        ig_account_id VARCHAR(80) NOT NULL DEFAULT '',
        ig_access_token TEXT NOT NULL DEFAULT '',
        ig_sync_stories BOOLEAN NOT NULL DEFAULT TRUE,

        tt_connected BOOLEAN NOT NULL DEFAULT FALSE,
        tt_account_handle VARCHAR(120) NOT NULL DEFAULT '',
        tt_client_key VARCHAR(80) NOT NULL DEFAULT '',
        tt_access_token TEXT NOT NULL DEFAULT '',
        tt_sync_leads BOOLEAN NOT NULL DEFAULT TRUE,

        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS omnichannel_conversations (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(30) NOT NULL,
        contact_name VARCHAR(150) NOT NULL,
        contact_handle VARCHAR(120) NOT NULL,
        avatar_color VARCHAR(20) NOT NULL DEFAULT '#4f46e5',
        unread_count INTEGER NOT NULL DEFAULT 0,
        estimated_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        tag VARCHAR(60) NOT NULL DEFAULT 'Lead Activo',
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        assigned_user_id INTEGER,
        last_message_text TEXT NOT NULL DEFAULT '',
        last_message_time VARCHAR(40) NOT NULL DEFAULT 'Ahora',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS omnichannel_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES omnichannel_conversations(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL,
        sender_name VARCHAR(120) NOT NULL,
        body TEXT NOT NULL,
        delivery_via VARCHAR(40) NOT NULL DEFAULT 'standard',
        time_label VARCHAR(40) NOT NULL DEFAULT '10:30',
        media_type VARCHAR(20) NOT NULL DEFAULT 'none',
        media_url TEXT NOT NULL DEFAULT '',
        media_filename VARCHAR(180) NOT NULL DEFAULT '',
        media_mimetype VARCHAR(100) NOT NULL DEFAULT '',
        wa_message_id VARCHAR(120) NOT NULL DEFAULT '',
        delivery_status VARCHAR(20) NOT NULL DEFAULT 'read',
        reply_to_id INTEGER REFERENCES omnichannel_messages(id) ON DELETE SET NULL,
        reply_to_sender VARCHAR(120) NOT NULL DEFAULT '',
        reply_to_body TEXT NOT NULL DEFAULT '',
        reply_to_media_url TEXT NOT NULL DEFAULT '',
        reply_to_media_type VARCHAR(20) NOT NULL DEFAULT 'none',
        is_forwarded BOOLEAN NOT NULL DEFAULT false,
        is_edited BOOLEAN NOT NULL DEFAULT false,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quick_replies (
        id SERIAL PRIMARY KEY,
        shortcut VARCHAR(60) NOT NULL UNIQUE,
        title VARCHAR(120) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        media_type VARCHAR(20) NOT NULL DEFAULT 'none',
        media_url TEXT NOT NULL DEFAULT '',
        media_filename VARCHAR(180) NOT NULL DEFAULT '',
        media_mimetype VARCHAR(100) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS crm_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL UNIQUE,
        color VARCHAR(20) NOT NULL DEFAULT '#10b981',
        scope VARCHAR(20) NOT NULL DEFAULT 'both',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversation_notes (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES omnichannel_conversations(id) ON DELETE CASCADE,
        author_name VARCHAR(120) NOT NULL DEFAULT 'Agente',
        content TEXT NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#f59e0b',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE omnichannel_conversations ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE omnichannel_conversations ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER;
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) NOT NULL DEFAULT 'none';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS media_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS media_filename VARCHAR(180) NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS media_mimetype VARCHAR(100) NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS wa_message_id VARCHAR(120) NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) NOT NULL DEFAULT 'read';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reply_to_sender VARCHAR(120) NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reply_to_body TEXT NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reply_to_media_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reply_to_media_type VARCHAR(20) NOT NULL DEFAULT 'none';
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS send_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
ALTER TABLE omnichannel_messages ADD COLUMN IF NOT EXISTS reactions_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    // Normalizar handles de WhatsApp (ej. "51 908 596 716" -> "+51908596716") y fusionar conversaciones divididas
    try {
      const allConvs = await this.rawQuery<{
        id: number;
        channel: string;
        contact_name: string;
        contact_handle: string;
        unread_count: number;
      }>(`SELECT id, channel, contact_name, contact_handle, unread_count FROM omnichannel_conversations ORDER BY id ASC`);

      const byCanonical = new Map<string, typeof allConvs.rows>();
      for (const row of allConvs.rows) {
        const canonical = normalizeChannelHandle(row.channel, row.contact_handle);
        const key = `${row.channel}::${canonical}`;
        const list = byCanonical.get(key) || [];
        list.push({ ...row, contact_handle: canonical });
        byCanonical.set(key, list);
      }

      for (const [, group] of byCanonical.entries()) {
        const primary = group[0];
        const bestNamed = group.find(
          (r) => r.contact_name && !r.contact_name.startsWith("+") && !r.contact_name.endsWith("@lid")
        );
        const targetName = bestNamed ? bestNamed.contact_name : primary.contact_name;

        if (group.length > 1) {
          const dupIds = group.slice(1).map((r) => r.id);
          const totalUnread = group.reduce((acc, r) => acc + Number(r.unread_count || 0), 0);
          for (const dupId of dupIds) {
            await this.rawQuery(
              `UPDATE omnichannel_messages SET conversation_id = $1 WHERE conversation_id = $2`,
              [primary.id, dupId]
            );
            await this.rawQuery(
              `UPDATE conversation_notes SET conversation_id = $1 WHERE conversation_id = $2`,
              [primary.id, dupId]
            );
            await this.rawQuery(`DELETE FROM omnichannel_conversations WHERE id = $1`, [dupId]);
          }
          const latestMsg = await this.rawQuery<{ body: string; time_label: string }>(
            `SELECT body, time_label FROM omnichannel_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`,
            [primary.id]
          );
          await this.rawQuery(
            `UPDATE omnichannel_conversations
             SET contact_handle = $1,
                 contact_name = $2,
                 unread_count = $3,
                 last_message_text = COALESCE($4, last_message_text),
                 last_message_time = COALESCE($5, last_message_time)
             WHERE id = $6`,
            [
              primary.contact_handle,
              targetName,
              totalUnread,
              latestMsg.rows[0]?.body || null,
              latestMsg.rows[0]?.time_label || null,
              primary.id,
            ]
          );
        } else {
          const orig = allConvs.rows.find((r) => r.id === primary.id);
          if (orig && orig.contact_handle !== primary.contact_handle) {
            await this.rawQuery(
              `UPDATE omnichannel_conversations SET contact_handle = $1 WHERE id = $2`,
              [primary.contact_handle, primary.id]
            );
          }
        }
      }

      await this.rawQuery(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_omnichannel_conv_channel_handle
         ON omnichannel_conversations (channel, contact_handle)`
      );
      await this.rawQuery(
        `CREATE INDEX IF NOT EXISTS idx_omnichannel_msg_conv_id
         ON omnichannel_messages (conversation_id)`
      );
      await this.rawQuery(
        `CREATE INDEX IF NOT EXISTS idx_omnichannel_msg_wa_id
         ON omnichannel_messages (wa_message_id) WHERE wa_message_id <> ''`
      );
    } catch (dedupErr) {
      console.warn("[Omnichannel DB] Aviso en normalización/deduplicación de conversaciones:", (dedupErr as Error).message);
    }

    // Asegurar fila única en channel_connections
    const connCheck = await this.rawQuery("SELECT id FROM channel_connections WHERE id = 1");
    if (connCheck.rowCount === 0) {
      await this.rawQuery("INSERT INTO channel_connections (id) VALUES (1)");
    }

    // Etiquetas iniciales si no existen
    const tagCheck = await this.rawQuery("SELECT id FROM crm_tags LIMIT 1");
    if (tagCheck.rowCount === 0) {
      await this.rawQuery(`
        INSERT INTO crm_tags (name, color, scope) VALUES
          ('Lead Activo', '#4f46e5', 'chat'),
          ('Soporte Técnico', '#0ea5e9', 'chat'),
          ('Cobranza', '#f59e0b', 'chat'),
          ('Instalación', '#10b981', 'chat'),
          ('VIP', '#ec4899', 'both')
        ON CONFLICT (name) DO NOTHING
      `);
    }

    // Respuestas rápidas iniciales si no existen
    const qrCheck = await this.rawQuery("SELECT id FROM quick_replies LIMIT 1");
    if (qrCheck.rowCount === 0) {
      await this.rawQuery(`
        INSERT INTO quick_replies (shortcut, title, body) VALUES
          ('/saludo', 'Saludo de Bienvenida', '¡Hola! Gracias por comunicarte con nosotros. ¿En qué podemos ayudarte hoy?'),
          ('/soporte', 'Soporte Técnico', 'Hemos recibido tu reporte técnico. Nuestro equipo está verificando tu conexión en este momento.'),
          ('/pagos', 'Medios de Pago', 'Puedes realizar tu pago por Yape, Plin o transferencia bancaria y enviarnos tu comprobante por este medio.')
        ON CONFLICT (shortcut) DO NOTHING
      `);
    }
  }

  private async rawQuery<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (this.mode === "postgres") {
      const res = await queryClient.unsafe(sql, params);
      const rows = Array.from(res) as T[];
      return { rows, rowCount: (res as any).count ?? rows.length };
    }
    if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0) };
    }
    throw new Error("Base de datos omnicanal no inicializada");
  }
}

export const omnichannelDb = new OmnichannelDatabase();
