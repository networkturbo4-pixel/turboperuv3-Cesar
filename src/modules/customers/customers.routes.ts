import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, schema } from "../../db";
import { eq } from "drizzle-orm";

const createCustomerSchema = z.object({
  fullName: z.string().min(3),
  identification: z.string().min(5),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  address: z.string().min(5),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  status: z.enum(["active", "suspended", "canceled", "pending_installation"]).default("active"),
  planId: z.number().int().optional(),
  assignedIp: z.string().optional(),
});

const sampleCustomers = [
  {
    id: 1,
    customerCode: "CLI-1001",
    fullName: "Carlos Mendoza Silva",
    identification: "1098234812",
    phone: "+57 312 456 7890",
    email: "carlos.mendoza@gmail.com",
    address: "Calle 14 # 8-45, Urb. El Prado",
    latitude: "4.7110",
    longitude: "-74.0721",
    status: "active",
    planName: "Fibra Pro 100 Mbps",
    assignedIp: "192.168.88.24",
    balance: "0.00",
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
    latitude: "4.6540",
    longitude: "-74.0560",
    status: "active",
    planName: "Corporativo Simétrico 500 Mbps",
    assignedIp: "192.168.88.100",
    balance: "0.00",
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
    latitude: "4.6980",
    longitude: "-74.0910",
    status: "suspended",
    planName: "Fibra Hogar 50 Mbps",
    assignedIp: "192.168.88.55",
    balance: "20.00",
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
    latitude: "4.6320",
    longitude: "-74.0650",
    status: "active",
    planName: "Fibra Gamer 300 Mbps",
    assignedIp: "192.168.88.72",
    balance: "0.00",
    createdAt: "2026-09-10T11:00:00Z",
  },
];

export const customersRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar clientes con búsqueda opcional
  fastify.get("/customers", async (request, reply) => {
    const { search, status } = request.query as { search?: string; status?: string };

    try {
      const data = await db.select().from(schema.customers);
      if (data.length > 0) {
        let filtered = data;
        if (status) filtered = filtered.filter((c) => c.status === status);
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.fullName.toLowerCase().includes(q) ||
              c.customerCode.toLowerCase().includes(q) ||
              c.identification.includes(q)
          );
        }
        return reply.send({ success: true, count: filtered.length, data: filtered });
      }
      // Fallback a clientes de prueba
      let filtered = sampleCustomers;
      if (status) filtered = filtered.filter((c) => c.status === status);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.customerCode.toLowerCase().includes(q) ||
            c.identification.includes(q)
        );
      }
      return reply.send({ success: true, count: filtered.length, data: filtered, source: "demo" });
    } catch {
      return reply.send({ success: true, count: sampleCustomers.length, data: sampleCustomers, source: "demo" });
    }
  });

  // Crear cliente
  fastify.post("/customers", async (request, reply) => {
    const parseResult = createCustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const customerCode = `CLI-${1000 + sampleCustomers.length + 1}`;
    const newCustomerData = {
      ...parseResult.data,
      customerCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const [created] = await db.insert(schema.customers).values(newCustomerData).returning();
      return reply.status(201).send({ success: true, data: created });
    } catch {
      const mockCreated = {
        id: sampleCustomers.length + 1,
        ...newCustomerData,
        createdAt: newCustomerData.createdAt.toISOString(),
        updatedAt: newCustomerData.updatedAt.toISOString(),
      };
      sampleCustomers.push(mockCreated as any);
      return reply.status(201).send({ success: true, data: mockCreated, source: "demo" });
    }
  });

  // Detalle de cliente
  fastify.get("/customers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const customerId = parseInt(id, 10);

    try {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId));
      if (!customer) return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
      return reply.send({ success: true, data: customer });
    } catch {
      const found = sampleCustomers.find((c) => c.id === customerId);
      if (!found) return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
      return reply.send({ success: true, data: found });
    }
  });
};
