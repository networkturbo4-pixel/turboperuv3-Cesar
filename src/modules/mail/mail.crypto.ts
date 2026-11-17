import crypto from "crypto";
import fs from "fs";
import path from "path";
import { env } from "../../config/env";

let cachedKey: Buffer | null = null;

function resolveEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = (env.MAIL_ENC_KEY || "").trim();
  if (raw.length >= 16) {
    cachedKey = crypto.scryptSync(raw, "turbonetwork-mail-aes256-salt", 32);
    return cachedKey;
  }

  // Fallback seguro en data/.mail_enc_key (mismo patrón que data/.jwt_secret)
  const dataDir = path.resolve(process.cwd(), "data");
  const keyFile = path.join(dataDir, ".mail_enc_key");
  try {
    if (fs.existsSync(keyFile)) {
      const persisted = fs.readFileSync(keyFile, "utf-8").trim();
      if (persisted.length >= 32) {
        cachedKey = Buffer.from(persisted.slice(0, 64), "hex");
        if (cachedKey.length === 32) return cachedKey;
      }
    }
    fs.mkdirSync(dataDir, { recursive: true });
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(keyFile, generated, { encoding: "utf-8", mode: 0o600 });
    if (env.NODE_ENV === "production") {
      console.warn("⚠️ [Mail] MAIL_ENC_KEY no configurado en .env; se generó llave persistida en data/.mail_enc_key.");
    }
    cachedKey = Buffer.from(generated, "hex");
    return cachedKey;
  } catch {
    cachedKey = crypto.scryptSync(env.JWT_SECRET, "turbonetwork-mail-fallback", 32);
    return cachedKey;
  }
}

export function encryptMailSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptMailSecret(payload: string): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de credencial cifrada inválido.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = resolveEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
