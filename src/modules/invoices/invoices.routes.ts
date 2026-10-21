import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { MikroTikService } from "../network/mikrotik.service";
import { SystemNotificationsService } from "../messages/system-notifications.service";

const registerPaymentSchema = z.object({
  paymentMethod: z.enum([
    "cash",
    "bank_transfer",
    "pos",
    "efectivo",
    "transferencia",
    "yape_plin",
    "yape",
    "plin",
    "tarjeta",
    "other"
  ]).default("cash"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  registeredBy: z.string().optional(),
  paidAmount: z.union([z.number(), z.string()]).optional(),
  customerCashGiven: z.union([z.number(), z.string()]).optional(),
  changeAmount: z.union([z.number(), z.string()]).optional(),
  bankName: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.number(),
  period: z.string().min(4),
  dueDate: z.string(),
  concept: z.string().optional(),
  subtotal: z.union([z.number(), z.string()]),
  discount: z.union([z.number(), z.string()]).optional().default("0.00"),
  total: z.union([z.number(), z.string()]),
  notes: z.string().optional(),
});

const batchGenerateSchema = z.object({
  period: z.string().min(4),
  dueDate: z.string().min(4),
  onlyActive: z.boolean().optional().default(true),
});

const closeSettlementSchema = z.object({
  closedBy: z.string().default("Cajero / Administrador"),
  countedCash: z.number().default(0),
  notes: z.string().optional(),
});

const createPurchaseSchema = z.object({
  supplier: z.string().min(1, "El proveedor es requerido"),
  invoiceNumber: z.string().min(1, "El número de comprobante es requerido"),
  date: z.string().optional(),
  category: z.string().default("Equipos de Red"),
  productName: z.string().min(1, "El nombre o concepto es requerido"),
  productId: z.number().nullable().optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative().optional(),
  paymentMethod: z.string().default("bank_transfer"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  addToInventory: z.boolean().optional().default(false),
  documentUrl: z.string().optional(),
  documentName: z.string().optional(),
  documentType: z.string().optional(),
  documentSize: z.number().optional(),
  documentData: z.string().optional(),
});

function getTenantInvoicesFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "invoices.json");
}

function getTenantSettlementsFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "settlements.json");
}

function getTenantPurchasesFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "inventory_purchases.json");
}

function getTenantProductsFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "inventory_products.json");
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

export function loadTenantSettlements(tenantId: string): any[] {
  const filePath = getTenantSettlementsFile(tenantId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.warn(`Aviso: Error al leer liquidaciones de ${tenantId}:`, err);
  }
  return [];
}

export function saveTenantSettlements(tenantId: string, settlements: any[]): void {
  const filePath = getTenantSettlementsFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(settlements, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir liquidaciones de ${tenantId}:`, err);
  }
}

export function loadTenantPurchases(tenantId: string): any[] {
  const filePath = getTenantPurchasesFile(tenantId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.warn(`Aviso: Error al leer compras de ${tenantId}:`, err);
  }
  return [];
}

export function saveTenantPurchases(tenantId: string, purchases: any[]): void {
  const filePath = getTenantPurchasesFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(purchases, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir compras de ${tenantId}:`, err);
  }
}

export function loadTenantProducts(tenantId: string): any[] {
  const filePath = getTenantProductsFile(tenantId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {}
  return [];
}

export function saveTenantProducts(tenantId: string, products: any[]): void {
  const filePath = getTenantProductsFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2), "utf-8");
  } catch (err) {}
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

export function loadTenantServices(tenantId: string): any[] {
  try {
    const p = getTenantFilePath(tenantId, "services.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {}
  return [];
}

export function loadTenantDevices(tenantId: string): any[] {
  try {
    const p = getTenantFilePath(tenantId, "devices.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {}
  return [];
}

export const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar facturas con filtros de estado, cliente y periodo por tenant
  fastify.get("/invoices", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { status, customerId, period, search } = request.query as {
      status?: string;
      customerId?: string;
      period?: string;
      search?: string;
    };

    const allInvoices = loadTenantInvoices(tenantId);
    let filtered = allInvoices;

    if (status && status !== "all") {
      filtered = filtered.filter((i: any) => i.status === status);
    }
    if (customerId) {
      filtered = filtered.filter((i: any) => i.customerId === parseInt(customerId, 10));
    }
    if (period && period !== "all") {
      filtered = filtered.filter((i: any) => i.period === period);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((i: any) => {
        const num = (i.invoiceNumber || "").toLowerCase();
        const cust = (i.customerName || "").toLowerCase();
        const code = (i.customerCode || "").toLowerCase();
        const per = (i.period || "").toLowerCase();
        return num.includes(q) || cust.includes(q) || code.includes(q) || per.includes(q);
      });
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
    const paidInvoices = invoices.filter((i: any) => i.status === "paid");
    const totalCollected = paidInvoices.reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const totalPending = invoices
      .filter((i: any) => i.status === "pending" || i.status === "overdue")
      .reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const overdueInvoices = invoices.filter((i: any) => i.status === "overdue");
    const overdueTotal = overdueInvoices.reduce((acc: number, inv: any) => acc + parseFloat(inv.total || 0), 0);
    const overdueCount = overdueInvoices.length;
    const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";

    // Breakdown por métodos de pago
    let collectedCash = 0;
    let collectedTransfer = 0;
    let collectedYape = 0;
    let collectedPOS = 0;

    paidInvoices.forEach((inv: any) => {
      const m = (inv.paymentMethod || "cash").toLowerCase();
      const amount = parseFloat(inv.total || 0);
      if (m === "cash" || m === "efectivo") {
        collectedCash += amount;
      } else if (m === "yape" || m === "plin" || m === "yape_plin") {
        collectedYape += amount;
      } else if (m === "pos" || m === "tarjeta") {
        collectedPOS += amount;
      } else {
        collectedTransfer += amount;
      }
    });

    return reply.send({
      success: true,
      tenantId,
      data: {
        totalBilled: totalBilled.toFixed(2),
        totalCollected: totalCollected.toFixed(2),
        totalPending: totalPending.toFixed(2),
        overdueTotal: overdueTotal.toFixed(2),
        collectionRate: `${collectionRate}%`,
        overdueCount,
        paidCount: paidInvoices.length,
        totalCount: invoices.length,
        collectedCash: collectedCash.toFixed(2),
        collectedTransfer: collectedTransfer.toFixed(2),
        collectedYape: collectedYape.toFixed(2),
        collectedPOS: collectedPOS.toFixed(2),
        currency: "S/",
      },
    });
  });

  // Crear recibo o factura manual individual
  fastify.post("/invoices", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createInvoiceSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const { customerId, period, dueDate, concept, subtotal, discount, total, notes } = parseResult.data;
    const customers = loadTenantCustomers(tenantId);
    const customer = customers.find((c: any) => c.id === customerId);

    if (!customer) {
      return reply.status(404).send({ success: false, message: "Cliente no encontrado" });
    }

    const invoices = loadTenantInvoices(tenantId);
    const maxId = invoices.reduce((max: number, i: any) => Math.max(max, Number(i.id) || 0), 0);
    const nextId = maxId + 1;
    const invoiceNumber = `REC-TRBO-${String(nextId).padStart(4, "0")}`;

    const newInvoice = {
      id: nextId,
      invoiceNumber,
      customerId: customer.id,
      customerName: customer.fullName || customer.name || `Cliente #${customer.id}`,
      customerCode: customer.customerCode || `CLI-${customer.id}`,
      serviceName: customer.serviceName || customer.planName || concept || "Servicio de Internet Fibra",
      concept: concept || "Mensualidad Servicio de Internet",
      period,
      issueDate: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      subtotal: Number(subtotal).toFixed(2),
      discount: Number(discount || 0).toFixed(2),
      total: Number(total).toFixed(2),
      status: "pending",
      paidDate: null,
      paymentMethod: null,
      referenceNumber: null,
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    invoices.unshift(newInvoice);
    saveTenantInvoices(tenantId, invoices);

    // Actualizar balance pendiente del cliente
    customer.balance = (parseFloat(customer.balance || "0") + parseFloat(newInvoice.total)).toFixed(2);
    saveTenantCustomers(tenantId, customers);

    return reply.status(201).send({
      success: true,
      message: `Recibo ${invoiceNumber} emitido exitosamente`,
      data: newInvoice,
    });
  });

  // Generación masiva de recibos del mes para todos los clientes activos
  fastify.post("/invoices/batch-generate", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = batchGenerateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const { period, dueDate, onlyActive } = parseResult.data;
    const customers = loadTenantCustomers(tenantId);
    const services = loadTenantServices(tenantId);
    const invoices = loadTenantInvoices(tenantId);

    let maxId = invoices.reduce((max: number, i: any) => Math.max(max, Number(i.id) || 0), 0);
    const generatedInvoices: any[] = [];

    const eligibleCustomers = customers.filter((c: any) => {
      if (onlyActive && c.status !== "active") return false;
      const alreadyHas = invoices.some((i: any) => i.customerId === c.id && i.period === period);
      return !alreadyHas;
    });

    for (const customer of eligibleCustomers) {
      maxId++;
      const invoiceNumber = `REC-TRBO-${String(maxId).padStart(4, "0")}`;

      let price = "35.00";
      let serviceTitle = customer.serviceName || customer.planName || "Internet Fibra Óptica";

      if (customer.serviceId || customer.planId) {
        const sid = customer.serviceId || customer.planId;
        const matchedService = services.find((s: any) => s.id === sid);
        if (matchedService && matchedService.price) {
          price = Number(matchedService.price).toFixed(2);
          serviceTitle = matchedService.name;
        }
      }

      const inv = {
        id: maxId,
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.fullName || customer.name || `Cliente #${customer.id}`,
        customerCode: customer.customerCode || `CLI-${customer.id}`,
        serviceName: serviceTitle,
        concept: `Abono Mensual Internet - ${period}`,
        period,
        issueDate: new Date().toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        subtotal: price,
        discount: "0.00",
        total: price,
        status: "pending",
        paidDate: null,
        paymentMethod: null,
        referenceNumber: null,
        notes: "Generación masiva mensual automática",
        createdAt: new Date().toISOString(),
      };

      invoices.unshift(inv);
      generatedInvoices.push(inv);

      customer.balance = (parseFloat(customer.balance || "0") + parseFloat(inv.total)).toFixed(2);
    }

    if (generatedInvoices.length > 0) {
      saveTenantInvoices(tenantId, invoices);
      saveTenantCustomers(tenantId, customers);
    }

    const totalGenerated = generatedInvoices.reduce((acc, i) => acc + parseFloat(i.total), 0);

    return reply.send({
      success: true,
      message: `Se generaron exitosamente ${generatedInvoices.length} recibos para el periodo ${period}`,
      count: generatedInvoices.length,
      totalAmount: totalGenerated.toFixed(2),
      data: generatedInvoices,
    });
  });

  // Resumen en vivo de Arqueo y Liquidación de Caja del Día / Turno
  fastify.get("/invoices/settlement/summary", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const invoices = loadTenantInvoices(tenantId);
    const settlements = loadTenantSettlements(tenantId);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const lastSettlement = settlements.length > 0 ? settlements[0] : null;
    const sinceTime = lastSettlement && lastSettlement.closedAt ? new Date(lastSettlement.closedAt).getTime() : 0;

    const paymentsInShift = invoices.filter((i: any) => {
      if (i.status !== "paid" || !i.paidDate) return false;
      const paidTime = new Date(i.paidDate).getTime();
      return paidTime >= sinceTime;
    });

    let totalCash = 0;
    let totalTransfer = 0;
    let totalYape = 0;
    let totalPOS = 0;

    paymentsInShift.forEach((p: any) => {
      const amount = parseFloat(p.total || 0);
      const m = (p.paymentMethod || "cash").toLowerCase();
      if (m === "cash" || m === "efectivo") {
        totalCash += amount;
      } else if (m === "yape" || m === "plin" || m === "yape_plin") {
        totalYape += amount;
      } else if (m === "pos" || m === "tarjeta") {
        totalPOS += amount;
      } else {
        totalTransfer += amount;
      }
    });

    const totalCollected = totalCash + totalTransfer + totalYape + totalPOS;

    return reply.send({
      success: true,
      tenantId,
      data: {
        today: todayStr,
        lastSettlementTime: lastSettlement ? lastSettlement.closedAt : null,
        lastSettlementNumber: lastSettlement ? lastSettlement.settlementNumber : null,
        totalCollected: totalCollected.toFixed(2),
        totalCash: totalCash.toFixed(2),
        totalTransfer: totalTransfer.toFixed(2),
        totalYape: totalYape.toFixed(2),
        totalPOS: totalPOS.toFixed(2),
        paymentCount: paymentsInShift.length,
        shiftPayments: paymentsInShift.map((p: any) => ({
          id: p.id,
          invoiceNumber: p.invoiceNumber,
          customerName: p.customerName,
          customerCode: p.customerCode,
          period: p.period,
          total: p.total,
          paymentMethod: p.paymentMethod || "cash",
          referenceNumber: p.referenceNumber || "--",
          paidDate: p.paidDate,
          notes: p.notes || "",
        })),
        recentSettlements: settlements.slice(0, 15),
      },
    });
  });

  // Ejecutar Arqueo / Cierre de Caja y Liquidación
  fastify.post("/invoices/settlement/close", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = closeSettlementSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const { closedBy, countedCash, notes } = parseResult.data;
    const invoices = loadTenantInvoices(tenantId);
    const settlements = loadTenantSettlements(tenantId);

    const lastSettlement = settlements.length > 0 ? settlements[0] : null;
    const sinceTime = lastSettlement && lastSettlement.closedAt ? new Date(lastSettlement.closedAt).getTime() : 0;

    const paymentsInShift = invoices.filter((i: any) => {
      if (i.status !== "paid" || !i.paidDate) return false;
      const paidTime = new Date(i.paidDate).getTime();
      return paidTime >= sinceTime;
    });

    let totalCash = 0;
    let totalTransfer = 0;
    let totalYape = 0;
    let totalPOS = 0;

    paymentsInShift.forEach((p: any) => {
      const amount = parseFloat(p.total || 0);
      const m = (p.paymentMethod || "cash").toLowerCase();
      if (m === "cash" || m === "efectivo") {
        totalCash += amount;
      } else if (m === "yape" || m === "plin" || m === "yape_plin") {
        totalYape += amount;
      } else if (m === "pos" || m === "tarjeta") {
        totalPOS += amount;
      } else {
        totalTransfer += amount;
      }
    });

    const totalCollected = totalCash + totalTransfer + totalYape + totalPOS;
    const difference = countedCash - totalCash;

    const nextSettlementId = settlements.length + 1;
    const settlementRecord = {
      id: nextSettlementId,
      settlementNumber: `LIQ-${new Date().getFullYear()}-${String(nextSettlementId).padStart(4, "0")}`,
      closedAt: new Date().toISOString(),
      closedBy: closedBy || "Cajero Principal",
      countedCash: countedCash.toFixed(2),
      systemCash: totalCash.toFixed(2),
      systemTransfer: totalTransfer.toFixed(2),
      systemYape: totalYape.toFixed(2),
      systemPOS: totalPOS.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      difference: difference.toFixed(2),
      paymentCount: paymentsInShift.length,
      invoiceIds: paymentsInShift.map((p: any) => p.id),
      notes: notes || "Cierre de caja realizado conforme",
      status: "closed",
    };

    settlements.unshift(settlementRecord);
    saveTenantSettlements(tenantId, settlements);

    return reply.status(201).send({
      success: true,
      message: `Liquidación ${settlementRecord.settlementNumber} cerrada exitosamente.`,
      data: settlementRecord,
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
    inv.notes = parseResult.data.notes || inv.notes || "";
    inv.registeredBy = parseResult.data.registeredBy || "Cajero";
    inv.paidAmount = parseResult.data.paidAmount ? String(parseResult.data.paidAmount) : inv.total;

    saveTenantInvoices(tenantId, invoices);

    // AUTO-REACTIVACIÓN EN MIKROTIK
    let mikrotikReactivationReport: any = null;
    try {
      const customerId = inv.customerId;
      const customers = loadTenantCustomers(tenantId);
      const customer = customers.find((c: any) => c.id === customerId);

      const hasOtherDebts = invoices.some(
        (i: any) => i.customerId === customerId && i.id !== invoiceId && (i.status === "pending" || i.status === "overdue")
      );

      if (customer && !hasOtherDebts) {
        customer.status = "active";
        customer.balance = "0.00";
        customer.updatedAt = new Date().toISOString();
        saveTenantCustomers(tenantId, customers);

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

    // Notificación automática al chat y WhatsApp
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

  // ========================================================
  // SECCIÓN 4: COMPRAS & GASTOS A PROVEEDORES
  // ========================================================

  // Listar compras con filtros
  fastify.get("/purchases", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { category, supplier, search } = request.query as {
      category?: string;
      supplier?: string;
      search?: string;
    };

    const purchases = loadTenantPurchases(tenantId);
    let filtered = purchases;

    if (category && category !== "all") {
      filtered = filtered.filter((p: any) => p.category === category);
    }
    if (supplier && supplier !== "all") {
      filtered = filtered.filter((p: any) => p.supplier === supplier);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((p: any) => {
        const sup = (p.supplier || "").toLowerCase();
        const num = (p.invoiceNumber || "").toLowerCase();
        const prod = (p.productName || "").toLowerCase();
        const cat = (p.category || "").toLowerCase();
        const notes = (p.notes || "").toLowerCase();
        return sup.includes(q) || num.includes(q) || prod.includes(q) || cat.includes(q) || notes.includes(q);
      });
    }

    return reply.send({
      success: true,
      tenantId,
      count: filtered.length,
      data: filtered,
    });
  });

  // Estadísticas financieras de compras y balance de ingresos vs egresos
  fastify.get("/purchases/summary", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const purchases = loadTenantPurchases(tenantId);
    const invoices = loadTenantInvoices(tenantId);

    const totalPurchases = purchases.reduce((acc, p) => acc + (parseFloat(p.totalCost) || 0), 0);
    const totalRevenue = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    const netOperationalBalance = totalRevenue - totalPurchases;
    const suppliers = Array.from(new Set(purchases.map((p) => p.supplier).filter(Boolean)));
    const totalUnits = purchases.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 0), 0);

    let cashPaid = 0;
    let transferPaid = 0;
    purchases.forEach((p) => {
      const m = (p.paymentMethod || "bank_transfer").toLowerCase();
      const cost = parseFloat(p.totalCost) || 0;
      if (m === "cash" || m === "efectivo") {
        cashPaid += cost;
      } else {
        transferPaid += cost;
      }
    });

    return reply.send({
      success: true,
      tenantId,
      data: {
        totalPurchases: totalPurchases.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        netOperationalBalance: netOperationalBalance.toFixed(2),
        supplierCount: suppliers.length,
        totalOrders: purchases.length,
        totalUnits,
        cashPaid: cashPaid.toFixed(2),
        transferPaid: transferPaid.toFixed(2),
        currency: "S/",
      },
    });
  });

function savePurchaseDocumentFile(dataUrlOrBase64: string, originalName?: string): { url: string; size: number; mimeType: string } | null {
  try {
    let base64Data = dataUrlOrBase64;
    let ext = ".pdf";
    let mimeType = "application/pdf";

    const matches = dataUrlOrBase64.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1].toLowerCase();
      base64Data = matches[2];
      if (mimeType.includes("pdf")) ext = ".pdf";
      else if (mimeType.includes("png")) ext = ".png";
      else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = ".jpg";
      else if (mimeType.includes("webp")) ext = ".webp";
      else if (mimeType.includes("xml")) ext = ".xml";
      else if (mimeType.includes("sheet") || mimeType.includes("excel")) ext = ".xlsx";
      else if (mimeType.includes("word") || mimeType.includes("document")) ext = ".docx";
    }

    if (originalName && originalName.includes(".")) {
      const parts = originalName.split(".");
      const origExt = parts[parts.length - 1].toLowerCase();
      if (/^[a-z0-9]+$/.test(origExt)) {
        ext = `.${origExt}`;
      }
    }

    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "purchases");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeBaseName = originalName
      ? originalName.replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 40)
      : "comprobante" + ext;
    const fileName = `${Date.now()}_${safeBaseName.endsWith(ext) ? safeBaseName : safeBaseName + ext}`;
    const targetFile = path.join(uploadDir, fileName);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(targetFile, buffer);

    return {
      url: `/uploads/purchases/${fileName}`,
      size: buffer.length,
      mimeType
    };
  } catch (err) {
    console.error("Error al persistir comprobante adjunto:", err);
    return null;
  }
}

  // Registrar nueva compra o gasto operativo
  fastify.post("/purchases", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createPurchaseSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const data = parseResult.data;
    const purchases = loadTenantPurchases(tenantId);

    let docUrl = data.documentUrl || null;
    let docName = data.documentName || null;
    let docType = data.documentType || null;
    let docSize = data.documentSize || null;

    const rawDocData = data.documentData || (docUrl && docUrl.startsWith("data:") ? docUrl : null);
    if (rawDocData) {
      const saved = savePurchaseDocumentFile(rawDocData, data.documentName || "comprobante");
      if (saved) {
        docUrl = saved.url;
        docSize = saved.size;
        if (!docType || docType === "application/octet-stream") docType = saved.mimeType;
      }
    }

    const totalCost = data.totalCost !== undefined ? Number(data.totalCost) : Number(data.quantity) * Number(data.unitCost);
    const newPurchase = {
      id: `pch-${Date.now().toString(36)}`,
      tenantId,
      productId: data.productId || null,
      productName: data.productName,
      category: data.category || "Equipos de Red",
      supplier: data.supplier,
      invoiceNumber: data.invoiceNumber,
      date: data.date || new Date().toISOString().split("T")[0],
      quantity: data.quantity,
      unitCost: data.unitCost,
      totalCost,
      paymentMethod: data.paymentMethod || "bank_transfer",
      referenceNumber: data.referenceNumber || `COMP-${Date.now().toString().slice(-6)}`,
      status: "completed",
      notes: data.notes || "",
      documentUrl: docUrl,
      documentName: docName,
      documentType: docType,
      documentSize: docSize,
      createdAt: new Date().toISOString(),
    };

    purchases.unshift(newPurchase);
    saveTenantPurchases(tenantId, purchases);

    if (data.addToInventory && data.productId) {
      try {
        const products = loadTenantProducts(tenantId);
        const prod = products.find((p: any) => p.id === data.productId);
        if (prod) {
          prod.stock = (parseInt(prod.stock, 10) || 0) + parseInt(String(data.quantity), 10);
          prod.updatedAt = new Date().toISOString();
          saveTenantProducts(tenantId, products);
        }
      } catch (err) {
        console.warn("Aviso al actualizar stock de producto:", err);
      }
    }

    return reply.status(201).send({
      success: true,
      message: `Compra ${newPurchase.invoiceNumber} registrada exitosamente`,
      data: newPurchase,
    });
  });

  // Adjuntar o actualizar documento a una compra existente
  fastify.post("/purchases/:id/document", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const purchases = loadTenantPurchases(tenantId);
    const purchase = purchases.find((p: any) => p.id === id);
    if (!purchase) {
      return reply.status(404).send({ success: false, message: "Compra no encontrada" });
    }

    let docUrl = body.documentUrl || null;
    let docName = body.documentName || "comprobante";
    let docType = body.documentType || "application/pdf";
    let docSize = body.documentSize || null;

    const rawData = body.documentData || (docUrl && docUrl.startsWith("data:") ? docUrl : null);
    if (rawData) {
      const saved = savePurchaseDocumentFile(rawData, docName);
      if (saved) {
        docUrl = saved.url;
        docSize = saved.size;
        docType = saved.mimeType;
      }
    }

    purchase.documentUrl = docUrl;
    purchase.documentName = docName;
    purchase.documentType = docType;
    purchase.documentSize = docSize;
    purchase.updatedAt = new Date().toISOString();

    saveTenantPurchases(tenantId, purchases);

    return reply.send({
      success: true,
      message: "Documento adjuntado exitosamente a la compra",
      data: purchase,
    });
  });

  // Eliminar comprobante de una compra
  fastify.delete("/purchases/:id/document", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const purchases = loadTenantPurchases(tenantId);
    const purchase = purchases.find((p: any) => p.id === id);
    if (!purchase) {
      return reply.status(404).send({ success: false, message: "Compra no encontrada" });
    }

    if (purchase.documentUrl && purchase.documentUrl.startsWith("/uploads/purchases/")) {
      try {
        const filePath = path.resolve(process.cwd(), "public", purchase.documentUrl.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn("Aviso al eliminar archivo físico de comprobante:", err);
      }
    }

    purchase.documentUrl = null;
    purchase.documentName = null;
    purchase.documentType = null;
    purchase.documentSize = null;
    purchase.updatedAt = new Date().toISOString();

    saveTenantPurchases(tenantId, purchases);

    return reply.send({
      success: true,
      message: "Comprobante desvinculado de la compra",
      data: purchase,
    });
  });
};
