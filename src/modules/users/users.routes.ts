import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { env } from "../../config/env";
import { resolveTenantId, getTenantFilePath, loadTenantsFromDisk } from "../tenants/tenants.service";
import { is2faRequiredForTenant, getMasterTotpSecret } from "../settings/connections.service";
import { verifyTOTP, enqueueZktecoUserInfo, enqueueZktecoDeleteUser } from "../rrhh/rrhh.routes";
import { SecurityService } from "../security/security.service";
import { AuditService } from "../security/audit.service";
import { MediaService } from "../storage/media.service";
import { extractCanonicalNumericId, allocateCanonicalUserId, toZktecoPin } from "./identity.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");

export interface PermissionDefinition {
  id: string;
  name: string;
  category: "customers" | "billing" | "network" | "plans" | "inventory" | "backpack" | "rrhh" | "messages" | "users" | "roles" | "system" | "maps";
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Clientes
  { id: "customers:view", name: "Ver Clientes", category: "customers", description: "Acceso al directorio de clientes y contratos" },
  { id: "customers:create", name: "Crear Clientes", category: "customers", description: "Dar de alta nuevos clientes" },
  { id: "customers:edit", name: "Editar Clientes", category: "customers", description: "Modificar datos y planes de clientes" },
  { id: "customers:suspend", name: "Suspender / Reactivar", category: "customers", description: "Cambiar estado del servicio del cliente" },

  // Facturación y Cobranzas
  { id: "billing:view", name: "Ver Recibos", category: "billing", description: "Consultar historial de facturas emitidas" },
  { id: "billing:collect", name: "Registrar Pagos", category: "billing", description: "Cobrar y liquidar recibos en efectivo/transferencia" },
  { id: "billing:generate", name: "Emisión Masiva", category: "billing", description: "Generar facturación mensual global" },

  // Inventario & Stock
  { id: "inventory:view", name: "Ver Inventario", category: "inventory", description: "Consultar catálogo de materiales y stock" },
  { id: "inventory:manage", name: "Gestionar Stock", category: "inventory", description: "Crear productos, compras e imprimir etiquetas" },

  // Mochila Técnica
  { id: "backpack:view", name: "Ver Mochila Técnica", category: "backpack", description: "Consultar materiales asignados a técnicos" },
  { id: "backpack:manage", name: "Asignar / Desasignar", category: "backpack", description: "Entrega y devolución de materiales a cuadrillas" },

  // RRHH & Asistencia
  { id: "rrhh:view", name: "Ver Asistencias", category: "rrhh", description: "Consultar asistencias y colaboradores" },
  { id: "rrhh:attendance", name: "Marcar Asistencia", category: "rrhh", description: "Registro biométrico selfie y GPS" },
  { id: "rrhh:manage", name: "Gestionar Personal", category: "rrhh", description: "Administrar colaboradores y turnos" },

  // Red & Equipos
  { id: "network:view", name: "Ver Equipos de Red", category: "network", description: "Ver MikroTik, OLTs, switches y topología" },
  { id: "network:control", name: "Diagnosticar & Test", category: "network", description: "Probar conectividad y enviar comandos a equipos" },
  { id: "network:manage", name: "Alta de Equipos", category: "network", description: "Agregar o editar routers y OLTs" },

  // Mensajería & WhatsApp / Chat
  { id: "messages:view", name: "Ver Mensajes & Chat", category: "messages", description: "Acceso a la bandeja de chats y conversaciones" },
  { id: "messages:send", name: "Enviar Mensajes", category: "messages", description: "Enviar respuestas, avisos y recordatorios" },
  { id: "messages:manage", name: "Gestionar Filtros & Plantillas", category: "messages", description: "Crear, editar o eliminar filtros y plantillas" },

  // Mapas & Cobertura FTTH / Wireless
  { id: "maps:view", name: "Ver Mapas & Cobertura", category: "maps", description: "Visualizar nodos, enlaces, áreas de cobertura y mediciones" },
  { id: "maps:create", name: "Crear Puntos, Enlaces y Áreas", category: "maps", description: "Añadir nuevos nodos, cables de fibra y zonas de servicio" },
  { id: "maps:edit", name: "Editar Elementos de Mapa", category: "maps", description: "Modificar ubicación, colores, iconos y trazados" },
  { id: "maps:delete", name: "Eliminar Elementos de Mapa", category: "maps", description: "Borrar nodos, enlaces y polígonos del mapa" },

  // Planes
  { id: "plans:manage", name: "Administrar Planes", category: "plans", description: "Crear o modificar tarifas de ancho de banda" },

  // Usuarios y Roles
  { id: "users:view", name: "Ver Usuarios", category: "users", description: "Consultar equipo de trabajo y operadores" },
  { id: "users:manage", name: "Gestionar Usuarios y PIN", category: "users", description: "Crear operadores y reasignar PIN de 8 dígitos" },
  { id: "roles:manage", name: "Configurar Roles Granulares", category: "roles", description: "Modificar matrices de permisos por rol" },

  // Sistema
  { id: "system:config", name: "Configuración Global", category: "system", description: "Parámetros del ISP, servidores y entorno" },
];

export const ALL_MODULE_IDS = [
  "dashboard",
  "customers",
  "messages",
  "billing",
  "inventory",
  "mochila",
  "apartados",
  "network",
  "maps",
  "plans",
  "rrhh",
  "config",
  "system",
];

export interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  allowedModules?: string[];
}

export interface SystemUser {
  id: number;
  dni?: string;
  biometricPin?: string;
  name: string;
  email: string;
  pin?: string; // Legado: migrado automáticamente a pinHash + pinLookup
  pinHash?: string;
  pinLookup?: string;
  roleId: number;
  roleName: string;
  avatar: string;
  isActive: boolean;
  createdAt: string;
  isSuperAdmin?: boolean;
  assignedTenantId?: string;
  allowedTenants?: string[];
  workSchedule?: string;
  expectedCheckInTime?: string;
  expectedCheckOutTime?: string;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  hireDate?: string;
  birthDate?: string;
  preferences?: Record<string, any>;
  requireTotp?: boolean; // Switcher para exigir o no Google Authenticator por usuario
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: 1,
    name: "Superadministrador",
    slug: "superadmin",
    description: "Acceso ilimitado a todas las configuraciones, auditoría y operaciones",
    permissions: ALL_PERMISSIONS.map((p) => p.id),
    allowedModules: [...ALL_MODULE_IDS],
  },
  {
    id: 2,
    name: "Administrador de Red / NOC",
    slug: "noc_engineer",
    description: "Gestión de routers MikroTik, OLTs, interfaces de red y planes",
    permissions: [
      "customers:view",
      "network:view",
      "network:control",
      "network:manage",
      "plans:manage",
    ],
    allowedModules: ["dashboard", "customers", "network", "plans", "system"],
  },
  {
    id: 3,
    name: "Cajero / Cobranzas",
    slug: "cashier",
    description: "Recepción de pagos, liquidación de recibos y consulta de saldos",
    permissions: [
      "customers:view",
      "billing:view",
      "billing:collect",
      "rrhh:attendance",
    ],
    allowedModules: ["dashboard", "customers", "billing", "rrhh"],
  },
  {
    id: 4,
    name: "Soporte Técnico en Campo",
    slug: "technician",
    description: "Consulta de clientes en campo, reactivación básica y verificación de red",
    permissions: [
      "customers:view",
      "customers:edit",
      "network:view",
      "network:control",
      "inventory:view",
      "backpack:view",
      "backpack:manage",
      "rrhh:attendance",
    ],
    allowedModules: ["dashboard", "customers", "inventory", "mochila", "network", "rrhh"],
  },
];

let rolesStore: Role[] = [...DEFAULT_ROLES];

export function loadRolesForTenant(tenantId: string): Role[] {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "turbonetwork";
  const filePath = getTenantFilePath(safeTenant, "roles.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list.map((r) => ({
          ...r,
          allowedModules:
            Array.isArray(r.allowedModules) && r.allowedModules.length > 0
              ? r.allowedModules
              : [...ALL_MODULE_IDS],
        }));
      }
    }
  } catch {}

  let initialRoles: Role[] = DEFAULT_ROLES;
  if (safeTenant === "loanetwork") {
    initialRoles = [
      {
        id: 1,
        name: "Superadministrador LoaNet",
        slug: "superadmin_loa",
        description: "Control absoluto de operaciones LoaNetwork Fibra",
        permissions: ALL_PERMISSIONS.map((p) => p.id),
        allowedModules: [...ALL_MODULE_IDS],
      },
      {
        id: 2,
        name: "Supervisor Regional Arequipa",
        slug: "supervisor_sur",
        description: "Supervisión de cuadrillas, auditoría de campo y clientes",
        permissions: ["customers:view", "customers:edit", "backpack:view", "backpack:manage", "inventory:view", "rrhh:view", "rrhh:manage"],
        allowedModules: ["dashboard", "customers", "inventory", "mochila", "rrhh"],
      },
      {
        id: 3,
        name: "Cajero Sucursal Centro",
        slug: "caja_centro",
        description: "Cobros en ventanilla y cierre de caja diario",
        permissions: ["customers:view", "billing:view", "billing:collect"],
        allowedModules: ["dashboard", "customers", "billing"],
      },
    ];
  } else if (safeTenant === "celeris") {
    initialRoles = [
      {
        id: 1,
        name: "Superadministrador Celeris",
        slug: "superadmin_celeris",
        description: "Administración integral Celeris Telecom",
        permissions: ALL_PERMISSIONS.map((p) => p.id),
        allowedModules: [...ALL_MODULE_IDS],
      },
      {
        id: 2,
        name: "Ingeniero NOC Enlaces",
        slug: "noc_celeris",
        description: "Monitoreo de enlaces troncales, BGP y OLTs",
        permissions: ["network:view", "network:control", "network:manage", "plans:manage", "system:config"],
        allowedModules: ["dashboard", "network", "plans", "system"],
      },
    ];
  } else if (fs.existsSync(ROLES_FILE)) {
    try {
      const rawGlobal = fs.readFileSync(ROLES_FILE, "utf-8");
      const parsedGlobal = JSON.parse(rawGlobal);
      if (Array.isArray(parsedGlobal) && parsedGlobal.length > 0) {
        initialRoles = parsedGlobal.map((r) => ({
          ...r,
          allowedModules:
            Array.isArray(r.allowedModules) && r.allowedModules.length > 0
              ? r.allowedModules
              : [...ALL_MODULE_IDS],
        }));
      }
    } catch {}
  }

  saveRolesForTenant(safeTenant, initialRoles);
  return initialRoles;
}

export function saveRolesForTenant(tenantId: string, roles: Role[]): void {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "turbonetwork";
  const filePath = getTenantFilePath(safeTenant, "roles.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(roles, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al persistir roles para tenant '${safeTenant}':`, err);
  }
}

let usersStore: SystemUser[] = [
  {
    id: 1,
    name: "César Administrador",
    email: "cesar@turbonetwork.com",
    pinHash: SecurityService.hashPin("12345678"),
    pinLookup: SecurityService.hmacPinLookup("12345678"),
    roleId: 1,
    roleName: "Superadministrador",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: "2026-09-01T00:00:00Z",
    isSuperAdmin: true,
    allowedTenants: ["*"],
    workSchedule: "08:00 - 17:00",
    preferences: {},
    requireTotp: false,
  },
];

function loadRolesFromDisk(): Role[] {
  try {
    if (fs.existsSync(ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(ROLES_FILE, "utf-8"));
    }
  } catch {}
  return rolesStore;
}

function saveRolesToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ROLES_FILE, JSON.stringify(rolesStore, null, 2), "utf-8");
  } catch {}
}

/**
 * Carga usuarios desde disco, migrando automáticamente PINs en texto plano a scrypt + HMAC
 * y extrayendo avatares Base64 pesados a archivos estáticos optimizados.
 */
function loadUsersFromDisk(): SystemUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false;
        const normalized = parsed.map((u: any) => {
          if (!u.assignedTenantId) {
            u.assignedTenantId =
              Array.isArray(u.allowedTenants) && u.allowedTenants.length > 0 && !u.allowedTenants.includes("*")
                ? u.allowedTenants[0]
                : "turbonetwork";
            changed = true;
          }
          if (!Array.isArray(u.allowedTenants) || u.allowedTenants.length === 0) {
            u.allowedTenants = u.isSuperAdmin ? ["*"] : [u.assignedTenantId];
            changed = true;
          }

          // Migrar PIN en texto plano a hash scrypt + índice HMAC sin romper accesos existentes
          if (typeof u.pin === "string" && u.pin.length > 0) {
            if (SecurityService.isHashedPin(u.pin)) {
              u.pinHash = u.pin;
              delete u.pin;
              changed = true;
            } else {
              u.pinHash = SecurityService.hashPin(u.pin);
              u.pinLookup = SecurityService.hmacPinLookup(u.pin);
              delete u.pin;
              changed = true;
            }
          }

          // Extraer avatares Base64 incrustados en JSON hacia data/uploads/avatars
          if (typeof u.avatar === "string" && u.avatar.startsWith("data:image/") && !u.avatar.startsWith("data:image/svg+xml")) {
            const externalUrl = MediaService.externalizeAvatarIfNeeded(u.avatar, `usr${u.id || ""}`);
            if (externalUrl && externalUrl !== u.avatar) {
              u.avatar = externalUrl;
              changed = true;
            }
          }

          return u as SystemUser;
        });

        if (changed) {
          try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(normalized, null, 2), "utf-8");
          } catch {}
        }
        return normalized;
      }
    }
  } catch {}
  return usersStore;
}

function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2), "utf-8");
  } catch {}
}

function sanitizeUserOutput(u: SystemUser) {
  const { pin, pinHash, pinLookup, ...safeUser } = u;
  return safeUser;
}

function resolveUserTotpSecret(user: SystemUser): string | null {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const list = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
      if (Array.isArray(list)) {
        const emp = list.find(
          (e: any) =>
            e.operatorId === user.id ||
            (e.email && user.email && String(e.email).toLowerCase() === user.email.toLowerCase())
        );
        if (emp && typeof emp.totpSecret === "string" && emp.totpSecret.length >= 16) {
          return emp.totpSecret;
        }
      }
    }
  } catch {}
  return null;
}

function buildAuthenticatedUserResponse(user: SystemUser, requestedTenant?: string) {
  const assignedTenant =
    requestedTenant ||
    user.assignedTenantId ||
    (user.allowedTenants && user.allowedTenants[0] !== "*" ? user.allowedTenants[0] : "turbonetwork");

  const tenantRoles = loadRolesForTenant(assignedTenant);
  const role = tenantRoles.find((r) => r.id === user.roleId) || rolesStore.find((r) => r.id === user.roleId);

  const userPermissions = user.isSuperAdmin ? ALL_PERMISSIONS.map((p) => p.id) : role?.permissions || [];
  const userAllowedModules = user.isSuperAdmin
    ? [...ALL_MODULE_IDS]
    : role?.allowedModules || [...ALL_MODULE_IDS];
  const allowedTenants = user.isSuperAdmin
    ? ["*"]
    : (user.allowedTenants || [assignedTenant]).filter(Boolean);

  return {
    assignedTenant,
    userPermissions,
    userAllowedModules,
    allowedTenants,
    userPayload: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      avatar: user.avatar,
      isSuperAdmin: !!user.isSuperAdmin,
      assignedTenantId: assignedTenant,
      allowedTenants,
      workSchedule: user.workSchedule || "08:00 - 17:00",
      expectedCheckInTime:
        user.expectedCheckInTime || user.workSchedule?.match(/(\d{1,2}:\d{2})/)?.[1] || "08:00",
      expectedCheckOutTime:
        user.expectedCheckOutTime || user.workSchedule?.match(/(?:hasta|a|-)\s*(\d{1,2}:\d{2})/)?.[1] || "17:00",
      scheduleStartDate: user.scheduleStartDate || "",
      scheduleEndDate: user.scheduleEndDate || "",
      hireDate: user.hireDate || "",
      birthDate: user.birthDate || "",
      preferences: user.preferences || {},
      permissions: userPermissions,
      allowedModules: userAllowedModules,
    },
  };
}

rolesStore = loadRolesFromDisk();
usersStore = loadUsersFromDisk();
if (!fs.existsSync(ROLES_FILE)) saveRolesToDisk();
if (!fs.existsSync(USERS_FILE)) saveUsersToDisk();

const pinLoginSchema = z.object({
  pin: z.string().length(8, "El PIN debe contener exactamente 8 dígitos").regex(/^\d{8}$/, "Solo dígitos numéricos"),
  totpCode: z.string().optional(),
  tenantId: z.string().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  dni: z.string().nullable().optional(),
  pin: z.string().length(8).regex(/^\d{8}$/),
  roleId: z.number().int().positive(),
  workSchedule: z.string().nullable().optional(),
  expectedCheckInTime: z.string().nullable().optional(),
  expectedCheckOutTime: z.string().nullable().optional(),
  scheduleStartDate: z.string().nullable().optional(),
  scheduleEndDate: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  assignedTenantId: z.string().nullable().optional(),
  allowedTenants: z.array(z.string()).nullable().optional(),
  requireTotp: z.boolean().optional(),
  syncWithZkteco: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  dni: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  pin: z.string().length(8).regex(/^\d{8}$/).optional(),
  roleId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  workSchedule: z.string().nullable().optional(),
  expectedCheckInTime: z.string().nullable().optional(),
  expectedCheckOutTime: z.string().nullable().optional(),
  scheduleStartDate: z.string().nullable().optional(),
  scheduleEndDate: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  assignedTenantId: z.string().nullable().optional(),
  allowedTenants: z.array(z.string()).nullable().optional(),
  preferences: z.record(z.any()).optional(),
  requireTotp: z.boolean().optional(),
  syncWithZkteco: z.boolean().optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  allowedModules: z.array(z.string()).optional(),
});

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Configuración pública de política de sesión e inactividad
  fastify.get("/auth/session-config", async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        idleTimeoutMinutes: env.SESSION_IDLE_TIMEOUT_MINUTES,
        idleTimeoutMs: SecurityService.getIdleTimeoutMs(),
        maxSessionHours: env.SESSION_MAX_HOURS,
        maxSessionMs: SecurityService.getMaxSessionMs(),
        warningBeforeSeconds: 60,
      },
    });
  });

  // Autenticación por PIN de 8 dígitos con Rate Limit, scrypt, JWT real y soporte TOTP 2FA
  fastify.post("/auth/pin-login", async (request, reply) => {
    const clientIp =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      request.ip ||
      "unknown";

    const rateCheck = SecurityService.checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        success: false,
        code: "RATE_LIMITED",
        retryAfterSeconds: rateCheck.retryAfterSeconds,
        message: `Demasiados intentos fallidos. Intente nuevamente en ${Math.ceil(rateCheck.retryAfterSeconds / 60)} min (${rateCheck.retryAfterSeconds}s).`,
      });
    }

    usersStore = loadUsersFromDisk();

    const parse = pinLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        message: "El PIN debe ser exactamente de 8 dígitos numéricos",
      });
    }

    const { pin, totpCode, tenantId: requestedTenant } = parse.data;
    const candidateLookup = SecurityService.hmacPinLookup(pin);

    let matchedUser: SystemUser | undefined;
    for (const u of usersStore) {
      if (!u.isActive) continue;
      const check = SecurityService.verifyPin(pin, u);
      if (check.valid) {
        matchedUser = u;
        if (check.needsMigration || u.pinLookup !== candidateLookup) {
          u.pinHash = SecurityService.hashPin(pin);
          u.pinLookup = candidateLookup;
          delete u.pin;
          saveUsersToDisk();
        }
        break;
      }
    }

    if (!matchedUser) {
      const failInfo = SecurityService.recordLoginFailure(clientIp);
      AuditService.log({
        ip: clientIp,
        action: "auth.login_failed",
        entity: "auth",
        details: { reason: "invalid_pin", remainingAttempts: failInfo.remainingAttempts },
      });
      return reply.status(401).send({
        success: false,
        message: failInfo.locked
          ? "Cuenta temporalmente protegida por múltiples intentos fallidos (10 min)."
          : `PIN no válido o usuario inactivo. Intentos restantes: ${failInfo.remainingAttempts}.`,
      });
    }

    const authInfo = buildAuthenticatedUserResponse(matchedUser, requestedTenant);
    const assignedTenant = authInfo.assignedTenant;

    // Validar acceso a la empresa solicitada si no es SuperAdmin
    if (
      requestedTenant &&
      !matchedUser.isSuperAdmin &&
      !authInfo.allowedTenants.includes("*") &&
      !authInfo.allowedTenants.map((t) => t.toLowerCase()).includes(requestedTenant.toLowerCase())
    ) {
      return reply.status(403).send({
        success: false,
        message: "No tienes acceso asignado a esta sede o empresa.",
      });
    }

    // Verificación estricta de 2FA (Google Authenticator) cuando esté activada por usuario o por empresa
    const tenantRequires2fa = is2faRequiredForTenant(assignedTenant);
    const mustVerify2fa = Boolean(matchedUser.requireTotp) || tenantRequires2fa;

    if (mustVerify2fa) {
      const tenants = loadTenantsFromDisk();
      const tenantObj = tenants.find((t) => t.id === assignedTenant);
      const tenantName = tenantObj?.name || assignedTenant;

      if (!totpCode || !totpCode.trim()) {
        AuditService.log({
          actorUserId: matchedUser.id,
          actorName: matchedUser.name,
          tenantId: assignedTenant,
          ip: clientIp,
          action: "auth.2fa_challenge",
          entity: "auth",
        });
        return reply.send({
          success: false,
          requires2fa: true,
          tenantId: assignedTenant,
          tenantName,
          message: tenantRequires2fa
            ? "La política de seguridad de esta empresa exige verificación en 2 pasos."
            : "Tu perfil tiene activada la verificación en 2 pasos.",
          user: {
            id: matchedUser.id,
            name: matchedUser.name,
            avatar: matchedUser.avatar,
          },
        });
      }

      const cleanCode = totpCode.trim();
      const masterSecret = getMasterTotpSecret(assignedTenant);
      const individualSecret = resolveUserTotpSecret(matchedUser);
      const validTotp =
        verifyTOTP(cleanCode, masterSecret) ||
        (individualSecret ? verifyTOTP(cleanCode, individualSecret) : false);

      if (!validTotp) {
        const failInfo = SecurityService.recordLoginFailure(clientIp);
        AuditService.log({
          actorUserId: matchedUser.id,
          actorName: matchedUser.name,
          tenantId: assignedTenant,
          ip: clientIp,
          action: "auth.2fa_failed",
          entity: "auth",
          details: { remainingAttempts: failInfo.remainingAttempts },
        });
        return reply.status(401).send({
          success: false,
          message: "Código de Google Authenticator incorrecto o expirado.",
        });
      }
    }

    SecurityService.clearLoginFailures(clientIp);

    const sessionRecord = SecurityService.createSession({
      userId: matchedUser.id,
      tenantId: assignedTenant,
      ip: clientIp,
      userAgent: (request.headers["user-agent"] as string) || "",
    });

    const jwtToken = fastify.jwt.sign(
      {
        jti: sessionRecord.jti,
        sub: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        roleId: matchedUser.roleId,
        roleName: matchedUser.roleName,
        isSuperAdmin: !!matchedUser.isSuperAdmin,
        assignedTenantId: assignedTenant,
        allowedTenants: authInfo.allowedTenants,
        permissions: authInfo.userPermissions,
      },
      { expiresIn: `${env.SESSION_MAX_HOURS}h` }
    );

    const isSecure =
      request.protocol === "https" ||
      request.headers["x-forwarded-proto"] === "https";
    reply.header("Set-Cookie", SecurityService.buildSessionCookie(jwtToken, isSecure));

    AuditService.log({
      actorUserId: matchedUser.id,
      actorName: matchedUser.name,
      tenantId: assignedTenant,
      ip: clientIp,
      action: "auth.login",
      entity: "session",
      details: { roleName: matchedUser.roleName },
    });

    return reply.send({
      success: true,
      message: `¡Bienvenido de nuevo, ${matchedUser.name}!`,
      data: {
        user: authInfo.userPayload,
        permissions: authInfo.userPermissions,
        allowedModules: authInfo.userAllowedModules,
        token: jwtToken,
        expiresAt: sessionRecord.maxExpiresAt,
        lastActivityAt: sessionRecord.lastActivityAt,
        idleTimeoutMs: sessionRecord.idleTimeoutMs,
        idleTimeoutMinutes: env.SESSION_IDLE_TIMEOUT_MINUTES,
      },
    });
  });

  // Cerrar sesión explícitamente: revoca el token en el servidor y limpia la cookie HttpOnly
  fastify.post("/auth/logout", async (request, reply) => {
    const rawCookieToken = SecurityService.parseCookie(request.headers.cookie, "tn_session");
    const authHeader = request.headers.authorization;
    const rawBearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = rawBearer || rawCookieToken;

    let actorId: number | null = request.authUser?.sub ?? null;
    let actorName = request.authUser?.name || "Operador";
    let tenantId = request.authUser?.assignedTenantId || "turbonetwork";

    if (request.authUser?.jti) {
      SecurityService.revokeSession(request.authUser.jti);
    } else if (token) {
      try {
        const decoded: any = fastify.jwt.decode(token);
        if (decoded?.jti) {
          SecurityService.revokeSession(decoded.jti);
          actorId = decoded.sub || null;
          actorName = decoded.name || actorName;
          tenantId = decoded.assignedTenantId || tenantId;
        }
      } catch {}
    }

    reply.header("Set-Cookie", SecurityService.buildClearSessionCookie());

    if (actorId) {
      AuditService.log({
        actorUserId: actorId,
        actorName,
        tenantId,
        ip: request.ip,
        action: "auth.logout",
        entity: "session",
      });
    }

    return reply.send({
      success: true,
      message: "Sesión cerrada correctamente.",
    });
  });

  // Renovar marca de actividad de sesión activa (mientras no supere maxExpiresAt)
  fastify.post("/auth/refresh", async (request, reply) => {
    if (!request.authUser || !request.sessionRecord) {
      return reply.status(401).send({ success: false, message: "Sesión no válida" });
    }
    const check = SecurityService.validateSession(request.authUser.jti, true);
    if (!check.valid || !check.session) {
      reply.header("Set-Cookie", SecurityService.buildClearSessionCookie());
      return reply.status(401).send({ success: false, message: "Sesión expirada" });
    }
    return reply.send({
      success: true,
      data: {
        lastActivityAt: check.session.lastActivityAt,
        expiresAt: check.session.maxExpiresAt,
        idleTimeoutMs: check.session.idleTimeoutMs,
      },
    });
  });

  // Obtener sesión del usuario autenticado (SIN fallback a Superadministrador)
  fastify.get("/auth/me", async (request, reply) => {
    if (!request.authUser) {
      return reply.status(401).send({
        success: false,
        code: "AUTH_REQUIRED",
        message: "No hay una sesión activa válida.",
      });
    }

    usersStore = loadUsersFromDisk();
    const user = usersStore.find((u) => u.id === request.authUser!.sub && u.isActive);

    if (!user) {
      SecurityService.revokeSession(request.authUser.jti);
      reply.header("Set-Cookie", SecurityService.buildClearSessionCookie());
      return reply.status(401).send({
        success: false,
        code: "USER_INACTIVE",
        message: "El operador ya no se encuentra activo.",
      });
    }

    const authInfo = buildAuthenticatedUserResponse(user);
    return reply.send({
      success: true,
      user: authInfo.userPayload,
      session: request.sessionRecord
        ? {
            expiresAt: request.sessionRecord.maxExpiresAt,
            lastActivityAt: request.sessionRecord.lastActivityAt,
            idleTimeoutMs: request.sessionRecord.idleTimeoutMs,
          }
        : undefined,
    });
  });

  // Servir avatares extraídos de Base64 de forma segura y cacheable
  fastify.get("/media/avatars/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const resolved = MediaService.resolveAvatarFile(fileName);
    if (!resolved) {
      return reply.status(404).send({ success: false, message: "Avatar no encontrado" });
    }
    const stream = fs.createReadStream(resolved.filePath);
    return reply
      .type(resolved.mimeType)
      .header("Cache-Control", "public, max-age=86400")
      .send(stream);
  });

  // Consultar bitácora inmutable de auditoría (restringido por RBAC a system:config / Superadmin)
  fastify.get("/security/audit-logs", async (request, reply) => {
    const query = request.query as { limit?: string; tenantId?: string } | undefined;
    const limit = query?.limit ? parseInt(query.limit, 10) : 100;
    const tenantId = query?.tenantId || resolveTenantId(request);
    const logs = AuditService.list({
      tenantId,
      isSuperAdmin: Boolean(request.authUser?.isSuperAdmin),
      limit,
    });
    return reply.send({
      success: true,
      count: logs.length,
      data: logs,
    });
  });

  // Catálogo maestro de permisos disponibles
  fastify.get("/permissions", async (_request, reply) => {
    return reply.send({ success: true, data: ALL_PERMISSIONS });
  });

  // Listar todos los roles de la empresa activa y su matriz de permisos
  fastify.get("/roles", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const roles = loadRolesForTenant(tenantId);
    return reply.send({ success: true, tenantId, data: roles });
  });

  // Crear nuevo rol con matriz personalizada para la empresa activa
  fastify.post("/roles", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parse = createRoleSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const roles = loadRolesForTenant(tenantId);
    const newRole: Role = {
      id: Date.now(),
      name: parse.data.name,
      slug: parse.data.name.toLowerCase().replace(/\s+/g, "_"),
      description: parse.data.description || "Rol personalizado del sistema",
      permissions: parse.data.permissions,
      allowedModules:
        Array.isArray(parse.data.allowedModules) && parse.data.allowedModules.length > 0
          ? parse.data.allowedModules
          : [...ALL_MODULE_IDS],
    };
    roles.push(newRole);
    saveRolesForTenant(tenantId, roles);

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId,
      ip: request.ip,
      action: "roles.create",
      entity: `role:${newRole.id}`,
      details: { name: newRole.name, permissionsCount: newRole.permissions.length },
    });

    return reply.status(201).send({ success: true, tenantId, data: newRole });
  });

  // Actualizar rol existente en la empresa activa
  fastify.put("/roles/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);
    const body = request.body as {
      name?: string;
      description?: string;
      permissions?: string[];
      allowedModules?: string[];
    };

    const roles = loadRolesForTenant(tenantId);
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      return reply.status(404).send({ success: false, message: "Rol no encontrado en esta empresa" });
    }

    if (body.name) {
      role.name = body.name;
      role.slug = body.name.toLowerCase().replace(/\s+/g, "_");
    }
    if (body.description !== undefined) {
      role.description = body.description;
    }
    if (body.permissions) {
      role.permissions = body.permissions;
    }
    if (body.allowedModules !== undefined) {
      role.allowedModules = Array.isArray(body.allowedModules) ? body.allowedModules : [...ALL_MODULE_IDS];
    }

    saveRolesForTenant(tenantId, roles);

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId,
      ip: request.ip,
      action: "roles.update",
      entity: `role:${role.id}`,
      details: { name: role.name },
    });

    return reply.send({ success: true, tenantId, message: "Rol actualizado correctamente", data: role });
  });

  // Eliminar rol en la empresa activa
  fastify.delete("/roles/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);

    if (roleId === 1) {
      return reply
        .status(403)
        .send({ success: false, message: "No es posible eliminar el rol Superadministrador del sistema" });
    }

    const roles = loadRolesForTenant(tenantId);
    const index = roles.findIndex((r) => r.id === roleId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Rol no encontrado en esta empresa" });
    }

    usersStore = loadUsersFromDisk();
    const hasAssignedUsers = usersStore.some((u) => {
      const userTenant = u.assignedTenantId || "turbonetwork";
      return userTenant === tenantId && u.roleId === roleId;
    });
    if (hasAssignedUsers) {
      return reply.status(400).send({
        success: false,
        message:
          "No se puede eliminar este rol porque tiene operadores asignados en esta empresa. Reasigne los operadores primero.",
      });
    }

    const deleted = roles.splice(index, 1)[0];
    saveRolesForTenant(tenantId, roles);

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId,
      ip: request.ip,
      action: "roles.delete",
      entity: `role:${roleId}`,
      details: { name: deleted.name },
    });

    return reply.send({ success: true, tenantId, message: "Rol eliminado exitosamente", data: deleted });
  });

  // Listar usuarios con horario, preferencias y estado (filtrado estricto por empresa)
  fastify.get("/users", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const query = request.query as Record<string, any> | undefined;
    const showAll = (query?.all === "true" || query?.all === true) && Boolean(request.authUser?.isSuperAdmin);
    const requestedTenant = (query?.tenantId || query?.tenant || request.headers["x-tenant-id"]) as
      | string
      | undefined;
    const tenantId = requestedTenant ? requestedTenant.trim().toLowerCase() : resolveTenantId(request);

    let list = usersStore;
    if (!showAll && tenantId) {
      list = usersStore.filter((u) => {
        const uTenant = (
          u.assignedTenantId
            ? u.assignedTenantId
            : Array.isArray(u.allowedTenants) && u.allowedTenants.length > 0 && !u.allowedTenants.includes("*")
              ? u.allowedTenants[0]
              : "turbonetwork"
        )
          .trim()
          .toLowerCase();

        if (uTenant === "*") return true;
        return uTenant === tenantId;
      });
    }

    const sanitized = list.map((u) => {
      const safeUser = sanitizeUserOutput(u);
      return {
        ...safeUser,
        assignedTenantId:
          safeUser.assignedTenantId ||
          (Array.isArray(safeUser.allowedTenants) &&
          safeUser.allowedTenants.length > 0 &&
          !safeUser.allowedTenants.includes("*")
            ? safeUser.allowedTenants[0]
            : "turbonetwork"),
        workSchedule: safeUser.workSchedule || "08:00 - 17:00",
        scheduleStartDate: safeUser.scheduleStartDate || "",
        scheduleEndDate: safeUser.scheduleEndDate || "",
        preferences: safeUser.preferences || {},
        requireTotp: Boolean(safeUser.requireTotp),
        pinMasked: "••••••••",
      };
    });
    return reply.send({ success: true, count: sanitized.length, tenantId, data: sanitized });
  });

  // Switcher rápido: Alternar acceso con código Google Authenticator (2FA) o sin código
  fastify.patch("/users/:id/toggle-totp", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    const body = (request.body as { requireTotp?: boolean }) || {};
    if (typeof body.requireTotp === "boolean") {
      user.requireTotp = body.requireTotp;
    } else {
      user.requireTotp = !user.requireTotp;
    }

    saveUsersToDisk();

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId: resolveTenantId(request),
      ip: request.ip,
      action: "users.toggle_totp",
      entity: `user:${user.id}`,
      details: { targetName: user.name, requireTotp: user.requireTotp },
    });

    const safeUser = sanitizeUserOutput(user);
    return reply.send({
      success: true,
      message: user.requireTotp
        ? `Acceso CON CÓDIGO de Google Authenticator activado para ${user.name}`
        : `Acceso SIN CÓDIGO (directo con PIN) configurado para ${user.name}`,
      requireTotp: user.requireTotp,
      data: { ...safeUser, pinMasked: "••••••••" },
    });
  });

  // Registrar nuevo usuario con rol, PIN hasheado con scrypt y horario
  fastify.post("/users", async (request, reply) => {
    const parse = createUserSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const rawTargetTenant = (
      parse.data.assignedTenantId ||
      (parse.data.allowedTenants && parse.data.allowedTenants[0]) ||
      resolveTenantId(request) ||
      "turbonetwork"
    )
      .trim()
      .toLowerCase();
    const targetTenant = rawTargetTenant || "turbonetwork";
    const tenantRoles = loadRolesForTenant(targetTenant);
    const role = tenantRoles.find((r) => r.id === parse.data.roleId) || rolesStore.find((r) => r.id === parse.data.roleId);
    if (!role) {
      return reply.status(400).send({ success: false, message: "El rol especificado no existe para esta empresa" });
    }

    usersStore = loadUsersFromDisk();

    if (usersStore.some((u) => u.email.toLowerCase() === parse.data.email.toLowerCase())) {
      return reply.status(400).send({ success: false, message: "Ya existe un usuario con este correo" });
    }

    const candidateLookup = SecurityService.hmacPinLookup(parse.data.pin);
    if (
      usersStore.some(
        (u) => u.pinLookup === candidateLookup || SecurityService.verifyPin(parse.data.pin, u).valid
      )
    ) {
      return reply.status(400).send({ success: false, message: "Este PIN ya está asignado a otro operador" });
    }

    // Vincular automáticamente con employees.json si coincide por DNI o correo (un solo ID canónico)
    const cleanDni = parse.data.dni ? String(parse.data.dni).trim() : "";
    const dniNum = extractCanonicalNumericId(cleanDni);
    let empsDisk: any[] = [];
    try {
      if (fs.existsSync(EMPLOYEES_FILE)) {
        const rawEmps = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
        if (Array.isArray(rawEmps)) empsDisk = rawEmps;
      }
    } catch {}

    const matchedEmpIdx = empsDisk.findIndex(
      (e: any) =>
        (cleanDni && String(e.dni || "").trim() === cleanDni) ||
        (dniNum !== null && (e.id === dniNum || extractCanonicalNumericId(e.dni) === dniNum)) ||
        (e.email && String(e.email).toLowerCase() === parse.data.email.toLowerCase())
    );
    const matchedEmp = matchedEmpIdx >= 0 ? empsDisk[matchedEmpIdx] : null;

    if (matchedEmp && usersStore.some((u) => u.id === matchedEmp.id)) {
      return reply.status(400).send({
        success: false,
        message: `El colaborador ${matchedEmp.name} (ID ${matchedEmp.id}) ya cuenta con un usuario operador activo.`,
      });
    }

    const usedIds = new Set<number>([
      1,
      ...usersStore.map((u) => Number(u.id)),
      ...empsDisk.filter((e: any) => !matchedEmp || e.id !== matchedEmp.id).map((e: any) => Number(e.id)),
    ]);

    const canonicalId = matchedEmp
      ? Number(matchedEmp.id)
      : allocateCanonicalUserId({
          dni: cleanDni || null,
          usedIds,
        });
    const zkUserIdStr = toZktecoPin(canonicalId);

    const newUser: SystemUser = {
      id: canonicalId,
      dni: cleanDni || matchedEmp?.dni || undefined,
      biometricPin: zkUserIdStr,
      name: parse.data.name,
      email: parse.data.email,
      pinHash: SecurityService.hashPin(parse.data.pin),
      pinLookup: candidateLookup,
      roleId: role.id,
      roleName: role.name,
      avatar: matchedEmp?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(parse.data.name)}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      isSuperAdmin: false,
      assignedTenantId: targetTenant,
      allowedTenants: [targetTenant],
      workSchedule: parse.data.workSchedule || matchedEmp?.workSchedule || "08:00 - 17:00",
      expectedCheckInTime:
        parse.data.expectedCheckInTime || parse.data.workSchedule?.match(/(\d{1,2}:\d{2})/)?.[1] || matchedEmp?.expectedCheckInTime || "08:00",
      expectedCheckOutTime:
        parse.data.expectedCheckOutTime ||
        parse.data.workSchedule?.match(/(?:hasta|a|-)\s*(\d{1,2}:\d{2})/)?.[1] ||
        matchedEmp?.expectedCheckOutTime ||
        "17:00",
      scheduleStartDate: parse.data.scheduleStartDate || "",
      scheduleEndDate: parse.data.scheduleEndDate || "",
      hireDate: parse.data.hireDate || matchedEmp?.hireDate || "",
      birthDate: parse.data.birthDate || matchedEmp?.birthDate || "",
      preferences: {},
      requireTotp: parse.data.requireTotp === true,
    };

    usersStore.push(newUser);
    saveUsersToDisk();

    if (matchedEmpIdx >= 0) {
      empsDisk[matchedEmpIdx] = {
        ...empsDisk[matchedEmpIdx],
        operatorId: canonicalId,
        operatorTenantId: targetTenant,
        operatorRoleId: role.id,
        operatorRoleName: role.name,
        biometricPin: zkUserIdStr,
        biometricId: zkUserIdStr,
      };
      try {
        fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(empsDisk, null, 2), "utf-8");
      } catch {}
    }

    let zktecoSync = null;
    if (parse.data.syncWithZkteco !== false) {
      try {
        // IMPORTANTE: Enviar SIEMPRE el ID único numérico (zkUserIdStr), jamás el PIN secreto de login
        zktecoSync = enqueueZktecoUserInfo(zkUserIdStr, newUser.name, newUser.isSuperAdmin);
      } catch (e) {
        console.warn("Aviso al encolar operador en ZKTeco:", e);
      }
    }

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId: targetTenant,
      ip: request.ip,
      action: "users.create",
      entity: `user:${newUser.id}`,
      details: { name: newUser.name, email: newUser.email, roleName: newUser.roleName, zkUserId: zkUserIdStr },
    });

    const safeUser = sanitizeUserOutput(newUser);
    return reply.status(201).send({
      success: true,
      message: zktecoSync
        ? `Usuario registrado y encolado para ZKTeco (ID único: ${zkUserIdStr}).`
        : `Usuario registrado de forma segura (ID único: ${zkUserIdStr}).`,
      data: { ...safeUser, pinMasked: "••••••••", zktecoSynced: !!zktecoSync },
    });
  });

  // Sincronizar usuario con ZKTeco usando su ID único numérico (jamás su PIN secreto de acceso web)
  fastify.post("/users/:id/sync-zkteco", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    const numericId = extractCanonicalNumericId(user.dni) || extractCanonicalNumericId(user.id);
    if (!numericId) {
      return reply.status(400).send({
        success: false,
        message: "El operador no posee un ID numérico válido de 1 a 9 dígitos para ZKTeco.",
      });
    }
    const zktecoPin = toZktecoPin(numericId);

    try {
      const syncResult = enqueueZktecoUserInfo(zktecoPin, user.name, user.isSuperAdmin);
      return reply.send({
        success: true,
        message: `¡Operador "${user.name}" enviado a la cola del ZKTeco (ID único: ${zktecoPin})!`,
        data: syncResult,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: "Error al sincronizar con ZKTeco: " + (err.message || String(err)),
      });
    }
  });

  fastify.put("/users/:id", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    const parse = updateUserSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const data = parse.data;
    let shouldRevokeSessions = false;

    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email;
    if (data.avatar !== undefined) {
      user.avatar = MediaService.externalizeAvatarIfNeeded(data.avatar, `usr${user.id}`);
    }
    if (data.pin) {
      const newLookup = SecurityService.hmacPinLookup(data.pin);
      if (
        usersStore.some(
          (u) => u.id !== userId && (u.pinLookup === newLookup || SecurityService.verifyPin(data.pin!, u).valid)
        )
      ) {
        return reply.status(400).send({ success: false, message: "Este PIN ya está asignado a otro operador" });
      }
      user.pinHash = SecurityService.hashPin(data.pin);
      user.pinLookup = newLookup;
      delete user.pin;
      shouldRevokeSessions = true;
    }
    if (data.roleId) {
      user.roleId = data.roleId;
      const targetTenant = user.assignedTenantId || resolveTenantId(request);
      const tenantRoles = loadRolesForTenant(targetTenant);
      const role = tenantRoles.find((r) => r.id === data.roleId) || rolesStore.find((r) => r.id === data.roleId);
      if (role) user.roleName = role.name;
      shouldRevokeSessions = true;
    }
    if (data.isActive !== undefined) {
      user.isActive = data.isActive;
      if (!data.isActive) shouldRevokeSessions = true;
    }
    if (data.workSchedule !== undefined) user.workSchedule = data.workSchedule || undefined;
    if (data.expectedCheckInTime !== undefined) user.expectedCheckInTime = data.expectedCheckInTime || undefined;
    else if (data.workSchedule) {
      const m = data.workSchedule.match(/(\d{1,2}:\d{2})/);
      if (m) user.expectedCheckInTime = m[1];
    }
    if (data.expectedCheckOutTime !== undefined) user.expectedCheckOutTime = data.expectedCheckOutTime || undefined;
    else if (data.workSchedule) {
      const m2 = data.workSchedule.match(/(?:hasta|a|-)\s*(\d{1,2}:\d{2})/);
      if (m2) user.expectedCheckOutTime = m2[1];
    }
    if (data.scheduleStartDate !== undefined) user.scheduleStartDate = data.scheduleStartDate || undefined;
    if (data.scheduleEndDate !== undefined) user.scheduleEndDate = data.scheduleEndDate || undefined;
    if (data.hireDate !== undefined) user.hireDate = data.hireDate || undefined;
    if (data.birthDate !== undefined) user.birthDate = data.birthDate || undefined;
    if (data.assignedTenantId !== undefined) {
      const assigned = data.assignedTenantId ? String(data.assignedTenantId).trim().toLowerCase() : undefined;
      user.assignedTenantId = assigned;
      if (assigned && assigned !== "*") {
        user.allowedTenants = [assigned];
      } else if (assigned === "*") {
        user.allowedTenants = ["*"];
      }
      shouldRevokeSessions = true;
    }
    if (data.allowedTenants !== undefined) {
      user.allowedTenants = Array.isArray(data.allowedTenants) ? data.allowedTenants.filter(Boolean) : [];
      if (user.allowedTenants.length === 1 && (!user.assignedTenantId || user.assignedTenantId === "*")) {
        user.assignedTenantId = user.allowedTenants[0];
      }
      shouldRevokeSessions = true;
    }
    if (user.allowedTenants) {
      user.allowedTenants = user.allowedTenants.filter(Boolean);
    }
    if (data.preferences !== undefined) user.preferences = { ...(user.preferences || {}), ...data.preferences };
    if (data.requireTotp !== undefined) user.requireTotp = Boolean(data.requireTotp);

    saveUsersToDisk();

    if (shouldRevokeSessions && userId !== request.authUser?.sub) {
      SecurityService.revokeAllUserSessions(userId);
    }

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId: resolveTenantId(request),
      ip: request.ip,
      action: "users.update",
      entity: `user:${user.id}`,
      details: { name: user.name, isActive: user.isActive, roleId: user.roleId },
    });

    const safeUser = sanitizeUserOutput(user);
    return reply.send({
      success: true,
      message: "Operador actualizado correctamente",
      data: safeUser,
    });
  });

  // Actualizar perfil de operador actual (foto de perfil, usuario/correo, nombres y apellidos)
  fastify.put("/users/profile", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const profileSchema = z.object({
      id: z.number().int().positive(),
      name: z.string().min(2, "El nombre completo es obligatorio"),
      email: z.string().min(3, "El usuario o correo es obligatorio"),
      avatar: z.string().optional(),
      pin: z.string().length(8).regex(/^\d{8}$/).optional(),
    });

    const parse = profileSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const { id, name, email, avatar, pin } = parse.data;

    // Impedir que un usuario sin permiso users:manage edite el perfil de otro operador
    const canManageUsers =
      request.authUser?.isSuperAdmin ||
      request.authUser?.roleId === 1 ||
      request.authUser?.permissions?.includes("users:manage");

    if (request.authUser && id !== request.authUser.sub && !canManageUsers) {
      return reply.status(403).send({
        success: false,
        message: "Solo puedes modificar tu propio perfil de operador.",
      });
    }

    const user = usersStore.find((u) => u.id === id);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Usuario no encontrado" });
    }

    const duplicate = usersStore.find((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase());
    if (duplicate) {
      return reply.status(400).send({ success: false, message: "Este usuario o correo ya está en uso por otro operador" });
    }

    if (pin) {
      const newLookup = SecurityService.hmacPinLookup(pin);
      if (
        usersStore.some(
          (u) => u.id !== id && (u.pinLookup === newLookup || SecurityService.verifyPin(pin, u).valid)
        )
      ) {
        return reply.status(400).send({ success: false, message: "Este PIN ya está asignado a otro operador" });
      }
      user.pinHash = SecurityService.hashPin(pin);
      user.pinLookup = newLookup;
      delete user.pin;
    }

    user.name = name;
    user.email = email;
    if (avatar) {
      user.avatar = MediaService.externalizeAvatarIfNeeded(avatar, `usr${user.id}`);
    }

    saveUsersToDisk();

    AuditService.log({
      actorUserId: request.authUser?.sub ?? id,
      actorName: request.authUser?.name ?? name,
      tenantId: resolveTenantId(request),
      ip: request.ip,
      action: "users.update_profile",
      entity: `user:${user.id}`,
      details: { pinChanged: Boolean(pin) },
    });

    const safeUser = sanitizeUserOutput(user);
    return reply.send({
      success: true,
      message: "¡Perfil de operador actualizado exitosamente!",
      data: safeUser,
    });
  });

  // Eliminar usuario
  fastify.delete("/users/:id", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    if (userId === 1) {
      return reply.status(403).send({ success: false, message: "No se puede eliminar al Superadministrador raíz" });
    }

    const idx = usersStore.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    const removed = usersStore.splice(idx, 1)[0];
    saveUsersToDisk();
    SecurityService.revokeAllUserSessions(userId);

    // Desvincular operatorId en employees.json si sigue siendo colaborador activo, o eliminar de ZKTeco si era solo operador
    let stillActiveEmployee = false;
    try {
      if (fs.existsSync(EMPLOYEES_FILE)) {
        const rawEmps = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
        if (Array.isArray(rawEmps)) {
          let empChanged = false;
          for (const emp of rawEmps) {
            if (emp.id === userId || emp.operatorId === userId) {
              if (emp.status === "active") stillActiveEmployee = true;
              delete emp.operatorId;
              delete emp.operatorRoleId;
              delete emp.operatorRoleName;
              delete emp.operatorTenantId;
              delete emp.operatorPin;
              empChanged = true;
            }
          }
          if (empChanged) {
            fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(rawEmps, null, 2), "utf-8");
          }
        }
      }
    } catch {}

    if (!stillActiveEmployee) {
      try {
        enqueueZktecoDeleteUser(userId);
      } catch {}
    }

    AuditService.log({
      actorUserId: request.authUser?.sub,
      actorName: request.authUser?.name,
      tenantId: resolveTenantId(request),
      ip: request.ip,
      action: "users.delete",
      entity: `user:${userId}`,
      details: { name: removed.name, email: removed.email },
    });

    return reply.send({ success: true, message: "Operador eliminado exitosamente" });
  });

  // Guardar preferencias personales del operador (colores, tema, toast, etc.)
  const handleSavePreferences = async (request: any, reply: any) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    const body = (request.body as Record<string, any>) || {};
    user.preferences = {
      ...(user.preferences || {}),
      ...body,
    };

    saveUsersToDisk();

    return reply.send({
      success: true,
      message: "Preferencias del usuario guardadas exitosamente",
      data: user.preferences,
    });
  };

  fastify.post("/users/:id/preferences", handleSavePreferences);
  fastify.put("/users/:id/preferences", handleSavePreferences);

  // Obtener preferencias personales del operador
  fastify.get("/users/:id/preferences", async (request, reply) => {
    usersStore = loadUsersFromDisk();
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Operador no encontrado" });
    }

    return reply.send({
      success: true,
      data: user.preferences || {},
    });
  });
};
