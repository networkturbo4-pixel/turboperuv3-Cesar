import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { MikroTikService } from "../network/mikrotik.service";
import { SystemNotificationsService } from "../messages/system-notifications.service";

const registerPaymentSchema = z.object({
  paymentMethod: z.enum(["cash", "bank_transfer", "pos", "efectivo", "transferencia", "tarjeta", "other"]).default("cash"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

function getTenantInvoicesFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "invoices.json");
}

export function loadTenantInvoices(tenantId: string): any[] {
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

export function saveTenantInvoices(tenantId: string, invoices: any[]): void {
  const filePath = getTenantInvoicesFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(invoices, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir facturas de ${tenantId}:`, err);
  }
}

export function loadTenantCustomers(tenantId: string): any[] {
  try {
    const p = getTenantFilePath(tenantId, "customers.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {}
  return [];
}

export function saveTenantCustomers(tenantId: string, list: any[]): void {
  try {
    const p = getTenantFilePath(tenantId, "customers.json");
    fs.writeFileSync(p, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {}
}

export function loadTenantDevices(tenantId: string): any[] {
  try {
    const p = getTenantFilePath(tenantId, "devices.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {}
  return [];
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

    // ========================================================
    // AUTO-REACTIVACIÓN INTELIGENTE EN MIKROTIK AL LIQUIDAR DEUDA
    // ========================================================
    let mikrotikReactivationReport: any = null;
    try {
      const customerId = inv.customerId;
      const customers = loadTenantCustomers(tenantId);
      const customer = customers.find((c: any) => c.id === customerId);

      // Verificar si al cliente le quedan otras facturas vencidas o pendientes
      const hasOtherDebts = invoices.some(
        (i: any) => i.customerId === customerId && i.id !== invoiceId && (i.status === "pending" || i.status === "overdue")
      );

      if (customer && !hasOtherDebts) {
        // Restaurar estado del cliente a activo
        const wasSuspended = customer.status === "suspended";
        customer.status = "active";
        customer.balance = "0.00";
        customer.updatedAt = new Date().toISOString();
        saveTenantCustomers(tenantId, customers);

        // Buscar equipo MikroTik asignado o primer router MikroTik de la empresa
        const devices = loadTenantDevices(tenantId);
        const targetRouter = devices.find((d: any) => d.vendor === "mikrotik");

        if (targetRouter) {
          const custPayload = {
            id: customer.id,
            name: customer.fullName || customer.name || `Cliente #${customer.id}`,
            ip: customer.assignedIp || customer.ip || undefined,
            pppoeUsername: customer.pppoeUsername || undefined,
          };
          mikrotikReactivationReport = await MikroTikService.reactivateCustomerService(targetRouter, custPayload);
        }
      }
    } catch (mktErr: any) {
      console.warn("Aviso al intentar auto-reactivación MikroTik:", mktErr?.message);
    }

    // Notificación automática en tiempo real al chat del cliente y por WhatsApp
    try {
      const customers = loadTenantCustomers(tenantId);
      const customer = customers.find((c: any) => c.id === inv.customerId);
      if (customer) {
        SystemNotificationsService.notifyPaymentReceived(tenantId, inv, customer, mikrotikReactivationReport).catch((err) => {
          console.warn("Aviso al despachar notificación de pago:", err?.message);
        });
      }
    } catch (notifErr: any) {
      console.warn("Aviso al preparar notificación de pago:", notifErr?.message);
    }

    const message = mikrotikReactivationReport
      ? `Pago registrado exitosamente. Servicio MikroTik '${mikrotikReactivationReport.details.device}' reactivado automáticamente (tráfico restablecido).`
      : "Pago registrado exitosamente. Recibo liquidado.";

    return reply.send({
      success: true,
      message,
      data: inv,
      mikrotik: mikrotikReactivationReport,
    });
  });
};
