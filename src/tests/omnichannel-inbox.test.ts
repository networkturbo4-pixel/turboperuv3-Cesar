import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { normalizeChannelHandle, computeCleanInitials } from "../modules/messages/handle-utils";
import { buildApp } from "../server";

async function runOmnichannelTests() {
  console.log("💬 Ejecutando suite de pruebas anti-regresión de Bandeja Omnicanal...");

  // 1. Normalización canónica E.164 (evita chats partidos entre manual y entrante)
  const canonical = "+51908596716";
  assert.equal(normalizeChannelHandle("whatsapp", "51 908 596 716"), canonical);
  assert.equal(normalizeChannelHandle("whatsapp", "+51 908 596 716"), canonical);
  assert.equal(normalizeChannelHandle("whatsapp", "51908596716"), canonical);
  assert.equal(normalizeChannelHandle("whatsapp", "908596716"), canonical);
  assert.equal(normalizeChannelHandle("whatsapp", "51908596716:14@s.whatsapp.net"), canonical);
  assert.equal(normalizeChannelHandle("whatsapp", "120363049999@g.us"), "120363049999@g.us");
  assert.equal(normalizeChannelHandle("whatsapp", "249211937378349:2@lid"), "249211937378349@lid");
  console.log("  ✅ [1/4] Normalización E.164 unifica números manuales, locales y JIDs de WhatsApp");

  // 2. Iniciales limpias de avatares (sin '+' ni '@')
  assert.equal(computeCleanInitials("+51 926 997 372"), "72");
  assert.equal(computeCleanInitials("@LicenciasDigitalesPro"), "LI");
  assert.equal(computeCleanInitials("MANUEL_DT"), "MD");
  assert.equal(computeCleanInitials("Jaime Acurio"), "JA");
  console.log("  ✅ [2/4] Cálculo de iniciales ignora símbolos (+, @, _) correctamente");

  // 3. Estado inicial de filtros en entry.ts (nunca ocultar conversaciones al abrir la bandeja)
  const entrySource = fs.readFileSync(
    path.join(process.cwd(), "src", "client-omnichannel", "entry.ts"),
    "utf-8"
  );
  assert.ok(
    entrySource.includes("tagFilter: ''"),
    "El estado inicial de entry.ts debe mantener tagFilter: '' para no ocultar chats sin etiqueta"
  );
  console.log("  ✅ [3/4] Filtro inicial de etiquetas verificado (sin ocultamiento por defecto)");

  // 4. Fusión en BD (PGlite en memoria aislada) + /favicon.ico sin 404
  const memDb = new PGlite();
  await memDb.waitReady;
  await memDb.exec(`
    CREATE TABLE omnichannel_conversations (
      id SERIAL PRIMARY KEY,
      channel VARCHAR(20) NOT NULL,
      contact_name VARCHAR(120) NOT NULL,
      contact_handle VARCHAR(120) NOT NULL,
      unread_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE omnichannel_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      body TEXT NOT NULL
    );
    INSERT INTO omnichannel_conversations (channel, contact_name, contact_handle, unread_count)
    VALUES
      ('whatsapp', 'emanuel', '51 908 596 716', 0),
      ('whatsapp', '+51908596716', '+51908596716', 2);
    INSERT INTO omnichannel_messages (conversation_id, body)
    VALUES (1, 'usted es emanuel ?'), (2, 'Buenas tardes');
  `);

  const rowsRes = await memDb.query<{
    id: number;
    channel: string;
    contact_name: string;
    contact_handle: string;
    unread_count: number;
  }>("SELECT * FROM omnichannel_conversations ORDER BY id ASC");

  const grouped = new Map<string, typeof rowsRes.rows>();
  for (const r of rowsRes.rows) {
    const c = normalizeChannelHandle(r.channel, r.contact_handle);
    const k = `${r.channel}::${c}`;
    const list = grouped.get(k) || [];
    list.push({ ...r, contact_handle: c });
    grouped.set(k, list);
  }
  for (const [, grp] of grouped.entries()) {
    if (grp.length > 1) {
      const keep = grp[0];
      for (const dup of grp.slice(1)) {
        await memDb.query("UPDATE omnichannel_messages SET conversation_id = $1 WHERE conversation_id = $2", [keep.id, dup.id]);
        await memDb.query("DELETE FROM omnichannel_conversations WHERE id = $1", [dup.id]);
      }
      await memDb.query("UPDATE omnichannel_conversations SET contact_handle = $1 WHERE id = $2", [keep.contact_handle, keep.id]);
    }
  }
  await memDb.exec("CREATE UNIQUE INDEX idx_test_unique_conv ON omnichannel_conversations (channel, contact_handle)");
  const finalConvs = await memDb.query("SELECT * FROM omnichannel_conversations");
  const finalMsgs = await memDb.query("SELECT * FROM omnichannel_messages WHERE conversation_id = 1");
  assert.equal(finalConvs.rows.length, 1);
  assert.equal(finalMsgs.rows.length, 2);
  await memDb.close();

  const app = await buildApp();
  const favRes = await app.inject({ method: "GET", url: "/favicon.ico" });
  assert.equal(favRes.statusCode, 302);
  await app.close();
  console.log("  ✅ [4/4] Fusión de hilos divididos, índice único y ruta /favicon.ico verificados");

  console.log("\n🎉 Suite de Bandeja Omnicanal completada exitosamente.");
  process.exit(0);
}

runOmnichannelTests().catch((err) => {
  console.error("❌ Falló la suite de Bandeja Omnicanal:", err);
  process.exit(1);
});
