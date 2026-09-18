import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config/env";

// Pool de conexiones optimizado para bajo consumo de memoria RAM
export const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // Suprime notices redundantes
});

export const db = drizzle(queryClient, { schema });
export { schema };
