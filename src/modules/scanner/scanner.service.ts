import os from "os";
import crypto from "crypto";

export interface ScannerScanData {
  code: string;
  format?: "barcode" | "qr" | "ocr" | "text" | string;
  raw?: string;
  confidence?: number;
  label?: string;
  preview?: string;
  timestamp: number;
}

export interface ScannerSession {
  sessionId: string;
  token: string;
  tenantId: string;
  label?: string;
  targetField?: string;
  status: "waiting" | "connected" | "scanned" | "closed";
  deviceInfo?: string;
  createdAt: number;
  lastActiveAt: number;
  lastScanned?: ScannerScanData | null;
  history: ScannerScanData[];
}

type SessionListener = (event: any) => void;

// Almacén en memoria de sesiones activas
const activeSessions = new Map<string, ScannerSession>();

// Suscriptores en tiempo real (SSE) por sessionId
const sessionListeners = new Map<string, Set<SessionListener>>();

// Limpieza automática cada 30 minutos
setInterval(() => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 horas
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastActiveAt > maxAge) {
      activeSessions.delete(id);
      sessionListeners.delete(id);
    }
  }
}, 30 * 60 * 1000);

/**
 * Obtener las direcciones IP locales IPv4 no internas (ej: 192.168.1.35)
 */
export function getLocalLanIps(): Array<{ name: string; ip: string }> {
  const result: Array<{ name: string; ip: string }> = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal && net.address) {
          result.push({ name, ip: net.address });
        }
      }
    }
  } catch (err) {
    console.error("[ScannerService] Error obteniendo interfaces de red:", err);
  }
  return result;
}

/**
 * Genera URLs de emparejamiento para el celular
 */
export function generatePairingUrls(
  sessionId: string,
  reqHost: string = "localhost:3000",
  proto: string = "http"
) {
  const hostClean = reqHost.trim();
  const portMatch = hostClean.match(/:(\d+)$/);
  const port = portMatch ? portMatch[1] : (proto === "https" ? "443" : "80");
  const isLocalhost = hostClean.startsWith("localhost") || hostClean.startsWith("127.0.0.1");

  const lanIps = getLocalLanIps();
  const lanUrls = lanIps.map(item => ({
    name: item.name,
    ip: item.ip,
    url: `${proto}://${item.ip}:${port}/scan?session=${sessionId}`,
  }));

  // URL principal: si el host es localhost y tenemos una IP LAN de Wi-Fi/Ethernet, preferir la LAN para el celular
  let bestUrl = `${proto}://${hostClean}/scan?session=${sessionId}`;
  if (isLocalhost && lanUrls.length > 0) {
    // Preferir Wi-Fi o Ethernet típica
    const preferred = lanUrls.find(l => !l.name.toLowerCase().includes("vEthernet") && !l.name.toLowerCase().includes("virtual")) || lanUrls[0];
    bestUrl = preferred.url;
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(bestUrl)}`;

  return {
    bestUrl,
    requestUrl: `${proto}://${hostClean}/scan?session=${sessionId}`,
    lanUrls,
    qrCodeUrl,
  };
}

/**
 * Crear una nueva sesión de emparejamiento para escaneo móvil
 */
export function createScannerSession(params: {
  tenantId?: string;
  label?: string;
  targetField?: string;
  reqHost?: string;
  proto?: string;
}): { session: ScannerSession; urls: ReturnType<typeof generatePairingUrls> } {
  // Generar ID de sesión amigable y seguro (ej: SES-7K9A2M)
  const token = crypto.randomBytes(4).toString("hex").toUpperCase();
  const sessionId = `SES-${token}`;
  const now = Date.now();

  const session: ScannerSession = {
    sessionId,
    token,
    tenantId: (params.tenantId || "turbonetwork").toLowerCase(),
    label: params.label || "Escáner Inteligente",
    targetField: params.targetField || "smart-scanner-input",
    status: "waiting",
    createdAt: now,
    lastActiveAt: now,
    lastScanned: null,
    history: [],
  };

  activeSessions.set(sessionId, session);
  const urls = generatePairingUrls(sessionId, params.reqHost, params.proto);

  return { session, urls };
}

/**
 * Obtener sesión por ID
 */
export function getScannerSession(sessionId: string): ScannerSession | null {
  if (!sessionId) return null;
  const s = activeSessions.get(sessionId.trim());
  if (s) {
    s.lastActiveAt = Date.now();
  }
  return s || null;
}

/**
 * El celular se conecta a la sesión
 */
export function connectDeviceToSession(
  sessionId: string,
  deviceInfo: string = "Dispositivo Móvil"
): ScannerSession | null {
  const s = getScannerSession(sessionId);
  if (!s) return null;

  s.status = "connected";
  s.deviceInfo = deviceInfo;
  s.lastActiveAt = Date.now();

  broadcastToSession(sessionId, {
    type: "device_connected",
    sessionId,
    deviceInfo,
    timestamp: Date.now(),
  });

  return s;
}

/**
 * Enviar un código o texto OCR capturado desde el celular hacia la PC
 */
export function submitScanToSession(
  sessionId: string,
  scanData: {
    code: string;
    format?: string;
    raw?: string;
    confidence?: number;
    label?: string;
    preview?: string;
  }
): ScannerSession | null {
  const s = getScannerSession(sessionId);
  if (!s) return null;

  const codeClean = (scanData.code || "").trim();
  if (!codeClean) return s;

  const data: ScannerScanData = {
    code: codeClean,
    format: (scanData.format as any) || "barcode",
    raw: scanData.raw || codeClean,
    confidence: scanData.confidence || 1.0,
    label: scanData.label,
    preview: scanData.preview,
    timestamp: Date.now(),
  };

  s.status = "scanned";
  s.lastScanned = data;
  s.lastActiveAt = Date.now();
  s.history.unshift(data);
  if (s.history.length > 50) s.history.pop();

  broadcastToSession(sessionId, {
    type: "scanned",
    sessionId,
    data,
    timestamp: Date.now(),
  });

  return s;
}

/**
 * Resetear la sesión a estado "connected" para el siguiente escaneo continuo
 */
export function resetSessionForNextScan(sessionId: string): ScannerSession | null {
  const s = getScannerSession(sessionId);
  if (!s) return null;
  s.status = "connected";
  s.lastActiveAt = Date.now();

  broadcastToSession(sessionId, {
    type: "session_reset",
    sessionId,
    timestamp: Date.now(),
  });

  return s;
}

/**
 * Registrar un listener de eventos en tiempo real para una sesión (SSE)
 */
export function addSessionListener(sessionId: string, listener: SessionListener): void {
  if (!sessionListeners.has(sessionId)) {
    sessionListeners.set(sessionId, new Set());
  }
  sessionListeners.get(sessionId)!.add(listener);
}

/**
 * Remover un listener de eventos
 */
export function removeSessionListener(sessionId: string, listener: SessionListener): void {
  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    listeners.delete(listener);
    if (listeners.size === 0) {
      sessionListeners.delete(sessionId);
    }
  }
}

/**
 * Emitir un evento a todos los clientes suscritos a una sesión
 */
export function broadcastToSession(sessionId: string, event: any): void {
  const listeners = sessionListeners.get(sessionId);
  if (!listeners || listeners.size === 0) return;

  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch (err) {
      console.warn("[ScannerService] Error enviando evento a listener:", err);
    }
  }
}
