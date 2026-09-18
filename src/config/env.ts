import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/turbonetwork"),
  JWT_SECRET: z.string().default("turbonetwork_super_secret_jwt_key_default"),
  COMPANY_NAME: z.string().default("TurboNetwork ISP"),
  CURRENCY_SYMBOL: z.string().default("$"),
  DEFAULT_DUE_DAYS: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Error en la configuración de variables de entorno:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
