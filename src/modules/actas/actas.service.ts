import fs from "fs";
import path from "path";
import crypto from "crypto";
import QRCode from "qrcode";
import { getTenantFilePath, loadTenantsFromDisk } from "../tenants/tenants.service";
import {
  loadAssignments,
  saveAssignments,
  loadProducts,
  saveProducts,
  loadInstallations,
  saveInstallations,
} from "../inventory/inventory.service";
import {
  ActaInstalacion,
  ActaEquipoItem,
  ActaMaterialItem,
  ActaEvidencia,
  ActaFirma,
} from "./actas.types";

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads", "actas");

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function loadActas(tenantId: string): ActaInstalacion[] {
  const filePath = getTenantFilePath(tenantId, "actas.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error(`[Actas] Error cargando actas para ${tenantId}:`, err);
  }
  return [];
}

export function saveActas(tenantId: string, list: ActaInstalacion[]): void {
  const filePath = getTenantFilePath(tenantId, "actas.json");
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error(`[Actas] Error guardando actas para ${tenantId}:`, err);
  }
}

export function getDefaultPrefixForTenant(tenantId: string): string {
  const tenant = loadTenantsFromDisk().find((t) => t.id === tenantId || t.slug === tenantId);
  if (tenant?.address) {
    const addr = tenant.address.toUpperCase();
    if (addr.includes("AREQUIPA")) return "AQP-";
    if (addr.includes("TRUJILLO")) return "TRU-";
    if (addr.includes("CUSCO")) return "CUZ-";
    if (addr.includes("PIURA")) return "PIU-";
  }
  return "LIM-";
}

export function getNextFolio(tenantId: string, customPrefix?: string): { prefijo: string; folioNumero: string; folioCompleto: string } {
  const actas = loadActas(tenantId);
  const prefijo = (customPrefix || getDefaultPrefixForTenant(tenantId)).toUpperCase();
  let maxNum = 0;
  for (const a of actas) {
    const num = parseInt(String(a.folioNumero || "0").replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const nextNum = String(maxNum + 1).padStart(6, "0");
  return {
    prefijo,
    folioNumero: nextNum,
    folioCompleto: `${prefijo}${nextNum}`,
  };
}

export function saveBase64Asset(tenantId: string, dataUrl: string, prefix = "img"): string {
  if (!dataUrl || typeof dataUrl !== "string") return "";
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl; // Ya es una URL guardada
  }
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!match) return dataUrl;

  let ext = match[1].toLowerCase().replace("jpeg", "jpg").replace("svg+xml", "svg");
  if (!["png", "jpg", "webp", "gif", "svg"].includes(ext)) ext = "png";

  const buffer = Buffer.from(match[2], "base64");
  const tenantDir = path.join(UPLOADS_ROOT, tenantId);
  ensureDir(tenantDir);

  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const fullPath = path.join(tenantDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/actas/${tenantId}/${filename}`;
}

function normalizeEvidencias(tenantId: string, evidencias: any[]): ActaEvidencia[] {
  if (!Array.isArray(evidencias)) return [];
  return evidencias.map((ev) => {
    const imgUrl = saveBase64Asset(tenantId, ev.imageUrl || ev.dataUrl || "", "ev");
    const thumbUrl = ev.thumbnailUrl
      ? saveBase64Asset(tenantId, ev.thumbnailUrl, "thumb")
      : imgUrl;
    return {
      id: ev.id || `ev-${crypto.randomBytes(4).toString("hex")}`,
      categoria: ev.categoria || "general",
      titulo: ev.titulo || "",
      imageUrl: imgUrl,
      thumbnailUrl: thumbUrl || imgUrl,
      createdAt: ev.createdAt || new Date().toISOString(),
    };
  }).filter((ev) => Boolean(ev.imageUrl));
}

function normalizeFirma(tenantId: string, firma: any, prefix: string): ActaFirma | undefined {
  if (!firma) return undefined;
  const rawImg = firma.dataUrl || firma.imageUrl || "";
  if (!rawImg && !firma.firmanteNombre) return undefined;
  const savedUrl = rawImg ? saveBase64Asset(tenantId, rawImg, prefix) : undefined;
  return {
    imageUrl: savedUrl,
    firmanteNombre: firma.firmanteNombre || "",
    firmanteDni: firma.firmanteDni || "",
    signedAt: firma.signedAt || (savedUrl ? new Date().toISOString() : undefined),
  };
}

/**
 * Sincroniza los equipos y materiales marcados desde la Mochila del Técnico:
 * - Marca la asignación en mochila como "instalado" (o descuenta cantidad parcial).
 * - Actualiza el estado de la unidad serializada en el producto a "instalado".
 * - Registra la instalación en ClientInstallation para trazabilidad sin descontar doble del almacén.
 */
export function syncMochilaInstallationsForActa(tenantId: string, acta: ActaInstalacion): void {
  const assignments = loadAssignments(tenantId);
  const products = loadProducts(tenantId);
  const installations = loadInstallations(tenantId);

  let assignmentsChanged = false;
  let productsChanged = false;
  let installationsChanged = false;

  const clientName = acta.cliente?.nombreCompleto || "Cliente";
  const techName = acta.detallesServicio?.tecnicoNombre || "Técnico";

  const processItem = (
    item: {
      accion?: string;
      mochilaAssignmentId?: string;
      productId?: number;
      mochilaSynced?: boolean;
      serieMac?: string;
      unitSku?: string;
      modeloMarca?: string;
      descripcion?: string;
      cantidad?: number;
    },
    qtyUsed: number,
    label: string
  ) => {
    if (item.mochilaSynced) return;
    if ((item.accion || "Instala") !== "Instala") return;
    if (!item.mochilaAssignmentId) return;

    const asgIdx = assignments.findIndex((a) => a.id === item.mochilaAssignmentId);
    if (asgIdx === -1) return;

    const asg = assignments[asgIdx];
    const currentQty = Number(asg.quantity || 1);

    if (qtyUsed >= currentQty) {
      (asg as any).status = "instalado";
      (asg as any).installedAt = new Date().toISOString();
      (asg as any).installedClientName = clientName;
      (asg as any).installedActaFolio = acta.folioCompleto;
      asg.notes = `${asg.notes ? asg.notes + " | " : ""}Instalado en ${clientName} (Acta ${acta.folioCompleto})`;
    } else {
      asg.quantity = Math.max(0, currentQty - qtyUsed);
      asg.notes = `${asg.notes ? asg.notes + " | " : ""}Consumido ${qtyUsed} en ${clientName} (Acta ${acta.folioCompleto})`;
    }
    assignmentsChanged = true;

    // Actualizar unidad individual serializada si aplica
    if (asg.itemUnitId || asg.unitSku || item.unitSku) {
      const prod = products.find((p) => p.id === (asg.productId || item.productId));
      if (prod && Array.isArray(prod.itemUnits)) {
        const cleanKey = (s?: string) => (s || "").toLowerCase().replace(/[\s\-_./]/g, "");
        const targetKey = cleanKey(asg.itemUnitId || asg.unitSku || item.unitSku);
        const unit = prod.itemUnits.find(
          (u) => (asg.itemUnitId && u.id === asg.itemUnitId) || cleanKey(u.sku) === targetKey
        );
        if (unit) {
          unit.status = "instalado";
          unit.assignedTo = clientName;
          unit.assignedAt = new Date().toISOString();
          if (item.serieMac && !unit.serialNumber) {
            unit.serialNumber = item.serieMac;
          }
          productsChanged = true;
        }
      }
    }

    // Registrar en trazabilidad de instalaciones sin descontar stock del almacén nuevamente
    installations.unshift({
      id: "inst-" + crypto.randomBytes(3).toString("hex"),
      tenantId,
      customerId: acta.cliente?.customerId ? Number(acta.cliente.customerId) : undefined,
      customerName: clientName,
      clientName,
      productId: asg.productId || item.productId || 0,
      productName: asg.productName || label,
      quantity: qtyUsed,
      serialOrMac: item.serieMac || asg.unitSku || "",
      technicianName: techName,
      technician: techName,
      date: acta.detallesServicio?.fecha || new Date().toISOString().slice(0, 10),
      notes: `Acta ${acta.folioCompleto} (Desde Mochila Técnica)`,
    } as any);
    installationsChanged = true;

    item.mochilaSynced = true;
  };

  for (const eq of acta.equipos || []) {
    processItem(eq, 1, eq.modeloMarca || "Equipo");
  }
  for (const mat of acta.materiales || []) {
    processItem(mat, Number(mat.cantidad || 1), mat.descripcion || "Material");
  }

  if (assignmentsChanged) saveAssignments(tenantId, assignments);
  if (productsChanged) saveProducts(tenantId, products);
  if (installationsChanged) saveInstallations(tenantId, installations);
}

export function createActa(tenantId: string, payload: Partial<ActaInstalacion>, operatorName?: string): ActaInstalacion {
  const actas = loadActas(tenantId);
  const folioInfo = getNextFolio(tenantId, payload.prefijo);
  const now = new Date().toISOString();

  const prefijo = (payload.prefijo || folioInfo.prefijo).toUpperCase();
  const folioNumero = payload.folioNumero
    ? String(payload.folioNumero).padStart(6, "0")
    : folioInfo.folioNumero;

  const newActa: ActaInstalacion = {
    id: `acta-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    tenantId,
    prefijo,
    folioNumero,
    folioCompleto: `${prefijo}${folioNumero}`,
    publicToken: crypto.randomBytes(12).toString("hex"),
    cliente: {
      customerId: payload.cliente?.customerId,
      nombreCompleto: (payload.cliente?.nombreCompleto || "").trim(),
      dniRuc: payload.cliente?.dniRuc || "",
      rotuladoQr: payload.cliente?.rotuladoQr || "",
      direccion: payload.cliente?.direccion || "",
      distrito: payload.cliente?.distrito || "",
      referencia: payload.cliente?.referencia || "",
      whatsappPrincipal: payload.cliente?.whatsappPrincipal || "",
      celularAlternativo: payload.cliente?.celularAlternativo || "",
      latitud: payload.cliente?.latitud || "",
      longitud: payload.cliente?.longitud || "",
    },
    plantaExterna: payload.plantaExterna || {},
    detallesServicio: {
      fecha: payload.detallesServicio?.fecha || now.slice(0, 10),
      horaInicio: payload.detallesServicio?.horaInicio || "",
      horaFin: payload.detallesServicio?.horaFin || "",
      tipo: payload.detallesServicio?.tipo || "Instalación",
      estadoFinal: payload.detallesServicio?.estadoFinal || "En Proceso",
      servicioContratadoId: payload.detallesServicio?.servicioContratadoId || "",
      servicioContratadoNombre: payload.detallesServicio?.servicioContratadoNombre || "Sin plan",
      tecnicoId: payload.detallesServicio?.tecnicoId || "",
      tecnicoNombre: payload.detallesServicio?.tecnicoNombre || operatorName || "Técnico",
      ssidWifi: payload.detallesServicio?.ssidWifi || "",
      passwordWifi: payload.detallesServicio?.passwordWifi || "",
      speedDl: payload.detallesServicio?.speedDl || "",
      speedUl: payload.detallesServicio?.speedUl || "",
      numTvs: payload.detallesServicio?.numTvs || "",
      splitters: payload.detallesServicio?.splitters || "",
      senalLow: payload.detallesServicio?.senalLow || "",
      vlanPppoe: payload.detallesServicio?.vlanPppoe || "",
    },
    equipos: Array.isArray(payload.equipos) ? payload.equipos.map((e: ActaEquipoItem) => ({
      ...e,
      id: e.id || `eq-${crypto.randomBytes(3).toString("hex")}`,
    })) : [],
    materiales: Array.isArray(payload.materiales) ? payload.materiales.map((m: ActaMaterialItem) => ({
      ...m,
      id: m.id || `mat-${crypto.randomBytes(3).toString("hex")}`,
      cantidad: Number(m.cantidad || 1),
    })) : [],
    evidencias: normalizeEvidencias(tenantId, payload.evidencias || []),
    observaciones: payload.observaciones || "",
    firmaCliente: normalizeFirma(tenantId, payload.firmaCliente, "firma_cli"),
    firmaTecnico: normalizeFirma(tenantId, payload.firmaTecnico, "firma_tec"),
    createdBy: operatorName || "Sistema",
    createdAt: now,
    updatedAt: now,
  };

  syncMochilaInstallationsForActa(tenantId, newActa);
  actas.unshift(newActa);
  saveActas(tenantId, actas);
  return newActa;
}

export function updateActa(
  tenantId: string,
  id: string,
  payload: Partial<ActaInstalacion>,
  operatorName?: string
): ActaInstalacion | null {
  const actas = loadActas(tenantId);
  const idx = actas.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const existing = actas[idx];
  const now = new Date().toISOString();
  const prevHistory = Array.isArray(existing.historialEdiciones) ? existing.historialEdiciones : [];
  const nextEstado = payload.detallesServicio?.estadoFinal || existing.detallesServicio?.estadoFinal;
  const newHistoryEntry = {
    user: operatorName || "Sistema",
    date: now,
    summary: nextEstado ? `Estado: ${nextEstado}` : "Edición de acta",
  };

  const updated: ActaInstalacion = {
    ...existing,
    prefijo: payload.prefijo !== undefined ? payload.prefijo.toUpperCase() : existing.prefijo,
    folioNumero: payload.folioNumero !== undefined ? String(payload.folioNumero).padStart(6, "0") : existing.folioNumero,
    folioCompleto: `${(payload.prefijo !== undefined ? payload.prefijo : existing.prefijo).toUpperCase()}${payload.folioNumero !== undefined ? String(payload.folioNumero).padStart(6, "0") : existing.folioNumero}`,
    cliente: payload.cliente ? { ...existing.cliente, ...payload.cliente } : existing.cliente,
    plantaExterna: payload.plantaExterna ? { ...existing.plantaExterna, ...payload.plantaExterna } : existing.plantaExterna,
    detallesServicio: payload.detallesServicio ? { ...existing.detallesServicio, ...payload.detallesServicio } : existing.detallesServicio,
    equipos: payload.equipos !== undefined ? payload.equipos : existing.equipos,
    materiales: payload.materiales !== undefined ? payload.materiales : existing.materiales,
    evidencias: payload.evidencias !== undefined ? normalizeEvidencias(tenantId, payload.evidencias) : existing.evidencias,
    observaciones: payload.observaciones !== undefined ? payload.observaciones : existing.observaciones,
    firmaCliente: payload.firmaCliente !== undefined ? normalizeFirma(tenantId, payload.firmaCliente, "firma_cli") : existing.firmaCliente,
    firmaTecnico: payload.firmaTecnico !== undefined ? normalizeFirma(tenantId, payload.firmaTecnico, "firma_tec") : existing.firmaTecnico,
    updatedBy: operatorName || existing.updatedBy || "Sistema",
    historialEdiciones: [newHistoryEntry, ...prevHistory].slice(0, 25),
    updatedAt: now,
  };

  syncMochilaInstallationsForActa(tenantId, updated);
  actas[idx] = updated;
  saveActas(tenantId, actas);
  return updated;
}

export function deleteActa(tenantId: string, id: string): boolean {
  const actas = loadActas(tenantId);
  const filtered = actas.filter((a) => a.id !== id);
  if (filtered.length === actas.length) return false;
  saveActas(tenantId, filtered);
  return true;
}

export function findActaByPublicToken(token: string): { tenantId: string; acta: ActaInstalacion } | null {
  const tenants = loadTenantsFromDisk();
  for (const t of tenants) {
    const actas = loadActas(t.id);
    const found = actas.find((a) => a.publicToken === token);
    if (found) {
      return { tenantId: t.id, acta: found };
    }
  }
  return null;
}

function escapeHtml(val?: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function renderPublicActaHtml(
  tenantId: string,
  acta: ActaInstalacion,
  baseUrl: string,
  autoPrint = false
): Promise<string> {
  const tenant = loadTenantsFromDisk().find((t) => t.id === tenantId || t.slug === tenantId);
  const publicUrl = `${baseUrl}/acta/${acta.publicToken}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 120, margin: 1 });
  } catch {
    qrDataUrl = "";
  }

  const statusColors: Record<string, string> = {
    "Finalizada (Éxito)": "background:#dcfce7;color:#15803d;border:1px solid #86efac;",
    "En Proceso": "background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;",
    "Pendiente": "background:#fef3c7;color:#b45309;border:1px solid #fcd34d;",
    "Observada": "background:#ffedd5;color:#c2410c;border:1px solid #fdba74;",
    "Anulada": "background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;",
  };
  const badgeStyle = statusColors[acta.detallesServicio?.estadoFinal || ""] || "background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;";

  const equiposRows = (acta.equipos || []).length > 0
    ? acta.equipos.map((e) => `
      <tr>
        <td><span class="pill ${e.accion === "Retira" ? "pill-warn" : "pill-ok"}">${escapeHtml(e.accion || "Instala")}</span></td>
        <td><strong>${escapeHtml(e.modeloMarca || "--")}</strong>${e.desdeMochila ? ' <span class="tag-mochila">Mochila</span>' : ""}</td>
        <td class="mono">${escapeHtml(e.serieMac || "--")}</td>
        <td>${escapeHtml(e.propiedad || "Alquiler")}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="empty">Sin equipos registrados</td></tr>`;

  const materialesRows = (acta.materiales || []).length > 0
    ? acta.materiales.map((m) => `
      <tr>
        <td><span class="pill ${m.accion === "Retira" ? "pill-warn" : "pill-ok"}">${escapeHtml(m.accion || "Instala")}</span></td>
        <td><strong>${escapeHtml(m.descripcion || "--")}</strong>${m.desdeMochila ? ' <span class="tag-mochila">Mochila</span>' : ""}</td>
        <td class="mono" style="text-align:center;">${escapeHtml(m.cantidad)}</td>
        <td>${escapeHtml(m.unidad || "Und")}</td>
        <td>${escapeHtml(m.propiedad || "Alquiler")}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="empty">Sin materiales registrados</td></tr>`;

  const evidenciasHtml = (acta.evidencias || []).length > 0
    ? `<div class="ev-grid">
        ${acta.evidencias.map((ev) => `
          <div class="ev-card" onclick="openLightbox('${escapeHtml(ev.imageUrl)}')">
            <img src="${escapeHtml(ev.thumbnailUrl || ev.imageUrl)}" alt="${escapeHtml(ev.titulo || ev.categoria)}" loading="lazy" />
            <div class="ev-cap">${escapeHtml(ev.titulo || ev.categoria || "Evidencia")}</div>
          </div>`).join("")}
      </div>`
    : `<p class="empty-txt">No se adjuntaron evidencias fotográficas.</p>`;

  const gpsLink = (acta.cliente?.latitud && acta.cliente?.longitud)
    ? `<a href="https://maps.google.com/?q=${encodeURIComponent(acta.cliente.latitud)},${encodeURIComponent(acta.cliente.longitud)}" target="_blank" class="gps-link">${escapeHtml(acta.cliente.latitud)}, ${escapeHtml(acta.cliente.longitud)} ↗</a>`
    : "--";

  const canClientSignRemotely = !acta.firmaCliente?.imageUrl;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Acta de Instalación ${escapeHtml(acta.folioCompleto)} | ${escapeHtml(tenant?.name || "TurboNetwork")}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 20px;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f172a; color: #0f172a;
    }
    .toolbar {
      max-width: 920px; margin: 0 auto 14px auto;
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;
      background: #1e293b; color: #f8fafc; padding: 12px 16px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn {
      border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
    }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-success { background: #059669; color: #fff; }
    .btn-light { background: #334155; color: #f8fafc; }
    .sheet {
      max-width: 920px; margin: 0 auto; background: #ffffff;
      border-radius: 12px; padding: 28px 32px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35);
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
      border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { max-height: 54px; max-width: 140px; object-fit: contain; }
    .brand h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .brand p { margin: 2px 0 0 0; font-size: 12px; color: #475569; }
    .folio-box { text-align: right; }
    .folio-num { font-size: 18px; font-weight: 800; color: #0f172a; font-family: monospace; }
    .status-pill {
      display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
    }
    .section { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .section-title {
      background: #f8fafc; padding: 8px 12px; font-size: 12px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px 14px; padding: 12px;
    }
    .field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .field div { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-word; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    th { background: #f8fafc; font-size: 10.5px; text-transform: uppercase; color: #475569; font-weight: 700; }
    .empty, .empty-txt { text-align: center; color: #94a3b8; font-size: 12px; padding: 14px; margin: 0; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .pill-ok { background: #dcfce7; color: #166534; }
    .pill-warn { background: #fef3c7; color: #92400e; }
    .tag-mochila { background: #ede9fe; color: #6d28d9; font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px; }
    .ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 12px; }
    .ev-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; background: #f8fafc; }
    .ev-card img { width: 100%; height: 100px; object-fit: cover; display: block; }
    .ev-cap { padding: 4px 6px; font-size: 10.5px; font-weight: 600; color: #334155; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .obs-box { padding: 12px; font-size: 13px; color: #334155; white-space: pre-wrap; }
    .signatures {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 18px;
    }
    .sig-box {
      border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; min-height: 145px;
      display: flex; flex-direction: column; justify-content: space-between; align-items: center;
    }
    .sig-box img { max-height: 85px; max-width: 100%; object-fit: contain; }
    .sig-line { width: 85%; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11.5px; font-weight: 700; color: #1e293b; }
    .sig-sub { font-size: 10.5px; color: #64748b; }
    .footer {
      margin-top: 18px; padding-top: 12px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; color: #64748b;
    }
    .gps-link { color: #2563eb; text-decoration: none; }
    .remote-sign-panel {
      max-width: 920px; margin: 16px auto 0 auto; background: #1e293b; color: #f8fafc;
      border-radius: 12px; padding: 18px; border: 1px solid rgba(255,255,255,0.1);
    }
    #remote-sign-canvas {
      background: #ffffff; border-radius: 8px; width: 100%; height: 180px; touch-action: none; cursor: crosshair;
    }
    .lightbox {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999;
      align-items: center; justify-content: center; padding: 20px;
    }
    .lightbox.open { display: flex; }
    .lightbox img { max-width: 95%; max-height: 90vh; border-radius: 8px; }
    @media (max-width: 640px) {
      body { padding: 10px; }
      .sheet { padding: 16px; }
      .header { flex-direction: column; }
      .folio-box { text-align: left; }
      .signatures { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar, .remote-sign-panel, .lightbox { display: none !important; }
      .sheet { box-shadow: none; padding: 10px 14px; max-width: 100%; border-radius: 0; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Acta de Instalación #${escapeHtml(acta.folioCompleto)}</strong>
      <div style="font-size:12px;color:#94a3b8;">${escapeHtml(acta.cliente?.nombreCompleto || "")}</div>
    </div>
    <div class="toolbar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Descargar / Imprimir PDF</button>
      <button class="btn btn-light" onclick="copyPublicLink()">🔗 Copiar Enlace</button>
    </div>
  </div>

  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${tenant?.logoUrl ? `<img src="${escapeHtml(tenant.logoUrl)}" alt="Logo" />` : ""}
        <div>
          <h1>${escapeHtml(tenant?.name || "TurboNetwork")}</h1>
          <p>${tenant?.ruc ? `RUC: ${escapeHtml(tenant.ruc)} · ` : ""}${escapeHtml(tenant?.address || "")}</p>
          <p>${escapeHtml(tenant?.phone || "")} ${tenant?.email ? `· ${escapeHtml(tenant.email)}` : ""}</p>
        </div>
      </div>
      <div class="folio-box">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Acta de Instalación</div>
        <div class="folio-num">#${escapeHtml(acta.folioCompleto)}</div>
        <span class="status-pill" style="${badgeStyle}">${escapeHtml(acta.detallesServicio?.estadoFinal || "En Proceso")}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">1. Datos del Cliente</div>
      <div class="grid">
        <div class="field"><label>Nombre / Razón Social</label><div>${escapeHtml(acta.cliente?.nombreCompleto || "--")}</div></div>
        <div class="field"><label>DNI / RUC</label><div class="mono">${escapeHtml(acta.cliente?.dniRuc || "--")}</div></div>
        <div class="field"><label>Rotulado (QR)</label><div class="mono">${escapeHtml(acta.cliente?.rotuladoQr || "--")}</div></div>
        <div class="field"><label>Dirección de Instalación</label><div>${escapeHtml(acta.cliente?.direccion || "--")}</div></div>
        <div class="field"><label>Distrito</label><div>${escapeHtml(acta.cliente?.distrito || "--")}</div></div>
        <div class="field"><label>Referencia</label><div>${escapeHtml(acta.cliente?.referencia || "--")}</div></div>
        <div class="field"><label>WhatsApp Principal</label><div class="mono">${escapeHtml(acta.cliente?.whatsappPrincipal || "--")}</div></div>
        <div class="field"><label>Celular Alternativo</label><div class="mono">${escapeHtml(acta.cliente?.celularAlternativo || "--")}</div></div>
        <div class="field"><label>Geolocalización GPS</label><div>${gpsLink}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Planta Externa</div>
      <div class="grid">
        <div class="field"><label>Nodo / Cluster</label><div>${escapeHtml(acta.plantaExterna?.nodoCluster || "--")}</div></div>
        <div class="field"><label>NAP / Caja</label><div>${escapeHtml(acta.plantaExterna?.napCaja || "--")}</div></div>
        <div class="field"><label>Puerto</label><div>${escapeHtml(acta.plantaExterna?.puerto || "--")}</div></div>
        <div class="field"><label>Potencia (dBm)</label><div class="mono">${escapeHtml(acta.plantaExterna?.potenciaDbm || "--")}</div></div>
        <div class="field"><label>Atenuación Empalme</label><div class="mono">${escapeHtml(acta.plantaExterna?.atenuacionEmpalme || "--")}</div></div>
        <div class="field"><label>Drop (m) / Precinto</label><div>${escapeHtml(acta.plantaExterna?.dropMetros || "--")} ${acta.plantaExterna?.precinto ? `/ ${escapeHtml(acta.plantaExterna.precinto)}` : ""}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Detalles del Servicio & Configuración Red / TV</div>
      <div class="grid">
        <div class="field"><label>Fecha</label><div class="mono">${escapeHtml(acta.detallesServicio?.fecha || "--")}</div></div>
        <div class="field"><label>Hora Inicio / Fin</label><div class="mono">${escapeHtml(acta.detallesServicio?.horaInicio || "--:--")} - ${escapeHtml(acta.detallesServicio?.horaFin || "--:--")}</div></div>
        <div class="field"><label>Tipo de Servicio</label><div>${escapeHtml(acta.detallesServicio?.tipo || "--")}</div></div>
        <div class="field"><label>Servicio Contratado</label><div>${escapeHtml(acta.detallesServicio?.servicioContratadoNombre || "--")}</div></div>
        <div class="field"><label>Técnico Responsable</label><div>${escapeHtml(acta.detallesServicio?.tecnicoNombre || "--")}</div></div>
        <div class="field"><label>SSID (WiFi)</label><div class="mono">${escapeHtml(acta.detallesServicio?.ssidWifi || "--")}</div></div>
        <div class="field"><label>Password WiFi</label><div class="mono">${escapeHtml(acta.detallesServicio?.passwordWifi || "--")}</div></div>
        <div class="field"><label>Speed DL / UL (Mbps)</label><div class="mono">${escapeHtml(acta.detallesServicio?.speedDl || "--")} / ${escapeHtml(acta.detallesServicio?.speedUl || "--")}</div></div>
        <div class="field"><label>N° TVs / Splitters</label><div>${escapeHtml(acta.detallesServicio?.numTvs || "0")} TVs · Splitters: ${escapeHtml(acta.detallesServicio?.splitters || "--")}</div></div>
        <div class="field"><label>Señal Low / VLAN</label><div>${escapeHtml(acta.detallesServicio?.senalLow || "--")} ${acta.detallesServicio?.vlanPppoe ? `· ${escapeHtml(acta.detallesServicio.vlanPppoe)}` : ""}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Equipos Instalados y Retirados</div>
      <table>
        <thead><tr><th>Acción</th><th>Modelo / Marca</th><th>Serie / MAC</th><th>Propiedad</th></tr></thead>
        <tbody>${equiposRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">5. Materiales Utilizados</div>
      <table>
        <thead><tr><th>Acción</th><th>Descripción</th><th style="text-align:center;">Cant.</th><th>Und.</th><th>Propiedad</th></tr></thead>
        <tbody>${materialesRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">6. Evidencias y Observaciones</div>
      ${evidenciasHtml}
      ${acta.observaciones ? `<div class="obs-box"><strong>Observaciones:</strong>\n${escapeHtml(acta.observaciones)}</div>` : ""}
    </div>

    <div class="signatures">
      <div class="sig-box">
        ${acta.firmaCliente?.imageUrl ? `<img src="${escapeHtml(acta.firmaCliente.imageUrl)}" alt="Firma Cliente" />` : `<div style="height:85px;display:flex;align-items:center;color:#94a3b8;font-size:12px;">Pendiente de firma</div>`}
        <div class="sig-line">
          Firma del Cliente
          <div class="sig-sub">${escapeHtml(acta.firmaCliente?.firmanteNombre || acta.cliente?.nombreCompleto || "")} ${acta.firmaCliente?.firmanteDni ? `· DNI ${escapeHtml(acta.firmaCliente.firmanteDni)}` : ""}</div>
        </div>
      </div>
      <div class="sig-box">
        ${acta.firmaTecnico?.imageUrl ? `<img src="${escapeHtml(acta.firmaTecnico.imageUrl)}" alt="Firma Técnico" />` : `<div style="height:85px;display:flex;align-items:center;color:#94a3b8;font-size:12px;">Sin firma</div>`}
        <div class="sig-line">
          Firma del Técnico
          <div class="sig-sub">${escapeHtml(acta.firmaTecnico?.firmanteNombre || acta.detallesServicio?.tecnicoNombre || "")}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>
        <div>Documento digital generado por <strong>${escapeHtml(tenant?.name || "TurboNetwork")}</strong></div>
        <div>Fecha de emisión: ${escapeHtml(acta.createdAt.slice(0, 10))} · Folio #${escapeHtml(acta.folioCompleto)}</div>
      </div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Verificación" style="width:74px;height:74px;" />` : ""}
    </div>
  </div>

  ${canClientSignRemotely ? `
  <div class="remote-sign-panel">
    <h3 style="margin:0 0 6px 0;font-size:15px;">✍️ Firmar Acta de Conformidad (Cliente)</h3>
    <p style="margin:0 0 12px 0;font-size:12px;color:#cbd5e1;">Si estás viendo esta acta desde tu celular o tablet, puedes firmar aquí para dar conformidad al servicio.</p>
    <canvas id="remote-sign-canvas"></canvas>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
      <input id="remote-sign-name" type="text" placeholder="Nombre del firmante" value="${escapeHtml(acta.cliente?.nombreCompleto || "")}" style="flex:1;min-width:180px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:13px;" />
      <button class="btn btn-light" onclick="clearRemoteSign()">Limpiar</button>
      <button class="btn btn-success" onclick="submitRemoteSign()">Guardar Firma</button>
    </div>
  </div>` : ""}

  <div id="lightbox" class="lightbox" onclick="this.classList.remove('open')">
    <img id="lightbox-img" src="" alt="Evidencia" />
  </div>

  <script>
    function openLightbox(src) {
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox').classList.add('open');
    }
    function copyPublicLink() {
      navigator.clipboard.writeText(window.location.href.split('?')[0]).then(() => {
        alert('Enlace copiado al portapapeles');
      });
    }
    ${canClientSignRemotely ? `
    (function() {
      const canvas = document.getElementById('remote-sign-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let drawing = false;
      let hasDrawn = false;
      function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
      }
      resize();
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      function start(e) { e.preventDefault(); drawing = true; hasDrawn = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
      function move(e) { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end);
      window.clearRemoteSign = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
      };
      window.submitRemoteSign = async function() {
        if (!hasDrawn) return alert('Por favor dibuja tu firma primero.');
        const dataUrl = canvas.toDataURL('image/png');
        const firmanteNombre = document.getElementById('remote-sign-name').value.trim();
        const res = await fetch('/api/actas/public/${escapeHtml(acta.publicToken)}/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, firmanteNombre })
        });
        const json = await res.json();
        if (json.success) {
          location.reload();
        } else {
          alert(json.message || 'No se pudo guardar la firma');
        }
      };
    })();` : ""}
    ${autoPrint ? `window.addEventListener('load', () => { setTimeout(() => window.print(), 350); });` : ""}
  </script>
</body>
</html>`;
}
