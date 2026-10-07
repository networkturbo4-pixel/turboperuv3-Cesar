import fs from "fs";
import path from "path";
import { FastifyRequest } from "fastify";
import { Tenant, loadTenantsFromDisk } from "../tenants/tenants.service";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

/**
 * Escapar cadenas para atributos HTML
 */
function escapeHtmlAttr(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Resuelve el negocio/tenant a partir de la petición HTTP:
 * 1. Parámetro query: ?tenant=slug o ?t=slug
 * 2. Parámetro de ruta: /t/:tenantSlug
 * 3. Subdominio: tenant.midominio.com (Host header)
 * 4. Fallback: primer tenant activo o 'turbonetwork'
 */
export function resolveTenantFromRequest(
  req: FastifyRequest<any>,
  tenantSlugOverride?: string
): Tenant {
  const tenants = loadTenantsFromDisk();
  const query = (req?.query as any) || {};
  const querySlug = (query.tenant || query.t || "").trim().toLowerCase();
  const paramSlug = (tenantSlugOverride || (req?.params as any)?.tenantSlug || "").trim().toLowerCase();
  const headers = req?.headers || {};
  const host = (headers["x-forwarded-host"] || headers.host || "").toString().toLowerCase().split(":")[0];

  // 1. Por parámetro query (?tenant=... o ?t=...)
  if (querySlug) {
    const match = tenants.find((t) => t.id.toLowerCase() === querySlug || t.slug.toLowerCase() === querySlug);
    if (match) return match;
  }

  // 2. Por parámetro de ruta (/t/:tenantSlug)
  if (paramSlug) {
    const match = tenants.find((t) => t.id.toLowerCase() === paramSlug || t.slug.toLowerCase() === paramSlug);
    if (match) return match;
  }

  // 3. Por subdominio (ej: celeris.turbonetwork.pe -> slug: 'celeris')
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1") && host.includes(".")) {
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "www" && subdomain !== "app" && subdomain !== "api") {
      const match = tenants.find((t) => t.id.toLowerCase() === subdomain || t.slug.toLowerCase() === subdomain);
      if (match) return match;
    }
  }

  // 4. Fallback: Negocio principal o primer negocio activo
  const defaultTenant = tenants.find((t) => t.id === "turbonetwork") || tenants[0];
  return (
    defaultTenant || {
      id: "turbonetwork",
      name: "TurboNetwork Perú S.A.C.",
      tagline: "ISP Enterprise Core",
      slug: "turbonetwork",
      primaryColor: "#2563eb",
      accentColor: "#059669",
      active: true,
      createdAt: new Date().toISOString(),
    }
  );
}

/**
 * Obtiene el buffer y mime-type del logotipo del negocio para servirlo a WhatsApp/redes sociales
 */
export function getTenantLogoResponse(tenantSlugOrId: string): { buffer: Buffer; contentType: string } | null {
  const cleanId = (tenantSlugOrId || "").replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase();
  const tenants = loadTenantsFromDisk();
  const tenant = tenants.find((t) => t.id.toLowerCase() === cleanId || t.slug.toLowerCase() === cleanId);

  // Intentar extraer de logoUrl o faviconUrl (los negocios guardan aquí su logotipo en alta resolución)
  const imageSource = (tenant && (tenant.logoUrl || tenant.faviconUrl)) || "";

  if (imageSource.startsWith("data:image/")) {
    const parts = imageSource.split(",");
    const meta = parts[0];
    const base64Data = parts[1];
    let contentType = "image/png";

    if (meta.includes("image/jpeg") || meta.includes("image/jpg")) {
      contentType = "image/jpeg";
    } else if (meta.includes("image/webp")) {
      contentType = "image/webp";
    } else if (meta.includes("image/png")) {
      contentType = "image/png";
    }

    try {
      const buffer = Buffer.from(base64Data, "base64");
      return { buffer, contentType };
    } catch {
      // Fallback
    }
  }

  // Fallback al icono PWA oficial de 512x512
  const fallbackIconPath = path.join(PUBLIC_DIR, "icons", "icon-512.png");
  if (fs.existsSync(fallbackIconPath)) {
    try {
      const buffer = fs.readFileSync(fallbackIconPath);
      return { buffer, contentType: "image/png" };
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Inyecta las meta-etiquetas Open Graph oficiales (WhatsApp, Facebook, Twitter, Telegram, LinkedIn)
 * dinámicamente en el HTML para el negocio seleccionado.
 */
export function injectOpenGraphHtml(
  htmlTemplate: string,
  tenant: Tenant,
  currentUrl: string,
  baseUrl: string
): string {
  const siteName = tenant.name || "TurboNetwork";
  const tagline = tenant.tagline || "Plataforma ISP Enterprise";
  const title = `${siteName} • ${tagline}`;
  const description =
    tenant.address && tenant.phone
      ? `Servicios de Internet de alta velocidad en ${tenant.address}. Contáctanos al ${tenant.phone}. Portal de abonados, facturación y soporte.`
      : `Servicios de conectividad y fibra óptica de alta velocidad, portal de clientes, facturación electrónica y soporte técnico.`;

  // URL absoluta del logotipo del negocio optimizada para WhatsApp
  const logoUrl = `${baseUrl}/api/og/image/${encodeURIComponent(tenant.slug || tenant.id)}.png`;
  const primaryColor = tenant.primaryColor || "#1d4ed8";

  // Bloque de Meta Tags Open Graph dinámico
  const ogTags = `
  <!-- ======================================================== -->
  <!-- OPEN GRAPH DINÁMICO POR NEGOCIO (WHATSAPP & REDES)      -->
  <!-- Negocio: ${escapeHtmlAttr(tenant.name)} (${tenant.id})   -->
  <!-- ======================================================== -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtmlAttr(siteName)}">
  <meta property="og:title" content="${escapeHtmlAttr(title)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:url" content="${escapeHtmlAttr(currentUrl)}">
  <meta property="og:image" content="${escapeHtmlAttr(logoUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtmlAttr(logoUrl)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1200">
  <meta property="og:image:alt" content="Logotipo Oficial de ${escapeHtmlAttr(siteName)}">
  <meta property="og:locale" content="es_PE">

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtmlAttr(title)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="${escapeHtmlAttr(logoUrl)}">

  <!-- Parámetro de inicialización del negocio activo en cliente -->
  <script>window.__INITIAL_TENANT__ = "${tenant.id.replace(/"/g, "")}";</script>
  `;

  let result = htmlTemplate;

  // Actualizar <title>
  result = result.replace(
    /<title\b[^>]*>(.*?)<\/title>/i,
    `<title id="page-title">${escapeHtmlAttr(title)}</title>`
  );

  // Actualizar meta apple-mobile-web-app-title y application-name
  result = result.replace(
    /<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*">/i,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtmlAttr(siteName)}">`
  );
  result = result.replace(
    /<meta\s+name="application-name"\s+content="[^"]*">/i,
    `<meta name="application-name" content="${escapeHtmlAttr(siteName)}">`
  );
  result = result.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*">/i,
    `<meta name="theme-color" content="${escapeHtmlAttr(primaryColor)}">`
  );

  // Inyectar el bloque Open Graph justo antes del cierre de </head>
  if (result.includes("</head>")) {
    result = result.replace("</head>", `${ogTags}\n</head>`);
  } else {
    result = `${ogTags}\n${result}`;
  }

  return result;
}
