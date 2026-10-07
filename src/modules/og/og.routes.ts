import { FastifyPluginAsync } from "fastify";
import { getTenantLogoResponse, resolveTenantFromRequest } from "./og.service";
import { loadTenantsFromDisk } from "../tenants/tenants.service";

export const ogRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Endpoint de imagen para WhatsApp y redes sociales:
   * GET /api/og/image/:tenantSlug
   * Ejemplo: /api/og/image/celeris.png o /api/og/image/loanetwork
   * Devuelve directamente el archivo binario PNG/JPEG con cabeceras de caché óptimas.
   */
  fastify.get("/og/image/:tenantSlug", async (request, reply) => {
    const { tenantSlug } = request.params as { tenantSlug: string };
    const logoData = getTenantLogoResponse(tenantSlug);

    if (!logoData) {
      return reply.status(404).send({ error: "Logotipo no encontrado para este negocio" });
    }

    return reply
      .type(logoData.contentType)
      .header("Cache-Control", "public, max-age=86400, s-maxage=86400")
      .header("Access-Control-Allow-Origin", "*")
      .send(logoData.buffer);
  });

  /**
   * Endpoint de inspección de metadatos Open Graph (para depuración y validación)
   */
  fastify.get("/og/preview/:tenantSlug", async (request, reply) => {
    const { tenantSlug } = request.params as { tenantSlug: string };
    const tenants = loadTenantsFromDisk();
    const cleanId = (tenantSlug || "").replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase();
    const tenant = tenants.find((t) => t.id.toLowerCase() === cleanId || t.slug.toLowerCase() === cleanId);

    if (!tenant) {
      return reply.status(404).send({ success: false, message: "Negocio no encontrado" });
    }

    const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost:3000";
    const proto = request.headers["x-forwarded-proto"] || request.protocol || "http";
    const baseUrl = `${proto}://${host}`;
    const logoUrl = `${baseUrl}/api/og/image/${encodeURIComponent(tenant.slug || tenant.id)}.png`;

    return reply.send({
      success: true,
      business: {
        id: tenant.id,
        name: tenant.name,
        tagline: tenant.tagline,
        primaryColor: tenant.primaryColor,
      },
      openGraph: {
        "og:site_name": tenant.name,
        "og:title": `${tenant.name} • ${tenant.tagline || "Plataforma ISP"}`,
        "og:description": `Servicios de conectividad y fibra óptica de alta velocidad, portal de clientes y soporte técnico.`,
        "og:url": `${baseUrl}/?tenant=${tenant.slug}`,
        "og:image": logoUrl,
        "og:image:type": "image/png",
        "og:image:width": 1200,
        "og:image:height": 1200,
        "twitter:card": "summary",
        "twitter:image": logoUrl,
      },
      directShareUrl: `${baseUrl}/?tenant=${tenant.slug}`,
      vanityShareUrl: `${baseUrl}/t/${tenant.slug}`,
    });
  });
};
