import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SecurityService, SessionRecord } from "../modules/security/security.service";
import { resolveTenantId } from "../modules/tenants/tenants.service";
import { getScannerSession } from "../modules/scanner/scanner.service";

export interface AuthenticatedUserPayload {
  jti: string;
  sub: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  isSuperAdmin: boolean;
  assignedTenantId: string;
  allowedTenants: string[];
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUserPayload;
    sessionRecord?: SessionRecord;
  }
}

function extractRawToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7).trim();
    if (candidate && !candidate.startsWith("mock_jwt_session_")) {
      return candidate;
    }
  }

  const cookieToken = SecurityService.parseCookie(request.headers.cookie, "tn_session");
  if (cookieToken) {
    return cookieToken;
  }

  const query = request.query as Record<string, any> | undefined;
  if (query && typeof query.token === "string" && query.token.length > 20) {
    return query.token;
  }

  return null;
}

function isPublicApiEndpoint(method: string, pathname: string, request: FastifyRequest): boolean {
  const m = method.toUpperCase();
  if (m === "OPTIONS") return true;

  if (pathname === "/api" || pathname === "/api/" || pathname === "/api/health") return true;
  if (pathname === "/api/auth/pin-login" && m === "POST") return true;
  if (pathname === "/api/auth/logout" && m === "POST") return true;
  if (pathname === "/api/auth/session-config" && m === "GET") return true;

  // Recursos estáticos/públicos previos al login (branding, selector básico de sede, avatares y OpenGraph)
  if (pathname === "/api/settings/branding" && m === "GET") return true;
  if (pathname === "/api/tenants" && m === "GET") return true;
  if (pathname.startsWith("/api/og/") && m === "GET") return true;
  if (pathname.startsWith("/api/media/avatars/") && m === "GET") return true;

  // Integraciones externas (webhooks de pasarela/WhatsApp, reloj biométrico ZKTeco y salas WebRTC de soporte)
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/webhooks/")) return true;
  if (pathname.startsWith("/iclock/")) return true;
  if (pathname.startsWith("/api/messages/calls/room/")) return true;

  // Sesiones emparejadas por QR del escáner móvil (/api/scanner/session/:sessionId...)
  if (pathname.startsWith("/api/scanner/session/")) return true;

  // Consulta de trazabilidad desde el escáner móvil si presenta una sesión de escáner activa válida
  if (pathname.startsWith("/api/inventory/traceability/") && m === "GET") {
    const query = request.query as Record<string, any> | undefined;
    const scannerSid =
      (request.headers["x-scanner-session"] as string) ||
      (typeof query?.session === "string" ? query.session : "");
    if (scannerSid && getScannerSession(scannerSid)) {
      return true;
    }
  }

  return false;
}

const TENANT_AGNOSTIC_PREFIXES = [
  "/api/auth/",
  "/api/tenants",
  "/api/permissions",
  "/api/health",
  "/api/users/profile",
];

function checkRbacPermission(method: string, pathname: string, user: AuthenticatedUserPayload): string | null {
  if (user.isSuperAdmin || user.roleId === 1) return null;

  const perms = new Set(user.permissions || []);
  const m = method.toUpperCase();
  const isMutation = m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";

  // Gestión de empresas: exclusivo Superadministrador
  if (pathname.startsWith("/api/tenants") && isMutation) {
    return "Solo un Superadministrador puede crear, modificar o eliminar empresas.";
  }

  // Operaciones críticas de infraestructura, backups, migraciones, actualizaciones y secretos maestros
  if (
    pathname.startsWith("/api/settings/backups") ||
    pathname === "/api/settings/system/update" ||
    pathname === "/api/database/migrate" ||
    pathname.startsWith("/api/settings/connections/master-totp") ||
    pathname.startsWith("/api/security/audit-logs") ||
    (pathname === "/api/settings/connections" && isMutation) ||
    (pathname === "/api/settings/branding" && isMutation)
  ) {
    if (!perms.has("system:config")) {
      return "Se requiere el permiso 'Configuración Global (system:config)' para esta operación.";
    }
  }

  // Gestión de roles
  if (pathname.startsWith("/api/roles") && isMutation) {
    if (!perms.has("roles:manage")) {
      return "Se requiere el permiso 'Configurar Roles Granulares (roles:manage)'.";
    }
  }

  // Gestión de operadores y PINs (excepto perfil/preferencias propias)
  if (pathname.startsWith("/api/users") && isMutation) {
    const prefMatch = pathname.match(/^\/api\/users\/(\d+)\/preferences$/);
    if (prefMatch && Number(prefMatch[1]) === user.sub) {
      return null;
    }
    if (pathname === "/api/users/profile") {
      return null; // En users.routes.ts se valida identidad estricta
    }
    if (!perms.has("users:manage")) {
      return "Se requiere el permiso 'Gestionar Usuarios y PIN (users:manage)'.";
    }
  }

  // Gestión de planes
  if (pathname.startsWith("/api/plans") && isMutation && !perms.has("plans:manage")) {
    return "Se requiere el permiso 'Administrar Planes (plans:manage)'.";
  }

  // Gestión de red
  if (pathname.startsWith("/api/network") && isMutation && !perms.has("network:manage") && !perms.has("network:control")) {
    return "Se requiere permiso de administración o control de red.";
  }

  return null;
}

export function registerGlobalAuthGuard(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const rawUrl = request.raw.url || request.url || "/";
    const qIdx = rawUrl.indexOf("?");
    const pathname = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;

    // Solo interceptar rutas de la API (/api y /api/*)
    if (pathname !== "/api" && !pathname.startsWith("/api/")) {
      return;
    }

    // Limpiar encabezados falsificables antes de autenticar
    delete request.headers["x-user-id"];

    const rawToken = extractRawToken(request);
    let verifiedUser: AuthenticatedUserPayload | undefined;

    if (rawToken) {
      try {
        const decoded = fastify.jwt.verify<AuthenticatedUserPayload>(rawToken);
        // No renovar inactividad en sondeos pasivos (/auth/session-status) si se solicita explícitamente
        const isPassiveCheck = request.headers["x-passive-check"] === "1";
        const sessionCheck = SecurityService.validateSession(decoded.jti, !isPassiveCheck);

        if (sessionCheck.valid && sessionCheck.session) {
          verifiedUser = decoded;
          request.authUser = decoded;
          request.sessionRecord = sessionCheck.session;
          request.headers["x-user-id"] = String(decoded.sub);
        } else if (!isPublicApiEndpoint(request.method, pathname, request)) {
          reply.header("Set-Cookie", SecurityService.buildClearSessionCookie());
          const idleMsg =
            sessionCheck.reason === "expired_idle"
              ? "Tu sesión se cerró automáticamente por inactividad."
              : "Tu sesión ha expirado. Inicia sesión nuevamente.";
          return reply.status(401).send({
            success: false,
            code: sessionCheck.reason === "expired_idle" ? "SESSION_IDLE_EXPIRED" : "SESSION_EXPIRED",
            message: idleMsg,
          });
        }
      } catch {
        if (!isPublicApiEndpoint(request.method, pathname, request)) {
          reply.header("Set-Cookie", SecurityService.buildClearSessionCookie());
          return reply.status(401).send({
            success: false,
            code: "INVALID_TOKEN",
            message: "Sesión inválida o caducada. Por favor ingrese su PIN nuevamente.",
          });
        }
      }
    }

    // Permitir rutas de la lista blanca pública
    if (isPublicApiEndpoint(request.method, pathname, request)) {
      return;
    }

    // Bloquear cualquier acceso anónimo al resto de la API
    if (!verifiedUser) {
      return reply.status(401).send({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Autenticación requerida para acceder a este recurso.",
      });
    }

    // Validar aislamiento estricto Multi-Tenant
    const isTenantAgnostic =
      TENANT_AGNOSTIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
      /^\/api\/users\/\d+\/preferences$/.test(pathname);

    if (!isTenantAgnostic && !verifiedUser.isSuperAdmin) {
      const allowed = Array.isArray(verifiedUser.allowedTenants) ? verifiedUser.allowedTenants : [];
      if (!allowed.includes("*")) {
        const targetTenant = resolveTenantId(request);
        if (targetTenant && !allowed.map((t) => t.toLowerCase()).includes(targetTenant.toLowerCase())) {
          return reply.status(403).send({
            success: false,
            code: "TENANT_FORBIDDEN",
            message: `No tienes permisos para acceder a la empresa '${targetTenant}'.`,
          });
        }
      }
    }

    // Validar permisos granulares RBAC en el servidor
    const rbacError = checkRbacPermission(request.method, pathname, verifiedUser);
    if (rbacError) {
      return reply.status(403).send({
        success: false,
        code: "PERMISSION_DENIED",
        message: rbacError,
      });
    }
  });
}
