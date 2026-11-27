import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveTenantId } from "../tenants/tenants.service";
import { MobilePushService } from "./push.service";
import {
  loadJsonArray,
  saveJsonArray,
  registerOrTouchDevice,
  listMobileDevices,
  updateDeviceStatus,
  recordTechnicianLocation,
  getLiveLocations,
  getTelemetryHistory,
  subscribeTelemetryStream,
} from "./telemetry.service";

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

function resolveClientIp(request: any): string {
  const fwd = request.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return String(request.ip || "");
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

  // 3b. Registrar/vincular dispositivo del técnico (Device Binding Fase 1)
  fastify.post("/devices/register", async (request, reply) => {
    const schema = z.object({
      deviceId: z.string().min(6).max(120),
      platform: z.enum(["android", "ios", "web"]).default("android"),
      deviceModel: z.string().max(120).optional(),
      appVersion: z.string().max(40).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "deviceId inválido" });
    }

    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    const result = registerOrTouchDevice(tenantId, {
      deviceId: parsed.data.deviceId,
      userId: user.sub,
      userName: user.name,
      roleName: user.roleName,
      platform: parsed.data.platform,
      deviceModel: parsed.data.deviceModel,
      appVersion: parsed.data.appVersion,
      lastIp: resolveClientIp(request),
    });

    return {
      success: true,
      data: result.device,
      isNew: result.isNew,
      requiresApproval: result.requiresApproval,
    };
  });

  // 3c. Listar dispositivos vinculados del tenant (para Operaciones / Supervisores)
  fastify.get("/devices", async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }
    const tenantId = resolveTenantId(request);
    return { success: true, data: listMobileDevices(tenantId) };
  });

  // 3d. Aprobar o revocar dispositivo de un técnico
  fastify.patch<{ Params: { deviceId: string } }>("/devices/:deviceId", async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }
    const perms = new Set(user.permissions || []);
    const canManage =
      user.isSuperAdmin ||
      user.roleId === 1 ||
      perms.has("ops:crews_manage") ||
      perms.has("users:manage") ||
      perms.has("system:config");
    if (!canManage) {
      return reply.status(403).send({ success: false, message: "No tienes permiso para autorizar o revocar dispositivos." });
    }

    const schema = z.object({
      status: z.enum(["authorized", "pending", "revoked"]),
      revokeOthersForUser: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Estado de dispositivo inválido" });
    }

    const tenantId = resolveTenantId(request);
    const updated = updateDeviceStatus(
      tenantId,
      request.params.deviceId,
      parsed.data.status,
      user.name,
      Boolean(parsed.data.revokeOthersForUser)
    );
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Dispositivo no encontrado" });
    }
    return { success: true, data: updated };
  });

  // 4. Recibir coordenadas GPS en tiempo real (APK Foreground Service o Fallback PWA)
  fastify.post("/telemetry/location", async (request, reply) => {
    const schema = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().optional(),
      speed: z.number().optional(),
      heading: z.number().optional(),
      batteryLevel: z.number().min(0).max(100).optional(),
      isMoving: z.boolean().optional(),
      deviceId: z.string().min(6).max(120).optional(),
      platform: z.enum(["android", "ios", "web"]).optional(),
      deviceModel: z.string().max(120).optional(),
      source: z.enum(["background_gps", "foreground_gps", "pwa_gps", "teltonika"]).default("background_gps"),
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

    const result = recordTechnicianLocation(tenantId, {
      userId: user.sub,
      userName: user.name,
      roleName: user.roleName,
      ...parsed.data,
      lastIp: resolveClientIp(request),
    });

    if (result.blocked) {
      return reply.status(403).send({
        success: false,
        code: "DEVICE_NOT_AUTHORIZED",
        deviceStatus: result.deviceStatus,
        message:
          result.deviceStatus === "pending"
            ? "Este segundo celular requiere aprobación del administrador en Operaciones."
            : "Este dispositivo fue revocado por el administrador.",
      });
    }

    return { success: true, data: result.record, deviceStatus: result.deviceStatus };
  });

  // 5. Consultar última ubicación en vivo de técnicos/cuadrillas (para operaciones.html)
  fastify.get("/telemetry/locations", async (request) => {
    const tenantId = resolveTenantId(request);
    const locations = getLiveLocations(tenantId);
    return { success: true, data: locations };
  });

  // 5b. Consultar recorrido del día (breadcrumbs) por técnico o cuadrilla
  fastify.get("/telemetry/history", async (request) => {
    const tenantId = resolveTenantId(request);
    const query = (request.query || {}) as { userId?: string; crewId?: string; date?: string };
    const points = getTelemetryHistory(tenantId, {
      userId: query.userId ? Number(query.userId) : undefined,
      crewId: query.crewId || undefined,
      date: query.date || undefined,
    });
    return { success: true, data: points };
  });

  // 5c. Stream SSE en tiempo real para mapa tipo Uber/inDrive
  fastify.get("/telemetry/stream", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ success: false, message: "Sesión requerida" });
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const writeEvent = (event: string, data: unknown) => {
      try {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        // ignore closed socket
      }
    };

    // Snapshot inicial
    writeEvent("snapshot", {
      locations: getLiveLocations(tenantId),
      devices: listMobileDevices(tenantId),
      ts: new Date().toISOString(),
    });

    const unsubscribe = subscribeTelemetryStream(tenantId, (event, data) => {
      writeEvent(event, data);
    });

    const heartbeat = setInterval(() => {
      try {
        raw.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        raw.end();
      } catch {
        // ignore
      }
    });
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
    saveJsonArray(tenantId, "mobile_nearby_checkins.json", checkins.slice(0, 500));

    return { success: true, data: entry };
  });

  // 7. Versión actual de APK para auto-actualización in-app
  fastify.get("/version", async () => {
    return {
      success: true,
      data: {
        version: "1.1.0",
        versionCode: 2,
        minSupportedVersion: "1.0.0",
        apkUrl: "/downloads/turbonetwork-latest.apk",
        releaseNotes: "Rastreo GPS en tiempo real (Fase 1), Device Binding y Push FCM.",
      },
    };
  });
}
