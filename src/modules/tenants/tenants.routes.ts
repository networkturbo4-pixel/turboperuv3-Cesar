import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import {
  Tenant,
  loadTenantsFromDisk,
  saveTenantsToDisk,
  getTenantDataDir,
  getTenantFilePath,
  resolveTenantId,
} from "./tenants.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const createTenantSchema = z.object({
  name: z.string().min(2, "El nombre comercial debe tener al menos 2 caracteres"),
  tagline: z.string().optional().or(z.literal("")),
  slug: z.string().min(2, "El slug debe tener al menos 2 caracteres").regex(/^[a-z0-9_-]+$/, "El slug debe contener solo minúsculas, números y guiones sin espacios"),
  ruc: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("El correo electrónico no tiene un formato válido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  globalCurrency: z.string().default("PEN"),
  socialLinks: z
    .object({
      facebook: z.string().optional().or(z.literal("")),
      instagram: z.string().optional().or(z.literal("")),
      linkedin: z.string().optional().or(z.literal("")),
      tiktok: z.string().optional().or(z.literal("")),
      whatsapp: z.string().optional().or(z.literal("")),
    })
    .optional(),
  customFields: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  primaryColor: z.string().default("#2563eb"),
  accentColor: z.string().default("#059669"),
  logoUrl: z.string().optional().or(z.literal("")),
  faviconUrl: z.string().optional().or(z.literal("")),
  pwaIconUrl: z.string().optional().or(z.literal("")),
  assignedUserIds: z.array(z.number()).optional(),
});

const updateTenantSchema = createTenantSchema.partial();

function getUsersFromDisk(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveUsersToDisk(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users.json:", err);
  }
}

export const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Listar todas las empresas con metadatos y acceso
  fastify.get("/tenants", async (request, reply) => {
    const tenants = loadTenantsFromDisk();
    const users = getUsersFromDisk();

    // Obtener información del usuario solicitante (si viene en header o sesión)
    const requesterUserId = request.headers["x-user-id"]
      ? parseInt(request.headers["x-user-id"] as string, 10)
      : null;

    let isSuperAdmin = true; // Por defecto permitimos exploración si no hay usuario estricto
    let allowedTenants = ["*"];

    if (requesterUserId) {
      const u = users.find((x) => x.id === requesterUserId);
      if (u) {
        isSuperAdmin = !!u.isSuperAdmin;
        allowedTenants = u.allowedTenants || (u.isSuperAdmin ? ["*"] : ["turbonetwork"]);
      }
    }

    // Filtrar qué tenants ve el usuario
    const visibleTenants = tenants.map((t) => {
      const hasAccess =
        isSuperAdmin ||
        allowedTenants.includes("*") ||
        allowedTenants.includes(t.id);

      // Contar usuarios asignados a esta empresa
      const assignedUsersCount = users.filter(
        (u) => u.isSuperAdmin || (u.allowedTenants && (u.allowedTenants.includes("*") || u.allowedTenants.includes(t.id)))
      ).length;

      return {
        ...t,
        hasAccess,
        assignedUsersCount,
      };
    });

    return reply.send({
      success: true,
      count: visibleTenants.length,
      isSuperAdmin,
      data: visibleTenants,
    });
  });

  // 2. Obtener detalle de una empresa
  fastify.get("/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenants = loadTenantsFromDisk();
    const tenant = tenants.find((t) => t.id === id.toLowerCase());

    if (!tenant) {
      return reply.status(404).send({ success: false, message: "Empresa no encontrada" });
    }

    const users = getUsersFromDisk();
    const assignedUsers = users
      .filter((u) => u.isSuperAdmin || (u.allowedTenants && (u.allowedTenants.includes("*") || u.allowedTenants.includes(tenant.id))))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, roleName: u.roleName, isSuperAdmin: !!u.isSuperAdmin }));

    return reply.send({
      success: true,
      data: {
        ...tenant,
        assignedUsers,
      },
    });
  });

  // 3. Crear nueva empresa / ISP (Superadministrador)
  fastify.post("/tenants", async (request, reply) => {
    const parse = createTenantSchema.safeParse(request.body);
    if (!parse.success) {
      const firstIssue = parse.error.issues[0];
      const field = firstIssue ? firstIssue.path.join('.') : 'campo';
      const msg = firstIssue ? `${field}: ${firstIssue.message}` : "Datos de empresa inválidos";
      return reply.status(400).send({ success: false, message: msg, errors: parse.error.format() });
    }

    const tenants = loadTenantsFromDisk();
    const normalizedSlug = parse.data.slug.toLowerCase().trim();

    if (tenants.some((t) => t.id === normalizedSlug || t.slug === normalizedSlug)) {
      return reply.status(409).send({
        success: false,
        message: `Ya existe una empresa con el identificador '${normalizedSlug}'. Elige otro slug.`,
      });
    }

    const newTenant: Tenant = {
      id: normalizedSlug,
      name: parse.data.name.trim(),
      tagline: parse.data.tagline || "ISP Enterprise Core",
      slug: normalizedSlug,
      ruc: parse.data.ruc || "",
      phone: parse.data.phone || "",
      email: parse.data.email || "",
      address: parse.data.address || "",
      primaryColor: parse.data.primaryColor || "#2563eb",
      accentColor: parse.data.accentColor || "#059669",
      logoUrl: parse.data.logoUrl || "",
      faviconUrl: parse.data.faviconUrl || "",
      pwaIconUrl: parse.data.pwaIconUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${normalizedSlug}`,
      active: true,
      createdAt: new Date().toISOString(),
    };

    tenants.push(newTenant);
    saveTenantsToDisk(tenants);

    // Inicializar carpeta de datos para el nuevo tenant
    const tenantDir = getTenantDataDir(normalizedSlug);
    const brandingFile = path.join(tenantDir, "branding.json");
    fs.writeFileSync(
      brandingFile,
      JSON.stringify(
        {
          systemName: newTenant.name,
          tagline: newTenant.tagline,
          logoUrl: newTenant.logoUrl,
          faviconUrl: newTenant.faviconUrl,
          pwaIconUrl: newTenant.pwaIconUrl,
          primaryColor: newTenant.primaryColor,
          accentColor: newTenant.accentColor,
          lightBgColor: "#f8fafc",
          darkBgColor: "#090a0f",
          fontFamily: "inter",
          fontSizeScale: "normal",
          themeMode: "dark",
        },
        null,
        2
      ),
      "utf-8"
    );

    // Crear listas iniciales vacías o base para el nuevo tenant
    const customersFile = path.join(tenantDir, "customers.json");
    if (!fs.existsSync(customersFile)) {
      fs.writeFileSync(customersFile, JSON.stringify([], null, 2), "utf-8");
    }

    const servicesFile = path.join(tenantDir, "services.json");
    if (!fs.existsSync(servicesFile)) {
      fs.writeFileSync(
        servicesFile,
        JSON.stringify(
          [
            {
              id: 1,
              name: `Plan ${newTenant.name} Fibra 100M`,
              speed: "100 Mbps Simétrico",
              downloadSpeedMbps: 100,
              uploadSpeedMbps: 100,
              price: "50.00",
              billingCycle: "monthly",
              description: "Plan base de fibra óptica para nuevos clientes",
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          ],
          null,
          2
        ),
        "utf-8"
      );
    }

    // Asignar usuarios si se especificaron
    if (parse.data.assignedUserIds && parse.data.assignedUserIds.length > 0) {
      const users = getUsersFromDisk();
      for (const u of users) {
        if (parse.data.assignedUserIds.includes(u.id)) {
          if (!u.allowedTenants) u.allowedTenants = [];
          if (!u.allowedTenants.includes(normalizedSlug) && !u.allowedTenants.includes("*")) {
            u.allowedTenants.push(normalizedSlug);
          }
        }
      }
      saveUsersToDisk(users);
    }

    return reply.status(201).send({
      success: true,
      message: `Empresa '${newTenant.name}' creada exitosamente.`,
      data: newTenant,
    });
  });

  // 4. Actualizar empresa existente (Superadministrador)
  fastify.put("/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = updateTenantSchema.safeParse(request.body);
    if (!parse.success) {
      const firstIssue = parse.error.issues[0];
      const field = firstIssue ? firstIssue.path.join('.') : 'campo';
      const msg = firstIssue ? `${field}: ${firstIssue.message}` : "Datos de empresa inválidos";
      return reply.status(400).send({ success: false, message: msg, errors: parse.error.format() });
    }

    const tenants = loadTenantsFromDisk();
    const index = tenants.findIndex((t) => t.id === id.toLowerCase());

    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Empresa no encontrada" });
    }

    const current = tenants[index];
    const updatedCustomFields = parse.data.customFields !== undefined
      ? parse.data.customFields.map((cf, idx) => ({
          id: cf.id || `cf-${Date.now()}-${idx}`,
          label: cf.label,
          value: cf.value,
        }))
      : current.customFields;

    const updated: Tenant = {
      ...current,
      ...parse.data,
      customFields: updatedCustomFields,
      id: current.id, // ID inmutable
      slug: current.slug,
    };

    tenants[index] = updated;
    saveTenantsToDisk(tenants);

    // Actualizar también branding.json del tenant para sincronía inmediata
    const tenantDir = getTenantDataDir(current.id);
    const brandingFile = path.join(tenantDir, "branding.json");
    if (fs.existsSync(brandingFile)) {
      try {
        const raw = fs.readFileSync(brandingFile, "utf-8");
        const branding = JSON.parse(raw);
        if (updated.name) branding.systemName = updated.name;
        if (updated.tagline) branding.tagline = updated.tagline;
        if (updated.primaryColor) branding.primaryColor = updated.primaryColor;
        if (updated.accentColor) branding.accentColor = updated.accentColor;
        if (updated.logoUrl !== undefined) branding.logoUrl = updated.logoUrl;
        if (updated.faviconUrl !== undefined) branding.faviconUrl = updated.faviconUrl;
        fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2), "utf-8");
      } catch {}
    }

    // Actualizar asignación de usuarios si fue proporcionada
    if (parse.data.assignedUserIds !== undefined) {
      const users = getUsersFromDisk();
      for (const u of users) {
        if (u.isSuperAdmin) continue; // Superadmin siempre tiene acceso
        if (!u.allowedTenants) u.allowedTenants = [];
        const shouldHave = parse.data.assignedUserIds.includes(u.id);
        const has = u.allowedTenants.includes(current.id);
        if (shouldHave && !has) {
          u.allowedTenants.push(current.id);
        } else if (!shouldHave && has) {
          u.allowedTenants = u.allowedTenants.filter((tid: string) => tid !== current.id);
        }
      }
      saveUsersToDisk(users);
    }

    return reply.send({
      success: true,
      message: `Empresa '${updated.name}' actualizada exitosamente.`,
      data: updated,
    });
  });

  // 5. Eliminar empresa (Superadministrador, protege la empresa raíz)
  fastify.delete("/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const normalized = id.toLowerCase().trim();

    if (normalized === "turbonetwork") {
      return reply.status(400).send({
        success: false,
        message: "No es posible eliminar la empresa principal por defecto (TurboNetwork).",
      });
    }

    const tenants = loadTenantsFromDisk();
    const index = tenants.findIndex((t) => t.id === normalized);

    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Empresa no encontrada" });
    }

    const removed = tenants.splice(index, 1)[0];
    saveTenantsToDisk(tenants);

    // Remover este tenant de allowedTenants de todos los usuarios
    const users = getUsersFromDisk();
    for (const u of users) {
      if (u.allowedTenants) {
        u.allowedTenants = u.allowedTenants.filter((tid: string) => tid !== normalized);
      }
    }
    saveUsersToDisk(users);

    return reply.send({
      success: true,
      message: `Empresa '${removed.name}' eliminada correctamente.`,
      data: removed,
    });
  });
};
