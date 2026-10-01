import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

const registerPaymentSchema = z.object({
  paymentMethod: z.enum(["cash", "bank_transfer", "pos", "efectivo", "transferencia", "tarjeta", "other"]).default("cash"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

function getTenantInvoicesFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "invoices.json");
}

function loadTenantInvoices(tenantId: string): any[] {
  const filePath = getTenantInvoicesFile(tenantId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.warn(`Aviso: Error al leer facturas de ${tenantId}:`, err);
  }
  return [];
}

function saveTenantInvoices(tenantId: string, invoices: any[]): void {
  const filePath = getTenantInvoicesFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(invoices, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir facturas de ${tenantId}:`, err);
  }
}

export const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar facturas con filtros de estado y cliente por tenant
  fastify.get("/invoices", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { status, customerId } = request.query as { status?: string; customerId?: string };

    const allInvoices = loadTenantInvoices(tenantId);
    let filtered = allInvoices;

    if (status) {
      filtered = filtered.filter((i: any) => i.status === status);
    }
    if (customerId) {
      filtered = filtered.filter((i: any) => i.customerId === parseInt(customerId, 10));
    }

    return reply.send({
      success: true,
      tenantId,
      count: filtered.length,
      data: filtered,
    });
  });

  // Estadísticas financieras de facturación por tenant
  fastify.get("/invoices/summary", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const invoices = loadTenantInvoices(tenantId);

    const totalBilled = invoices.reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const totalCollected = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const totalPending = invoices
      .filter((i: any) => i.status === "pending" || i.status === "overdue")
      .reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;
    const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";

    return reply.send({
      success: true,
      tenantId,
      data: {
        totalBilled: totalBilled.toFixed(2),
        totalCollected: totalCollected.toFixed(2),
        totalPending: totalPending.toFixed(2),
        collectionRate: `${collectionRate}%`,
        overdueCount,
        currency: "$",
      },
    });
  });

  // Registrar pago de recibo para el tenant activo
  fastify.post("/invoices/:id/pay", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const invoiceId = parseInt(id, 10);
    const parseResult = registerPaymentSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const invoices = loadTenantInvoices(tenantId);
    const inv = invoices.find((i: any) => i.id === invoiceId);

    if (!inv) {
      return reply.status(404).send({ success: false, message: "Recibo no encontrado en la empresa actual" });
    }

    inv.status = "paid";
    inv.paidDate = new Date().toISOString();
    inv.paymentMethod = parseResult.data.paymentMethod;
    inv.referenceNumber = parseResult.data.referenceNumber || `PAG-${Date.now()}`;

    saveTenantInvoices(tenantId, invoices);

    return reply.send({
      success: true,
      message: "Pago registrado exitosamente. Recibo liquidado.",
      data: inv,
    });
  });
};
