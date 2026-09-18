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

export async function buildApp() {
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

  // Servir frontend estático si existe la carpeta public
  const publicPath = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: "/",
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
