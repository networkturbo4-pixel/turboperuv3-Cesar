import { FastifyInstance } from "fastify";
import { resolveTenantId, loadTenantsFromDisk } from "../tenants/tenants.service";
import { getPersonnelAssignments, loadProducts } from "../inventory/inventory.service";
import { sendWhatsAppQrDirectMessage } from "../messages/whatsapp-qr-service";
import {
  loadActas,
  saveActas,
  getNextFolio,
  createActa,
  updateActa,
  deleteActa,
  findActaByPublicToken,
  saveBase64Asset,
} from "./actas.service";
import { ActaInstalacion } from "./actas.types";

export async function actasRoutes(fastify: FastifyInstance) {
  // Listar actas del tenant
  fastify.get("/actas", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const q = (request.query || {}) as {
      search?: string;
      estado?: string;
      tecnicoId?: string;
    };

    let list = loadActas(tenantId);

    if (q.estado && q.estado !== "ALL") {
      list = list.filter((a) => (a.detallesServicio?.estadoFinal || "") === q.estado);
    }

    if (q.tecnicoId && q.tecnicoId !== "ALL") {
      list = list.filter((a) => String(a.detallesServicio?.tecnicoId || "") === String(q.tecnicoId));
    }

    if (q.search && q.search.trim()) {
      const term = q.search.trim().toLowerCase();
      list = list.filter((a) => {
        const hay = [
          a.folioCompleto,
          a.cliente?.nombreCompleto,
          a.cliente?.dniRuc,
          a.cliente?.distrito,
          a.cliente?.direccion,
          a.detallesServicio?.tecnicoNombre,
          a.plantaExterna?.napCaja,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      });
    }

    return reply.send({ success: true, data: list });
  });

  // Obtener siguiente folio correlativo
  fastify.get("/actas/next-folio", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const q = (request.query || {}) as { prefijo?: string };
    const folio = getNextFolio(tenantId, q.prefijo);
    return reply.send({ success: true, data: folio });
  });

  // Obtener mochila activa del técnico (equipos y materiales asignados disponibles para instalar)
  fastify.get("/actas/technician-mochila/:employeeId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { employeeId } = request.params as { employeeId: string };

    const activeAssignments = getPersonnelAssignments(tenantId, {
      employeeId,
      status: "asignado",
    });

    const products = loadProducts(tenantId);
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const items = activeAssignments
      .filter((a) => Number(a.quantity || 0) > 0)
      .map((a) => {
        const prod = a.productId ? prodMap.get(a.productId) : undefined;
        const cat = String((a as any).category || (prod as any)?.category || "").toLowerCase();
        const nameLower = String(a.productName || "").toLowerCase();

        // Clasificar si es Equipo (ONT, Router, ONU, Switch, Antena, Deco, etc.) o Material/Insumo
        const isEquipment =
          Boolean(a.unitSku || a.itemUnitId) ||
          cat.includes("equipo") ||
          cat.includes("red") ||
          cat.includes("ont") ||
          cat.includes("router") ||
          /\b(ont|onu|router|mesh|switch|antena|cpe|deco|tv\s*box|modem|módem)\b/i.test(nameLower);

        // Buscar serialNumber de la unidad si existe
        let serialOrMac = a.unitSku || "";
        if (prod && Array.isArray(prod.itemUnits) && (a.itemUnitId || a.unitSku)) {
          const unit = prod.itemUnits.find(
            (u) => (a.itemUnitId && u.id === a.itemUnitId) || (a.unitSku && u.sku === a.unitSku)
          );
          if (unit?.serialNumber) {
            serialOrMac = unit.serialNumber;
          }
        }

        return {
          assignmentId: a.id,
          productId: a.productId,
          productName: a.productName,
          productSku: a.productSku,
          category: (a as any).category || "Insumos",
          quantity: Number(a.quantity || 1),
          unit: (prod as any)?.unit || "Und",
          unitSku: a.unitSku || "",
          serialOrMac,
          isEquipment,
          assignedAt: a.assignedAt,
        };
      });

    return reply.send({
      success: true,
      data: {
        all: items,
        equipos: items.filter((i) => i.isEquipment),
        materiales: items.filter((i) => !i.isEquipment),
      },
    });
  });

  // Obtener detalle de un acta
  fastify.get("/actas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const actas = loadActas(tenantId);
    const acta = actas.find((a) => a.id === id);
    if (!acta) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }
    return reply.send({ success: true, data: acta });
  });

  // Crear nueva acta
  fastify.post("/actas", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<ActaInstalacion>;

    if (!body.cliente?.nombreCompleto || !body.cliente.nombreCompleto.trim()) {
      return reply.status(400).send({
        success: false,
        message: "El Nombre Completo / Razón Social del cliente es obligatorio.",
      });
    }

    const operatorName = request.authUser?.name || "Sistema";
    const created = createActa(tenantId, body, operatorName);
    return reply.status(201).send({
      success: true,
      message: `Acta #${created.folioCompleto} creada correctamente`,
      data: created,
    });
  });

  // Editar / actualizar acta existente
  fastify.put("/actas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Partial<ActaInstalacion>;

    const operatorName = request.authUser?.name || "Sistema";
    const updated = updateActa(tenantId, id, body, operatorName);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }
    return reply.send({
      success: true,
      message: `Acta #${updated.folioCompleto} actualizada`,
      data: updated,
    });
  });

  // Eliminar acta
  fastify.delete("/actas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const ok = deleteActa(tenantId, id);
    if (!ok) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }
    return reply.send({ success: true, message: "Acta eliminada correctamente" });
  });

  // Enviar acta por WhatsApp (intenta envío directo por sesión QR si está activa + devuelve enlace wa.me)
  fastify.post("/actas/:id/send-whatsapp", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { phone?: string };
    const actas = loadActas(tenantId);
    const acta = actas.find((a) => a.id === id);

    if (!acta) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }

    const tenant = loadTenantsFromDisk().find((t) => t.id === tenantId || t.slug === tenantId);
    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const publicUrl = `${protocol}://${host}/acta/${acta.publicToken}`;

    const rawPhone = (body.phone || acta.cliente?.whatsappPrincipal || acta.cliente?.celularAlternativo || "").replace(/\D/g, "");
    const normalizedPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;

    const textMessage =
      `📋 *ACTA DE INSTALACIÓN #${acta.folioCompleto}*\n` +
      `🏢 *${tenant?.name || "TurboNetwork"}*\n\n` +
      `👤 *Cliente:* ${acta.cliente?.nombreCompleto || "--"}\n` +
      `📅 *Fecha:* ${acta.detallesServicio?.fecha || "--"}\n` +
      `🛠️ *Tipo:* ${acta.detallesServicio?.tipo || "Instalación"}\n` +
      `✅ *Estado:* ${acta.detallesServicio?.estadoFinal || "Finalizada"}\n` +
      `👷 *Técnico:* ${acta.detallesServicio?.tecnicoNombre || "--"}\n\n` +
      `🔗 *Ver / Descargar / Firmar Acta:*\n${publicUrl}`;

    let sentDirect = false;
    if (normalizedPhone.length >= 8) {
      try {
        const res = await sendWhatsAppQrDirectMessage(normalizedPhone, textMessage);
        if (res?.success) sentDirect = true;
      } catch {
        sentDirect = false;
      }
    }

    const waUrl = normalizedPhone.length >= 8
      ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(textMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(textMessage)}`;

    return reply.send({
      success: true,
      sentDirect,
      waUrl,
      publicUrl,
      message: sentDirect
        ? "Acta enviada por WhatsApp directamente"
        : "Enlace de WhatsApp listo para abrir",
    });
  });

  // Firma remota del cliente desde la vista pública (sin login)
  fastify.post("/actas/public/:token/sign", async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = (request.body || {}) as { dataUrl?: string; firmanteNombre?: string; firmanteDni?: string };
    if (!body.dataUrl || !body.dataUrl.startsWith("data:image/")) {
      return reply.status(400).send({ success: false, message: "Firma inválida" });
    }

    const found = findActaByPublicToken(token);
    if (!found) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }

    const { tenantId, acta } = found;
    const savedUrl = saveBase64Asset(tenantId, body.dataUrl, "firma_cli_pub");
    const actas = loadActas(tenantId);
    const idx = actas.findIndex((a) => a.id === acta.id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Acta no encontrada" });
    }

    actas[idx].firmaCliente = {
      imageUrl: savedUrl,
      firmanteNombre: body.firmanteNombre || acta.cliente?.nombreCompleto || "",
      firmanteDni: body.firmanteDni || acta.cliente?.dniRuc || "",
      signedAt: new Date().toISOString(),
    };
    actas[idx].updatedAt = new Date().toISOString();
    saveActas(tenantId, actas);

    return reply.send({ success: true, message: "Firma registrada correctamente", data: actas[idx].firmaCliente });
  });
}
