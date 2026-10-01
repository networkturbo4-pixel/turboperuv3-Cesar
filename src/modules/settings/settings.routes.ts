import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import {
  resolveTenantId,
  getTenantFilePath,
  loadTenantsFromDisk,
  saveTenantsToDisk,
} from "../tenants/tenants.service";

export interface BrandingSettings {
  systemName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  pwaIconUrl: string;
  primaryColor: string;
  accentColor: string;
  lightBgColor: string;
  darkBgColor: string;
  fontFamily: string;
  fontSizeScale: "compact" | "normal" | "comfortable" | "large";
  themeMode: "dark" | "light";
  currency?: string;
  globalCurrency?: string;
}

const defaultSettings: BrandingSettings = {
  systemName: "TurboNetwork",
  tagline: "ISP Enterprise Core",
  logoUrl: "",
  faviconUrl: "",
  pwaIconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=TurboNetPro",
  primaryColor: "#2563eb",
  accentColor: "#059669",
  lightBgColor: "#f8fafc",
  darkBgColor: "#090a0f",
  fontFamily: "inter",
  fontSizeScale: "normal",
  themeMode: "dark",
  currency: "PEN",
  globalCurrency: "PEN",
};

// Cargar desde disco de forma persistente para un tenant específico
function loadSettingsFromDisk(tenantId: string): BrandingSettings {
  try {
    const tenants = loadTenantsFromDisk();
    const curTenant = tenants.find((t) => t.id === tenantId);
    const tenantCurrency = curTenant?.globalCurrency || "PEN";

    const file = getTenantFilePath(tenantId, "branding.json");
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      const data = JSON.parse(content);
      return { ...defaultSettings, currency: tenantCurrency, globalCurrency: tenantCurrency, ...data };
    }
    return { ...defaultSettings, currency: tenantCurrency, globalCurrency: tenantCurrency };
  } catch (err) {
    console.warn(`Aviso: Inicializando configuraciones por defecto para ${tenantId}:`, err);
  }
  return defaultSettings;
}

function saveSettingsToDisk(tenantId: string, settings: BrandingSettings) {
  try {
    const file = getTenantFilePath(tenantId, "branding.json");
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), "utf-8");

    // Sincronizar también con la lista central de tenants.json
    const tenants = loadTenantsFromDisk();
    const tIndex = tenants.findIndex((t) => t.id === tenantId);
    if (tIndex !== -1) {
      tenants[tIndex].name = settings.systemName;
      tenants[tIndex].tagline = settings.tagline;
      tenants[tIndex].primaryColor = settings.primaryColor;
      tenants[tIndex].accentColor = settings.accentColor;
      tenants[tIndex].logoUrl = settings.logoUrl;
      tenants[tIndex].faviconUrl = settings.faviconUrl;
      if (settings.globalCurrency || settings.currency) {
        tenants[tIndex].globalCurrency = settings.globalCurrency || settings.currency || "PEN";
      }
      saveTenantsToDisk(tenants);
    }
  } catch (err) {
    console.error(`Error al persistir configuraciones en disco para ${tenantId}:`, err);
  }
}

const updateBrandingSchema = z.object({
  systemName: z.string().min(2).optional(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  pwaIconUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  lightBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  darkBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().optional(),
  fontSizeScale: z.enum(["compact", "normal", "comfortable", "large"]).optional(),
  themeMode: z.enum(["dark", "light"]).optional(),
  currency: z.string().optional(),
  globalCurrency: z.string().optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Obtener personalización actual del tenant activo
  fastify.get("/settings/branding", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const tenantSettings = loadSettingsFromDisk(tenantId);
    return reply.send({ success: true, tenantId, data: tenantSettings });
  });

  // Guardar personalización del tenant activo
  fastify.post("/settings/branding", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parse = updateBrandingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const current = loadSettingsFromDisk(tenantId);
    const updated = {
      ...current,
      ...parse.data,
    };

    saveSettingsToDisk(tenantId, updated);

    // Sincronizar en tenants.json para la lista de empresas del workspace dropdown
    try {
      const tenants = loadTenantsFromDisk();
      const t = tenants.find((x) => x.id === tenantId);
      if (t) {
        if (updated.systemName) t.name = updated.systemName;
        if (updated.tagline !== undefined) t.tagline = updated.tagline;
        if (updated.primaryColor) t.primaryColor = updated.primaryColor;
        if (updated.accentColor) t.accentColor = updated.accentColor;
        if (updated.logoUrl !== undefined) t.logoUrl = updated.logoUrl;
        if (updated.faviconUrl !== undefined) t.faviconUrl = updated.faviconUrl;
        saveTenantsToDisk(tenants);
      }
    } catch (err) {
      console.error("Error sincronizando tenants.json desde branding:", err);
    }

    return reply.send({
      success: true,
      tenantId,
      message: "Personalización y estilo de marca guardados exitosamente.",
      data: updated,
    });
  });
};
