import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getTenantFilePath } from "../tenants/tenants.service";
import { generateTOTP, verifyTOTP } from "../rrhh/rrhh.routes";

export const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function isValidBase32Secret(secret: string): boolean {
  if (!secret || typeof secret !== "string") return false;
  const clean = secret.toUpperCase().replace(/\s/g, "");
  if (clean.length < 16) return false;
  return /^[A-Z2-7]+$/.test(clean);
}

export function sanitizeBase32(secret: string): string {
  if (!secret || typeof secret !== "string") return "";
  return secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function generateBase32Secret(length = 16): string {
  const bytes = crypto.randomBytes(length);
  let secret = "";
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

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
  require2faOnLogin: boolean; // Regla estricta: Exigir 2FA obligatorio al entrar
}

export interface MapboxSettings {
  enabled: boolean;
  accessToken: string;
  defaultStyle: string;
  defaultCenter: [number, number];
  defaultZoom: number;
}

export interface EvolutionSettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  webhookSecret?: string;
  autoReconnect?: boolean;
}

export interface MetaSettings {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId?: string;
  accessToken: string;
  verifyToken: string;
}

export interface WhatsAppConfig {
  provider: "evolution" | "meta" | "both";
  activeProvider: "evolution" | "meta";
  evolution: EvolutionSettings;
  meta: MetaSettings;
  notifyOnCustomerCreate: boolean;
  notifyOnInvoiceDue: boolean;
  notifyOnPayment: boolean;
  notifyOnServiceCut: boolean;
  notifyOnTicketAssignment: boolean;
}

export interface ConnectionsConfig {
  kuti: KutiSettings;
  jsonpe: JsonPeSettings;
  security: MasterSecuritySettings;
  mapbox: MapboxSettings;
  whatsapp: WhatsAppConfig;
  updatedAt?: string;
}

export const defaultWhatsApp: WhatsAppConfig = {
  provider: "both",
  activeProvider: "evolution",
  evolution: {
    enabled: false,
    apiUrl: "http://localhost:8080",
    apiKey: "",
    instanceName: "turbonetwork",
    webhookSecret: "",
    autoReconnect: true,
  },
  meta: {
    enabled: false,
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    verifyToken: "turbonetwork_webhook_token",
  },
  notifyOnCustomerCreate: false,
  notifyOnInvoiceDue: true,
  notifyOnPayment: true,
  notifyOnServiceCut: true,
  notifyOnTicketAssignment: true,
};

// RFC 4648 Base32 limpio (16 caracteres, sin números 0, 1, 8, 9)
export const DEFAULT_MASTER_TOTP_SECRET = "TURBONETWORKKEY2";
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
    require2faOnLogin: false,
  },
  mapbox: {
    enabled: true,
    accessToken: "",
    defaultStyle: "mapbox://styles/mapbox/satellite-streets-v12",
    defaultCenter: [-77.0368, -12.0970],
    defaultZoom: 14,
  },
  whatsapp: defaultWhatsApp,
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const GLOBAL_CONNECTIONS_FILE = path.join(DATA_DIR, "connections_settings.json");

export function loadConnectionsConfig(tenantId?: string): ConnectionsConfig {
  try {
    // Si viene tenantId, cargar o inicializar configuración aislada por negocio
    if (tenantId && tenantId !== "global") {
      const tenantFile = getTenantFilePath(tenantId, "connections.json");
      if (fs.existsSync(tenantFile)) {
        const raw = fs.readFileSync(tenantFile, "utf-8");
        const parsed = JSON.parse(raw);
        const config: ConnectionsConfig = {
          ...defaultConnections,
          ...parsed,
          whatsapp: {
            ...defaultWhatsApp,
            ...(parsed.whatsapp || {}),
            evolution: {
              ...defaultWhatsApp.evolution,
              ...(parsed.whatsapp?.evolution || {}),
            },
            meta: {
              ...defaultWhatsApp.meta,
              ...(parsed.whatsapp?.meta || {}),
            },
          },
        };

        // Asegurar que el secreto sea Base32 válido (sin dígitos ilegales como 0 de versiones previas)
        if (!isValidBase32Secret(config.security?.masterTotpSecret)) {
          config.security.masterTotpSecret = generateBase32Secret(16);
          try {
            fs.writeFileSync(tenantFile, JSON.stringify(config, null, 2), "utf-8");
          } catch (e) {}
        }
        if (config.security.require2faOnLogin === undefined) {
          config.security.require2faOnLogin = false;
        }
        return config;
      } else {
        // Inicializar configuración aislada con su propia llave secreta Base32 única para esta empresa
        const initialConfig: ConnectionsConfig = {
          ...defaultConnections,
          security: {
            ...defaultConnections.security,
            masterTotpSecret: generateBase32Secret(16),
            require2faOnLogin: false,
          },
          whatsapp: defaultWhatsApp,
          updatedAt: new Date().toISOString(),
        };
        try {
          const tenantDir = path.dirname(tenantFile);
          if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
          fs.writeFileSync(tenantFile, JSON.stringify(initialConfig, null, 2), "utf-8");
        } catch (e) {}
        return initialConfig;
      }
    }

    // Cargar archivo global
    if (fs.existsSync(GLOBAL_CONNECTIONS_FILE)) {
      const raw = fs.readFileSync(GLOBAL_CONNECTIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const config: ConnectionsConfig = {
        ...defaultConnections,
        ...parsed,
        whatsapp: {
          ...defaultWhatsApp,
          ...(parsed.whatsapp || {}),
          evolution: {
            ...defaultWhatsApp.evolution,
            ...(parsed.whatsapp?.evolution || {}),
          },
          meta: {
            ...defaultWhatsApp.meta,
            ...(parsed.whatsapp?.meta || {}),
          },
        },
      };
      if (!isValidBase32Secret(config.security?.masterTotpSecret)) {
        config.security.masterTotpSecret = DEFAULT_MASTER_TOTP_SECRET;
      }
      if (config.security.require2faOnLogin === undefined) {
        config.security.require2faOnLogin = false;
      }
      return config;
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
    whatsapp: {
      ...current.whatsapp,
      ...(config.whatsapp || {}),
      evolution: {
        ...current.whatsapp.evolution,
        ...(config.whatsapp?.evolution || {}),
      },
      meta: {
        ...current.whatsapp.meta,
        ...(config.whatsapp?.meta || {}),
      },
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Si viene tenantId específico, aislar y guardar en el directorio de ese negocio
    if (tenantId && tenantId !== "global") {
      const tenantFile = getTenantFilePath(tenantId, "connections.json");
      const tenantDir = path.dirname(tenantFile);
      if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
      fs.writeFileSync(tenantFile, JSON.stringify(updated, null, 2), "utf-8");
    } else {
      // Guardar en archivo global solo cuando no es de un negocio específico
      fs.writeFileSync(GLOBAL_CONNECTIONS_FILE, JSON.stringify(updated, null, 2), "utf-8");
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

export function is2faRequiredForTenant(tenantId?: string): boolean {
  return false;
}

export function setTenant2faRequirement(tenantId: string, required: boolean): boolean {
  const conf = loadConnectionsConfig(tenantId);
  conf.security.require2faOnLogin = false;
  saveConnectionsConfig({ security: conf.security }, tenantId);
  return false;
}

export function regenerateTenantTotpSecret(tenantId: string): string {
  const newSecret = generateBase32Secret(16);
  const conf = loadConnectionsConfig(tenantId);
  conf.security.masterTotpSecret = newSecret;
  saveConnectionsConfig({ security: conf.security }, tenantId);
  return newSecret;
}
