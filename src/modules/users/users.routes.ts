import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface PermissionDefinition {
  id: string;
  name: string;
  category: "customers" | "billing" | "network" | "plans" | "users" | "system";
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

  // Red & Equipos
  { id: "network:view", name: "Ver Equipos de Red", category: "network", description: "Ver MikroTik, OLTs, switches y topología" },
  { id: "network:control", name: "Diagnosticar & Test", category: "network", description: "Probar conectividad y enviar comandos a equipos" },
  { id: "network:manage", name: "Alta de Equipos", category: "network", description: "Agregar o editar routers y OLTs" },

  // Planes
  { id: "plans:manage", name: "Administrar Planes", category: "plans", description: "Crear o modificar tarifas de ancho de banda" },

  // Usuarios y Roles
  { id: "users:view", name: "Ver Usuarios", category: "users", description: "Consultar equipo de trabajo y operadores" },
  { id: "users:manage", name: "Gestionar Usuarios y PIN", category: "users", description: "Crear operadores y reasignar PIN de 8 dígitos" },
  { id: "roles:manage", name: "Configurar Roles Granulares", category: "roles" as any, description: "Modificar matrices de permisos por rol" },

  // Sistema
  { id: "system:config", name: "Configuración Global", category: "system", description: "Parámetros del ISP, servidores y entorno" },
];

export interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
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
}

let rolesStore: Role[] = [
  {
    id: 1,
    name: "Superadministrador",
    slug: "superadmin",
    description: "Acceso ilimitado a todas las funciones del SaaS ISP",
    permissions: ALL_PERMISSIONS.map((p) => p.id),
  },
  {
    id: 2,
    name: "Administrador de Red / NOC",
    slug: "network_admin",
    description: "Gestión técnica de MikroTik, OLTs, topología y diagnóstico",
    permissions: [
      "customers:view",
      "network:view",
      "network:control",
      "network:manage",
      "plans:manage",
    ],
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
    ],
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
    ],
  },
];

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
});

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Autenticación por PIN de 8 dígitos
  fastify.post("/auth/pin-login", async (request, reply) => {
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

    const role = rolesStore.find((r) => r.id === user.roleId);

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
        },
        permissions: role?.permissions || [],
        token: `mock_jwt_session_${user.id}_${Date.now()}`,
      },
    });
  });

  // Catálogo maestro de permisos disponibles
  fastify.get("/permissions", async (_request, reply) => {
    return reply.send({ success: true, data: ALL_PERMISSIONS });
  });

  // Listar todos los roles y su matriz de permisos
  fastify.get("/roles", async (_request, reply) => {
    return reply.send({ success: true, data: rolesStore });
  });

  // Crear nuevo rol con matriz personalizada
  fastify.post("/roles", async (request, reply) => {
    const parse = createRoleSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const newRole: Role = {
      id: Date.now(), // ID único garantizado
      name: parse.data.name,
      slug: parse.data.name.toLowerCase().replace(/\s+/g, "_"),
      description: parse.data.description || "Rol personalizado del sistema",
      permissions: parse.data.permissions,
    };
    rolesStore.push(newRole);
    saveRolesToDisk();

    return reply.status(201).send({ success: true, data: newRole });
  });

  // Actualizar rol existente (nombre, descripción y permisos)
  fastify.put("/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);
    const body = request.body as { name?: string; description?: string; permissions?: string[] };

    const role = rolesStore.find((r) => r.id === roleId);
    if (!role) {
      return reply.status(404).send({ success: false, message: "Rol no encontrado" });
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

    saveRolesToDisk();
    return reply.send({ success: true, message: "Rol actualizado correctamente", data: role });
  });

  // Eliminar rol
  fastify.delete("/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const roleId = parseInt(id, 10);

    if (roleId === 1) {
      return reply.status(403).send({ success: false, message: "No es posible eliminar el rol Superadministrador del sistema" });
    }

    const index = rolesStore.findIndex((r) => r.id === roleId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Rol no encontrado" });
    }

    const hasAssignedUsers = usersStore.some((u) => u.roleId === roleId);
    if (hasAssignedUsers) {
      return reply.status(400).send({ 
        success: false, 
        message: "No se puede eliminar este rol porque tiene operadores asignados. Reasigne los operadores primero." 
      });
    }

    const deleted = rolesStore.splice(index, 1)[0];
    saveRolesToDisk();

    return reply.send({ success: true, message: "Rol eliminado exitosamente", data: deleted });
  });

  // Listar usuarios
  fastify.get("/users", async (_request, reply) => {
    const sanitized = usersStore.map(({ pin, ...safeUser }) => ({
      ...safeUser,
      pinMasked: "••••••••",
    }));
    return reply.send({ success: true, count: sanitized.length, data: sanitized });
  });

  // Registrar nuevo usuario con rol y PIN de 8 dígitos
  fastify.post("/users", async (request, reply) => {
    const parse = createUserSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const role = rolesStore.find((r) => r.id === parse.data.roleId);
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
      id: usersStore.length + 1,
      name: parse.data.name,
      email: parse.data.email,
      pin: parse.data.pin,
      roleId: role.id,
      roleName: role.name,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(parse.data.name)}`,
      isActive: true,
      createdAt: new Date().toISOString(),
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
};
