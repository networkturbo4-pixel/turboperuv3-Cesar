import crypto from "crypto";
import fs from "fs";
import path from "path";
import { env } from "../../config/env";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, ".sessions.json");

const SCRYPT_PREFIX = "scrypt$";
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutos de bloqueo tras exceder intentos

export interface SessionRecord {
  jti: string;
  userId: number;
  tenantId: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastActivityAt: number;
  idleTimeoutMs: number;
  maxExpiresAt: number;
  revoked: boolean;
}

interface RateLimitBucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const sessionsMap = new Map<string, SessionRecord>();
const rateLimitMap = new Map<string, RateLimitBucket>();
let flushTimer: NodeJS.Timeout | null = null;

function loadSessionsFromDisk(): void {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      for (const item of parsed) {
        if (item && item.jti && !item.revoked && item.maxExpiresAt > now) {
          sessionsMap.set(item.jti, item as SessionRecord);
        }
      }
    }
  } catch {
    // Si el archivo de sesiones está corrupto, iniciar limpio
  }
}

function scheduleSessionsFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const now = Date.now();
      const active: SessionRecord[] = [];
      for (const [jti, s] of sessionsMap.entries()) {
        if (s.revoked || now >= s.maxExpiresAt || now - s.lastActivityAt > s.idleTimeoutMs) {
          sessionsMap.delete(jti);
        } else {
          active.push(s);
        }
      }
      await fs.promises.writeFile(SESSIONS_FILE, JSON.stringify(active, null, 2), { encoding: "utf-8", mode: 0o600 });
    } catch {
      // No bloquear operaciones por fallo de flush en disco
    }
  }, 5000);
  if (flushTimer.unref) flushTimer.unref();
}

loadSessionsFromDisk();

export class SecurityService {
  public static getIdleTimeoutMs(): number {
    return env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  }

  public static getMaxSessionMs(): number {
    return env.SESSION_MAX_HOURS * 60 * 60 * 1000;
  }

  /**
   * Genera un hash criptográfico con sal aleatoria usando scrypt nativo.
   */
  public static hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(pin, salt, 32).toString("hex");
    return `${SCRYPT_PREFIX}${salt}$${derived}`;
  }

  /**
   * Genera un identificador determinista HMAC-SHA256 para búsqueda rápida O(1)
   * y compatibilidad con marcaciones biométricas ZKTeco sin guardar el PIN en texto plano.
   */
  public static hmacPinLookup(pin: string): string {
    return crypto
      .createHmac("sha256", `${env.JWT_SECRET}:pin-lookup-v1`)
      .update(String(pin).trim())
      .digest("hex");
  }

  public static isHashedPin(value?: string): boolean {
    return typeof value === "string" && value.startsWith(SCRYPT_PREFIX);
  }

  /**
   * Verifica un PIN contra su hash scrypt o contra un PIN legado en texto plano.
   */
  public static verifyPin(
    candidatePin: string,
    user: { pin?: string; pinHash?: string }
  ): { valid: boolean; needsMigration: boolean } {
    const hashValue = user.pinHash || (this.isHashedPin(user.pin) ? user.pin : undefined);
    if (hashValue && hashValue.startsWith(SCRYPT_PREFIX)) {
      const parts = hashValue.slice(SCRYPT_PREFIX.length).split("$");
      if (parts.length === 2) {
        const [salt, storedHex] = parts;
        try {
          const derived = crypto.scryptSync(candidatePin, salt, 32);
          const storedBuf = Buffer.from(storedHex, "hex");
          if (derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf)) {
            return { valid: true, needsMigration: Boolean(user.pin && !this.isHashedPin(user.pin)) };
          }
        } catch {
          return { valid: false, needsMigration: false };
        }
      }
      return { valid: false, needsMigration: false };
    }

    // Compatibilidad transparente con PIN legado en texto plano (se migra al instante)
    if (typeof user.pin === "string" && /^\d{8}$/.test(user.pin)) {
      const a = Buffer.from(candidatePin, "utf-8");
      const b = Buffer.from(user.pin, "utf-8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { valid: true, needsMigration: true };
      }
    }

    return { valid: false, needsMigration: false };
  }

  /**
   * Control de fuerza bruta por IP en login por PIN / 2FA.
   */
  public static checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
    const key = ip || "unknown";
    const bucket = rateLimitMap.get(key);
    if (!bucket) return { allowed: true, retryAfterSeconds: 0 };

    const now = Date.now();
    if (bucket.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)),
      };
    }

    if (now - bucket.firstFailureAt > LOGIN_WINDOW_MS) {
      rateLimitMap.delete(key);
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  public static recordLoginFailure(ip: string): { locked: boolean; retryAfterSeconds: number; remainingAttempts: number } {
    const key = ip || "unknown";
    const now = Date.now();
    let bucket = rateLimitMap.get(key);

    if (!bucket || now - bucket.firstFailureAt > LOGIN_WINDOW_MS) {
      bucket = { failures: 1, firstFailureAt: now, lockedUntil: 0 };
    } else {
      bucket.failures += 1;
    }

    if (bucket.failures >= LOGIN_MAX_ATTEMPTS) {
      bucket.lockedUntil = now + LOGIN_LOCKOUT_MS;
      rateLimitMap.set(key, bucket);
      return {
        locked: true,
        retryAfterSeconds: Math.ceil(LOGIN_LOCKOUT_MS / 1000),
        remainingAttempts: 0,
      };
    }

    rateLimitMap.set(key, bucket);
    return {
      locked: false,
      retryAfterSeconds: 0,
      remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - bucket.failures),
    };
  }

  public static clearLoginFailures(ip: string): void {
    rateLimitMap.delete(ip || "unknown");
  }

  /**
   * Registra una nueva sesión autenticada con control de inactividad y vida máxima.
   */
  public static createSession(params: {
    userId: number;
    tenantId: string;
    ip: string;
    userAgent: string;
  }): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      jti: crypto.randomUUID(),
      userId: params.userId,
      tenantId: params.tenantId,
      ip: params.ip,
      userAgent: (params.userAgent || "").slice(0, 200),
      createdAt: now,
      lastActivityAt: now,
      idleTimeoutMs: this.getIdleTimeoutMs(),
      maxExpiresAt: now + this.getMaxSessionMs(),
      revoked: false,
    };
    sessionsMap.set(record.jti, record);
    scheduleSessionsFlush();
    return record;
  }

  /**
   * Valida si la sesión sigue vigente (no revocada, dentro de tiempo máximo y sin superar inactividad).
   */
  public static validateSession(
    jti: string,
    touch = true
  ): { valid: boolean; reason?: "not_found" | "revoked" | "expired_max" | "expired_idle"; session?: SessionRecord } {
    if (!jti) return { valid: false, reason: "not_found" };
    const session = sessionsMap.get(jti);
    if (!session) return { valid: false, reason: "not_found" };
    if (session.revoked) {
      sessionsMap.delete(jti);
      return { valid: false, reason: "revoked" };
    }

    const now = Date.now();
    if (now >= session.maxExpiresAt) {
      sessionsMap.delete(jti);
      scheduleSessionsFlush();
      return { valid: false, reason: "expired_max" };
    }

    if (now - session.lastActivityAt > session.idleTimeoutMs) {
      sessionsMap.delete(jti);
      scheduleSessionsFlush();
      return { valid: false, reason: "expired_idle" };
    }

    if (touch && now - session.lastActivityAt > 10_000) {
      session.lastActivityAt = now;
      scheduleSessionsFlush();
    }

    return { valid: true, session };
  }

  public static revokeSession(jti?: string): boolean {
    if (!jti) return false;
    const s = sessionsMap.get(jti);
    if (!s) return false;
    s.revoked = true;
    sessionsMap.delete(jti);
    scheduleSessionsFlush();
    return true;
  }

  public static revokeAllUserSessions(userId: number): number {
    let count = 0;
    for (const [jti, s] of sessionsMap.entries()) {
      if (s.userId === userId) {
        s.revoked = true;
        sessionsMap.delete(jti);
        count++;
      }
    }
    if (count > 0) scheduleSessionsFlush();
    return count;
  }

  public static buildSessionCookie(token: string, isSecureRequest = false): string {
    const maxAgeSec = Math.floor(this.getMaxSessionMs() / 1000);
    const parts = [
      `tn_session=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAgeSec}`,
    ];
    if (isSecureRequest) {
      parts.push("Secure");
    }
    return parts.join("; ");
  }

  public static buildClearSessionCookie(): string {
    return "tn_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
  }

  public static parseCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const k = pair.slice(0, idx).trim();
      if (k === name) {
        try {
          return decodeURIComponent(pair.slice(idx + 1).trim());
        } catch {
          return pair.slice(idx + 1).trim();
        }
      }
    }
    return null;
  }
}
