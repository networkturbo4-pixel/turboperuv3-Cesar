import fs from "fs";
import path from "path";
import { getTenantFilePath } from "../tenants/tenants.service";
import { generateTOTP, verifyTOTP } from "../rrhh/rrhh.routes";

export interface KutiSettings {
  enabled: boolean;
  environment: "sandbox" | "production";
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  currency: string;
  autoProcessInvoices: boolean;
}

export interface JsonPeSettings {
  enabled: boolean;
  token: string;
  baseUrl: string;
  autoFillCustomer: boolean;
  autoFillEmployee: boolean;
}

export interface MasterSecuritySettings {
  masterTotpSecret: string;
  masterSupervisorPin: string;
  allowMasterTotpForAll: boolean;
}

export interface MapboxSettings {
  enabled: boolean;
  accessToken: string;
  defaultStyle: string;
  defaultCenter: [number, number];
  defaultZoom: number;
}

export interface ConnectionsConfig {
  kuti: KutiSettings;
  jsonpe: JsonPeSettings;
  security: MasterSecuritySettings;
  mapbox: MapboxSettings;
  updatedAt?: string;
}

export const DEFAULT_MASTER_TOTP_SECRET = "TURBOISPMASTERKEY2026";
export const DEFAULT_SUPERVISOR_PIN = "998877";

const defaultConnections: ConnectionsConfig = {
  kuti: {
    enabled: false,
    environment: "sandbox",
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
    currency: "PEN",
    autoProcessInvoices: true,
  },
  jsonpe: {
    enabled: false,
    token: "",
    baseUrl: "https://api.json.pe/api",
    autoFillCustomer: true,
    autoFillEmployee: true,
  },
  security: {
    masterTotpSecret: DEFAULT_MASTER_TOTP_SECRET,
    masterSupervisorPin: DEFAULT_SUPERVISOR_PIN,
    allowMasterTotpForAll: true,
  },
  mapbox: {
    enabled: true,
    accessToken: "",
    defaultStyle: "mapbox://styles/mapbox/satellite-streets-v12",
    defaultCenter: [-77.0368, -12.0970],
    defaultZoom: 14,
  },
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const GLOBAL_CONNECTIONS_FILE = path.join(DATA_DIR, "connections_settings.json");

export function loadConnectionsConfig(tenantId?: string): ConnectionsConfig {
  try {
    // Si viene tenantId, intentar cargar primero el archivo específico de esa sede
    if (tenantId && tenantId !== "global") {
      const tenantFile = getTenantFilePath(tenantId, "connections.json");
      if (fs.existsSync(tenantFile)) {
        const raw = fs.readFileSync(tenantFile, "utf-8");
        return { ...defaultConnections, ...JSON.parse(raw) };
      }
    }

    // Cargar archivo global
    if (fs.existsSync(GLOBAL_CONNECTIONS_FILE)) {
      const raw = fs.readFileSync(GLOBAL_CONNECTIONS_FILE, "utf-8");
      return { ...defaultConnections, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn("Aviso: Inicializando conexiones con valores por defecto:", err);
  }

  return { ...defaultConnections };
}

export function saveConnectionsConfig(config: Partial<ConnectionsConfig>, tenantId?: string): ConnectionsConfig {
  const current = loadConnectionsConfig(tenantId);
  const updated: ConnectionsConfig = {
    kuti: { ...current.kuti, ...(config.kuti || {}) },
    jsonpe: { ...current.jsonpe, ...(config.jsonpe || {}) },
    security: { ...current.security, ...(config.security || {}) },
    mapbox: { ...current.mapbox, ...(config.mapbox || {}) },
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Guardar en archivo global
    fs.writeFileSync(GLOBAL_CONNECTIONS_FILE, JSON.stringify(updated, null, 2), "utf-8");

    // Si viene tenantId específico, guardar también en su directorio
    if (tenantId && tenantId !== "global") {
      const tenantFile = getTenantFilePath(tenantId, "connections.json");
      const tenantDir = path.dirname(tenantFile);
      if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
      fs.writeFileSync(tenantFile, JSON.stringify(updated, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error al persistir configuraciones de conexiones:", err);
    throw err;
  }

  return updated;
}

export function getMasterTotpSecret(tenantId?: string): string {
  const conf = loadConnectionsConfig(tenantId);
  return conf.security?.masterTotpSecret || DEFAULT_MASTER_TOTP_SECRET;
}

export function getMasterSupervisorPin(tenantId?: string): string {
  const conf = loadConnectionsConfig(tenantId);
  return conf.security?.masterSupervisorPin || DEFAULT_SUPERVISOR_PIN;
}
