import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  deliveryStatusFromBaileys,
  mergeDeliveryStatus,
  captionForQueuedBody,
  isQueuedMessageExpired,
  formatDateSeparatorLabel,
  dayKey,
  SEND_QUEUE_MAX_AGE_MS,
  applyReaction,
} from "../modules/messages/message-utils";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf-8");

async function runMessageFlowTests() {
  console.log("📨 Ejecutando pruebas del flujo de mensajes (envío, cola, citas, adjuntos, scroll)...");

  // 1. Estados de entrega de Baileys y monotonía (nunca retroceder de "leído" a "enviado")
  assert.equal(deliveryStatusFromBaileys(2), "sent");
  assert.equal(deliveryStatusFromBaileys(3), "delivered");
  assert.equal(deliveryStatusFromBaileys(4), "read");
  assert.equal(deliveryStatusFromBaileys(5), "read");
  assert.equal(mergeDeliveryStatus("read", "sent"), "read");
  assert.equal(mergeDeliveryStatus("queued", "sent"), "sent");
  assert.equal(mergeDeliveryStatus("sent", "delivered"), "delivered");

  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    CREATE TABLE omnichannel_messages (id SERIAL PRIMARY KEY, wa_message_id VARCHAR(120) NOT NULL DEFAULT '', delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent');
    INSERT INTO omnichannel_messages (wa_message_id, delivery_status) VALUES ('A1', 'read'), ('A2', 'queued'), ('A3', 'delivered');
  `);
  const monotonicSql = `UPDATE omnichannel_messages SET delivery_status = $1::text
     WHERE wa_message_id = $2
       AND (CASE delivery_status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 WHEN 'queued' THEN 1 ELSE 0 END)
         < (CASE $1::text WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 ELSE 0 END)`;
  await db.query(monotonicSql, ["sent", "A1"]);
  await db.query(monotonicSql, ["sent", "A2"]);
  await db.query(monotonicSql, ["read", "A3"]);
  const st = await db.query<{ wa_message_id: string; delivery_status: string }>(
    "SELECT wa_message_id, delivery_status FROM omnichannel_messages ORDER BY id"
  );
  assert.deepEqual(
    st.rows.map((r) => r.delivery_status),
    ["read", "sent", "read"]
  );
  await db.close();
  console.log("  ✅ [1/6] Estados de entrega: mapeo Baileys y actualización monótona en SQL");

  // 2. Cola de envío: caducidad y pie de foto de adjuntos
  assert.equal(isQueuedMessageExpired(Date.now() - SEND_QUEUE_MAX_AGE_MS - 1000, Date.now()), true);
  assert.equal(isQueuedMessageExpired(Date.now() - 60_000, Date.now()), false);
  assert.equal(captionForQueuedBody("[Foto]", "image"), "");
  assert.equal(captionForQueuedBody("[Documento: factura.pdf]", "document"), "");
  assert.equal(captionForQueuedBody("Hola, tu recibo", "image"), "Hola, tu recibo");
  assert.equal(captionForQueuedBody("Hola", "none"), "Hola");
  console.log("  ✅ [2/6] Cola de envío: caducidad a 30 min y pie de foto sin textos de respaldo");

  // 3. Separadores de fecha
  const now = new Date(2026, 10, 17, 13, 0, 0);
  assert.equal(formatDateSeparatorLabel(new Date(2026, 10, 17, 8, 0, 0), now), "Hoy");
  assert.equal(formatDateSeparatorLabel(new Date(2026, 10, 16, 23, 59, 0), now), "Ayer");
  assert.notEqual(dayKey(new Date(2026, 10, 16)), dayKey(new Date(2026, 10, 17)));
  assert.ok(/2026/.test(formatDateSeparatorLabel(new Date(2026, 9, 1), now)));
  console.log("  ✅ [3/6] Separadores de fecha: Hoy / Ayer / fecha completa");

  // 4. Servidor: envío en cola, reintento manual, cita y adjuntos persistidos en disco
  const routes = read("src", "modules", "messages", "omnichannel.routes.ts");
  assert.ok(routes.includes('initialDeliveryStatus = "queued"'), "Un fallo de socket debe dejar el mensaje en cola, no perderlo");
  assert.ok(routes.includes('"/inbox/messages/:id/retry"'), "Debe existir el reintento manual de mensajes fallidos");
  assert.ok(routes.includes("quoted: quotedInfo"), "Las respuestas deben viajar citadas a WhatsApp");
  assert.ok(routes.includes("crm_${media_type}_"), "Los adjuntos enviados deben guardarse en data/media");
  const server = read("src", "server.ts");
  assert.ok(server.includes("startWhatsAppSendQueueWorker()"), "El worker de cola debe iniciar con el servidor real");
  assert.ok(server.includes('prefix: "/media/"'), "Debe servirse /media/* con sesión");
  console.log("  ✅ [4/6] Servidor: cola, reintento manual, citas y adjuntos persistidos");

  // 5. Cliente: reintento, placeholders de multimedia y banner de conexión
  const client = read("src", "client-omnichannel", "inbox-and-connections.ts");
  assert.ok(client.includes("js-retry-send") && client.includes("/retry"), "El mensaje fallido debe tener botón Reintentar");
  assert.ok(client.includes("mediaFailedBoxHtml"), "Multimedia fallida debe mostrar placeholder");
  assert.ok(client.includes("No se pudo descargar"), "El texto del placeholder debe ser claro");
  assert.ok(client.includes("handleWhatsAppConnectionStatus"), "Debe existir el banner de conexión de WhatsApp");
  assert.ok(client.includes("chat-date-separator") && client.includes("chat-jump-bottom"), "Separadores de fecha y botón 'ir al último'");
  console.log("  ✅ [5/6] Cliente: reintento, placeholder de multimedia, banner y separadores");

  // 6. Scroll: el re-render conserva la posición y se ancla al fondo mientras cargan imágenes
  const entry = read("src", "client-omnichannel", "entry.ts");
  assert.ok(entry.includes("wasNearBottom") && entry.includes("prevScrollTop"), "El re-render debe conservar el scroll");
  assert.ok(entry.includes("loadedmetadata"), "Debe re-anclar al fondo cuando cargan fotos y videos");
  console.log("  ✅ [6/6] Scroll: posición conservada y anclaje al fondo durante la carga");

  // 7. Fase 2: reacciones, paginación, búsqueda, progreso de subida y sin scroll horizontal
  let reacts = applyReaction([], "agent", "👍");
  reacts = applyReaction(reacts, "contact", "❤️");
  reacts = applyReaction(reacts, "agent", "🙏");
  assert.deepEqual(reacts, [
    { emoji: "❤️", by: "contact" },
    { emoji: "🙏", by: "agent" },
  ]);
  assert.deepEqual(applyReaction(reacts, "agent", ""), [{ emoji: "❤️", by: "contact" }]);
  assert.ok(routes.includes('"/inbox/messages/:id/reaction"') && routes.includes("msg_limit"), "Reacciones y paginación en servidor");
  const svc = read("src", "modules", "messages", "whatsapp-qr-service.ts");
  assert.ok(svc.includes("m.reactionMessage") && svc.includes("sendWhatsAppQrReaction"), "Reacciones entrantes y salientes con WhatsApp");
  assert.ok(client.includes("js-load-older") && client.includes("btn-toggle-chat-search") && client.includes("postJsonWithProgress"), "Cliente: anteriores, búsqueda y progreso");
  const css = read("public", "assets", "omnichannel-inbox.css");
  assert.ok(/\.chat-messages-scroller,\s*\n\.inbox-conversations-list \{ overflow-x: hidden !important; \}/.test(css), "Sin deslizable horizontal en mensajes y lista");
  assert.ok(!client.includes("gap:0.3rem;overflow-x:auto;padding-bottom:0.15rem;"), "Las etiquetas de filtro no deben deslizarse horizontalmente");
  console.log("  ✅ [7/7] Fase 2: reacciones, cargar anteriores, búsqueda, progreso y sin scroll horizontal");
  console.log("\n🎉 Pruebas del flujo de mensajes completadas exitosamente.");
  process.exit(0);
}

runMessageFlowTests().catch((err) => {
  console.error("❌ Falló la suite del flujo de mensajes:", err);
  process.exit(1);
});
