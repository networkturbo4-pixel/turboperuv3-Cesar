import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit_logs.json");
const MAX_AUDIT_ENTRIES = 5000;

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId: number | null;
  actorName: string;
  tenantId: string;
  ip: string;
  action: string;
  entity: string;
  details?: Record<string, any>;
}

let auditBuffer: AuditLogEntry[] | null = null;
let writePending = false;

function ensureLoaded(): AuditLogEntry[] {
  if (auditBuffer !== null) return auditBuffer;
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        auditBuffer = parsed;
        return auditBuffer;
      }
    }
  } catch {
    // Inicializar buffer limpio si hubo corrupción previa
  }
  auditBuffer = [];
  return auditBuffer;
}

function scheduleWrite(): void {
  if (writePending) return;
  writePending = true;
  const timer = setTimeout(async () => {
    writePending = false;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const data = ensureLoaded();
      await fs.promises.writeFile(AUDIT_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("Aviso al persistir bitácora de auditoría:", err);
    }
  }, 1500);
  if (timer.unref) timer.unref();
}

export class AuditService {
  public static log(params: {
    actorUserId?: number | null;
    actorName?: string;
    tenantId?: string;
    ip?: string;
    action: string;
    entity: string;
    details?: Record<string, any>;
  }): AuditLogEntry {
    const list = ensureLoaded();
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName || "Sistema / Anónimo",
      tenantId: params.tenantId || "turbonetwork",
      ip: params.ip || "unknown",
      action: params.action,
      entity: params.entity,
      details: params.details,
    };

    list.unshift(entry);
    if (list.length > MAX_AUDIT_ENTRIES) {
      list.length = MAX_AUDIT_ENTRIES;
    }
    scheduleWrite();
    return entry;
  }

  public static list(options?: { tenantId?: string; isSuperAdmin?: boolean; limit?: number }): AuditLogEntry[] {
    const list = ensureLoaded();
    const limit = Math.min(Math.max(options?.limit || 100, 1), 1000);
    if (options?.isSuperAdmin || !options?.tenantId) {
      return list.slice(0, limit);
    }
    return list.filter((e) => e.tenantId === options.tenantId).slice(0, limit);
  }
}
