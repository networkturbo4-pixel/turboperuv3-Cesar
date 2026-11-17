import assert from "node:assert/strict";
import { encryptMailSecret, decryptMailSecret } from "../modules/mail/mail.crypto";
import { autodetectMailProvider } from "../modules/mail/mail.providers";
import { sanitizeMailHtml, blockRemoteImagesInHtml, extractMailSnippet } from "../modules/mail/mail.sanitizer";
import { createMailAccount, listAccessibleAccounts } from "../modules/mail/mail.service";
import { mailQuery } from "../modules/mail/mail.db";
import type { AuthenticatedUserPayload } from "../middleware/auth.guard";

async function runTests() {
  console.log("🧪 [Mail Tests] Iniciando pruebas unitarias e integración...");

  // 1. Cifrado AES-256-GCM
  const secret = "AppPassw0rd!2026";
  const enc = encryptMailSecret(secret);
  assert.notEqual(enc, secret);
  assert.equal(enc.split(":").length, 3);
  assert.equal(decryptMailSecret(enc), secret);
  console.log("  ✅ Cifrado AES-256-GCM OK");

  // 2. Autodetección de proveedores
  const gmail = autodetectMailProvider("soporte@gmail.com");
  assert.equal(gmail.provider, "gmail");
  assert.equal(gmail.imapHost, "imap.gmail.com");
  assert.equal(gmail.smtpHost, "smtp.gmail.com");

  const outlook = autodetectMailProvider("ventas@outlook.com");
  assert.equal(outlook.provider, "outlook");
  assert.equal(outlook.imapHost, "outlook.office365.com");

  const custom = autodetectMailProvider("info@turbonetwork.pe");
  assert.equal(custom.provider, "custom");
  assert.equal(custom.imapHost, "mail.turbonetwork.pe");
  console.log("  ✅ Autodetección de proveedores OK");

  // 3. Sanitización HTML y bloqueo de imágenes remotas
  const dirty = `<p>Hola</p><script>alert(1)</script><img src="https://tracker.test/pixel.png" onerror="alert(2)">`;
  const clean = sanitizeMailHtml(dirty);
  assert.equal(clean.includes("<script"), false);
  assert.equal(clean.includes("onerror"), false);
  const blocked = blockRemoteImagesInHtml(clean);
  assert.equal(blocked.hasBlockedImages, true);
  assert.equal(blocked.html.includes("data-blocked-src=\"https://tracker.test/pixel.png\""), true);
  assert.equal(extractMailSnippet("", "<p>Hola   mundo <b>test</b></p>"), "Hola mundo test");
  console.log("  ✅ Sanitización HTML y privacidad de imágenes OK");

  // 4. Aislamiento multi-tenant en BD
  const userA: AuthenticatedUserPayload = {
    jti: "t1",
    sub: 101,
    name: "Admin A",
    email: "a@test.local",
    roleId: 1,
    roleName: "Superadmin",
    isSuperAdmin: true,
    assignedTenantId: "test_mail_tenant_a",
    allowedTenants: ["test_mail_tenant_a"],
    permissions: [],
  };
  const userB: AuthenticatedUserPayload = { ...userA, sub: 102, assignedTenantId: "test_mail_tenant_b", allowedTenants: ["test_mail_tenant_b"] };

  await mailQuery(`DELETE FROM mail_accounts WHERE tenant_id IN ('test_mail_tenant_a', 'test_mail_tenant_b')`);

  const accA = await createMailAccount("test_mail_tenant_a", userA, {
    email: "soporte@tenanta.com",
    password: "secretA",
    skipVerify: true,
    signatureHtml: "<p>Firma A</p>",
  });
  const accB = await createMailAccount("test_mail_tenant_b", userB, {
    email: "soporte@tenantb.com",
    password: "secretB",
    skipVerify: true,
    signatureHtml: "<p>Firma B</p>",
  });

  const listA = await listAccessibleAccounts("test_mail_tenant_a", userA);
  const listB = await listAccessibleAccounts("test_mail_tenant_b", userB);
  assert.equal(listA.length, 1);
  assert.equal(listA[0].id, accA.id);
  assert.equal(listB.length, 1);
  assert.equal(listB[0].id, accB.id);

  // Limpieza
  await mailQuery(`DELETE FROM mail_accounts WHERE tenant_id IN ('test_mail_tenant_a', 'test_mail_tenant_b')`);
  console.log("  ✅ Aislamiento multi-tenant en BD OK");

  console.log("🎉 [Mail Tests] Todas las pruebas pasaron.");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Error en Mail Tests:", err);
  process.exit(1);
});
