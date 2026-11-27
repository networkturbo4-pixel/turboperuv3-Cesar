import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { MikroTikService } from "../network/mikrotik.service";
import { SystemNotificationsService } from "../messages/system-notifications.service";
import { adjustStock, getInventoryProducts } from "../inventory/inventory.service";
import {
  ShareableDocType,
  createOrUpdateDocumentShare,
  getDocumentShare,
  resolveTenantDocument,
  renderModernDocumentHtml,
} from "./document-share.service";

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

const purchaseItemSchema = z.object({
  productId: z.number().nullable().optional(),
  sku: z.string().optional(),
  productName: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative().optional(),
});

const createPurchaseSchema = z.object({
  supplier: z.string().min(1, "El proveedor es requerido"),
  supplierRuc: z.string().optional(),
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
  addToInventory: z.boolean().optional().default(true),
  purchaseOrderId: z.string().nullable().optional(),
  purchaseOrderNumber: z.string().nullable().optional(),
  items: z.array(purchaseItemSchema).optional(),
  documentUrl: z.string().optional(),
  documentName: z.string().optional(),
  documentType: z.string().optional(),
  documentSize: z.number().optional(),
  documentData: z.string().optional(),
});

const createPurchaseOrderSchema = z.object({
  supplier: z.string().min(1, "El proveedor es requerido"),
  supplierRuc: z.string().optional().default(""),
  supplierContact: z.string().optional().default(""),
  date: z.string().optional(),
  expectedDate: z.string().optional().default(""),
  paymentTerms: z.string().optional().default("Transferencia Bancaria"),
  notes: z.string().optional().default(""),
  createdBy: z.string().optional().default("Administración"),
  items: z.array(z.object({
    productId: z.number().nullable().optional(),
    sku: z.string().optional().default(""),
    productName: z.string().min(1),
    category: z.string().optional().default("Equipos de Red"),
    quantity: z.number().positive(),
    estimatedUnitCost: z.number().nonnegative().default(0),
  })).min(1, "Debe agregar al menos un producto a la orden de compra"),
});

function getTenantPurchaseOrdersFile(tenantId: string): string {
  return getTenantFilePath(tenantId, "purchase_orders.json");
}

export function loadTenantPurchaseOrders(tenantId: string): any[] {
  const filePath = getTenantPurchaseOrdersFile(tenantId);
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`Aviso: Error al leer órdenes de compra de ${tenantId}:`, err);
  }
  return [];
}

export function saveTenantPurchaseOrders(tenantId: string, orders: any[]): void {
  const filePath = getTenantPurchaseOrdersFile(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir órdenes de compra de ${tenantId}:`, err);
  }
}

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

  // Registrar nueva compra o gasto operativo (conectado con Inventario, Kardex, Historial de Producto y OC)
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

    const purchaseDate = data.date || new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();
    const shouldUpdateInventory = data.addToInventory !== false;
    const tenantProducts = getInventoryProducts(tenantId, {});

    // Helper: vincular producto por ID o por coincidencia de nombre/SKU si no vino productId
    const resolveLinkedProduct = (itemProductId?: number | null, itemName?: string) => {
      if (itemProductId) {
        return tenantProducts.find((p: any) => Number(p.id) === Number(itemProductId)) || null;
      }
      if (itemName) {
        const needle = itemName.trim().toLowerCase();
        return (
          tenantProducts.find(
            (p: any) =>
              (p.name || "").trim().toLowerCase() === needle ||
              (p.sku || "").trim().toLowerCase() === needle
          ) || null
        );
      }
      return null;
    };

    const lineItems =
      Array.isArray(data.items) && data.items.length > 0
        ? data.items
        : [
            {
              productId: data.productId || null,
              productName: data.productName,
              category: data.category || "Equipos de Red",
              quantity: data.quantity,
              unitCost: data.unitCost,
              totalCost:
                data.totalCost !== undefined
                  ? Number(data.totalCost)
                  : Number(data.quantity) * Number(data.unitCost),
            },
          ];

    const createdPurchases: any[] = [];
    const inventoryUpdates: Array<{ productId: number; productName: string; addedQty: number; newStock: number }> = [];

    for (let idx = 0; idx < lineItems.length; idx++) {
      const item = lineItems[idx];
      const linkedProd = resolveLinkedProduct(item.productId, item.productName);
      const resolvedProductId = linkedProd ? Number(linkedProd.id) : item.productId || null;
      const qty = Number(item.quantity);
      const uCost = Number(item.unitCost);
      const lineTotal = item.totalCost !== undefined ? Number(item.totalCost) : +(qty * uCost).toFixed(2);

      const newPurchase = {
        id: `pch-${Date.now().toString(36)}${lineItems.length > 1 ? `-${idx + 1}` : ""}`,
        tenantId,
        productId: resolvedProductId,
        productName: item.productName || linkedProd?.name || data.productName,
        category: item.category || data.category || "Equipos de Red",
        supplier: data.supplier,
        supplierRuc: data.supplierRuc || "",
        invoiceNumber: data.invoiceNumber,
        purchaseOrderId: data.purchaseOrderId || null,
        purchaseOrderNumber: data.purchaseOrderNumber || null,
        date: purchaseDate,
        purchaseDate,
        quantity: qty,
        unitCost: uCost,
        totalCost: lineTotal,
        paymentMethod: data.paymentMethod || "bank_transfer",
        referenceNumber: data.referenceNumber || `COMP-${Date.now().toString().slice(-6)}`,
        status: "completed",
        notes: data.notes || "",
        documentUrl: docUrl,
        documentName: docName,
        documentType: docType,
        documentSize: docSize,
        addedToInventory: Boolean(shouldUpdateInventory && resolvedProductId),
        createdAt: nowIso,
      };

      purchases.unshift(newPurchase);
      createdPurchases.push(newPurchase);

      if (shouldUpdateInventory && resolvedProductId) {
        try {
          const ocSuffix = data.purchaseOrderNumber ? ` (${data.purchaseOrderNumber})` : "";
          const updatedProd = adjustStock(tenantId, resolvedProductId, {
            type: "in",
            quantity: qty,
            reason: `Compra Fac #${data.invoiceNumber} - ${data.supplier}${ocSuffix}`,
            operatorName: "Compras / Recepción",
          });
          if (updatedProd) {
            inventoryUpdates.push({
              productId: resolvedProductId,
              productName: updatedProd.name,
              addedQty: qty,
              newStock: updatedProd.stock,
            });
          }
        } catch (err) {
          console.warn("Aviso al actualizar stock e historial de producto:", err);
        }
      }
    }

    saveTenantPurchases(tenantId, purchases);

    // Si proviene de una Orden de Compra, marcarla como recibida y vincular factura
    let updatedOrder: any = null;
    if (data.purchaseOrderId) {
      const orders = loadTenantPurchaseOrders(tenantId);
      const ord = orders.find((o: any) => o.id === data.purchaseOrderId);
      if (ord) {
        ord.status = "recibida";
        ord.linkedInvoiceNumber = data.invoiceNumber;
        ord.linkedPurchaseIds = Array.from(
          new Set([...(ord.linkedPurchaseIds || []), ...createdPurchases.map((c) => c.id)])
        );
        ord.receivedAt = nowIso;
        ord.updatedAt = nowIso;
        saveTenantPurchaseOrders(tenantId, orders);
        updatedOrder = ord;
      }
    }

    const invSummaryMsg =
      inventoryUpdates.length > 0
        ? ` • Stock actualizado en Inventario (${inventoryUpdates.length} producto${inventoryUpdates.length > 1 ? "s" : ""})`
        : "";

    return reply.status(201).send({
      success: true,
      message: `Compra ${data.invoiceNumber} registrada exitosamente${invSummaryMsg}`,
      data: createdPurchases[0],
      items: createdPurchases,
      inventoryUpdates,
      purchaseOrder: updatedOrder,
    });
  });

  // ========================================================
  // SECCIÓN 4.1: ÓRDENES DE COMPRA (OC) CONECTADAS A INVENTARIO
  // ========================================================

  fastify.get("/purchase-orders", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { status, search } = request.query as { status?: string; search?: string };
    let orders = loadTenantPurchaseOrders(tenantId).filter(
      (o: any) => !o.tenantId || String(o.tenantId).toLowerCase() === tenantId
    );
    if (status && status !== "all") {
      orders = orders.filter((o: any) => o.status === status);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      orders = orders.filter((o: any) => {
        const num = (o.orderNumber || "").toLowerCase();
        const sup = (o.supplier || "").toLowerCase();
        const ruc = (o.supplierRuc || "").toLowerCase();
        const notes = (o.notes || "").toLowerCase();
        const itemNames = (o.items || []).map((i: any) => (i.productName || "").toLowerCase()).join(" ");
        return num.includes(q) || sup.includes(q) || ruc.includes(q) || notes.includes(q) || itemNames.includes(q);
      });
    }
    return reply.send({ success: true, tenantId, count: orders.length, data: orders });
  });

  fastify.post("/purchase-orders", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createPurchaseOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message: "Datos inválidos para la Orden de Compra",
        errors: parseResult.error.format(),
      });
    }
    const data = parseResult.data;
    const orders = loadTenantPurchaseOrders(tenantId);
    const year = new Date().getFullYear();
    const seq = orders.length + 1;
    const orderNumber = `OC-${year}-${String(seq).padStart(4, "0")}`;
    const items = data.items.map((it) => {
      const subtotal = +(Number(it.quantity) * Number(it.estimatedUnitCost || 0)).toFixed(2);
      return {
        productId: it.productId || null,
        sku: it.sku || "",
        productName: it.productName.trim(),
        category: it.category || "Equipos de Red",
        quantity: Number(it.quantity),
        estimatedUnitCost: Number(it.estimatedUnitCost || 0),
        subtotal,
      };
    });
    const estimatedTotal = +items.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2);
    const nowIso = new Date().toISOString();
    const newOrder = {
      id: `oc-${Date.now().toString(36)}`,
      orderNumber,
      tenantId,
      supplier: data.supplier.trim(),
      supplierRuc: (data.supplierRuc || "").trim(),
      supplierContact: (data.supplierContact || "").trim(),
      date: data.date || nowIso.split("T")[0],
      expectedDate: data.expectedDate || "",
      paymentTerms: data.paymentTerms || "Transferencia Bancaria",
      notes: data.notes || "",
      status: "pendiente",
      items,
      estimatedTotal,
      linkedPurchaseIds: [],
      linkedInvoiceNumber: null,
      createdBy: data.createdBy || "Administración",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    orders.unshift(newOrder);
    saveTenantPurchaseOrders(tenantId, orders);

    return reply.status(201).send({
      success: true,
      message: `Orden de Compra ${orderNumber} creada exitosamente`,
      data: newOrder,
    });
  });

  fastify.put("/purchase-orders/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const orders = loadTenantPurchaseOrders(tenantId);
    const idx = orders.findIndex((o: any) => o.id === id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Orden de compra no encontrada" });
    }
    const existing = orders[idx];
    const updated = {
      ...existing,
      ...(body.status ? { status: body.status } : {}),
      ...(body.supplier !== undefined ? { supplier: String(body.supplier).trim() } : {}),
      ...(body.supplierRuc !== undefined ? { supplierRuc: String(body.supplierRuc).trim() } : {}),
      ...(body.supplierContact !== undefined ? { supplierContact: String(body.supplierContact).trim() } : {}),
      ...(body.expectedDate !== undefined ? { expectedDate: body.expectedDate } : {}),
      ...(body.paymentTerms !== undefined ? { paymentTerms: body.paymentTerms } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(Array.isArray(body.items)
        ? {
            items: body.items.map((it: any) => ({
              productId: it.productId || null,
              sku: it.sku || "",
              productName: String(it.productName || "").trim(),
              category: it.category || "Equipos de Red",
              quantity: Number(it.quantity) || 1,
              estimatedUnitCost: Number(it.estimatedUnitCost) || 0,
              subtotal: +((Number(it.quantity) || 1) * (Number(it.estimatedUnitCost) || 0)).toFixed(2),
            })),
            estimatedTotal: +body.items
              .reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1) * (Number(it.estimatedUnitCost) || 0), 0)
              .toFixed(2),
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    orders[idx] = updated;
    saveTenantPurchaseOrders(tenantId, orders);
    return reply.send({ success: true, message: `Orden ${updated.orderNumber} actualizada`, data: updated });
  });

  fastify.delete("/purchase-orders/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const orders = loadTenantPurchaseOrders(tenantId);
    const idx = orders.findIndex((o: any) => o.id === id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Orden de compra no encontrada" });
    }
    const removed = orders.splice(idx, 1)[0];
    saveTenantPurchaseOrders(tenantId, orders);
    return reply.send({ success: true, message: `Orden ${removed.orderNumber} eliminada`, data: removed });
  });

  // ========================================================
  // SECCIÓN 4.2: OCR INTELIGENTE DE FACTURAS (GEMINI + XML + PDF + FALLBACK)
  // ========================================================

  function parseInvoiceTextHeuristic(rawText: string, tenantProducts: any[]) {
    const text = String(rawText || "").replace(/\r/g, "\n");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // 1. Serie-Número de factura/boleta (Perú: F001-0001234, E001-123, B001-12345, etc.)
    const invMatch =
      text.match(/\b([FBE][A-Z0-9]{3}\s*[-–]\s*\d{1,8})\b/i) ||
      text.match(/(?:FACTURA|BOLETA|COMPROBANTE|N[°º]\s*DOC)[^\n]{0,20}?([A-Z0-9]{2,5}[-–]\d{3,10})/i);
    const invoiceNumber = invMatch ? invMatch[1].replace(/\s+/g, "").toUpperCase() : "";

    // 2. RUC (11 dígitos empezando por 10 o 20)
    const rucMatches = text.match(/\b((?:10|20)\d{9})\b/g) || [];
    const supplierRuc = rucMatches[0] || "";

    // 3. Fecha (YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY)
    let date = "";
    const isoDate = text.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2})\b/);
    const dmyDate = text.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
    if (isoDate) {
      date = isoDate[1].replace(/\//g, "-");
    } else if (dmyDate) {
      date = `${dmyDate[3]}-${dmyDate[2]}-${dmyDate[1]}`;
    }

    // 4. Proveedor (línea con SAC/S.A.C./SRL/EIRL/SA o primera línea con letras antes de RUC)
    let supplier = "";
    const companyLine = lines.find((l) =>
      /\b(S\.?A\.?C\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|S\.?A\.?|PERU|TELECOM|NETWORK|TECH|LATAM|ELECTRIC)\b/i.test(l) &&
      l.length >= 4 &&
      l.length <= 90 &&
      !/FACTURA|BOLETA|RUC|CLIENTE|SEÑOR|DIRECCION/i.test(l)
    );
    if (companyLine) {
      supplier = companyLine.replace(/^R\.?U\.?C\.?.*$/i, "").trim();
    } else if (lines.length > 0) {
      supplier = lines.find((l) => l.length >= 4 && l.length <= 70 && !/^\d+$/.test(l) && !/FACTURA|BOLETA/i.test(l)) || "";
    }

    // 5. Total a pagar
    let totalCost = 0;
    const totalRegexes = [
      /(?:IMPORTE\s*TOTAL|TOTAL\s*A\s*PAGAR|TOTAL\s*VENTA|TOTAL\s*GENERAL|TOTAL\s*S\/?|MONTO\s*TOTAL)[^\d]{0,18}(?:S\/\.?|PEN|USD|\$)?\s*([\d,]+\.\d{2})/i,
      /(?:TOTAL)[^\d\n]{0,12}(?:S\/\.?|PEN|USD|\$)?\s*([\d,]+\.\d{2})/i,
    ];
    for (const rx of totalRegexes) {
      const m = text.match(rx);
      if (m && m[1]) {
        totalCost = parseFloat(m[1].replace(/,/g, "")) || 0;
        if (totalCost > 0) break;
      }
    }
    if (!totalCost) {
      const allAmounts = Array.from(text.matchAll(/(?:S\/\.?|PEN|\$)?\s*([\d,]+\.\d{2})/g))
        .map((m) => parseFloat(m[1].replace(/,/g, "")) || 0)
        .filter((n) => n > 0 && n < 10_000_000);
      if (allAmounts.length > 0) totalCost = Math.max(...allAmounts);
    }

    // 6. Intentar extraer producto / cantidad / costo unitario o empatar con catálogo
    let matchedProduct: any = null;
    const textLower = text.toLowerCase();
    for (const prod of tenantProducts) {
      const pName = (prod.name || "").trim().toLowerCase();
      const pSku = (prod.sku || "").trim().toLowerCase();
      if ((pSku && pSku.length >= 4 && textLower.includes(pSku)) || (pName && pName.length >= 5 && textLower.includes(pName))) {
        matchedProduct = prod;
        break;
      }
    }

    // Buscar línea con cantidad y precio unitario (ej: "50  Router Wi-Fi 6  125.00  6250.00")
    let quantity = 1;
    let unitCost = totalCost;
    let productName = matchedProduct?.name || "";
    const qtyLineMatch = text.match(/\b(\d{1,5})(?:\.00)?\s+(?:UND|UNID|UNI|PCS|PZA|CAJA|MTR|MTS|ROLLO|BOBINA|NIU|ZZ)\s+([^\n]{4,80}?)\s+([\d,]+\.\d{2})/i);
    if (qtyLineMatch) {
      quantity = Math.max(1, parseInt(qtyLineMatch[1], 10) || 1);
      if (!productName) productName = qtyLineMatch[2].trim();
      unitCost = parseFloat(qtyLineMatch[3].replace(/,/g, "")) || (totalCost > 0 ? +(totalCost / quantity).toFixed(2) : 0);
    } else if (totalCost > 0) {
      unitCost = totalCost;
    }

    return {
      supplier,
      supplierRuc,
      invoiceNumber,
      date,
      productId: matchedProduct ? Number(matchedProduct.id) : null,
      productName,
      category: matchedProduct?.category || "Equipos de Red",
      quantity,
      unitCost: +Number(unitCost || 0).toFixed(2),
      totalCost: +Number(totalCost || 0).toFixed(2),
      paymentMethod: /EFECTIVO|CONTADO/i.test(text) ? "cash" : /CREDITO|CRÉDITO/i.test(text) ? "credit" : "bank_transfer",
      notes: supplierRuc ? `RUC Proveedor: ${supplierRuc}` : "",
    };
  }

  function extractTextFromPdfBuffer(buffer: Buffer): string {
    const chunks: string[] = [];
    const rawLatin = buffer.toString("latin1");

    // 1. Extraer texto de streams FlateDecode
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(rawLatin)) !== null) {
      const streamBytes = Buffer.from(match[1], "latin1");
      let decoded = "";
      try {
        decoded = zlib.inflateSync(streamBytes).toString("latin1");
      } catch {
        decoded = match[1];
      }
      const tjMatches = decoded.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g) || [];
      for (const tj of tjMatches) {
        const inner = tj.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
        chunks.push(inner.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\"));
      }
      const tjArrMatches = decoded.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
      for (const arr of tjArrMatches) {
        const parts = arr.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g) || [];
        chunks.push(parts.map((p) => p.slice(1, -1)).join(""));
      }
    }

    // 2. Fallback: texto plano legible directo en el PDF
    if (chunks.join(" ").trim().length < 20) {
      const plain = rawLatin.replace(/[^\x20-\x7E\n\r\tÁÉÍÓÚÑáéíóúñ]/g, " ").replace(/\s{2,}/g, "\n");
      chunks.push(plain);
    }

    return chunks.join("\n").slice(0, 12000);
  }

  function parseSunatXmlInvoice(xmlText: string, tenantProducts: any[]) {
    const tagVal = (pattern: RegExp) => {
      const m = xmlText.match(pattern);
      return m && m[1] ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };
    const invoiceNumber = tagVal(/<cbc:ID>([FBE][A-Z0-9]{3}-\d+)<\/cbc:ID>/i) || tagVal(/<cbc:ID>([^<]{4,30})<\/cbc:ID>/i);
    const date = tagVal(/<cbc:IssueDate>(\d{4}-\d{2}-\d{2})<\/cbc:IssueDate>/i);
    const supplierBlock = xmlText.match(/<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/i)?.[1] || "";
    const supplierRuc = supplierBlock.match(/<cbc:ID[^>]*>(\d{11})<\/cbc:ID>/i)?.[1] || "";
    const supplier =
      supplierBlock.match(/<cbc:RegistrationName>([\s\S]*?)<\/cbc:RegistrationName>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ||
      supplierBlock.match(/<cbc:Name>([\s\S]*?)<\/cbc:Name>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ||
      "";
    const totalCost = parseFloat(tagVal(/<cbc:PayableAmount[^>]*>([\d.]+)<\/cbc:PayableAmount>/i)) || 0;

    // Extraer líneas de factura
    const lineBlocks = Array.from(xmlText.matchAll(/<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/gi)).map((m) => m[1]);
    const items = lineBlocks.map((blk) => {
      const desc = blk.match(/<cbc:Description>([\s\S]*?)<\/cbc:Description>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "Producto";
      const qty = parseFloat(blk.match(/<cbc:InvoicedQuantity[^>]*>([\d.]+)<\/cbc:InvoicedQuantity>/i)?.[1] || "1") || 1;
      const price = parseFloat(blk.match(/<cbc:PriceAmount[^>]*>([\d.]+)<\/cbc:PriceAmount>/i)?.[1] || "0") || 0;
      const matched = tenantProducts.find(
        (p: any) =>
          (p.name || "").toLowerCase() === desc.toLowerCase() ||
          desc.toLowerCase().includes((p.name || "").toLowerCase())
      );
      return {
        productId: matched ? Number(matched.id) : null,
        productName: matched ? matched.name : desc,
        quantity: qty,
        unitCost: price,
        totalCost: +(qty * price).toFixed(2),
      };
    });

    const firstItem = items[0];
    return {
      supplier,
      supplierRuc,
      invoiceNumber,
      date,
      productId: firstItem?.productId || null,
      productName: firstItem?.productName || "",
      quantity: firstItem?.quantity || 1,
      unitCost: firstItem?.unitCost || totalCost,
      totalCost: totalCost || firstItem?.totalCost || 0,
      paymentMethod: "bank_transfer",
      notes: supplierRuc ? `Factura XML SUNAT • RUC ${supplierRuc}` : "Factura XML SUNAT",
      items,
    };
  }

  fastify.post("/purchases/ocr", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as {
      documentData?: string;
      documentName?: string;
      mimeType?: string;
    }) || {};

    if (!body.documentData) {
      return reply.status(400).send({ success: false, message: "Debe adjuntar una factura (PDF, imagen o XML) para leer con OCR." });
    }

    const tenantProducts = getInventoryProducts(tenantId, {});
    let mimeType = (body.mimeType || "").toLowerCase();
    let base64Data = body.documentData;

    const dataUrlMatch = body.documentData.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1].toLowerCase();
      base64Data = dataUrlMatch[2];
    }

    const fileName = (body.documentName || "").toLowerCase();
    const isXml = mimeType.includes("xml") || fileName.endsWith(".xml");
    const isPdf = mimeType.includes("pdf") || fileName.endsWith(".pdf");
    const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(fileName);

    // 1. Factura electrónica XML SUNAT -> parseo exacto 100% determinista
    if (isXml) {
      const xmlText = Buffer.from(base64Data, "base64").toString("utf-8");
      const parsed = parseSunatXmlInvoice(xmlText, tenantProducts);
      return reply.send({
        success: true,
        engine: "sunat-xml",
        message: "Datos extraídos automáticamente desde Factura Electrónica XML.",
        data: parsed,
      });
    }

    // 2. Motor primario: Gemini Vision / Multimodal si GEMINI_API_KEY está configurada
    const geminiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
    if (geminiKey && (isImage || isPdf)) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const catalogHint = tenantProducts
          .slice(0, 60)
          .map((p: any) => `${p.id}:${p.sku || ""}:${p.name}`)
          .join(" | ");

        const prompt = `Eres un motor OCR experto en facturas y boletas de compra (especialmente Perú/SUNAT).
Analiza el documento adjunto y devuelve ÚNICAMENTE un JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
{
  "supplier": "Nombre o Razón Social del proveedor",
  "supplierRuc": "RUC de 11 dígitos si aparece o cadena vacía",
  "invoiceNumber": "Serie y número de factura o boleta (ej: F001-002891)",
  "date": "YYYY-MM-DD",
  "productName": "Descripción del producto o concepto principal",
  "quantity": 1,
  "unitCost": 0,
  "totalCost": 0,
  "paymentMethod": "bank_transfer",
  "notes": "Resumen breve o RUC/moneda",
  "items": [
    { "productName": "Nombre", "quantity": 1, "unitCost": 0, "totalCost": 0 }
  ]
}
Catálogo de inventario del cliente (id:sku:nombre) para ayudar a normalizar nombres si coinciden: ${catalogHint}`;

        const resp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: isPdf ? "application/pdf" : mimeType || "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });

        const rawJsonText = (resp.text || "").replace(/```json|```/gi, "").trim();
        const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Vincular productId contra catálogo del tenant
          const matchProd = (name?: string) => {
            if (!name) return null;
            const n = name.toLowerCase().trim();
            return tenantProducts.find(
              (p: any) =>
                (p.name || "").toLowerCase().includes(n) ||
                n.includes((p.name || "").toLowerCase()) ||
                (p.sku && n.includes(String(p.sku).toLowerCase()))
            );
          };
          const mainMatch = matchProd(parsed.productName);
          if (mainMatch) parsed.productId = Number(mainMatch.id);
          if (Array.isArray(parsed.items)) {
            parsed.items = parsed.items.map((it: any) => {
              const m = matchProd(it.productName);
              return { ...it, productId: m ? Number(m.id) : null };
            });
          }
          return reply.send({
            success: true,
            engine: "gemini-vision",
            message: "Factura leída con IA OCR (Gemini Vision) y campos completados.",
            data: parsed,
          });
        }
      } catch (err: any) {
        console.warn("[OCR Compras] Fallo Gemini Vision, pasando a fallback:", err?.message);
      }
    }

    // 3. PDF sin Gemini -> extracción directa de texto PDF + parser heurístico
    if (isPdf) {
      const pdfBuf = Buffer.from(base64Data, "base64");
      const extractedText = extractTextFromPdfBuffer(pdfBuf);
      const parsed = parseInvoiceTextHeuristic(extractedText, tenantProducts);
      const hasUsefulData = Boolean(parsed.invoiceNumber || parsed.supplier || parsed.totalCost > 0);
      return reply.send({
        success: true,
        engine: "pdf-text",
        hasUsefulData,
        rawTextPreview: extractedText.slice(0, 600),
        message: hasUsefulData
          ? "Datos extraídos automáticamente desde el comprobante PDF."
          : "PDF escaneado sin capa de texto. Verifica o completa los campos manualmente.",
        data: parsed,
      });
    }

    // 4. Imagen sin Gemini -> indicar al frontend que ejecute Tesseract.js local
    return reply.send({
      success: true,
      engine: "client-tesseract",
      fallbackToClientOcr: true,
      message: "Ejecutando motor OCR local en el navegador...",
      data: null,
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

  // ========================================================
  // SECCIÓN 4.3: FORMATO MODERNO A4 + COMPARTIR PÚBLICO CON CONTRASEÑA
  // ========================================================

  const validDocTypes = new Set<ShareableDocType>(["purchase_order", "purchase", "invoice"]);

  fastify.get("/documents/share/:docType/:docId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { docType, docId } = request.params as { docType: string; docId: string };
    if (!validDocTypes.has(docType as ShareableDocType)) {
      return reply.status(400).send({ success: false, message: "Tipo de documento inválido" });
    }
    const share = getDocumentShare(tenantId, docType as ShareableDocType, docId);
    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    if (!share) {
      return reply.send({ success: true, data: null });
    }
    return reply.send({
      success: true,
      data: {
        token: share.token,
        docType: share.docType,
        docId: share.docId,
        docNumber: share.docNumber,
        hasPassword: share.hasPassword,
        enabled: share.enabled,
        viewsCount: share.viewsCount || 0,
        publicUrl: `${baseUrl}/doc/${share.token}`,
        publicPath: `/doc/${share.token}`,
        updatedAt: share.updatedAt,
      },
    });
  });

  fastify.post("/documents/share", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as {
      docType?: string;
      docId?: string | number;
      password?: string;
      removePassword?: boolean;
      enabled?: boolean;
    }) || {};

    if (!body.docType || !validDocTypes.has(body.docType as ShareableDocType) || !body.docId) {
      return reply.status(400).send({ success: false, message: "docType y docId son requeridos" });
    }

    const share = createOrUpdateDocumentShare(tenantId, {
      docType: body.docType as ShareableDocType,
      docId: String(body.docId),
      password: body.password,
      removePassword: Boolean(body.removePassword),
      enabled: body.enabled,
    });

    if (!share) {
      return reply.status(404).send({ success: false, message: "Documento no encontrado en esta empresa" });
    }

    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const baseUrl = `${protocol}://${host}`;

    return reply.send({
      success: true,
      message: share.hasPassword
        ? "Enlace público guardado con protección por contraseña."
        : "Enlace público generado y listo para compartir.",
      data: {
        token: share.token,
        docType: share.docType,
        docId: share.docId,
        docNumber: share.docNumber,
        hasPassword: share.hasPassword,
        enabled: share.enabled,
        viewsCount: share.viewsCount || 0,
        publicUrl: `${baseUrl}/doc/${share.token}`,
        publicPath: `/doc/${share.token}`,
        updatedAt: share.updatedAt,
      },
    });
  });

  fastify.get("/documents/render/:docType/:docId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { docType, docId } = request.params as { docType: string; docId: string };
    const q = (request.query || {}) as { print?: string };
    if (!validDocTypes.has(docType as ShareableDocType)) {
      return reply.status(400).send({ success: false, message: "Tipo de documento inválido" });
    }
    const resolved = resolveTenantDocument(tenantId, docType as ShareableDocType, docId);
    if (!resolved) {
      return reply.status(404).type("text/html; charset=utf-8").send("<h1>Documento no encontrado</h1>");
    }
    const share = getDocumentShare(tenantId, docType as ShareableDocType, docId);
    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const publicUrl = share && share.enabled ? `${protocol}://${host}/doc/${share.token}` : undefined;

    const html = await renderModernDocumentHtml({
      tenantId,
      docType: docType as ShareableDocType,
      doc: resolved.doc,
      publicUrl,
      autoPrint: q.print === "1",
    });
    return reply.type("text/html; charset=utf-8").send(html);
  });
};
