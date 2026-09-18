import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, schema } from "../../db";
import { eq } from "drizzle-orm";

const createPlanSchema = z.object({
  name: z.string().min(2),
  downloadSpeedMbps: z.number().int().positive(),
  uploadSpeedMbps: z.number().int().positive(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("$"),
  burstLimit: z.string().optional(),
  priority: z.number().int().min(1).max(8).default(8),
});

// Planes de demostración predeterminados para inicio instantáneo
const samplePlans = [
  {
    id: 1,
    name: "Fibra Hogar 50 Mbps",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    price: "20.00",
    currency: "$",
    burstLimit: "60M/60M",
    priority: 8,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Fibra Pro 100 Mbps",
    downloadSpeedMbps: 100,
    uploadSpeedMbps: 100,
    price: "35.00",
    currency: "$",
    burstLimit: "120M/120M",
    priority: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: "Fibra Gamer 300 Mbps",
    downloadSpeedMbps: 300,
    uploadSpeedMbps: 300,
    price: "55.00",
    currency: "$",
    burstLimit: "350M/350M",
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: "Corporativo Simétrico 500 Mbps",
    downloadSpeedMbps: 500,
    uploadSpeedMbps: 500,
    price: "90.00",
    currency: "$",
    burstLimit: "600M/600M",
    priority: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const plansRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar todos los planes
  fastify.get("/plans", async (_request, reply) => {
    try {
      const data = await db.select().from(schema.plans);
      if (data.length > 0) return reply.send({ success: true, data });
      return reply.send({ success: true, data: samplePlans });
    } catch {
      // Retornar catálogo de prueba si la BD aún no está inicializada
      return reply.send({ success: true, data: samplePlans, source: "demo" });
    }
  });

  // Crear nuevo plan
  fastify.post("/plans", async (request, reply) => {
    const parseResult = createPlanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    try {
      const [newPlan] = await db.insert(schema.plans).values(parseResult.data).returning();
      return reply.status(201).send({ success: true, data: newPlan });
    } catch {
      const mockCreated = {
        id: samplePlans.length + 1,
        ...parseResult.data,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      samplePlans.push(mockCreated as any);
      return reply.status(201).send({ success: true, data: mockCreated, source: "demo" });
    }
  });

  // Obtener plan por ID
  fastify.get("/plans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const planId = parseInt(id, 10);

    try {
      const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, planId));
      if (!plan) return reply.status(404).send({ success: false, message: "Plan no encontrado" });
      return reply.send({ success: true, data: plan });
    } catch {
      const found = samplePlans.find((p) => p.id === planId);
      if (!found) return reply.status(404).send({ success: false, message: "Plan no encontrado" });
      return reply.send({ success: true, data: found });
    }
  });
};
