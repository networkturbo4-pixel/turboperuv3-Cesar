import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { MobilePushService } from "./push.service";

export interface TechnicianTelemetryRecord {
  userId: number;
  userName: string;
  roleName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMoving?: boolean;
  source: "background_gps" | "foreground_gps";
  updatedAt: string;
}

export interface NearbyCheckinRecord {
  id: string;
  userId: number;
  userName: string;
  beaconId: string;
  beaconName: string;
  zoneType: "warehouse" | "vehicle" | "office" | "nap" | "other";
  rssi?: number;
  latitude?: number;
  longitude?: number;
  detectedAt: string;
}

function loadJsonArray<T>(tenantId: string, filename: string): T[] {
  const filePath = getTenantFilePath(tenantId, filename);
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveJsonArray<T>(tenantId: string, filename: string, data: T[]): void {
  const filePath = getTenantFilePath(tenantId, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function mobileRoutes(fastify: FastifyInstance) {
  // 1. Registrar token FCM del dispositivo móvil
  fastify.post("/push/register", async (request, reply) => {
    const schema = z.object({
      fcmToken: z.string().min(10),
      platform: z.enum(["android", "ios", "web"]).default("android"),
      deviceName: z.string().optional(),
      appVersion: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Token FCM inválido" });
    }

    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    const device = MobilePushService.registerDevice(tenantId, {
      userId: user.sub,
      userName: user.name,
      platform: parsed.data.platform,
      fcmToken: parsed.data.fcmToken,
      deviceName: parsed.data.deviceName,
      appVersion: parsed.data.appVersion,
    });

    return { success: true, data: device };
  });

  // 2. Eliminar registro de token FCM (logout)
  fastify.delete("/push/register", async (request, reply) => {
    const schema = z.object({ fcmToken: z.string().min(10) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Token FCM requerido" });
    }
    const tenantId = resolveTenantId(request);
    const removed = MobilePushService.unregisterDevice(tenantId, parsed.data.fcmToken);
    return { success: true, removed };
  });

  // 3. Enviar notificación push de prueba al usuario actual
  fastify.post("/push/test", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    const result = await MobilePushService.sendToUser(tenantId, user.sub, {
      title: "TurboNetwork • Prueba Nativa",
      body: "Las notificaciones en tiempo real están activas en tu dispositivo.",
      channelId: "turbo_general",
      url: "/tech",
    });

    return { success: true, data: result };
  });

  // 4. Recibir coordenadas GPS en segundo plano (Foreground Service Android)
  fastify.post("/telemetry/location", async (request, reply) => {
    const schema = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().optional(),
      speed: z.number().optional(),
      heading: z.number().optional(),
      batteryLevel: z.number().optional(),
      isMoving: z.boolean().optional(),
      source: z.enum(["background_gps", "foreground_gps"]).default("background_gps"),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Coordenadas GPS inválidas" });
    }

    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    const locations = loadJsonArray<TechnicianTelemetryRecord>(tenantId, "mobile_telemetry.json");
    const now = new Date().toISOString();
    const nextRecord: TechnicianTelemetryRecord = {
      userId: user.sub,
      userName: user.name,
      roleName: user.roleName,
      ...parsed.data,
      updatedAt: now,
    };

    const idx = locations.findIndex((l) => l.userId === user.sub);
    if (idx >= 0) {
      locations[idx] = nextRecord;
    } else {
      locations.unshift(nextRecord);
    }

    saveJsonArray(tenantId, "mobile_telemetry.json", locations);
    return { success: true, data: nextRecord };
  });

  // 5. Consultar última ubicación en vivo de técnicos/cuadrillas (para operaciones.html)
  fastify.get("/telemetry/locations", async (request) => {
    const tenantId = resolveTenantId(request);
    const locations = loadJsonArray<TechnicianTelemetryRecord>(tenantId, "mobile_telemetry.json");
    return { success: true, data: locations };
  });

  // 6. Registrar detección de dispositivo cercano / Beacon BLE (almacén, vehículo, oficina)
  fastify.post("/nearby/checkin", async (request, reply) => {
    const schema = z.object({
      beaconId: z.string().min(1),
      beaconName: z.string().min(1),
      zoneType: z.enum(["warehouse", "vehicle", "office", "nap", "other"]).default("other"),
      rssi: z.number().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Datos de beacon inválidos" });
    }

    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    const checkins = loadJsonArray<NearbyCheckinRecord>(tenantId, "mobile_nearby_checkins.json");
    const entry: NearbyCheckinRecord = {
      id: "nb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      userId: user.sub,
      userName: user.name,
      ...parsed.data,
      detectedAt: new Date().toISOString(),
    };
    checkins.unshift(entry);
    // Conservar los últimos 500 registros de proximidad por tenant
    saveJsonArray(tenantId, "mobile_nearby_checkins.json", checkins.slice(0, 500));

    return { success: true, data: entry };
  });

  // 7. Versión actual de APK para auto-actualización in-app
  fastify.get("/version", async () => {
    return {
      success: true,
      data: {
        version: "1.0.0",
        versionCode: 1,
        minSupportedVersion: "1.0.0",
        apkUrl: "/downloads/turbonetwork-latest.apk",
        releaseNotes: "Versión inicial nativa Android con Push FCM, GPS en segundo plano y Dispositivos Cercanos.",
      },
    };
  });
}
