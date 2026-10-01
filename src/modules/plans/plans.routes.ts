import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");

export const createPlanSchema = z.object({
  name: z.string().min(2, "El nombre del servicio debe tener al menos 2 caracteres"),
  description: z.string().optional().default(""),
  downloadSpeedMbps: z.number().int().positive("La velocidad de bajada debe ser positiva"),
  uploadSpeedMbps: z.number().int().positive("La velocidad de subida debe ser positiva"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido con hasta 2 decimales"),
  currency: z.string().default("$"),
  technology: z.string().optional().default("Fibra Óptica GPON"),
  ipType: z.string().optional().default("CGNAT Dinámica"),
  burstLimit: z.string().optional().default("No asignada"),
  priority: z.number().int().min(1).max(8).default(8),
  details: z.string().optional().default(""),
});

export const updatePlanSchema = createPlanSchema.partial();

export type ServicePlan = z.infer<typeof createPlanSchema> & {
  id: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

const defaultServices: ServicePlan[] = [
  {
    id: 1,
    name: "Plan Turbo Residencial 50M",
    description: "Conexión estable para navegación, streaming HD y redes sociales.",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    price: "45.00",
    currency: "$",
    technology: "Fibra Óptica GPON",
    ipType: "CGNAT Dinámica",
    burstLimit: "60M/60M 10s",
    priority: 8,
    details: "Instalación estándar, router WiFi 5 Dual Band incluido",
    isActive: true,
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: 2,
    name: "Plan Turbo Fibra Gamer 100M",
    description: "Ultra baja latencia optimizada para gaming competitivo y videollamadas 4K.",
    downloadSpeedMbps: 100,
    uploadSpeedMbps: 100,
    price: "70.00",
    currency: "$",
    technology: "Fibra Óptica GPON",
    ipType: "CGNAT Dinámica",
    burstLimit: "120M/120M 15s",
    priority: 5,
    details: "Enrutamiento prioritario BGP, baja fluctuación (jitter < 2ms)",
    isActive: true,
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: 3,
    name: "Plan Turbo Corporativo Simétrico 300M",
    description: "Enlace simétrico de alta disponibilidad para oficinas, empresas y servidores.",
    downloadSpeedMbps: 300,
    uploadSpeedMbps: 300,
    price: "180.00",
    currency: "$",
    technology: "Fibra Óptica Directa",
    ipType: "IP Pública Fija",
    burstLimit: "Sin límite",
    priority: 1,
    details: "SLA 99.8% garantizado, Soporte técnico NOC 24/7 dedicado",
    isActive: true,
    createdAt: "2026-09-01T08:00:00Z",
  },
];

function loadServicesFromDisk(tenantId = "turbonetwork"): ServicePlan[] {
  try {
    const tenantFile = getTenantFilePath(tenantId, "services.json");
    if (fs.existsSync(tenantFile)) {
      const raw = fs.readFileSync(tenantFile, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    if (fs.existsSync(SERVICES_FILE)) {
      const raw = fs.readFileSync(SERVICES_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    return defaultServices;
  } catch (err) {
    console.warn(`Aviso: No se pudo leer services.json para ${tenantId}:`, err);
    return defaultServices;
  }
}

function saveServicesToDisk(tenantId = "turbonetwork", services: ServicePlan[]) {
  try {
    const tenantFile = getTenantFilePath(tenantId, "services.json");
    const dir = path.dirname(tenantFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tenantFile, JSON.stringify(services, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al guardar services.json para ${tenantId}:`, err);
  }
}

function syncCustomersServiceUpdate(tenantId: string, serviceId: number, planName: string, planSpeed: string) {
  try {
    const custFile = getTenantFilePath(tenantId, "customers.json");
    if (!fs.existsSync(custFile)) return;
    const raw = fs.readFileSync(custFile, "utf-8");
    const customers = JSON.parse(raw);
    if (!Array.isArray(customers)) return;
    let modified = false;
    for (const c of customers) {
      if (c.serviceId === serviceId || c.planId === serviceId) {
        c.serviceName = planName;
        c.serviceSpeed = planSpeed;
        modified = true;
      }
    }
    if (modified) {
      fs.writeFileSync(custFile, JSON.stringify(customers, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error al sincronizar clientes con servicio:", err);
  }
}

export const plansRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar todos los planes / servicios del tenant
  const listHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const services = loadServicesFromDisk(tenantId);
    return reply.send({ success: true, count: services.length, tenantId, data: services });
  };

  // Crear nuevo plan / servicio
  const createHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createPlanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const services = loadServicesFromDisk(tenantId);
    const nextId =
      services.length > 0
        ? Math.max(...services.map((s) => s.id)) + 1
        : 1;

    const newService: ServicePlan = {
      id: nextId,
      ...parseResult.data,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    services.push(newService);
    saveServicesToDisk(tenantId, services);

    try {
      await db.insert(schema.plans).values({
        name: newService.name,
        downloadSpeedMbps: newService.downloadSpeedMbps,
        uploadSpeedMbps: newService.uploadSpeedMbps,
        price: newService.price,
        currency: newService.currency,
        burstLimit: newService.burstLimit,
        priority: newService.priority,
      });
    } catch {}

    return reply.status(201).send({ success: true, tenantId, data: newService });
  };

  // Actualizar plan / servicio
  const updateHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const serviceId = parseInt(id, 10);

    const parseResult = updatePlanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const services = loadServicesFromDisk(tenantId);
    const index = services.findIndex((s) => s.id === serviceId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Servicio no encontrado" });
    }

    const current = services[index];
    const updated: ServicePlan = {
      ...current,
      ...parseResult.data,
      updatedAt: new Date().toISOString(),
    };

    services[index] = updated;
    saveServicesToDisk(tenantId, services);

    // Sincronizar clientes que tengan este servicio asignado
    const speedStr = `${updated.downloadSpeedMbps}M bajada / ${updated.uploadSpeedMbps}M subida`;
    syncCustomersServiceUpdate(tenantId, serviceId, updated.name, speedStr);

    try {
      await db
        .update(schema.plans)
        .set({
          name: updated.name,
          downloadSpeedMbps: updated.downloadSpeedMbps,
          uploadSpeedMbps: updated.uploadSpeedMbps,
          price: updated.price,
          currency: updated.currency,
          burstLimit: updated.burstLimit,
          priority: updated.priority,
        })
        .where(eq(schema.plans.id, serviceId));
    } catch {}

    return reply.send({
      success: true,
      tenantId,
      message: "Servicio actualizado exitosamente",
      data: updated,
    });
  };

  // Eliminar servicio
  const deleteHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const serviceId = parseInt(id, 10);

    const services = loadServicesFromDisk(tenantId);
    const index = services.findIndex((s) => s.id === serviceId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Servicio no encontrado" });
    }

    const removed = services.splice(index, 1)[0];
    saveServicesToDisk(tenantId, services);

    try {
      await db.delete(schema.plans).where(eq(schema.plans.id, serviceId));
    } catch {}

    return reply.send({
      success: true,
      tenantId,
      message: `El servicio '${removed.name}' ha sido eliminado exitosamente.`,
      data: removed,
    });
  };

  // Detalle de servicio por ID
  const getByIdHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const serviceId = parseInt(id, 10);
    const services = loadServicesFromDisk(tenantId);
    const found = services.find((s) => s.id === serviceId);
    if (!found) {
      return reply.status(404).send({ success: false, message: "Servicio no encontrado" });
    }
    return reply.send({ success: true, tenantId, data: found });
  };

  // Rutas bajo /plans y alias bajo /services
  fastify.get("/plans", listHandler);
  fastify.post("/plans", createHandler);
  fastify.get("/plans/:id", getByIdHandler);
  fastify.put("/plans/:id", updateHandler);
  fastify.patch("/plans/:id", updateHandler);
  fastify.delete("/plans/:id", deleteHandler);

  fastify.get("/services", listHandler);
  fastify.post("/services", createHandler);
  fastify.get("/services/:id", getByIdHandler);
  fastify.put("/services/:id", updateHandler);
  fastify.patch("/services/:id", updateHandler);
  fastify.delete("/services/:id", deleteHandler);
};
