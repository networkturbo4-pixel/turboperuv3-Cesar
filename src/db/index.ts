import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config/env";

// ============================================================================
// CIRCUIT BREAKER PARA EVITAR SATURACIÓN DE LA BASE DE DATOS BAJO ALTA CARGA
// ============================================================================
class DatabaseCircuitBreaker {
  private failureCount = 0;
  private maxFailures = 3;
  private resetTimeoutMs = 30000; // 30s de enfriamiento si falla o se satura la BD
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  public getStatus() {
    this.checkHalfOpen();
    return {
      state: this.state,
      failures: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      isAvailable: this.state !== "OPEN",
    };
  }

  private checkHalfOpen() {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      }
    }
  }

  public canAttempt(): boolean {
    this.checkHalfOpen();
    return this.state !== "OPEN";
  }

  public recordSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  public recordFailure(err?: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.maxFailures) {
      if (this.state !== "OPEN") {
        console.warn(
          `⚠️ [DB Circuit Breaker] Conexión a PostgreSQL no disponible o saturada (${err?.message || "Error"}). Circuito ABIERTO por ${this.resetTimeoutMs / 1000}s para garantizar respuesta inmediata.`
        );
      }
      this.state = "OPEN";
    }
  }

  /**
   * Ejecuta una consulta a la BD con protección de disyuntor y timeout rápido.
   * Si la BD está caída, saturada o lenta, retorna de inmediato el fallback sin bloquear el event loop.
   */
  public async executeSafe<T>(fn: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
    if (!this.canAttempt()) {
      // Circuito abierto: respuesta inmediata (0ms de espera)
      return fallback();
    }

    try {
      // Timeout de seguridad de 2.8 segundos
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout de consulta a la base de datos (2.8s)")), 2800)
        ),
      ]);
      this.recordSuccess();
      return result;
    } catch (err: any) {
      this.recordFailure(err);
      return fallback();
    }
  }
}

export const dbCircuitBreaker = new DatabaseCircuitBreaker();

// Pool de conexiones optimizado para alta concurrencia y baja latencia
export const queryClient = postgres(env.DATABASE_URL, {
  max: 20,                // Capacidad equilibrada para decenas de usuarios concurrentes
  idle_timeout: 10,       // Liberar sockets inactivos rápidamente
  connect_timeout: 2.5,   // Fallo rápido (2.5s en lugar de 10s) para evitar colapsos
  max_lifetime: 60 * 30,  // Reciclar conexiones cada 30 min (evita memory leaks)
  onnotice: () => {},     // Suprime notices redundantes
  connection: {
    statement_timeout: 3000, // Timeout estricto de 3s por consulta SQL
  },
});

export const db = drizzle(queryClient, { schema });
export { schema };
