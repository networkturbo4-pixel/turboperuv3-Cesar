import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { env } from "./config/env";

// Rutas de módulos
import { healthRoutes } from "./modules/health/health.routes";
import { plansRoutes } from "./modules/plans/plans.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { invoicesRoutes } from "./modules/invoices/invoices.routes";
import { networkRoutes } from "./modules/network/network.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { maintenanceRoutes } from "./modules/settings/maintenance.routes";
import { connectionsRoutes } from "./modules/settings/connections.routes";
import { rrhhRoutes, getCredentialHtmlByToken } from "./modules/rrhh/rrhh.routes";
import { tenantsRoutes } from "./modules/tenants/tenants.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { messagesRoutes } from "./modules/messages/messages.routes";
import { mapsRoutes } from "./modules/maps/maps.routes";
import { databaseRoutes } from "./modules/database/database.routes";
import { ogRoutes } from "./modules/og/og.routes";
import { resolveTenantFromRequest, injectOpenGraphHtml } from "./modules/og/og.service";
import { initializeTenantsSystem } from "./modules/tenants/tenants.service";

export async function buildApp() {
  // Inicializar y asegurar sistema de múltiples empresas (Multi-Tenant)
  initializeTenantsSystem();

  const fastify = Fastify({
    bodyLimit: 15 * 1024 * 1024, // 15 MB para subida de logos, favicons e iconos PWA
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
    disableRequestLogging: env.NODE_ENV === "production",
  });

  // Seguridad y CORS
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Permite cargar assets del dashboard embebido
  });

  await fastify.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Rutas directas de credencial digital pública (sin requerir autenticación)
  fastify.get("/credencial/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const host = req.headers.host || "localhost:3000";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    const html = getCredentialHtmlByToken(token, baseUrl);
    if (!html) {
      return reply.status(404).type("text/html; charset=utf-8").send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#fff; min-height:100vh;">
          <h1 style="color:#f43f5e;">Credencial No Encontrada</h1>
          <p style="color:#94a3b8;">El enlace del acta de personal no existe o ha sido revocado.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px;">Ir al Portal</a>
        </div>
      `);
    }
    return reply.type("text/html; charset=utf-8").send(html);
  });

  fastify.get("/rrhh/personal/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const host = req.headers.host || "localhost:3000";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    const html = getCredentialHtmlByToken(token, baseUrl);
    if (!html) {
      return reply.status(404).type("text/html; charset=utf-8").send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#fff; min-height:100vh;">
          <h1 style="color:#f43f5e;">Credencial No Encontrada</h1>
          <p style="color:#94a3b8;">El enlace del acta de personal no existe o ha sido revocado.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px;">Ir al Portal</a>
        </div>
      `);
    }
    return reply.type("text/html; charset=utf-8").send(html);
  });

  // Servir frontend estático y renderizado dinámico de Open Graph por Negocio
  const publicPath = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    // Función centralizada para inyectar Open Graph según el negocio solicitado
    const serveDynamicHtml = (req: any, reply: any, tenantSlug?: string) => {
      const indexPath = path.join(publicPath, "index.html");
      if (!fs.existsSync(indexPath)) {
        return reply.status(404).send("index.html not found");
      }
      const rawHtml = fs.readFileSync(indexPath, "utf-8");
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const baseUrl = `${proto}://${host}`;
      const currentUrl = `${baseUrl}${req.url}`;

      const tenant = resolveTenantFromRequest(req, tenantSlug);

      const processedHtml = injectOpenGraphHtml(rawHtml, tenant, currentUrl, baseUrl);
      return reply.type("text/html; charset=utf-8").send(processedHtml);
    };

    // 1. Ruta Raíz (ej: https://tudominio.com o https://tudominio.com/?tenant=celeris)
    fastify.get("/", async (req, reply) => {
      return serveDynamicHtml(req, reply);
    });

    fastify.get("/index.html", async (req, reply) => {
      return serveDynamicHtml(req, reply);
    });

    // 2. Ruta Amigable de Negocio Directa (ej: https://tudominio.com/t/celeris o /t/loanetwork)
    fastify.get("/t/:tenantSlug", async (req, reply) => {
      const { tenantSlug } = req.params as { tenantSlug: string };
      return serveDynamicHtml(req, reply, tenantSlug);
    });

    // 3. Servir assets estáticos (CSS, JS, iconos, imágenes)
    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: "/",
      index: false, // Desactivar index automático para que fastify.get("/") inyecte Open Graph
    });
  }

  // Registro de Rutas de la API
  await fastify.register(healthRoutes, { prefix: "/api" });
  await fastify.register(plansRoutes, { prefix: "/api" });
  await fastify.register(customersRoutes, { prefix: "/api" });
  await fastify.register(invoicesRoutes, { prefix: "/api" });
  await fastify.register(networkRoutes, { prefix: "/api" });
  await fastify.register(dashboardRoutes, { prefix: "/api" });
  await fastify.register(usersRoutes, { prefix: "/api" });
  await fastify.register(settingsRoutes, { prefix: "/api" });
  await fastify.register(rrhhRoutes, { prefix: "/api" });
  await fastify.register(tenantsRoutes, { prefix: "/api" });
  await fastify.register(ogRoutes, { prefix: "/api" });
  await fastify.register(maintenanceRoutes, { prefix: "/api" });
  await fastify.register(connectionsRoutes, { prefix: "/api" });
  await fastify.register(inventoryRoutes, { prefix: "/api" });
  await fastify.register(messagesRoutes, { prefix: "/api" });
  await fastify.register(mapsRoutes, { prefix: "/api" });
  await fastify.register(databaseRoutes, { prefix: "/api" });


  // Mensaje base de bienvenida para la API
  fastify.get("/api", async () => {
    return {
      name: "TurboNetwork Engine API",
      version: "1.0.0",
      status: "online",
      docs: "/api/health",
    };
  });

  return fastify;
}

// Inicialización del servidor
async function start() {
  try {
    const app = await buildApp();
    const port = Number(process.env.PORT) || env.PORT;
    const host = env.HOST;

    await app.listen({ port, host });
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│  ⚡ TurboNetwork SaaS Engine iniciado exitosamente          │
│                                                             │
│  - URL Local:     http://localhost:${port}                    │
│  - API Health:    http://localhost:${port}/api/health         │
│  - Modo:          ${env.NODE_ENV.toUpperCase()}                                  │
│  - Compatible:    cPanel (Passenger) & VPS (PM2/Docker)     │
└─────────────────────────────────────────────────────────────┘
    `);
  } catch (err) {
    console.error("❌ Error al arrancar el servidor:", err);
    process.exit(1);
  }
}

// Ejecutar si es el módulo principal
if (require.main === module) {
  start();
}
