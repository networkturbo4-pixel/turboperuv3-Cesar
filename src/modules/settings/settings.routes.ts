import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

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

let currentSettings: BrandingSettings = {
  systemName: "TurboNetwork",
  tagline: "ISP Core Engine",
  logoUrl: "", // Si está vacío usa el isotipo SVG por defecto
  faviconUrl: "",
  pwaIconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=TurboPWA",
  primaryColor: "#0071e3",
  accentColor: "#30d158",
  lightBgColor: "#f5f5f7",
  darkBgColor: "#0b0c10",
  fontFamily: "apple", // "apple" | "jakarta" | "inter" | "outfit" | "poppins"
  fontSizeScale: "normal",
  themeMode: "dark",
};

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

  // Guardar personalización global
  fastify.post("/settings/branding", async (request, reply) => {
    const parse = updateBrandingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    currentSettings = {
      ...currentSettings,
      ...parse.data,
    };

    return reply.send({
      success: true,
      message: "Personalización y estilo de marca guardados exitosamente.",
      data: currentSettings,
    });
  });
};
