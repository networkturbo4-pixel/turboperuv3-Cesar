import crypto from "crypto";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { env } from "../../config/env";
import { getTenantFilePath, loadTenantsFromDisk } from "../tenants/tenants.service";
import {
  loadTenantInvoices,
  loadTenantPurchases,
  loadTenantPurchaseOrders,
} from "./invoices.routes";

export type ShareableDocType = "purchase_order" | "purchase" | "invoice";

export interface DocumentShareRecord {
  token: string;
  tenantId: string;
  docType: ShareableDocType;
  docId: string;
  docNumber: string;
  passwordHash: string | null;
  hasPassword: boolean;
  enabled: boolean;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDocBranding {
  tenantId: string;
  name: string;
  tagline: string;
  ruc: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  primaryColor: string;
  accentColor: string;
  currencySymbol: string;
  logoUrl: string;
}

const SHARES_FILE_NAME = "shared_documents.json";

function escapeHtml(str: any): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hashSharePassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifySharePassword(record: DocumentShareRecord, candidate: string): boolean {
  if (!record.hasPassword || !record.passwordHash) return true;
  if (!candidate) return false;
  if (record.passwordHash.startsWith("scrypt$")) {
    const parts = record.passwordHash.slice("scrypt$".length).split("$");
    if (parts.length !== 2) return false;
    const [salt, storedHex] = parts;
    try {
      const derived = crypto.scryptSync(candidate, salt, 32);
      const storedBuf = Buffer.from(storedHex, "hex");
      return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
    } catch {
      return false;
    }
  }
  return false;
}

export function buildUnlockCookieName(token: string): string {
  return `tn_doc_unlock_${token.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

export function signUnlockCookieValue(token: string, passwordHash: string | null): string {
  const payload = `${token}:${passwordHash || "open"}`;
  return crypto
    .createHmac("sha256", `${env.JWT_SECRET}:public-doc-share-v1`)
    .update(payload)
    .digest("hex");
}

export function verifyUnlockCookieValue(
  token: string,
  passwordHash: string | null,
  cookieVal?: string | null
): boolean {
  if (!cookieVal) return false;
  const expected = signUnlockCookieValue(token, passwordHash);
  try {
    const a = Buffer.from(cookieVal, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function loadTenantDocumentShares(tenantId: string): DocumentShareRecord[] {
  const filePath = getTenantFilePath(tenantId, SHARES_FILE_NAME);
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`Aviso al leer shared_documents de ${tenantId}:`, err);
  }
  return [];
}

export function saveTenantDocumentShares(tenantId: string, list: DocumentShareRecord[]): void {
  const filePath = getTenantFilePath(tenantId, SHARES_FILE_NAME);
  try {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al guardar shared_documents de ${tenantId}:`, err);
  }
}

export function resolveTenantDocument(
  tenantId: string,
  docType: ShareableDocType,
  docId: string
): { doc: any; docNumber: string } | null {
  const idStr = String(docId);
  if (docType === "purchase_order") {
    const orders = loadTenantPurchaseOrders(tenantId);
    const found = orders.find((o: any) => String(o.id) === idStr || String(o.orderNumber) === idStr);
    if (!found) return null;
    return { doc: found, docNumber: found.orderNumber || idStr };
  }
  if (docType === "purchase") {
    const purchases = loadTenantPurchases(tenantId);
    const found = purchases.find((p: any) => String(p.id) === idStr);
    if (!found) return null;
    return { doc: found, docNumber: found.invoiceNumber || idStr };
  }
  if (docType === "invoice") {
    const invoices = loadTenantInvoices(tenantId);
    const found = invoices.find((i: any) => String(i.id) === idStr || String(i.invoiceNumber) === idStr);
    if (!found) return null;
    return { doc: found, docNumber: found.invoiceNumber || `REC-${idStr}` };
  }
  return null;
}

export function getDocumentShare(
  tenantId: string,
  docType: ShareableDocType,
  docId: string
): DocumentShareRecord | null {
  const list = loadTenantDocumentShares(tenantId);
  return list.find((s) => s.docType === docType && String(s.docId) === String(docId)) || null;
}

export function createOrUpdateDocumentShare(
  tenantId: string,
  params: {
    docType: ShareableDocType;
    docId: string;
    password?: string;
    removePassword?: boolean;
    enabled?: boolean;
  }
): DocumentShareRecord | null {
  const resolved = resolveTenantDocument(tenantId, params.docType, params.docId);
  if (!resolved) return null;

  const list = loadTenantDocumentShares(tenantId);
  const nowIso = new Date().toISOString();
  let existing = list.find((s) => s.docType === params.docType && String(s.docId) === String(params.docId));

  if (!existing) {
    existing = {
      token: crypto.randomBytes(12).toString("hex"),
      tenantId,
      docType: params.docType,
      docId: String(params.docId),
      docNumber: resolved.docNumber,
      passwordHash: null,
      hasPassword: false,
      enabled: params.enabled !== false,
      viewsCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    list.unshift(existing);
  } else {
    existing.docNumber = resolved.docNumber;
    if (params.enabled !== undefined) existing.enabled = Boolean(params.enabled);
    existing.updatedAt = nowIso;
  }

  if (params.removePassword) {
    existing.passwordHash = null;
    existing.hasPassword = false;
  } else if (typeof params.password === "string" && params.password.trim().length > 0) {
    existing.passwordHash = hashSharePassword(params.password.trim());
    existing.hasPassword = true;
  }

  saveTenantDocumentShares(tenantId, list);
  return existing;
}

export function findSharedDocumentByToken(
  token: string
): { share: DocumentShareRecord; doc: any; tenantId: string } | null {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;

  const tenantsDir = path.resolve(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) return null;

  const dirs = fs.readdirSync(tenantsDir);
  for (const dirName of dirs) {
    const shareFile = path.join(tenantsDir, dirName, SHARES_FILE_NAME);
    if (!fs.existsSync(shareFile)) continue;
    try {
      const list: DocumentShareRecord[] = JSON.parse(fs.readFileSync(shareFile, "utf-8"));
      if (!Array.isArray(list)) continue;
      const share = list.find((s) => s.token === cleanToken);
      if (share) {
        const resolved = resolveTenantDocument(dirName, share.docType, share.docId);
        if (!resolved) return null;
        return { share, doc: resolved.doc, tenantId: dirName };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function incrementShareViews(tenantId: string, token: string): void {
  const list = loadTenantDocumentShares(tenantId);
  const found = list.find((s) => s.token === token);
  if (found) {
    found.viewsCount = (found.viewsCount || 0) + 1;
    saveTenantDocumentShares(tenantId, list);
  }
}

export function getTenantDocumentBranding(tenantId: string): TenantDocBranding {
  const tenants = loadTenantsFromDisk();
  const tenant = tenants.find((t) => t.id.toLowerCase() === tenantId.toLowerCase()) || tenants[0];

  let brandingJson: any = {};
  try {
    const bPath = getTenantFilePath(tenantId, "branding.json");
    if (fs.existsSync(bPath)) {
      brandingJson = JSON.parse(fs.readFileSync(bPath, "utf-8"));
    }
  } catch {}

  const currencyCode = (tenant?.globalCurrency || "PEN").toUpperCase();
  const currencySymbol = currencyCode === "USD" ? "$" : currencyCode === "EUR" ? "€" : "S/";

  const logoUrl =
    brandingJson.logoUrl ||
    tenant?.logoUrl ||
    brandingJson.faviconUrl ||
    tenant?.faviconUrl ||
    brandingJson.pwaIconUrl ||
    tenant?.pwaIconUrl ||
    "";

  return {
    tenantId,
    name: brandingJson.systemName || tenant?.name || "TurboNetwork Perú S.A.C.",
    tagline: brandingJson.tagline || tenant?.tagline || "ISP Enterprise Core",
    ruc: tenant?.ruc || "20601234567",
    phone: tenant?.phone || "",
    email: tenant?.email || "",
    address: tenant?.address || "Lima, Perú",
    website: tenant?.website || "",
    primaryColor: brandingJson.primaryColor || tenant?.primaryColor || "#2563eb",
    accentColor: brandingJson.accentColor || tenant?.accentColor || "#059669",
    currencySymbol,
    logoUrl,
  };
}

function renderLogoBox(branding: TenantDocBranding, sizePx = 56): string {
  const initials = (branding.name || "TN")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "TN";

  if (branding.logoUrl) {
    return `
      <div style="width:${sizePx}px;height:${sizePx}px;border-radius:14px;background:#ffffff;border:1px solid #e2e8f0;padding:6px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,0.06);flex-shrink:0;overflow:hidden;">
        <img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.name)}" style="max-width:100%;max-height:100%;object-fit:contain;" />
      </div>
    `;
  }
  return `
    <div style="width:${sizePx}px;height:${sizePx}px;border-radius:14px;background:linear-gradient(135deg,${escapeHtml(branding.primaryColor)},${escapeHtml(branding.accentColor)});color:#ffffff;font-weight:900;font-size:${Math.round(sizePx * 0.36)}px;display:flex;align-items:center;justify-content:center;letter-spacing:1px;box-shadow:0 6px 16px rgba(37,99,235,0.22);flex-shrink:0;">
      ${escapeHtml(initials)}
    </div>
  `;
}

export async function renderModernDocumentHtml(params: {
  tenantId: string;
  docType: ShareableDocType;
  doc: any;
  publicUrl?: string;
  autoPrint?: boolean;
}): Promise<string> {
  const { tenantId, docType, doc, publicUrl, autoPrint } = params;
  const branding = getTenantDocumentBranding(tenantId);
  const sym = branding.currencySymbol;
  const primary = branding.primaryColor;
  const accent = branding.accentColor;

  let qrDataUrl = "";
  if (publicUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 120, margin: 1 });
    } catch {}
  }

  let docTitle = "DOCUMENTO";
  let docSubtitle = "";
  let docNumber = "";
  let issueDate = "";
  let secondaryDateLabel = "";
  let secondaryDateVal = "";
  let statusText = "";
  let statusBg = "#eff6ff";
  let statusColor = primary;
  let partyTitle = "CLIENTE / PROVEEDOR";
  let partyName = "";
  let partyMeta: Array<{ label: string; value: string }> = [];
  let extraMeta: Array<{ label: string; value: string }> = [];
  let items: Array<{ code: string; desc: string; qty: number; unit: number; subtotal: number }> = [];
  let subtotalAmount = 0;
  let discountAmount = 0;
  let totalAmount = 0;
  let notes = doc.notes || "";
  let attachedDocUrl = doc.documentUrl || "";
  let showSignatures = false;

  if (docType === "purchase_order") {
    docTitle = "ORDEN DE COMPRA";
    docSubtitle = "Requerimiento Oficial de Adquisición";
    docNumber = doc.orderNumber || doc.id;
    issueDate = doc.date || (doc.createdAt || "").slice(0, 10);
    secondaryDateLabel = "Entrega Estimada";
    secondaryDateVal = doc.expectedDate || "Por coordinar";
    statusText = (doc.status || "PENDIENTE").toUpperCase();
    if (doc.status === "recibida") {
      statusBg = "#ecfdf5";
      statusColor = "#059669";
    } else if (doc.status === "cancelada") {
      statusBg = "#fff1f2";
      statusColor = "#e11d48";
    } else {
      statusBg = "#fffbeb";
      statusColor = "#d97706";
    }
    partyTitle = "DATOS DEL PROVEEDOR";
    partyName = doc.supplier || "Proveedor";
    partyMeta = [
      { label: "RUC", value: doc.supplierRuc || "No especificado" },
      { label: "Contacto", value: doc.supplierContact || "—" },
    ];
    extraMeta = [
      { label: "Condición de Pago", value: doc.paymentTerms || "Transferencia Bancaria" },
      { label: "Solicitado por", value: doc.createdBy || "Logística / Administración" },
      ...(doc.linkedInvoiceNumber ? [{ label: "Factura Vinculada", value: doc.linkedInvoiceNumber }] : []),
    ];
    items = (doc.items || []).map((it: any) => ({
      code: it.sku || (it.productId ? `INV-${it.productId}` : "—"),
      desc: it.productName || "Producto",
      qty: Number(it.quantity) || 1,
      unit: Number(it.estimatedUnitCost) || 0,
      subtotal: Number(it.subtotal) || (Number(it.quantity) || 1) * (Number(it.estimatedUnitCost) || 0),
    }));
    totalAmount = Number(doc.estimatedTotal) || items.reduce((a, b) => a + b.subtotal, 0);
    subtotalAmount = totalAmount;
    showSignatures = true;
  } else if (docType === "purchase") {
    docTitle = "COMPROBANTE DE COMPRA";
    docSubtitle = "Registro Oficial de Factura / Adquisición";
    docNumber = doc.invoiceNumber || doc.id;
    issueDate = doc.date || (doc.createdAt || "").slice(0, 10);
    secondaryDateLabel = "Referencia / Op.";
    secondaryDateVal = doc.referenceNumber || "—";
    statusText = "REGISTRADA";
    statusBg = "#ecfdf5";
    statusColor = "#059669";
    partyTitle = "DATOS DEL PROVEEDOR";
    partyName = doc.supplier || "Proveedor";
    partyMeta = [
      { label: "RUC", value: doc.supplierRuc || "No especificado" },
      { label: "Categoría", value: doc.category || "Equipos de Red" },
    ];
    const payLabelMap: Record<string, string> = {
      bank_transfer: "Transferencia Bancaria",
      cash: "Efectivo de Caja",
      credit: "Crédito 30 días",
      other: "Tarjeta / POS",
    };
    extraMeta = [
      { label: "Método de Pago", value: payLabelMap[doc.paymentMethod] || doc.paymentMethod || "Transferencia" },
      ...(doc.purchaseOrderNumber ? [{ label: "Orden de Compra", value: doc.purchaseOrderNumber }] : []),
      { label: "Inventario", value: doc.productId ? `Vinculado (ID #${doc.productId})` : "Gasto Operativo" },
    ];
    const qty = Number(doc.quantity) || 1;
    const uCost = Number(doc.unitCost) || 0;
    const tot = Number(doc.totalCost) || qty * uCost;
    items = [
      {
        code: doc.productId ? `INV-${doc.productId}` : "COMP",
        desc: doc.productName || "Concepto de compra",
        qty,
        unit: uCost,
        subtotal: tot,
      },
    ];
    subtotalAmount = tot;
    totalAmount = tot;
  } else {
    // invoice (Facturación & Recibos a clientes)
    docTitle = "FACTURA / RECIBO";
    docSubtitle = "Comprobante de Servicio de Telecomunicaciones";
    docNumber = doc.invoiceNumber || `REC-${doc.id}`;
    issueDate = (doc.issueDate || doc.createdAt || "").slice(0, 10);
    secondaryDateLabel = "Vencimiento";
    secondaryDateVal = (doc.dueDate || "").slice(0, 10) || "—";
    statusText = doc.status === "paid" ? "PAGADO" : doc.status === "overdue" ? "VENCIDO" : "PENDIENTE";
    if (doc.status === "paid") {
      statusBg = "#ecfdf5";
      statusColor = "#059669";
    } else if (doc.status === "overdue") {
      statusBg = "#fff1f2";
      statusColor = "#e11d48";
    } else {
      statusBg = "#fffbeb";
      statusColor = "#d97706";
    }
    partyTitle = "FACTURADO A (CLIENTE)";
    partyName = doc.customerName || `Cliente #${doc.customerId}`;
    partyMeta = [
      { label: "Código Cliente", value: doc.customerCode || `CLI-${doc.customerId}` },
      { label: "Servicio / Plan", value: doc.serviceName || "Internet Fibra Óptica" },
    ];
    extraMeta = [
      { label: "Periodo Facturado", value: doc.period || "—" },
      { label: "Método de Pago", value: doc.paymentMethod || "Por definir" },
      ...(doc.referenceNumber ? [{ label: "N° Operación", value: doc.referenceNumber }] : []),
    ];
    subtotalAmount = Number(doc.subtotal ?? doc.total ?? 0);
    discountAmount = Number(doc.discount ?? 0);
    totalAmount = Number(doc.total ?? 0);
    items = [
      {
        code: doc.period || "SERV",
        desc: doc.concept || doc.serviceName || "Mensualidad Servicio de Internet",
        qty: 1,
        unit: subtotalAmount,
        subtotal: subtotalAmount,
      },
    ];
  }

  const rowsHtml = items
    .map(
      (it, idx) => `
      <tr style="background:${idx % 2 === 1 ? "#f8fafc" : "#ffffff"};">
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-family:monospace;font-size:12px;text-align:center;">${idx + 1}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#475569;font-family:monospace;font-size:12px;">${escapeHtml(it.code)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;font-size:13px;">${escapeHtml(it.desc)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-family:monospace;font-size:12.5px;text-align:center;font-weight:600;">${it.qty}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;font-family:monospace;font-size:12.5px;text-align:right;">${sym} ${it.unit.toFixed(2)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-family:monospace;font-size:13px;text-align:right;font-weight:700;">${sym} ${it.subtotal.toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docTitle)} ${escapeHtml(docNumber)} • ${escapeHtml(branding.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background: #f1f5f9;
      color: #0f172a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      max-width: 850px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px 16px;
      box-shadow: 0 4px 16px rgba(15,23,42,0.05);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: ${escapeHtml(primary)}; color: #ffffff; box-shadow: 0 6px 14px rgba(37,99,235,0.22); }
    .btn-ghost { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
    .sheet {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 50px rgba(15,23,42,0.08);
    }
    .accent-bar {
      height: 7px;
      background: linear-gradient(90deg, ${escapeHtml(primary)}, ${escapeHtml(accent)});
    }
    .sheet-body { padding: 34px 38px 38px; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .company-block { display: flex; align-items: flex-start; gap: 14px; max-width: 470px; }
    .doc-badge-box {
      min-width: 235px;
      border-radius: 14px;
      border: 1.5px solid ${escapeHtml(primary)}33;
      background: linear-gradient(180deg, ${escapeHtml(primary)}0d, #ffffff);
      padding: 14px 18px;
      text-align: right;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin: 22px 0 26px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 15px 18px;
      font-size: 12.5px;
      line-height: 1.65;
    }
    .table-wrap {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #0f172a;
      color: #f8fafc;
      padding: 11px 14px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-align: left;
    }
    .bottom-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      flex-wrap: wrap;
    }
    .totals-box {
      min-width: 290px;
      margin-left: auto;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: linear-gradient(135deg, ${escapeHtml(primary)}, ${escapeHtml(accent)});
      color: #ffffff;
      font-weight: 800;
      font-size: 16px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      margin-top: 56px;
      text-align: center;
      font-size: 12px;
      color: #475569;
    }
    .sig-line { border-top: 1.5px solid #94a3b8; padding-top: 8px; font-weight: 600; color: #0f172a; }
    .footer-note {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
      flex-wrap: wrap;
      gap: 8px;
    }
    @media (max-width: 680px) {
      .sheet-body { padding: 20px; }
      .meta-grid { grid-template-columns: 1fr; }
      .doc-badge-box { width: 100%; text-align: left; }
      .totals-box { width: 100%; }
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none; border: none; border-radius: 0; max-width: 100%; }
      .sheet-body { padding: 20px 24px; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div style="display:flex;align-items:center;gap:10px;">
      ${renderLogoBox(branding, 32)}
      <div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(docTitle)} ${escapeHtml(docNumber)}</div>
        <div style="font-size:11px;color:#64748b;">${escapeHtml(branding.name)} • Documento Digital Verificado</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      ${
        attachedDocUrl
          ? `<a href="${escapeHtml(attachedDocUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">📎 Ver Comprobante Adjunto</a>`
          : ""
      }
      <button type="button" onclick="window.print()" class="btn btn-primary">🖨️ Imprimir / Guardar PDF</button>
    </div>
  </div>

  <div class="sheet">
    <div class="accent-bar"></div>
    <div class="sheet-body">
      <div class="doc-header">
        <div class="company-block">
          ${renderLogoBox(branding, 62)}
          <div>
            <h1 style="margin:0;font-size:21px;font-weight:900;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(branding.name)}</h1>
            <div style="font-size:12px;font-weight:600;color:${escapeHtml(primary)};margin-top:2px;">${escapeHtml(branding.tagline)}</div>
            <div style="font-size:11.5px;color:#475569;margin-top:6px;line-height:1.5;">
              <div><strong>RUC:</strong> ${escapeHtml(branding.ruc)}</div>
              <div>${escapeHtml(branding.address)}</div>
              <div>${[branding.phone ? "Tel: " + branding.phone : "", branding.email].filter(Boolean).map(escapeHtml).join(" • ")}</div>
            </div>
          </div>
        </div>

        <div class="doc-badge-box">
          <div style="font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:${escapeHtml(primary)};text-transform:uppercase;">${escapeHtml(docTitle)}</div>
          <div style="font-size:20px;font-weight:900;font-family:monospace;color:#0f172a;margin-top:4px;">${escapeHtml(docNumber)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(docSubtitle)}</div>
          <div style="margin-top:10px;display:inline-block;padding:4px 10px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.06em;background:${statusBg};color:${statusColor};border:1px solid ${statusColor}33;">
            ${escapeHtml(statusText)}
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <div style="font-size:10px;font-weight:800;letter-spacing:0.08em;color:${escapeHtml(primary)};text-transform:uppercase;margin-bottom:6px;">${escapeHtml(partyTitle)}</div>
          <div style="font-size:14.5px;font-weight:800;color:#0f172a;margin-bottom:4px;">${escapeHtml(partyName)}</div>
          ${partyMeta
            .map((m) => `<div><span style="color:#64748b;">${escapeHtml(m.label)}:</span> <strong style="color:#1e293b;">${escapeHtml(m.value)}</strong></div>`)
            .join("")}
        </div>
        <div class="meta-card">
          <div style="font-size:10px;font-weight:800;letter-spacing:0.08em;color:${escapeHtml(primary)};text-transform:uppercase;margin-bottom:6px;">DETALLES DEL DOCUMENTO</div>
          <div><span style="color:#64748b;">Fecha de Emisión:</span> <strong style="font-family:monospace;color:#0f172a;">${escapeHtml(issueDate || "—")}</strong></div>
          <div><span style="color:#64748b;">${escapeHtml(secondaryDateLabel)}:</span> <strong style="font-family:monospace;color:#0f172a;">${escapeHtml(secondaryDateVal)}</strong></div>
          ${extraMeta
            .map((m) => `<div><span style="color:#64748b;">${escapeHtml(m.label)}:</span> <strong style="color:#1e293b;">${escapeHtml(m.value)}</strong></div>`)
            .join("")}
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:44px;text-align:center;">#</th>
              <th style="width:110px;">Código / SKU</th>
              <th>Descripción</th>
              <th style="width:72px;text-align:center;">Cant.</th>
              <th style="width:118px;text-align:right;">P. Unitario</th>
              <th style="width:124px;text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <div class="bottom-grid">
        <div style="flex:1;min-width:240px;display:flex;gap:14px;align-items:flex-start;">
          ${
            qrDataUrl
              ? `<div style="padding:8px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;text-align:center;flex-shrink:0;">
                   <img src="${qrDataUrl}" alt="QR Verificación" style="width:86px;height:86px;display:block;" />
                   <div style="font-size:9px;color:#64748b;font-weight:700;margin-top:4px;text-transform:uppercase;">Verificación</div>
                 </div>`
              : ""
          }
          <div style="font-size:12px;color:#475569;line-height:1.6;">
            ${
              notes
                ? `<div style="padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1;">
                     <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Observaciones</div>
                     <div style="color:#0f172a;">${escapeHtml(notes)}</div>
                   </div>`
                : `<div style="padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
                     <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Validez Digital</div>
                     <div>Documento emitido electrónicamente por <strong>${escapeHtml(branding.name)}</strong>.</div>
                   </div>`
            }
          </div>
        </div>

        <div class="totals-box">
          <div class="totals-row">
            <span style="color:#64748b;">Subtotal</span>
            <span style="font-family:monospace;font-weight:600;">${sym} ${subtotalAmount.toFixed(2)}</span>
          </div>
          ${
            discountAmount > 0
              ? `<div class="totals-row">
                   <span style="color:#64748b;">Descuento</span>
                   <span style="font-family:monospace;font-weight:600;color:#e11d48;">-${sym} ${discountAmount.toFixed(2)}</span>
                 </div>`
              : ""
          }
          <div class="totals-grand">
            <span>TOTAL</span>
            <span style="font-family:monospace;">${sym} ${totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${
        showSignatures
          ? `<div class="signatures">
               <div class="sig-line">Solicitado por (Logística / Almacén)</div>
               <div class="sig-line">Autorizado por (Gerencia / Administración)</div>
             </div>`
          : ""
      }

      <div class="footer-note">
        <span>${escapeHtml(branding.name)} • RUC ${escapeHtml(branding.ruc)}</span>
        <span>Generado el ${new Date().toLocaleDateString("es-PE")} • Vista Oficial</span>
      </div>
    </div>
  </div>
  ${autoPrint ? `<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>` : ""}
</body>
</html>`;
}

export function renderDocumentPasswordGateHtml(params: {
  tenantId: string;
  token: string;
  docType: ShareableDocType;
  docNumber: string;
}): string {
  const branding = getTenantDocumentBranding(params.tenantId);
  const typeLabel =
    params.docType === "purchase_order"
      ? "Orden de Compra"
      : params.docType === "purchase"
      ? "Comprobante de Compra"
      : "Factura / Recibo";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documento Protegido • ${escapeHtml(branding.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: radial-gradient(circle at top, #1e293b, #020617 70%);
      color: #f8fafc;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      width: 100%;
      max-width: 400px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 22px;
      padding: 32px 28px;
      text-align: center;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(16px);
    }
    .input {
      width: 100%;
      padding: 13px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(2, 6, 23, 0.7);
      color: #ffffff;
      font-size: 15px;
      text-align: center;
      outline: none;
      margin-top: 16px;
    }
    .input:focus { border-color: ${escapeHtml(branding.primaryColor)}; box-shadow: 0 0 0 3px ${escapeHtml(branding.primaryColor)}33; }
    .btn {
      width: 100%;
      margin-top: 14px;
      padding: 13px 18px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, ${escapeHtml(branding.primaryColor)}, ${escapeHtml(branding.accentColor)});
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3);
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .err { color: #fb7185; font-size: 12px; font-weight: 600; min-height: 18px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex;justify-content:center;margin-bottom:14px;">
      ${renderLogoBox(branding, 64)}
    </div>
    <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(branding.name)}</div>
    <h1 style="margin:6px 0 4px;font-size:19px;font-weight:800;color:#ffffff;">🔒 Documento Protegido</h1>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
      ${escapeHtml(typeLabel)} <strong style="color:#e2e8f0;font-family:monospace;">${escapeHtml(params.docNumber)}</strong><br/>
      Ingresa la contraseña proporcionada para ver o descargar este documento.
    </p>
    <form id="unlock-form">
      <input type="password" id="doc-password" class="input" placeholder="Ingresa la contraseña..." autocomplete="off" required autofocus />
      <div id="err-box" class="err"></div>
      <button type="submit" id="submit-btn" class="btn">Desbloquear Documento</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('unlock-form');
    const pwdInput = document.getElementById('doc-password');
    const errBox = document.getElementById('err-box');
    const btn = document.getElementById('submit-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Verificando...';
      try {
        const res = await fetch('/doc/${encodeURIComponent(params.token)}/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwdInput.value })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          window.location.reload();
        } else {
          errBox.textContent = data.message || 'Contraseña incorrecta.';
          pwdInput.value = '';
          pwdInput.focus();
        }
      } catch (_) {
        errBox.textContent = 'Error de conexión. Intenta nuevamente.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Desbloquear Documento';
      }
    });
  </script>
</body>
</html>`;
}
