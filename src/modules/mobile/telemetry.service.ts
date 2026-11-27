import fs from "fs";
import path from "path";
import { getTenantFilePath } from "../tenants/tenants.service";

export type DeviceAuthStatus = "authorized" | "pending" | "revoked";
export type TelemetrySource = "background_gps" | "foreground_gps" | "pwa_gps" | "teltonika";

export interface MobileDeviceRecord {
  deviceId: string;
  userId: number;
  userName: string;
  roleName: string;
  platform: "android" | "ios" | "web";
  deviceModel?: string;
  appVersion?: string;
  lastIp?: string;
  status: DeviceAuthStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface TechnicianTelemetryRecord {
  userId: number;
  userName: string;
  roleName: string;
  avatar?: string;
  deviceId?: string;
  deviceStatus?: DeviceAuthStatus;
  crewId?: string;
  crewName?: string;
  vehicleName?: string;
  vehiclePlate?: string;
  vehicleType?: "auto" | "moto" | "camioneta";
  trackerImei?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMoving?: boolean;
  source: TelemetrySource;
  updatedAt: string;
}

export interface TelemetryHistoryPoint {
  userId: number;
  deviceId?: string;
  crewId?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  batteryLevel?: number;
  source: TelemetrySource;
  ts: string;
}

interface CrewSummary {
  id: string;
  name: string;
  vehicleName?: string;
  vehiclePlate?: string;
  vehicleType?: "auto" | "moto" | "camioneta";
  trackerImei?: string;
  members?: Array<{ id?: number; name?: string }>;
}

type SseListener = (event: string, data: unknown) => void;
const sseSubscribers = new Map<string, Set<SseListener>>();

export function subscribeTelemetryStream(tenantId: string, listener: SseListener): () => void {
  let set = sseSubscribers.get(tenantId);
  if (!set) {
    set = new Set();
    sseSubscribers.set(tenantId, set);
  }
  set.add(listener);
  return () => {
    const current = sseSubscribers.get(tenantId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      sseSubscribers.delete(tenantId);
    }
  };
}

export function broadcastTelemetryEvent(tenantId: string, event: string, data: unknown): void {
  const set = sseSubscribers.get(tenantId);
  if (!set || set.size === 0) return;
  for (const listener of set) {
    try {
      listener(event, data);
    } catch {
      // ignore broken listeners
    }
  }
}

export function loadJsonArray<T>(tenantId: string, filename: string): T[] {
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

export function saveJsonArray<T>(tenantId: string, filename: string, data: T[]): void {
  const filePath = getTenantFilePath(tenantId, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getLimaDateString(date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  return date.toISOString().slice(0, 10);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findCrewForUser(tenantId: string, userId: number, userName?: string): CrewSummary | undefined {
  const crews = loadJsonArray<CrewSummary>(tenantId, "apartado_crews.json");
  const normalizedName = (userName || "").trim().toLowerCase();
  return crews.find((crew) =>
    Array.isArray(crew.members) &&
    crew.members.some(
      (m) =>
        (m.id && Number(m.id) === Number(userId)) ||
        (normalizedName && (m.name || "").trim().toLowerCase() === normalizedName)
    )
  );
}

export function findUserAvatar(tenantId: string, userId: number, userName?: string): string | undefined {
  const normalizedName = (userName || "").trim().toLowerCase();
  const candidates: string[] = [
    path.resolve(process.cwd(), "data", "users.json"),
    getTenantFilePath(tenantId, "employees.json"),
    path.resolve(process.cwd(), "data", "employees.json"),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!Array.isArray(parsed)) continue;
      const match = parsed.find((item: any) => {
        if (!item) return false;
        const itemId = Number(item.id || item.userId || 0);
        if (itemId && itemId === Number(userId)) return true;
        const itemName = String(item.name || item.fullName || "").trim().toLowerCase();
        return Boolean(normalizedName && itemName && itemName === normalizedName);
      });
      const avatar = match && typeof match.avatar === "string" ? match.avatar.trim() : "";
      if (avatar) return avatar;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function listMobileDevices(tenantId: string): Array<MobileDeviceRecord & { avatar?: string; crewId?: string; crewName?: string; vehiclePlate?: string }> {
  const devices = loadJsonArray<MobileDeviceRecord>(tenantId, "mobile_devices.json");
  return devices.map((d) => {
    const crew = findCrewForUser(tenantId, d.userId, d.userName);
    const avatar = findUserAvatar(tenantId, d.userId, d.userName);
    return {
      ...d,
      avatar,
      crewId: crew?.id,
      crewName: crew?.name,
      vehiclePlate: crew?.vehiclePlate,
    };
  });
}

export function registerOrTouchDevice(
  tenantId: string,
  input: {
    deviceId: string;
    userId: number;
    userName: string;
    roleName: string;
    platform: "android" | "ios" | "web";
    deviceModel?: string;
    appVersion?: string;
    lastIp?: string;
  }
): { device: MobileDeviceRecord; isNew: boolean; requiresApproval: boolean } {
  const devices = loadJsonArray<MobileDeviceRecord>(tenantId, "mobile_devices.json");
  const now = new Date().toISOString();

  const existingIdx = devices.findIndex(
    (d) => d.deviceId === input.deviceId && Number(d.userId) === Number(input.userId)
  );

  if (existingIdx >= 0) {
    const current = devices[existingIdx];
    const updated: MobileDeviceRecord = {
      ...current,
      userName: input.userName || current.userName,
      roleName: input.roleName || current.roleName,
      platform: input.platform || current.platform,
      deviceModel: input.deviceModel || current.deviceModel,
      appVersion: input.appVersion || current.appVersion,
      lastIp: input.lastIp || current.lastIp,
      lastSeenAt: now,
    };
    devices[existingIdx] = updated;
    saveJsonArray(tenantId, "mobile_devices.json", devices);
    return {
      device: updated,
      isNew: false,
      requiresApproval: updated.status !== "authorized",
    };
  }

  // Regla Fase 1: el primer celular de un técnico se autoriza automáticamente;
  // cualquier segundo celular distinto queda en "pending" hasta aprobación del admin.
  const hasAuthorizedDevice = devices.some(
    (d) => Number(d.userId) === Number(input.userId) && d.status === "authorized"
  );

  const status: DeviceAuthStatus = hasAuthorizedDevice ? "pending" : "authorized";
  const created: MobileDeviceRecord = {
    deviceId: input.deviceId,
    userId: input.userId,
    userName: input.userName,
    roleName: input.roleName,
    platform: input.platform,
    deviceModel: input.deviceModel,
    appVersion: input.appVersion,
    lastIp: input.lastIp,
    status,
    firstSeenAt: now,
    lastSeenAt: now,
    approvedBy: status === "authorized" ? "auto_first_device" : undefined,
    approvedAt: status === "authorized" ? now : undefined,
  };

  devices.unshift(created);
  saveJsonArray(tenantId, "mobile_devices.json", devices);

  broadcastTelemetryEvent(tenantId, "device", created);

  return {
    device: created,
    isNew: true,
    requiresApproval: status !== "authorized",
  };
}

export function updateDeviceStatus(
  tenantId: string,
  deviceId: string,
  status: DeviceAuthStatus,
  actorName: string,
  revokeOthersForUser = false
): MobileDeviceRecord | null {
  const devices = loadJsonArray<MobileDeviceRecord>(tenantId, "mobile_devices.json");
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const targetUserId = devices[idx].userId;

  if (status === "authorized" && revokeOthersForUser) {
    for (let i = 0; i < devices.length; i++) {
      if (i !== idx && Number(devices[i].userId) === Number(targetUserId) && devices[i].status === "authorized") {
        devices[i] = {
          ...devices[i],
          status: "revoked",
        };
      }
    }
  }

  devices[idx] = {
    ...devices[idx],
    status,
    approvedBy: status === "authorized" ? actorName : devices[idx].approvedBy,
    approvedAt: status === "authorized" ? now : devices[idx].approvedAt,
  };

  saveJsonArray(tenantId, "mobile_devices.json", devices);
  broadcastTelemetryEvent(tenantId, "device", devices[idx]);
  return devices[idx];
}

export function recordTechnicianLocation(
  tenantId: string,
  input: {
    userId: number;
    userName: string;
    roleName: string;
    deviceId?: string;
    platform?: "android" | "ios" | "web";
    deviceModel?: string;
    lastIp?: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    isMoving?: boolean;
    source: TelemetrySource;
  }
): { record: TechnicianTelemetryRecord; deviceStatus: DeviceAuthStatus; blocked: boolean } {
  let deviceStatus: DeviceAuthStatus = "authorized";

  if (input.deviceId) {
    const reg = registerOrTouchDevice(tenantId, {
      deviceId: input.deviceId,
      userId: input.userId,
      userName: input.userName,
      roleName: input.roleName,
      platform: input.platform || (input.source === "pwa_gps" ? "web" : "android"),
      deviceModel: input.deviceModel,
      lastIp: input.lastIp,
    });
    deviceStatus = reg.device.status;
  }

  const crew = findCrewForUser(tenantId, input.userId, input.userName);
  const avatar = findUserAvatar(tenantId, input.userId, input.userName);
  const now = new Date().toISOString();

  const nextRecord: TechnicianTelemetryRecord = {
    userId: input.userId,
    userName: input.userName,
    roleName: input.roleName,
    avatar,
    deviceId: input.deviceId,
    deviceStatus,
    crewId: crew?.id,
    crewName: crew?.name,
    vehicleName: crew?.vehicleName,
    vehiclePlate: crew?.vehiclePlate,
    vehicleType: crew?.vehicleType,
    trackerImei: crew?.trackerImei,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    speed: input.speed,
    heading: input.heading,
    batteryLevel: input.batteryLevel,
    isMoving: input.isMoving ?? (typeof input.speed === "number" ? input.speed > 0.8 : undefined),
    source: input.source,
    updatedAt: now,
  };

  // Si el dispositivo está pendiente o revocado, no sobreescribe la posición oficial del técnico
  if (deviceStatus !== "authorized") {
    return { record: nextRecord, deviceStatus, blocked: true };
  }

  const locations = loadJsonArray<TechnicianTelemetryRecord>(tenantId, "mobile_telemetry.json");
  const idx = locations.findIndex((l) => Number(l.userId) === Number(input.userId));
  if (idx >= 0) {
    locations[idx] = nextRecord;
  } else {
    locations.unshift(nextRecord);
  }
  saveJsonArray(tenantId, "mobile_telemetry.json", locations);

  // Guardar en historial diario (breadcrumbs) filtrando ruido
  const dateStr = getLimaDateString();
  const histFile = `mobile_telemetry_history_${dateStr}.json`;
  const history = loadJsonArray<TelemetryHistoryPoint>(tenantId, histFile);
  let lastForUser: TelemetryHistoryPoint | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (Number(history[i].userId) === Number(input.userId)) {
      lastForUser = history[i];
      break;
    }
  }

  const shouldAppend =
    !lastForUser ||
    haversineMeters(lastForUser.lat, lastForUser.lng, input.latitude, input.longitude) >= 10 ||
    Date.now() - new Date(lastForUser.ts).getTime() >= 60000;

  if (shouldAppend) {
    history.push({
      userId: input.userId,
      deviceId: input.deviceId,
      crewId: crew?.id,
      lat: input.latitude,
      lng: input.longitude,
      speed: input.speed,
      heading: input.heading,
      accuracy: input.accuracy,
      batteryLevel: input.batteryLevel,
      source: input.source,
      ts: now,
    });
    const trimmed = history.length > 5000 ? history.slice(history.length - 5000) : history;
    saveJsonArray(tenantId, histFile, trimmed);
  }

  broadcastTelemetryEvent(tenantId, "location", nextRecord);
  return { record: nextRecord, deviceStatus, blocked: false };
}

export function getLiveLocations(tenantId: string): TechnicianTelemetryRecord[] {
  const locations = loadJsonArray<TechnicianTelemetryRecord>(tenantId, "mobile_telemetry.json");
  return locations.map((loc) => {
    const crew = findCrewForUser(tenantId, loc.userId, loc.userName);
    const avatar = findUserAvatar(tenantId, loc.userId, loc.userName) || loc.avatar;
    return {
      ...loc,
      avatar,
      crewId: crew?.id || loc.crewId,
      crewName: crew?.name || loc.crewName,
      vehicleName: crew?.vehicleName || loc.vehicleName,
      vehiclePlate: crew?.vehiclePlate || loc.vehiclePlate,
      vehicleType: crew?.vehicleType || loc.vehicleType,
      trackerImei: crew?.trackerImei || loc.trackerImei,
    };
  });
}

export function getTelemetryHistory(
  tenantId: string,
  options: { userId?: number; crewId?: string; date?: string }
): TelemetryHistoryPoint[] {
  const dateStr = options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : getLimaDateString();
  const histFile = `mobile_telemetry_history_${dateStr}.json`;
  const all = loadJsonArray<TelemetryHistoryPoint>(tenantId, histFile);
  return all.filter((pt) => {
    if (options.userId && Number(pt.userId) !== Number(options.userId)) return false;
    if (options.crewId && pt.crewId !== options.crewId) return false;
    return true;
  });
}
