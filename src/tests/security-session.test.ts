import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildApp } from "../server";
import { SecurityService } from "../modules/security/security.service";
import { sanitizeGitBranch } from "../modules/settings/maintenance.service";
import { queryClient } from "../db";

async function runTests() {
  console.log("🔐 Ejecutando suite de pruebas de Seguridad, Sesiones e Inactividad...\n");
  const app = await buildApp();

  try {
    // 1. Verificar que /api/auth/me rechaza peticiones sin autenticar (fin del fallback a Superadmin)
    const anonMe = await app.inject({ method: "GET", url: "/api/auth/me" });
    assert.equal(anonMe.statusCode, 401, "GET /api/auth/me sin token debe devolver 401");
    console.log("  ✅ [1/9] /api/auth/me bloquea acceso anónimo (sin fallback a Superadministrador)");

    // 2. Verificar que endpoints críticos están protegidos contra acceso anónimo y spoofing de x-user-id
    const spoofedUsers = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { "x-user-id": "1" },
    });
    assert.equal(spoofedUsers.statusCode, 401, "GET /api/users con x-user-id falso debe devolver 401");

    const anonBackups = await app.inject({ method: "GET", url: "/api/settings/backups" });
    assert.equal(anonBackups.statusCode, 401, "GET /api/settings/backups sin token debe devolver 401");
    console.log("  ✅ [2/9] Guard global bloquea rutas /api/* anónimas e ignora x-user-id falsificado");

    // 3. Verificar que GET /api/tenants sin sesión solo entrega metadatos públicos y isSuperAdmin=false
    const publicTenants = await app.inject({ method: "GET", url: "/api/tenants" });
    assert.equal(publicTenants.statusCode, 200);
    const pubTenantsBody = publicTenants.json();
    assert.equal(pubTenantsBody.isSuperAdmin, false, "GET /api/tenants público nunca debe otorgar SuperAdmin");
    console.log("  ✅ [3/9] /api/tenants público oculta privilegios y datos sensibles previos al login");

    // 4. Login real con PIN (verifica migración scrypt de users.json + emisión de JWT + Cookie HttpOnly)
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/pin-login",
      payload: { pin: "12345678" },
    });
    assert.equal(loginRes.statusCode, 200, "Login con PIN válido debe responder 200");
    const loginBody = loginRes.json();
    assert.equal(loginBody.success, true);
    assert.ok(loginBody.data.token && !loginBody.data.token.startsWith("mock_jwt_"), "Debe emitir un JWT real firmado");
    assert.ok(loginBody.data.idleTimeoutMs > 0, "Debe informar tiempo de inactividad");
    const setCookie = String(loginRes.headers["set-cookie"] || "");
    assert.ok(setCookie.includes("tn_session=") && setCookie.includes("HttpOnly"), "Debe emitir cookie HttpOnly");
    console.log("  ✅ [4/9] Login emite JWT firmado + Cookie HttpOnly y migra PINs en disco a scrypt");

    // 5. Verificar que users.json ya no contiene PINs en texto plano ni avatares Base64 gigantes
    const usersRaw = fs.readFileSync(path.resolve(process.cwd(), "data", "users.json"), "utf-8");
    const usersDisk = JSON.parse(usersRaw);
    for (const u of usersDisk) {
      assert.equal(u.pin, undefined, `Usuario ${u.id} no debe tener PIN en texto plano en disco`);
      assert.ok(String(u.pinHash || "").startsWith("scrypt$"), `Usuario ${u.id} debe tener pinHash scrypt`);
      if (u.avatar) {
        assert.ok(!String(u.avatar).startsWith("data:image/jpeg;base64"), "Avatar Base64 debe haberse externalizado");
      }
    }
    console.log("  ✅ [5/9] users.json libre de PINs en texto plano y de imágenes JPEG en Base64");

    // 6. Verificar acceso autenticado con JWT a /api/auth/me y /api/users
    const jwt = loginBody.data.token as string;
    const authMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(authMe.statusCode, 200);
    assert.equal(authMe.json().user.id, 1);
    console.log("  ✅ [6/9] Peticiones autenticadas con Bearer JWT resuelven identidad verificada");

    // 7. Simular expiración por inactividad en el servidor y comprobar rechazo automático 401
    const decoded: any = app.jwt.decode(jwt);
    const checkBefore = SecurityService.validateSession(decoded.jti, false);
    assert.equal(checkBefore.valid, true);
    // Retroceder lastActivityAt más allá del límite de inactividad
    checkBefore.session!.lastActivityAt = Date.now() - checkBefore.session!.idleTimeoutMs - 5000;

    const expiredIdleRes = await app.inject({
      method: "GET",
      url: "/api/customers",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(expiredIdleRes.statusCode, 401, "Sesión inactiva debe ser rechazada con 401");
    assert.equal(expiredIdleRes.json().code, "SESSION_IDLE_EXPIRED");
    console.log("  ✅ [7/9] Expiración automática por inactividad verificada en servidor (401 SESSION_IDLE_EXPIRED)");

    // 8. Verificar revocación inmediata al ejecutar POST /api/auth/logout
    const loginRes2 = await app.inject({
      method: "POST",
      url: "/api/auth/pin-login",
      payload: { pin: "12345678" },
    });
    const jwt2 = loginRes2.json().data.token as string;
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { Authorization: `Bearer ${jwt2}` },
    });
    assert.equal(logoutRes.statusCode, 200);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { Authorization: `Bearer ${jwt2}` },
    });
    assert.equal(afterLogout.statusCode, 401, "Token cerrado debe quedar revocado inmediatamente");
    console.log("  ✅ [8/9] Logout revoca instantáneamente el JWT en servidor y limpia la cookie");

    // 9. Verificar protección anti-fuerza bruta (Rate Limit) y anti-RCE en nombres de ramas Git
    const testIp = "203.0.113.99";
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/pin-login",
        headers: { "x-forwarded-for": testIp },
        payload: { pin: "99999999" },
      });
    }
    const lockedRes = await app.inject({
      method: "POST",
      url: "/api/auth/pin-login",
      headers: { "x-forwarded-for": testIp },
      payload: { pin: "12345678" },
    });
    assert.equal(lockedRes.statusCode, 429, "Tras 5 intentos fallidos debe responder 429 Too Many Requests");
    SecurityService.clearLoginFailures(testIp);

    assert.throws(() => sanitizeGitBranch("main; rm -rf /"), /inválido/i);
    assert.throws(() => sanitizeGitBranch("--upload-pack=evil"), /inválido/i);
    assert.equal(sanitizeGitBranch("main"), "main");
    console.log("  ✅ [9/9] Bloqueo anti-fuerza bruta (HTTP 429) y sanitización anti-RCE verificados\n");

    console.log("🎉 Todas las pruebas de seguridad y sesiones pasaron exitosamente.");
  } finally {
    await app.close();
    await queryClient.end({ timeout: 2 }).catch(() => {});
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Falló la suite de pruebas:", err);
    process.exit(1);
  });
