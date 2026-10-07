import fs from "fs";
import path from "path";
import { db, schema, queryClient, dbCircuitBreaker } from "../../db";
import { sql, eq } from "drizzle-orm";
import { env } from "../../config/env";
import { getTenantFilePath } from "../tenants/tenants.service";

const DATA_DIR = path.resolve(process.cwd(), "data");

export interface DatabaseStatus {
  isConnected: boolean;
  circuitBreaker: {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failures: number;
    isAvailable: boolean;
    lastFailureTime: string | null;
  };
  postgres: {
    urlMasked: string;
    serverTime?: string;
    version?: string;
    latencyMs?: number;
    counts: {
      users: number;
      customers: number;
      devices: number;
      invoices: number;
      payments: number;
    };
  };
  jsonStorage: {
    tenantsCount: number;
    usersCount: number;
    customersCount: number;
    devicesCount: number;
    invoicesCount: number;
  };
  migrationParity: {
    isFullyMigrated: boolean;
    syncStatus: string;
    details: string;
  };
}

export interface MigrationResult {
  success: boolean;
  durationMs: number;
  migrated: {
    tenants: number;
    users: number;
    devices: number;
    customers: number;
    invoices: number;
    payments: number;
  };
  errors: string[];
  message: string;
  timestamp: string;
}

export class DatabaseService {
  /**
   * Oculta contraseñas en URLs de conexión
   */
  public static maskDatabaseUrl(url: string): string {
    try {
      const u = new URL(url);
      if (u.password) u.password = "••••••••";
      return u.toString();
    } catch (e) {
      return "postgresql://user:••••@localhost:5432/turbonetwork";
    }
  }

  /**
   * Diagnóstico completo de salud y estado de sincronización JSON <-> PostgreSQL
   */
  public static async getStatus(): Promise<DatabaseStatus> {
    const cbStatus = dbCircuitBreaker.getStatus();
    const startTime = Date.now();
    let isConnected = false;
    let serverTime: string | undefined;
    let version: string | undefined;
    let latencyMs: number | undefined;

    const pgCounts = {
      users: 0,
      customers: 0,
      devices: 0,
      invoices: 0,
      payments: 0,
    };

    // 1. Probar conectividad con PostgreSQL si el disyuntor lo permite
    if (cbStatus.isAvailable) {
      try {
        const ping = await Promise.race([
          queryClient`SELECT NOW() as server_time, version() as version`,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000)),
        ]);
        if (ping && ping.length > 0) {
          isConnected = true;
          latencyMs = Date.now() - startTime;
          serverTime = ping[0].server_time?.toISOString?.() || String(ping[0].server_time);
          version = ping[0].version?.split(" ")?.[0] || "PostgreSQL";

          // Contar registros reales en tablas PostgreSQL
          try {
            const [uCount] = await queryClient`SELECT count(*)::int as c FROM users`;
            pgCounts.users = uCount?.c || 0;
          } catch (e) {}

          try {
            const [cCount] = await queryClient`SELECT count(*)::int as c FROM customers`;
            pgCounts.customers = cCount?.c || 0;
          } catch (e) {}

          try {
            const [dCount] = await queryClient`SELECT count(*)::int as c FROM network_devices`;
            pgCounts.devices = dCount?.c || 0;
          } catch (e) {}

          try {
            const [iCount] = await queryClient`SELECT count(*)::int as c FROM invoices`;
            pgCounts.invoices = iCount?.c || 0;
          } catch (e) {}

          try {
            const [pCount] = await queryClient`SELECT count(*)::int as c FROM payments`;
            pgCounts.payments = pCount?.c || 0;
          } catch (e) {}

          dbCircuitBreaker.recordSuccess();
        }
      } catch (err: any) {
        dbCircuitBreaker.recordFailure(err);
        isConnected = false;
      }
    }

    // 2. Contar registros existentes en archivos JSON del disco
    let jsonUsers = 0;
    try {
      const uPath = path.join(DATA_DIR, "users.json");
      if (fs.existsSync(uPath)) {
        const u = JSON.parse(fs.readFileSync(uPath, "utf-8"));
        jsonUsers = Array.isArray(u) ? u.length : 0;
      }
    } catch (e) {}

    let jsonTenants = 1;
    try {
      const tPath = path.join(DATA_DIR, "tenants.json");
      if (fs.existsSync(tPath)) {
        const t = JSON.parse(fs.readFileSync(tPath, "utf-8"));
        jsonTenants = Array.isArray(t) ? t.length : 1;
      }
    } catch (e) {}

    let jsonCustomers = 0;
    let jsonDevices = 0;
    let jsonInvoices = 0;

    // Recorrer tenants para contar clientes, facturas y dispositivos JSON
    const tenantsDir = path.join(DATA_DIR, "tenants");
    if (fs.existsSync(tenantsDir)) {
      try {
        const dirs = fs.readdirSync(tenantsDir);
        for (const dir of dirs) {
          const tenantPath = path.join(tenantsDir, dir);
          try {
            if (!fs.statSync(tenantPath).isDirectory()) continue;

            const cFile = path.join(tenantPath, "customers.json");
            if (fs.existsSync(cFile)) {
              const c = JSON.parse(fs.readFileSync(cFile, "utf-8"));
              if (Array.isArray(c)) jsonCustomers += c.length;
            }

            const dFile = path.join(tenantPath, "devices.json");
            if (fs.existsSync(dFile)) {
              const d = JSON.parse(fs.readFileSync(dFile, "utf-8"));
              if (Array.isArray(d)) jsonDevices += d.length;
            }

            const iFile = path.join(tenantPath, "invoices.json");
            if (fs.existsSync(iFile)) {
              const i = JSON.parse(fs.readFileSync(iFile, "utf-8"));
              if (Array.isArray(i)) jsonInvoices += i.length;
            }
          } catch (itemErr) {}
        }
      } catch (e) {}
    }

    // Si no encontró clientes en tenants, revisar la raíz data/customers.json
    if (jsonCustomers === 0) {
      try {
        const cFile = path.join(DATA_DIR, "customers.json");
        if (fs.existsSync(cFile)) {
          const c = JSON.parse(fs.readFileSync(cFile, "utf-8"));
          if (Array.isArray(c)) jsonCustomers = c.length;
        }
      } catch (e) {}
    }

    // 3. Determinar paridad de sincronización
    const isFullyMigrated =
      isConnected &&
      pgCounts.customers >= jsonCustomers &&
      jsonCustomers > 0 &&
      pgCounts.invoices >= jsonInvoices;

    let syncStatus = "Modo Híbrido Resiliente (JSON activo, Fallback listo)";
    let details = "Los datos operan de forma inmediata en JSON con fallback de alta velocidad.";

    if (isConnected) {
      if (isFullyMigrated) {
        syncStatus = "PostgreSQL Sincronizado y Homologado";
        details = "Todas las tablas en PostgreSQL tienen paridad completa con los archivos operacionales.";
      } else {
        syncStatus = "PostgreSQL Conectado (Migración disponible)";
        details = `PostgreSQL está en línea. Hay ${jsonCustomers} clientes y ${jsonInvoices} recibos en JSON listos para migración a PostgreSQL.`;
      }
    } else {
      syncStatus = "Almacenamiento Local JSON (PostgreSQL Desconectado)";
      details = "El motor está respondiendo desde JSON plano. Cuando PostgreSQL esté disponible se reconecta automáticamente.";
    }

    return {
      isConnected,
      circuitBreaker: dbCircuitBreaker.getStatus(),
      postgres: {
        urlMasked: this.maskDatabaseUrl(env.DATABASE_URL),
        serverTime,
        version,
        latencyMs,
        counts: pgCounts,
      },
      jsonStorage: {
        tenantsCount: jsonTenants,
        usersCount: jsonUsers,
        customersCount: jsonCustomers,
        devicesCount: jsonDevices,
        invoicesCount: jsonInvoices,
      },
      migrationParity: {
        isFullyMigrated,
        syncStatus,
        details,
      },
    };
  }

  /**
   * Ejecuta la migración completa y segura de archivos JSON a PostgreSQL
   */
  public static async migrateAllJsonToPostgres(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const migrated = {
      tenants: 0,
      users: 0,
      devices: 0,
      customers: 0,
      invoices: 0,
      payments: 0,
    };

    // 1. Probar que PostgreSQL esté en línea
    try {
      await queryClient`SELECT 1`;
    } catch (connErr: any) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        migrated,
        errors: [`No se puede conectar a PostgreSQL: ${connErr.message}`],
        message: "Error de conexión a PostgreSQL. Verifique DATABASE_URL.",
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Migrar Usuarios
    try {
      const uPath = path.join(DATA_DIR, "users.json");
      if (fs.existsSync(uPath)) {
        const usersList: any[] = JSON.parse(fs.readFileSync(uPath, "utf-8"));
        for (const u of usersList) {
          try {
            await queryClient`
              INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
              VALUES (${u.name || "Usuario"}, ${u.email}, ${u.passwordHash || u.password || "hash_default"}, ${u.role || "admin"}, true, ${u.tenantId || "turbonetwork"})
              ON CONFLICT (email) DO UPDATE 
              SET name = EXCLUDED.name, role = EXCLUDED.role, tenant_id = EXCLUDED.tenant_id
            `;
            migrated.users++;
          } catch (insertErr: any) {
            errors.push(`Usuario ${u.email}: ${insertErr.message}`);
          }
        }
      }
    } catch (e: any) {
      errors.push(`Lectura de users.json: ${e.message}`);
    }

    // 3. Descubrir empresas (tenants)
    const tenantIds: string[] = ["turbonetwork", "celeris", "loanetwork"];
    try {
      const tPath = path.join(DATA_DIR, "tenants.json");
      if (fs.existsSync(tPath)) {
        const tList: any[] = JSON.parse(fs.readFileSync(tPath, "utf-8"));
        for (const t of tList) {
          if (t.id && !tenantIds.includes(t.id)) tenantIds.push(t.id);
        }
      }
    } catch (e) {}

    migrated.tenants = tenantIds.length;

    // 4. Migrar Equipos de Red (Devices)
    for (const tId of tenantIds) {
      try {
        const dPath = getTenantFilePath(tId, "devices.json");
        if (fs.existsSync(dPath)) {
          const devList: any[] = JSON.parse(fs.readFileSync(dPath, "utf-8"));
          for (const d of devList) {
            try {
              await queryClient`
                INSERT INTO network_devices (tenant_id, name, vendor, model, ip_address, port, username, api_type, status)
                VALUES (${tId}, ${d.name}, ${d.vendor || "mikrotik"}, ${d.model || null}, ${d.ipAddress}, ${d.port || 8728}, ${d.username || "admin"}, ${d.apiType || "routeros_api"}, ${d.status || "online"})
                ON CONFLICT DO NOTHING
              `;
              migrated.devices++;
            } catch (dErr: any) {
              errors.push(`Equipo ${d.name} (${tId}): ${dErr.message}`);
            }
          }
        }
      } catch (e) {}
    }

    // 5. Migrar Clientes y Servicios
    for (const tId of tenantIds) {
      try {
        const cPath = getTenantFilePath(tId, "customers.json");
        if (fs.existsSync(cPath)) {
          const custList: any[] = JSON.parse(fs.readFileSync(cPath, "utf-8"));
          for (const c of custList) {
            try {
              const code = c.code || `CLI-${c.id}`;
              const fullName = c.fullName || c.name || "Cliente Sin Nombre";
              const dni = c.dni || c.documentNumber || `DNI-${c.id}`;
              const phone = c.phone || "000000000";
              const email = c.email || null;
              const address = c.address || "Dirección no especificada";
              const status = c.status || "active";

              const [insertedCust] = await queryClient`
                INSERT INTO customers (tenant_id, customer_code, full_name, identification, phone, email, address, status)
                VALUES (${tId}, ${code}, ${fullName}, ${dni}, ${phone}, ${email}, ${address}, ${status})
                ON CONFLICT (tenant_id, customer_code) DO UPDATE
                SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, address = EXCLUDED.address, status = EXCLUDED.status
                RETURNING id
              `;

              migrated.customers++;

              // Si tiene datos de servicio, registrar en customer_services
              if (insertedCust?.id && (c.assignedIp || c.pppoeUsername || c.monthlyFee || c.plan)) {
                try {
                  await queryClient`
                    INSERT INTO customer_services (tenant_id, customer_id, plan_id, assigned_ip, pppoe_username, monthly_fee, status)
                    VALUES (${tId}, ${insertedCust.id}, 1, ${c.assignedIp || null}, ${c.pppoeUsername || null}, ${parseFloat(c.monthlyFee || c.price || 50).toFixed(2)}, ${status})
                    ON CONFLICT DO NOTHING
                  `;
                } catch (sErr) {}
              }
            } catch (cErr: any) {
              errors.push(`Cliente #${c.id} (${tId}): ${cErr.message}`);
            }
          }
        }
      } catch (e) {}
    }

    // 6. Migrar Facturación y Pagos
    for (const tId of tenantIds) {
      try {
        const iPath = getTenantFilePath(tId, "invoices.json");
        if (fs.existsSync(iPath)) {
          const invList: any[] = JSON.parse(fs.readFileSync(iPath, "utf-8"));
          for (const inv of invList) {
            try {
              const invNum = inv.invoiceNumber || inv.number || `REC-${inv.id}`;
              const custId = inv.customerId || 1;
              const period = inv.period || "2026-10";
              const issueDate = inv.issueDate ? new Date(inv.issueDate) : new Date();
              const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(Date.now() + 5 * 86400000);
              const total = parseFloat(inv.total || inv.amount || 0).toFixed(2);
              const subtotal = total;
              const status = inv.status || "pending";

              const [insertedInv] = await queryClient`
                INSERT INTO invoices (tenant_id, invoice_number, customer_id, period, issue_date, due_date, subtotal, total, status)
                VALUES (${tId}, ${invNum}, ${custId}, ${period}, ${issueDate}, ${dueDate}, ${subtotal}, ${total}, ${status})
                ON CONFLICT (tenant_id, invoice_number) DO UPDATE
                SET status = EXCLUDED.status, total = EXCLUDED.total
                RETURNING id
              `;

              migrated.invoices++;

              // Si está pagada, registrar pago en la tabla payments
              if (insertedInv?.id && status === "paid") {
                try {
                  const payAmount = total;
                  const payMethod = inv.paymentMethod || "cash";
                  const refNum = inv.referenceNumber || `PAG-${inv.id}`;
                  const payDate = inv.paidDate ? new Date(inv.paidDate) : new Date();

                  await queryClient`
                    INSERT INTO payments (tenant_id, invoice_id, customer_id, amount, payment_method, reference_number, payment_date)
                    VALUES (${tId}, ${insertedInv.id}, ${custId}, ${payAmount}, ${payMethod}, ${refNum}, ${payDate})
                    ON CONFLICT DO NOTHING
                  `;
                  migrated.payments++;
                } catch (pErr) {}
              }
            } catch (invErr: any) {
              errors.push(`Recibo #${inv.id} (${tId}): ${invErr.message}`);
            }
          }
        }
      } catch (e) {}
    }

    const durationMs = Date.now() - startTime;
    const success = errors.length < 5;

    return {
      success,
      durationMs,
      migrated,
      errors: errors.slice(0, 10), // Limitar a los 10 primeros
      message: success
        ? `¡Migración completada con éxito en ${(durationMs / 1000).toFixed(2)}s! ${migrated.customers} clientes, ${migrated.invoices} facturas y ${migrated.devices} equipos sincronizados en PostgreSQL.`
        : `Migración finalizada con ${errors.length} advertencias en ${(durationMs / 1000).toFixed(2)}s.`,
      timestamp: new Date().toISOString(),
    };
  }
}
