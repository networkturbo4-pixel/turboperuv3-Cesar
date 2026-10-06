import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { resolveTenantId, getTenantFilePath, getTenantDataDir } from "../tenants/tenants.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface PermissionDefinition {
  id: string;
  name: string;
  category: "customers" | "billing" | "network" | "plans" | "inventory" | "backpack" | "rrhh" | "messages" | "users" | "roles" | "system";
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
  name: string;
  email: string;
  pin: string; // 8 dígitos
  roleId: number;
  roleName: string;
  avatar: string;
  isActive: boolean;
  createdAt: string;
  isSuperAdmin?: boolean;
  assignedTenantId?: string;
  allowedTenants?: string[];
  workSchedule?: string;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  hireDate?: string;
  birthDate?: string;
  preferences?: Record<string, any>;
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
        return list.map(r => ({
          ...r,
          allowedModules: Array.isArray(r.allowedModules) && r.allowedModules.length > 0
            ? r.allowedModules
            : [...ALL_MODULE_IDS]
        }));
      }
    }
  } catch (err) {}

  // Fallback / inicialización por tenant
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
      }
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
      }
    ];
  } else if (fs.existsSync(ROLES_FILE)) {
    try {
      const rawGlobal = fs.readFileSync(ROLES_FILE, "utf-8");
      const parsedGlobal = JSON.parse(rawGlobal);
      if (Array.isArray(parsedGlobal) && parsedGlobal.length > 0) {
        initialRoles = parsedGlobal.map(r => ({
          ...r,
          allowedModules: Array.isArray(r.allowedModules) && r.allowedModules.length > 0 ? r.allowedModules : [...ALL_MODULE_IDS]
        }));
      }
    } catch (e) {}
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
    pin: "12345678",
    roleId: 1,
    roleName: "Superadministrador",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: "2026-09-01T00:00:00Z",
    isSuperAdmin: true,
    allowedTenants: ["*"],
    workSchedule: "08:00 - 17:00",
    preferences: {},
  },
  {
    id: 2,
    name: "Ing. Alejandro Torres",
    email: "alejandro.redes@turbonetwork.com",
    pin: "87654321",
    roleId: 2,
    roleName: "Administrador de Red / NOC",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: "2026-09-05T00:00:00Z",
    isSuperAdmin: false,
    allowedTenants: ["turbonetwork", "loanetwork"],
    workSchedule: "08:30 - 17:30",
    preferences: {},
  },
  {
    id: 3,
    name: "Ana Morales",
    email: "ana.caja@turbonetwork.com",
    pin: "11223344",
    roleId: 3,
    roleName: "Cajero / Cobranzas",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: "2026-09-10T00:00:00Z",
    isSuperAdmin: false,
    allowedTenants: ["turbonetwork"],
    workSchedule: "08:00 - 16:30",
    preferences: {},
  },
];

// Cargar roles y usuarios persistidos si existen
function loadRolesFromDisk(): Role[] {
  try {
    if (fs.existsSync(ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(ROLES_FILE, "utf-8"));
    }
  } catch (err) {}
  return rolesStore;
}

function saveRolesToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ROLES_FILE, JSON.stringify(rolesStore, null, 2), "utf-8");
  } catch (err) {}
}

function loadUsersFromDisk(): SystemUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    }
  } catch (err) {}
  return usersStore;
}

function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2), "utf-8");
  } catch (err) {}
}

rolesStore = loadRolesFromDisk();
usersStore = loadUsersFromDisk();
if (!fs.existsSync(ROLES_FILE)) saveRolesToDisk();
if (!fs.existsSync(USERS_FILE)) saveUsersToDisk();

const pinLoginSchema = z.object({
  pin: z.string().length(8, "El PIN debe contener exactamente 8 dígitos").regex(/^\d{8}$/, "Solo dígitos numéricos"),
});

const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  pin: z.string().length(8).regex(/^\d{8}$/),
  roleId: z.number().int().positive(),
  workSchedule: z.string().nullable().optional(),
  scheduleStartDate: z.string().nullable().optional(),
  scheduleEndDate: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  assignedTenantId: z.string().nullable().optional(),
  allowedTenants: z.array(z.string()).nullable().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  avatar: z.string().nullable().optional(),
  pin: z.string().length(8).regex(/^\d{8}$/).optional(),
  roleId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  workSchedule: z.string().nullable().optional(),
  scheduleStartDate: z.string().nullable().optional(),
  scheduleEndDate: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  assignedTenantId: z.string().nullable().optional(),
  allowedTenants: z.array(z.string()).nullable().optional(),
  preferences: z.record(z.any()).optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  allowedModules: z.array(z.string()).optional(),
});

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Autenticación por PIN de 8 dígitos
  fastify.post("/auth/pin-login", async (request, reply) => {
    // Recargar usuarios desde disco para asegurar que cambios recientes estén disponibles
    usersStore = loadUsersFromDisk();

    const parse = pinLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "El PIN debe ser exactamente de 8 dígitos numéricos" });
    }

    const { pin } = parse.data;
    const user = usersStore.find((u) => u.pin === pin && u.isActive);

    if (!user) {
      return reply.status(401).send({
        success: false,
        message: "PIN no válido o usuario inactivo. Intente nuevamente.",
      });
    }

    const assignedTenant = user.assignedTenantId || (user.allowedTenants && user.allowedTenants[0] !== "*" ? user.allowedTenants[0] : "turbonetwork");
    const tenantRoles = loadRolesForTenant(assignedTenant);
    const role = tenantRoles.find((r) => r.id === user.roleId) || rolesStore.find((r) => r.id === user.roleId);

    const userPermissions = user.isSuperAdmin ? ALL_PERMISSIONS.map((p) => p.id) : (role?.permissions || []);
    const userAllowedModules = user.isSuperAdmin ? [...ALL_MODULE_IDS] : (role?.allowedModules || [...ALL_MODULE_IDS]);

    return reply.send({
      success: true,
      message: `¡Bienvenido de nuevo, ${user.name}!`,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          roleName: user.roleName,
          avatar: user.avatar,
          isSuperAdmin: !!user.isSuperAdmin,
          assignedTenantId: assignedTenant,
          allowedTenants: (user.allowedTenants || (user.isSuperAdmin ? ["*"] : [assignedTenant])).filter(Boolean),
          workSchedule: user.workSchedule || "08:00 - 17:00",
          scheduleStartDate: user.scheduleStartDate || "",
          scheduleEndDate: user.scheduleEndDate || "",
          hireDate: user.hireDate || "",
          birthDate: user.birthDate || "",
          preferences: user.preferences || {},
          permissions: userPermissions,
          allowedModules: userAllowedModules,
        },
        permissions: userPermissions,
        token: `mock_jwt_session_${user.id}_${Date.now()}`,
      },
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
      allowedModules: Array.isArray(parse.data.allowedModules) && parse.data.allowedModules.length > 0
        ? parse.data.allowedModules
        : [...ALL_MODULE_IDS],
    };
    roles.push(newRole);
    saveRolesForTenant(tenantId, roles);

    return reply.status(201).send({ success: true, tenantId, data: newRole });
  });

  // Actualizar rol existente en la empresa activa
  fastify.put("/roles/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);
    const body = request.body as { name?: string; description?: string; permissions?: string[]; allowedModules?: string[] };

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
    return reply.send({ success: true, tenantId, message: "Rol actualizado correctamente", data: role });
  });

  // Eliminar rol en la empresa activa
  fastify.delete("/roles/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);

    if (roleId === 1) {
      return reply.status(403).send({ success: false, message: "No es posible eliminar el rol Superadministrador del sistema" });
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
        message: "No se puede eliminar este rol porque tiene operadores asignados en esta empresa. Reasigne los operadores primero." 
      });
    }

    const deleted = roles.splice(index, 1)[0];
    saveRolesForTenant(tenantId, roles);

    return reply.send({ success: true, tenantId, message: "Rol eliminado exitosamente", data: deleted });
  });

  // Listar usuarios con horario, preferencias y estado
  fastify.get("/users", async (_request, reply) => {
    usersStore = loadUsersFromDisk();
    const sanitized = usersStore.map(({ pin, ...safeUser }) => ({
      ...safeUser,
      workSchedule: safeUser.workSchedule || "08:00 - 17:00",
      scheduleStartDate: safeUser.scheduleStartDate || "",
      scheduleEndDate: safeUser.scheduleEndDate || "",
      preferences: safeUser.preferences || {},
      pinMasked: "••••••••",
    }));
    return reply.send({ success: true, count: sanitized.length, data: sanitized });
  });

  // Registrar nuevo usuario con rol, PIN de 8 dígitos y horario
  fastify.post("/users", async (request, reply) => {
    const parse = createUserSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const targetTenant = parse.data.assignedTenantId || (parse.data.allowedTenants && parse.data.allowedTenants[0]) || resolveTenantId(request);
    const tenantRoles = loadRolesForTenant(targetTenant);
    const role = tenantRoles.find((r) => r.id === parse.data.roleId) || rolesStore.find((r) => r.id === parse.data.roleId);
    if (!role) {
      return reply.status(400).send({ success: false, message: "El rol especificado no existe" });
    }

    // Comprobar email duplicado
    if (usersStore.some((u) => u.email.toLowerCase() === parse.data.email.toLowerCase())) {
      return reply.status(400).send({ success: false, message: "Ya existe un usuario con este correo" });
    }

    // Comprobar PIN duplicado para evitar colisiones
    if (usersStore.some((u) => u.pin === parse.data.pin)) {
      return reply.status(400).send({ success: false, message: "Este PIN ya está asignado a otro operador" });
    }

    const newUser: SystemUser = {
      id: Date.now(),
      name: parse.data.name,
      email: parse.data.email,
      pin: parse.data.pin,
      roleId: role.id,
      roleName: role.name,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(parse.data.name)}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      isSuperAdmin: false,
      assignedTenantId: parse.data.assignedTenantId || (parse.data.allowedTenants && parse.data.allowedTenants[0]) || "turbonetwork",
      allowedTenants: parse.data.allowedTenants || (parse.data.assignedTenantId ? [parse.data.assignedTenantId] : ["turbonetwork"]),
      workSchedule: parse.data.workSchedule || "08:00 - 17:00",
      scheduleStartDate: parse.data.scheduleStartDate || "",
      scheduleEndDate: parse.data.scheduleEndDate || "",
      hireDate: parse.data.hireDate || "",
      birthDate: parse.data.birthDate || "",
      preferences: {},
    };

    usersStore.push(newUser);
    saveUsersToDisk();

    const { pin, ...safeUser } = newUser;
    return reply.status(201).send({
      success: true,
      message: "Usuario registrado con PIN de 8 dígitos.",
      data: { ...safeUser, pinMasked: "••••••••" },
    });
  });

  // Actualizar usuario existente (nombre, email, horario, rol, etc.)
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
    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email;
    if (data.avatar) user.avatar = data.avatar;
    if (data.pin) user.pin = data.pin;
    if (data.roleId) {
      user.roleId = data.roleId;
      const targetTenant = user.assignedTenantId || resolveTenantId(request);
      const tenantRoles = loadRolesForTenant(targetTenant);
      const role = tenantRoles.find((r) => r.id === data.roleId) || rolesStore.find((r) => r.id === data.roleId);
      if (role) user.roleName = role.name;
    }
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.workSchedule !== undefined) user.workSchedule = data.workSchedule;
    if (data.scheduleStartDate !== undefined) user.scheduleStartDate = data.scheduleStartDate;
    if (data.scheduleEndDate !== undefined) user.scheduleEndDate = data.scheduleEndDate;
    if (data.hireDate !== undefined) user.hireDate = data.hireDate;
    if (data.birthDate !== undefined) user.birthDate = data.birthDate;
    if (data.assignedTenantId !== undefined) {
      user.assignedTenantId = data.assignedTenantId;
      if (!user.allowedTenants) user.allowedTenants = [];
      if (data.assignedTenantId && !user.allowedTenants.includes(data.assignedTenantId) && !user.allowedTenants.includes("*")) {
        user.allowedTenants.push(data.assignedTenantId);
      }
    }
    if (data.allowedTenants !== undefined) {
      user.allowedTenants = Array.isArray(data.allowedTenants) ? data.allowedTenants.filter(Boolean) : [];
    }
    if (user.allowedTenants) {
      user.allowedTenants = user.allowedTenants.filter(Boolean);
    }
    if (data.preferences !== undefined) user.preferences = { ...(user.preferences || {}), ...data.preferences };

    saveUsersToDisk();

    const { pin, ...safeUser } = user;
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
    const user = usersStore.find((u) => u.id === id);
    if (!user) {
      return reply.status(404).send({ success: false, message: "Usuario no encontrado" });
    }

    // Comprobar colisión de correo/usuario
    const duplicate = usersStore.find((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase());
    if (duplicate) {
      return reply.status(400).send({ success: false, message: "Este usuario o correo ya está en uso por otro operador" });
    }

    user.name = name;
    user.email = email;
    if (avatar) user.avatar = avatar;
    if (pin) user.pin = pin;

    saveUsersToDisk();

    const { pin: _, ...safeUser } = user;
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

    usersStore.splice(idx, 1);
    saveUsersToDisk();

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
