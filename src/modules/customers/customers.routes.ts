import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { db, schema, dbCircuitBreaker } from "../../db";
import { eq } from "drizzle-orm";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { MikroTikService } from "../network/mikrotik.service";
import { SystemNotificationsService } from "../messages/system-notifications.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const RECEIPT_DISPATCH_FILE = path.join(DATA_DIR, "receipt_dispatch_settings.json");

export type DispatchChannels = {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
};

export type BeforeDueStage = {
  enabled: boolean;
  daysBefore: number;
  dispatchTime: string;
  channels: DispatchChannels;
  subject: string;
  template: string;
};

export type OnDueStage = {
  enabled: boolean;
  dispatchTime: string;
  channels: DispatchChannels;
  subject: string;
  template: string;
};

export type OnCutStage = {
  enabled: boolean;
  graceDaysAfterDue: number;
  actionType: "suspend_traffic" | "captive_portal" | "notify_only";
  actionDescription: string;
  dispatchTime: string;
  channels: DispatchChannels;
  subject: string;
  template: string;
};

export type ReceiptDispatchConfig = {
  enabled: boolean;
  companyName: string;
  supportPhone: string;
  paymentLinkDefault: string;
  stages: {
    beforeDue: BeforeDueStage;
    onDue: OnDueStage;
    onCut: OnCutStage;
  };
  updatedAt: string;
};

export const defaultDispatchConfig: ReceiptDispatchConfig = {
  enabled: true,
  companyName: "TurboNetwork Fibra",
  supportPhone: "+51 987 654 321",
  paymentLinkDefault: "https://pagos.turbonetwork.net/pago",
  stages: {
    beforeDue: {
      enabled: true,
      daysBefore: 3,
      dispatchTime: "09:00",
      channels: {
        whatsapp: true,
        email: true,
        sms: false,
      },
      subject: "Aviso de Recibo de Internet - Próximo Vencimiento",
      template: `Estimado(a) *{cliente}*,

Le recordamos que su servicio de internet *{servicio}* cuenta con su recibo emitido por el monto de *\${monto}*.

- *Nº de Recibo:* {recibo_nro}
- *Fecha Límite de Pago:* {fecha_vencimiento}

Evite recargos y realice su pago en línea de manera segura en:
{enlace_pago}

Agradecemos su puntualidad para seguir brindándole la mejor experiencia de conectividad.

Atentamente,
*{empresa}* - Soporte: {telefono_soporte}`,
    },
    onDue: {
      enabled: true,
      dispatchTime: "08:30",
      channels: {
        whatsapp: true,
        email: true,
        sms: true,
      },
      subject: "Recordatorio: Vencimiento de Servicio de Internet Hoy",
      template: `Estimado(a) *{cliente}*,

Le informamos que el día de *HOY* vence el plazo de pago de su servicio de internet *{servicio}*.

- *Monto a Pagar:* \${monto}
- *Nº de Recibo:* {recibo_nro}
- *Fecha de Vencimiento:* {fecha_vencimiento}

Para evitar la interrupción de su navegación, realice su abono aquí:
{enlace_pago}

Si ya realizó su pago en las últimas horas, por favor remita su comprobante al WhatsApp: {telefono_soporte}.

Muchas gracias,
*{empresa}*`,
    },
    onCut: {
      enabled: true,
      graceDaysAfterDue: 2,
      actionType: "suspend_traffic",
      actionDescription: "Suspender servicio en enrutador MikroTik y cortar tráfico",
      dispatchTime: "10:00",
      channels: {
        whatsapp: true,
        email: true,
        sms: true,
      },
      subject: "Aviso Importante: Servicio Suspendido por Falta de Pago",
      template: `AVISO IMPORTANTE: *{cliente}*

Le comunicamos que su servicio de internet *{servicio}* ha sido *SUSPENDIDO TEMPORALMENTE* por falta de pago tras vencer el periodo de gracia ({dias_vencido} días).

- *Estado:* Servicio Suspendido
- *Saldo Pendiente:* \${monto}
- *Recibo Vencido:* {recibo_nro}

*¿CÓMO REACTIVAR SU SERVICIO INMEDIATAMENTE?*
1. Realice el pago del monto adeudado en línea: {enlace_pago}
2. Remita su comprobante al canal de soporte oficial: {telefono_soporte}
3. El sistema reactivará automáticamente su ancho de banda en un plazo máximo de 10 minutos.

Estamos atentos para brindarle asistencia inmediata.
*{empresa}* - Operaciones de Red`,
    },
  },
  updatedAt: new Date().toISOString(),
};

function loadDispatchSettingsFromDisk(tenantId = "turbonetwork"): ReceiptDispatchConfig {
  try {
    const file = getTenantFilePath(tenantId, "receipt_dispatch.json");
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...defaultDispatchConfig,
        ...parsed,
        stages: {
          beforeDue: { ...defaultDispatchConfig.stages.beforeDue, ...(parsed.stages?.beforeDue || {}) },
          onDue: { ...defaultDispatchConfig.stages.onDue, ...(parsed.stages?.onDue || {}) },
          onCut: { ...defaultDispatchConfig.stages.onCut, ...(parsed.stages?.onCut || {}) },
        },
      };
    }
    if (fs.existsSync(RECEIPT_DISPATCH_FILE)) {
      const raw = fs.readFileSync(RECEIPT_DISPATCH_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...defaultDispatchConfig, ...parsed };
    }
    return defaultDispatchConfig;
  } catch (err) {
    console.warn(`Aviso: No se pudo leer receipt_dispatch.json para ${tenantId}, usando defaults:`, err);
    return defaultDispatchConfig;
  }
}

function saveDispatchSettingsToDisk(tenantId = "turbonetwork", cfg: ReceiptDispatchConfig): boolean {
  try {
    const file = getTenantFilePath(tenantId, "receipt_dispatch.json");
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`Error al guardar receipt_dispatch.json para ${tenantId}:`, err);
    return false;
  }
}

export const createCustomerSchema = z.object({
  fullName: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres"),
  identification: z.string().min(4, "El documento debe tener al menos 4 caracteres"),
  phone: z.string().min(6, "El número de teléfono debe ser válido"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  address: z.string().min(3, "La dirección de instalación es requerida"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  serviceId: z.number().int().optional(),
  planId: z.number().int().optional(),
  serviceName: z.string().optional(),
  planName: z.string().optional(),
  serviceSpeed: z.string().optional(),
  startDate: z.string().optional(),
  assignedIp: z.string().optional().default("Dinámica"),
  status: z.enum(["active", "suspended", "canceled", "pending_installation"]).default("active"),
  notes: z.string().optional().default(""),
  balance: z.string().optional().default("0.00"),
});

export type CustomerRecord = {
  id: number;
  customerCode: string;
  fullName: string;
  identification: string;
  phone: string;
  email?: string;
  address: string;
  latitude?: string;
  longitude?: string;
  serviceId?: number;
  planId?: number;
  serviceName: string;
  planName?: string;
  serviceSpeed?: string;
  startDate: string;
  assignedIp: string;
  status: "active" | "suspended" | "canceled" | "pending_installation";
  notes?: string;
  balance: string;
  createdAt: string;
  updatedAt?: string;
};

const defaultCustomers: CustomerRecord[] = [
  {
    id: 1,
    customerCode: "CLI-1001",
    fullName: "Carlos Mendoza Silva",
    identification: "1098234812",
    phone: "+57 312 456 7890",
    email: "carlos.mendoza@gmail.com",
    address: "Calle 14 # 8-45, Urb. El Prado",
    status: "active",
    serviceId: 2,
    planId: 2,
    serviceName: "Fibra Pro 100 Mbps",
    planName: "Fibra Pro 100 Mbps",
    serviceSpeed: "100 Mbps",
    startDate: "2026-08-15",
    assignedIp: "192.168.88.24",
    balance: "0.00",
    notes: "Instalación en piso 2 con router GPON",
    createdAt: "2026-08-15T10:00:00Z",
  },
  {
    id: 2,
    customerCode: "CLI-1002",
    fullName: "Empresa Inversiones Andina SAS",
    identification: "901283921-1",
    phone: "+57 320 987 6543",
    email: "finanzas@andina.com",
    address: "Cra 7 # 72-10, Torre B Of. 502",
    status: "active",
    serviceId: 4,
    planId: 4,
    serviceName: "Corporativo Simétrico 500 Mbps",
    planName: "Corporativo Simétrico 500 Mbps",
    serviceSpeed: "500 Mbps Simétrico",
    startDate: "2026-07-20",
    assignedIp: "192.168.88.100",
    balance: "0.00",
    notes: "Enlace dedicado con IP Pública Estática",
    createdAt: "2026-07-20T08:30:00Z",
  },
  {
    id: 3,
    customerCode: "CLI-1003",
    fullName: "Mariana Restrepo López",
    identification: "52891044",
    phone: "+57 301 234 5678",
    email: "mariana.r@hotmail.com",
    address: "Av. Boyacá # 68-12 Apto 304",
    status: "suspended",
    serviceId: 1,
    planId: 1,
    serviceName: "Fibra Hogar 50 Mbps",
    planName: "Fibra Hogar 50 Mbps",
    serviceSpeed: "50 Mbps",
    startDate: "2026-09-01",
    assignedIp: "192.168.88.55",
    balance: "20.00",
    notes: "Abonado temporalmente suspendido por mora",
    createdAt: "2026-09-01T14:15:00Z",
  },
  {
    id: 4,
    customerCode: "CLI-1004",
    fullName: "David Fernández Gómez",
    identification: "1018449120",
    phone: "+57 318 665 4433",
    email: "david.fg@outlook.com",
    address: "Diagonal 45 # 19-30",
    status: "active",
    serviceId: 3,
    planId: 3,
    serviceName: "Fibra Gamer 300 Mbps",
    planName: "Fibra Gamer 300 Mbps",
    serviceSpeed: "300 Mbps Fast-Path",
    startDate: "2026-09-10",
    assignedIp: "192.168.88.72",
    balance: "0.00",
    notes: "Router Wi-Fi 6 instalado",
    createdAt: "2026-09-10T11:00:00Z",
  },
];

export function loadCustomersFromDisk(tenantId = "turbonetwork"): CustomerRecord[] {
  try {
    const file = getTenantFilePath(tenantId, "customers.json");
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const raw = fs.readFileSync(CUSTOMERS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    return defaultCustomers;
  } catch (err) {
    console.warn(`Aviso: No se pudo leer customers.json para ${tenantId}, usando memoria:`, err);
    return defaultCustomers;
  }
}

export function saveCustomersToDisk(tenantId = "turbonetwork", list: CustomerRecord[]) {
  try {
    const file = getTenantFilePath(tenantId, "customers.json");
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir customers.json para ${tenantId}:`, err);
  }
}

export const loadTenantCustomers = loadCustomersFromDisk;
export const saveTenantCustomers = saveCustomersToDisk;

function getServiceDetails(tenantId = "turbonetwork", serviceId?: number) {
  if (!serviceId) return null;
  try {
    const file = getTenantFilePath(tenantId, "services.json");
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const services = JSON.parse(raw);
      if (Array.isArray(services)) {
        return services.find((s: any) => s.id === serviceId);
      }
    }
    if (fs.existsSync(SERVICES_FILE)) {
      const raw = fs.readFileSync(SERVICES_FILE, "utf-8");
      const services = JSON.parse(raw);
      if (Array.isArray(services)) {
        return services.find((s: any) => s.id === serviceId);
      }
    }
  } catch {}
  return null;
}

export const customersRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar clientes con búsqueda opcional y filtros
  fastify.get("/customers", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { search, status } = request.query as { search?: string; status?: string };

    try {
      const data = await dbCircuitBreaker.executeSafe(
        async () => {
          return await db.select().from(schema.customers).where(eq(schema.customers.tenantId, tenantId));
        },
        () => []
      );
      if (data && data.length > 0) {
        let filtered = data as any[];
        if (status) filtered = filtered.filter((c) => c.status === status);
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.fullName?.toLowerCase().includes(q) ||
              c.customerCode?.toLowerCase().includes(q) ||
              c.identification?.includes(q) ||
              c.assignedIp?.includes(q)
          );
        }
        return reply.send({ success: true, tenantId, count: filtered.length, data: filtered });
      }
    } catch {
      // Usar almacenamiento persistente local
    }

    const customers = loadCustomersFromDisk(tenantId);
    let filtered = customers;
    if (status) filtered = filtered.filter((c) => c.status === status);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.identification.includes(q) ||
          c.assignedIp?.toLowerCase().includes(q) ||
          c.serviceName?.toLowerCase().includes(q)
      );
    }
    return reply.send({ success: true, tenantId, count: filtered.length, data: filtered });
  });

  // Crear nuevo cliente con asignación de servicio y fecha de inicio
  fastify.post("/customers", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createCustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const payload = parseResult.data;
    const customers = loadCustomersFromDisk(tenantId);

    // Generar ID y código correlativo CLI-100X
    const nextId = customers.length > 0 ? Math.max(...customers.map((c) => c.id)) + 1 : 1;
    let maxNumber = 1000;
    for (const c of customers) {
      const match = c.customerCode?.match(/CLI-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    const customerCode = `CLI-${maxNumber + 1}`;

    // Resolver servicio asignado y velocidad
    const targetServiceId = payload.serviceId || payload.planId;
    let resolvedServiceName = payload.serviceName || payload.planName || "Servicio Estándar";
    let resolvedSpeed = payload.serviceSpeed || "";

    if (targetServiceId) {
      const srv = getServiceDetails(tenantId, targetServiceId);
      if (srv) {
        resolvedServiceName = srv.name;
        resolvedSpeed = `${srv.downloadSpeedMbps}M bajada / ${srv.uploadSpeedMbps}M subida`;
      }
    }

    // Fecha de inicio por defecto: hoy
    const today = new Date().toISOString().slice(0, 10);
    const startDate = payload.startDate && payload.startDate.trim() !== "" ? payload.startDate : today;

    const newCustomer: CustomerRecord = {
      id: nextId,
      customerCode,
      fullName: payload.fullName,
      identification: payload.identification,
      phone: payload.phone,
      email: payload.email || undefined,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      serviceId: targetServiceId,
      planId: targetServiceId,
      serviceName: resolvedServiceName,
      planName: resolvedServiceName,
      serviceSpeed: resolvedSpeed,
      startDate,
      assignedIp: payload.assignedIp || "Dinámica",
      status: payload.status,
      notes: payload.notes || "",
      balance: payload.balance || "0.00",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    customers.unshift(newCustomer);
    saveCustomersToDisk(tenantId, customers);

    try {
      await dbCircuitBreaker.executeSafe(
        async () => {
          await db.insert(schema.customers).values({
            tenantId,
            customerCode: newCustomer.customerCode,
            fullName: newCustomer.fullName,
            identification: newCustomer.identification,
            phone: newCustomer.phone,
            email: newCustomer.email,
            address: newCustomer.address,
            status: newCustomer.status as any,
          });
        },
        () => null
      );
    } catch {
      // Guardado exitoso en almacenamiento persistente
    }

    return reply.status(201).send({
      success: true,
      tenantId,
      message: "Cliente registrado exitosamente con servicio y fecha de inicio asignados",
      data: newCustomer,
    });
  });

  // Cambiar estado de cliente (Activar / Suspender)
  fastify.patch("/customers/:id/status", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const customerId = parseInt(id, 10);
    const { status } = request.body as { status: CustomerRecord["status"] };

    const customers = loadCustomersFromDisk(tenantId);
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
    }

    customer.status = status;
    customer.updatedAt = new Date().toISOString();
    saveCustomersToDisk(tenantId, customers);

    // ========================================================
    // APLICACIÓN AUTOMÁTICA EN MIKROTIK (CORTE / REACTIVACIÓN)
    // ========================================================
    let mikrotikReport: any = null;
    try {
      const devPath = getTenantFilePath(tenantId, "devices.json");
      if (fs.existsSync(devPath)) {
        const devices = JSON.parse(fs.readFileSync(devPath, "utf-8"));
        const targetRouter = devices.find((d: any) => d.vendor === "mikrotik");
        if (targetRouter) {
          const custPayload = {
            id: customer.id,
            name: customer.fullName || customer.name || `Cliente #${customer.id}`,
            ip: customer.assignedIp || customer.ip || undefined,
            pppoeUsername: customer.pppoeUsername || undefined,
          };
          if (status === "suspended") {
            mikrotikReport = await MikroTikService.suspendCustomerService(targetRouter, custPayload);
          } else if (status === "active") {
            mikrotikReport = await MikroTikService.reactivateCustomerService(targetRouter, custPayload);
          }
        }
      }
    } catch (mktErr: any) {
      console.warn("Aviso al sincronizar estado de cliente con MikroTik:", mktErr?.message);
    }

    // Si el estado pasó a suspendido, notificar al abonado por TurboChat y WhatsApp
    if (status === "suspended") {
      SystemNotificationsService.notifyServiceCutoff(tenantId, customer).catch((err) => {
        console.warn("Aviso al enviar notificación de corte:", err?.message);
      });
    }

    const message = mikrotikReport
      ? `Estado del cliente actualizado a '${status}'. Regla aplicada en MikroTik (${mikrotikReport.message}).`
      : `Estado del cliente actualizado a '${status}'`;

    return reply.send({
      success: true,
      tenantId,
      message,
      data: customer,
      mikrotik: mikrotikReport,
    });
  });

  // Eliminar cliente individual
  fastify.delete("/customers/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const customerId = parseInt(id, 10);

    const customers = loadCustomersFromDisk(tenantId);
    const index = customers.findIndex((c) => c.id === customerId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
    }

    const removed = customers.splice(index, 1)[0];
    saveCustomersToDisk(tenantId, customers);

    return reply.send({
      success: true,
      tenantId,
      message: `Cliente ${removed.fullName} eliminado exitosamente`,
      data: removed,
    });
  });

  // Acciones masivas sobre clientes seleccionados
  fastify.post("/customers/bulk-action", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const bulkSchema = z.object({
      customerIds: z.array(z.number().int()).min(1, "Debe seleccionar al menos un cliente"),
      action: z.enum(["delete", "suspend", "activate"]),
    });

    const parse = bulkSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const { customerIds, action } = parse.data;
    let customers = loadCustomersFromDisk(tenantId);

    const idSet = new Set(customerIds);
    let affectedCount = 0;

    if (action === "delete") {
      const initialCount = customers.length;
      customers = customers.filter((c) => !idSet.has(c.id));
      affectedCount = initialCount - customers.length;
      saveCustomersToDisk(tenantId, customers);

      return reply.send({
        success: true,
        tenantId,
        message: `Se eliminaron exitosamente ${affectedCount} cliente(s)`,
        affectedCount,
      });
    }

    const targetStatus = action === "suspend" ? "suspended" : "active";
    const affectedCustomers: any[] = [];
    for (const c of customers) {
      if (idSet.has(c.id)) {
        c.status = targetStatus;
        c.updatedAt = new Date().toISOString();
        affectedCount++;
        affectedCustomers.push(c);
      }
    }
    saveCustomersToDisk(tenantId, customers);

    // Sincronización en MikroTik para las acciones masivas
    let bulkMikrotikReport = "";
    try {
      const devPath = getTenantFilePath(tenantId, "devices.json");
      if (fs.existsSync(devPath)) {
        const devices = JSON.parse(fs.readFileSync(devPath, "utf-8"));
        const targetRouter = devices.find((d: any) => d.vendor === "mikrotik");
        if (targetRouter) {
          for (const aff of affectedCustomers) {
            const p = {
              id: aff.id,
              name: aff.fullName || aff.name || `Cliente #${aff.id}`,
              ip: aff.assignedIp || aff.ip || undefined,
              pppoeUsername: aff.pppoeUsername || undefined,
            };
            if (action === "suspend") {
              await MikroTikService.suspendCustomerService(targetRouter, p);
            } else if (action === "activate") {
              await MikroTikService.reactivateCustomerService(targetRouter, p);
            }
          }
          bulkMikrotikReport = ` | MikroTik sincronizado (${affectedCount} reglas actualizadas).`;
        }
      }
    } catch (e) {}

    const actionName = action === "suspend" ? "suspendieron" : "activaron";
    return reply.send({
      success: true,
      tenantId,
      message: `Se ${actionName} exitosamente ${affectedCount} cliente(s)${bulkMikrotikReport}`,
      affectedCount,
    });
  });

  // Obtener configuración del despacho de recibos
  fastify.get("/customers/receipt-dispatch-config", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const config = loadDispatchSettingsFromDisk(tenantId);
    return reply.send({
      success: true,
      tenantId,
      data: config,
    });
  });

  // Guardar configuración del despacho de recibos
  fastify.post("/customers/receipt-dispatch-config", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as Partial<ReceiptDispatchConfig>;
    const current = loadDispatchSettingsFromDisk(tenantId);

    const updatedConfig: ReceiptDispatchConfig = {
      ...current,
      ...body,
      stages: {
        beforeDue: {
          ...current.stages.beforeDue,
          ...(body.stages?.beforeDue || {}),
          channels: {
            ...current.stages.beforeDue.channels,
            ...(body.stages?.beforeDue?.channels || {}),
          },
        },
        onDue: {
          ...current.stages.onDue,
          ...(body.stages?.onDue || {}),
          channels: {
            ...current.stages.onDue.channels,
            ...(body.stages?.onDue?.channels || {}),
          },
        },
        onCut: {
          ...current.stages.onCut,
          ...(body.stages?.onCut || {}),
          channels: {
            ...current.stages.onCut.channels,
            ...(body.stages?.onCut?.channels || {}),
          },
        },
      },
      updatedAt: new Date().toISOString(),
    };

    const saved = saveDispatchSettingsToDisk(tenantId, updatedConfig);
    if (!saved) {
      return reply.status(500).send({
        success: false,
        message: "Error al guardar la configuración en disco",
      });
    }

    return reply.send({
      success: true,
      tenantId,
      message: "Configuración de envíos de recibos guardada correctamente",
      data: updatedConfig,
    });
  });

  // Ejecutar despacho de recibos en vivo (según configuración del modal)
  fastify.post("/customers/receipt-dispatch/execute", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as any) || {};

    const report = await SystemNotificationsService.executeAutomatedReceiptDispatch(tenantId, {
      forceStage: body.stage,
      dryRun: Boolean(body.dryRun),
    });

    return reply.send(report);
  });

  // Simular / Probar envío de plantilla
  fastify.post("/customers/test-dispatch", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { stage, template, customerId } = (request.body || {}) as {
      stage?: "beforeDue" | "onDue" | "onCut";
      template?: string;
      customerId?: number;
    };

    const targetStage = stage || "beforeDue";
    const config = loadDispatchSettingsFromDisk(tenantId);
    const activeStage = config.stages[targetStage] || config.stages.beforeDue;
    const rawTemplate = template || activeStage.template;

    let sampleCustomer: CustomerRecord | undefined;
    if (customerId) {
      const customers = loadCustomersFromDisk(tenantId);
      sampleCustomer = customers.find((c) => c.id === customerId);
    }
    if (!sampleCustomer) {
      sampleCustomer = {
        id: 1,
        customerCode: "CLI-1001",
        fullName: "Carlos Mendoza Silva",
        identification: "1098234812",
        phone: "+51 987 654 321",
        email: "carlos.mendoza@gmail.com",
        address: "Av. Principal 450, Piso 2",
        status: "active",
        serviceName: "Fibra Ultra 200 Mbps",
        serviceSpeed: "200 Mbps Simétrico",
        startDate: "2026-08-15",
        assignedIp: "192.168.88.24",
        balance: "45.00",
        createdAt: "2026-08-15T10:00:00Z",
      };
    }

    // Sustitución de etiquetas en tiempo de ejecución
    const rendered = rawTemplate
      .replace(/\{cliente\}/g, sampleCustomer.fullName)
      .replace(/\{documento\}/g, sampleCustomer.identification)
      .replace(/\{servicio\}/g, sampleCustomer.serviceName || "Fibra Óptica")
      .replace(/\{velocidad\}/g, sampleCustomer.serviceSpeed || "200 Mbps")
      .replace(/\{monto\}/g, sampleCustomer.balance || "45.00")
      .replace(/\{fecha_vencimiento\}/g, "25/09/2026")
      .replace(/\{recibo_nro\}/g, "REC-2026-0891")
      .replace(/\{enlace_pago\}/g, config.paymentLinkDefault || "https://pagos.turbonetwork.net/pago")
      .replace(/\{dias_vencido\}/g, String(config.stages.onCut.graceDaysAfterDue || 2))
      .replace(/\{empresa\}/g, config.companyName || "TurboNetwork Fibra")
      .replace(/\{telefono_soporte\}/g, config.supportPhone || "+51 987 654 321");

    return reply.send({
      success: true,
      tenantId,
      message: "Simulación de despacho de recibo ejecutada con éxito",
      data: {
        stage: targetStage,
        customer: {
          name: sampleCustomer.fullName,
          phone: sampleCustomer.phone,
          email: sampleCustomer.email,
        },
        channels: activeStage.channels,
        renderedMessage: rendered,
        dispatchedAt: new Date().toISOString(),
      },
    });
  });

  // Detalle de cliente
  fastify.get("/customers/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const customerId = parseInt(id, 10);
    const customers = loadCustomersFromDisk(tenantId);
    const found = customers.find((c) => c.id === customerId);
    if (!found) {
      return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
    }
    return reply.send({ success: true, tenantId, data: found });
  });
};
