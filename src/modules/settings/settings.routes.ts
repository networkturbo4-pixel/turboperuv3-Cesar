import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";

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
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "branding_settings.json");

let currentSettings: BrandingSettings = {
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
};

// Cargar desde disco de forma persistente
function loadSettingsFromDisk(): BrandingSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const data = JSON.parse(content);
      return { ...currentSettings, ...data };
    }
  } catch (err) {
    console.warn("Aviso: Inicializando configuraciones por defecto:", err);
  }
  return currentSettings;
}

function saveSettingsToDisk(settings: BrandingSettings) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al persistir configuraciones en disco:", err);
  }
}

// Inicializar configuraciones guardadas
currentSettings = loadSettingsFromDisk();

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
});

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Obtener personalización actual
  fastify.get("/settings/branding", async (_request, reply) => {
    return reply.send({ success: true, data: currentSettings });
  });

  // Guardar personalización global y persistir en disco
  fastify.post("/settings/branding", async (request, reply) => {
    const parse = updateBrandingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    currentSettings = {
      ...currentSettings,
      ...parse.data,
    };

    saveSettingsToDisk(currentSettings);

    return reply.send({
      success: true,
      message: "Personalización y estilo de marca guardados exitosamente.",
      data: currentSettings,
    });
  });
};
