import * as dotenv from "dotenv";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";

dotenv.config();

const DEFAULT_WEAK_SECRET = "turbonetwork_super_secret_jwt_key_default";

function resolveStrongJwtSecret(rawSecret?: string, nodeEnv?: string): string {
  if (rawSecret && rawSecret !== DEFAULT_WEAK_SECRET && rawSecret.length >= 32) {
    return rawSecret;
  }

  const dataDir = path.resolve(process.cwd(), "data");
  const secretFile = path.join(dataDir, ".jwt_secret");

  try {
    if (fs.existsSync(secretFile)) {
      const persisted = fs.readFileSync(secretFile, "utf-8").trim();
      if (persisted.length >= 64) {
        if (nodeEnv === "production") {
          console.warn("⚠️ [Seguridad] Usando llave persistida en data/.jwt_secret. Se recomienda definir JWT_SECRET en .env.");
        }
        return persisted;
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const generated = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(secretFile, generated, { encoding: "utf-8", mode: 0o600 });
    if (nodeEnv === "production") {
      console.warn("⚠️ [Seguridad] JWT_SECRET no configurado o inseguro; se generó una llave criptográfica única en data/.jwt_secret.");
    }
    return generated;
  } catch {
    return crypto.randomBytes(48).toString("hex");
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/turbonetwork"),
  JWT_SECRET: z.string().default(DEFAULT_WEAK_SECRET),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(480).default(15),
  SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(72).default(8),
  CORS_ORIGINS: z.string().default(""),
  COMPANY_NAME: z.string().default("TurboNetwork ISP"),
  CURRENCY_SYMBOL: z.string().default("$"),
  DEFAULT_DUE_DAYS: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Error en la configuración de variables de entorno:", parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  JWT_SECRET: resolveStrongJwtSecret(parsed.data.JWT_SECRET, parsed.data.NODE_ENV),
};
