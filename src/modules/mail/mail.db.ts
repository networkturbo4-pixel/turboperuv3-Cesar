import { omnichannelDb, QueryResult } from "../messages/omnichannel-db";

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

async function initMailSchema(): Promise<void> {
  await omnichannelDb.ensureReady();

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_accounts (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT 'custom',
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL DEFAULT 993,
      imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL DEFAULT 465,
      smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
      username TEXT NOT NULL,
      password_enc TEXT NOT NULL,
      signature_html TEXT NOT NULL DEFAULT '',
      signature_default_new BOOLEAN NOT NULL DEFAULT TRUE,
      signature_default_reply BOOLEAN NOT NULL DEFAULT TRUE,
      avatar_url TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#3b82f6',
      status TEXT NOT NULL DEFAULT 'active',
      last_sync_at TIMESTAMPTZ,
      last_error TEXT DEFAULT '',
      shared_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, email)
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_folders (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'custom',
      uidvalidity BIGINT DEFAULT 0,
      last_uid BIGINT NOT NULL DEFAULT 0,
      unread_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, path)
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_messages (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      folder_id INTEGER NOT NULL REFERENCES mail_folders(id) ON DELETE CASCADE,
      uid BIGINT NOT NULL DEFAULT 0,
      message_id TEXT NOT NULL DEFAULT '',
      in_reply_to TEXT DEFAULT '',
      references_header TEXT DEFAULT '',
      thread_id TEXT NOT NULL DEFAULT '',
      from_name TEXT DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      to_list JSONB NOT NULL DEFAULT '[]'::jsonb,
      cc_list JSONB NOT NULL DEFAULT '[]'::jsonb,
      bcc_list JSONB NOT NULL DEFAULT '[]'::jsonb,
      reply_to TEXT DEFAULT '',
      subject TEXT NOT NULL DEFAULT '(sin asunto)',
      snippet TEXT NOT NULL DEFAULT '',
      body_html_sanitized TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      has_remote_images BOOLEAN NOT NULL DEFAULT FALSE,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      is_starred BOOLEAN NOT NULL DEFAULT FALSE,
      is_draft BOOLEAN NOT NULL DEFAULT FALSE,
      has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
      customer_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, folder_id, uid)
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_attachments (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      content_id TEXT DEFAULT '',
      is_inline BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tablas preparadas para Hito 2 & 3
  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_labels (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_message_labels (
      message_id INTEGER NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES mail_labels(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, label_id)
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_templates (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_rules (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      account_id INTEGER REFERENCES mail_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      priority INTEGER NOT NULL DEFAULT 0,
      conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      actions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await omnichannelDb.query(`
    CREATE TABLE IF NOT EXISTS mail_scheduled (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      payload_json JSONB NOT NULL,
      send_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Migración segura para instalaciones existentes
  await omnichannelDb.query(`ALTER TABLE mail_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Índices de rendimiento multi-tenant
  await omnichannelDb.query(`CREATE INDEX IF NOT EXISTS idx_mail_accounts_tenant ON mail_accounts(tenant_id)`);
  await omnichannelDb.query(`CREATE INDEX IF NOT EXISTS idx_mail_folders_tenant_acc ON mail_folders(tenant_id, account_id, role)`);
  await omnichannelDb.query(`CREATE INDEX IF NOT EXISTS idx_mail_messages_list ON mail_messages(tenant_id, account_id, folder_id, date DESC)`);
  await omnichannelDb.query(`CREATE INDEX IF NOT EXISTS idx_mail_messages_thread ON mail_messages(tenant_id, thread_id)`);
  await omnichannelDb.query(`CREATE INDEX IF NOT EXISTS idx_mail_messages_msgid ON mail_messages(account_id, message_id)`);
}

export async function ensureMailDbReady(): Promise<void> {
  if (schemaInitialized) return;
  if (!schemaInitPromise) {
    schemaInitPromise = initMailSchema()
      .then(() => {
        schemaInitialized = true;
      })
      .catch((err) => {
        schemaInitPromise = null;
        throw err;
      });
  }
  await schemaInitPromise;
}

export async function mailQuery<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  await ensureMailDbReady();
  return omnichannelDb.query<T>(sql, params);
}
