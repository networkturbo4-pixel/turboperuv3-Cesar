import fs from "fs";
import path from "path";
import { FastifyRequest } from "fastify";

export interface TenantCustomField {
  id: string;
  label: string;
  value: string;
}

export interface TenantSocialLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface Tenant {
  id: string; // slug único: "turbonetwork", "loanetwork", "celeris"
  name: string;
  tagline: string;
  slug: string;
  ruc?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  globalCurrency?: string; // "PEN", "USD", "EUR"
  socialLinks?: TenantSocialLinks;
  customFields?: TenantCustomField[];
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  pwaIconUrl?: string;
  active: boolean;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const TENANTS_DIR = path.join(DATA_DIR, "tenants");
const TENANTS_FILE = path.join(DATA_DIR, "tenants.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: "turbonetwork",
    name: "TurboNetwork",
    tagline: "ISP Enterprise Core",
    slug: "turbonetwork",
    ruc: "20601234567",
    phone: "+51 987 654 321",
    email: "contacto@turbonetwork.com",
    address: "Av. Principal 123, Lima",
    primaryColor: "#2563eb",
    accentColor: "#059669",
    logoUrl: "",
    faviconUrl: "",
    pwaIconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=TurboNetPro",
    active: true,
    createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "loanetwork",
    name: "LoaNetwork",
    tagline: "Conectividad Óptica de Alta Velocidad",
    slug: "loanetwork",
    ruc: "20609876543",
    phone: "+51 912 345 678",
    email: "soporte@loanetwork.pe",
    address: "Calle Los Álamos 456, Arequipa",
    primaryColor: "#7c3aed",
    accentColor: "#06b6d4",
    logoUrl: "",
    faviconUrl: "",
    pwaIconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=LoaNet",
    active: true,
    createdAt: "2026-09-15T00:00:00Z",
  },
  {
    id: "celeris",
    name: "Celeris Telecom",
    tagline: "Banda Ancha & Fibra Dedicada",
    slug: "celeris",
    ruc: "20605558881",
    phone: "+51 955 667 788",
    email: "operaciones@celeristelecom.com",
    address: "Parque Industrial Manzana B Lote 4, Trujillo",
    primaryColor: "#ea580c",
    accentColor: "#10b981",
    logoUrl: "",
    faviconUrl: "",
    pwaIconUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=CelerisISP",
    active: true,
    createdAt: "2026-09-20T00:00:00Z",
  },
];

// Garantizar estructura de carpetas
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TENANTS_DIR)) {
    fs.mkdirSync(TENANTS_DIR, { recursive: true });
  }
}

// Cargar lista central de empresas
export function loadTenantsFromDisk(): Tenant[] {
  ensureDirectories();
  try {
    if (fs.existsSync(TENANTS_FILE)) {
      const raw = fs.readFileSync(TENANTS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (err) {
    console.warn("Aviso: Error al leer tenants.json, usando valores por defecto:", err);
  }
  saveTenantsToDisk(DEFAULT_TENANTS);
  return DEFAULT_TENANTS;
}

// Guardar lista central de empresas
export function saveTenantsToDisk(tenants: Tenant[]) {
  ensureDirectories();
  try {
    fs.writeFileSync(TENANTS_FILE, JSON.stringify(tenants, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al persistir tenants.json:", err);
  }
}

// Obtener ruta a la carpeta de datos de un tenant específico
export function getTenantDataDir(tenantId: string): string {
  ensureDirectories();
  const safeId = tenantId.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "turbonetwork";
  const tenantDir = path.join(TENANTS_DIR, safeId);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
  return tenantDir;
}

// Obtener ruta a un archivo dentro de la carpeta de un tenant
export function getTenantFilePath(tenantId: string, fileName: string): string {
  const tenantDir = getTenantDataDir(tenantId);
  return path.join(tenantDir, fileName);
}

// Resolver tenant ID desde la solicitud HTTP (cabecera 'x-tenant-id' o query param)
export function resolveTenantId(request: FastifyRequest): string {
  const headerTenant = request.headers["x-tenant-id"];
  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim().toLowerCase();
  }
  const query = request.query as Record<string, any> | undefined;
  if (query) {
    if (typeof query.tenantId === "string" && query.tenantId.trim()) {
      return query.tenantId.trim().toLowerCase();
    }
    if (typeof query.tenant === "string" && query.tenant.trim()) {
      return query.tenant.trim().toLowerCase();
    }
  }
  return "turbonetwork";
}

// Inicializar y migrar datos iniciales para cada tenant si es la primera vez
export function initializeTenantsSystem() {
  ensureDirectories();
  const tenants = loadTenantsFromDisk();

  // 1. Migrar/asegurar datos de TurboNetwork
  const turboDir = getTenantDataDir("turbonetwork");
  const turboBranding = path.join(turboDir, "branding.json");
  const oldBranding = path.join(DATA_DIR, "branding_settings.json");
  if (!fs.existsSync(turboBranding)) {
    if (fs.existsSync(oldBranding)) {
      fs.copyFileSync(oldBranding, turboBranding);
    } else {
      fs.writeFileSync(turboBranding, JSON.stringify(DEFAULT_TENANTS[0], null, 2), "utf-8");
    }
  }

  const turboCustomers = path.join(turboDir, "customers.json");
  const oldCustomers = path.join(DATA_DIR, "customers.json");
  if (!fs.existsSync(turboCustomers) && fs.existsSync(oldCustomers)) {
    fs.copyFileSync(oldCustomers, turboCustomers);
  }

  const turboServices = path.join(turboDir, "services.json");
  const oldServices = path.join(DATA_DIR, "services.json");
  if (!fs.existsSync(turboServices) && fs.existsSync(oldServices)) {
    fs.copyFileSync(oldServices, turboServices);
  }

  const turboDispatch = path.join(turboDir, "receipt_dispatch.json");
  const oldDispatch = path.join(DATA_DIR, "receipt_dispatch_settings.json");
  if (!fs.existsSync(turboDispatch) && fs.existsSync(oldDispatch)) {
    fs.copyFileSync(oldDispatch, turboDispatch);
  }

  // 2. Sembrar datos para LoaNetwork si es nuevo
  const loaDir = getTenantDataDir("loanetwork");
  const loaBranding = path.join(loaDir, "branding.json");
  if (!fs.existsSync(loaBranding)) {
    fs.writeFileSync(loaBranding, JSON.stringify({
      systemName: "LoaNetwork",
      tagline: "Conectividad Óptica de Alta Velocidad",
      primaryColor: "#7c3aed",
      accentColor: "#06b6d4",
      lightBgColor: "#f8fafc",
      darkBgColor: "#090a0f",
      fontFamily: "inter",
      fontSizeScale: "normal",
      themeMode: "dark"
    }, null, 2), "utf-8");
  }

  const loaCustomers = path.join(loaDir, "customers.json");
  if (!fs.existsSync(loaCustomers)) {
    fs.writeFileSync(loaCustomers, JSON.stringify([
      {
        id: 1,
        code: "CLI-LOA-101",
        fullName: "Roberto Carlos Gutiérrez",
        documentType: "dni",
        documentNumber: "45678901",
        email: "roberto.gutierrez@gmail.com",
        phone: "+51 954 112 233",
        address: "Calle Mercaderes 210, Arequipa",
        serviceStatus: "active",
        servicePlanId: 1,
        serviceSpeed: "200 Mbps Simétrico Fibra",
        monthlyFee: "65.00",
        billingDay: 5,
        ipAddress: "10.20.10.45",
        routerModel: "Huawei EG8145V5",
        createdAt: "2026-09-12T10:00:00Z"
      },
      {
        id: 2,
        code: "CLI-LOA-102",
        fullName: "Clinica Odontológica Sur Dental SAC",
        documentType: "ruc",
        documentNumber: "20604445551",
        email: "administracion@surdental.pe",
        phone: "+51 958 776 655",
        address: "Av. Cayma 550 Of. 302, Arequipa",
        serviceStatus: "active",
        servicePlanId: 2,
        serviceSpeed: "500 Mbps Corporativo",
        monthlyFee: "150.00",
        billingDay: 15,
        ipAddress: "10.20.10.46",
        routerModel: "MikroTik hEX S",
        createdAt: "2026-09-14T15:30:00Z"
      }
    ], null, 2), "utf-8");
  }

  const loaServices = path.join(loaDir, "services.json");
  if (!fs.existsSync(loaServices)) {
    fs.writeFileSync(loaServices, JSON.stringify([
      {
        id: 1,
        name: "Plan Loa Fibra 200M",
        speed: "200 Mbps Simétrico Fibra",
        downloadSpeedMbps: 200,
        uploadSpeedMbps: 200,
        price: "65.00",
        billingCycle: "monthly",
        description: "Fibra óptica directa al hogar con ultra baja latencia",
        isActive: true,
        createdAt: "2026-09-15T00:00:00Z"
      },
      {
        id: 2,
        name: "Plan Loa Pyme 500M",
        speed: "500 Mbps Corporativo",
        downloadSpeedMbps: 500,
        uploadSpeedMbps: 500,
        price: "150.00",
        billingCycle: "monthly",
        description: "Enlace simétrico dedicado con soporte 24/7 y SLA 99.8%",
        isActive: true,
        createdAt: "2026-09-15T00:00:00Z"
      }
    ], null, 2), "utf-8");
  }

  // 3. Sembrar datos para Celeris si es nuevo
  const celerisDir = getTenantDataDir("celeris");
  const celerisBranding = path.join(celerisDir, "branding.json");
  if (!fs.existsSync(celerisBranding)) {
    fs.writeFileSync(celerisBranding, JSON.stringify({
      systemName: "Celeris Telecom",
      tagline: "Banda Ancha & Fibra Dedicada",
      primaryColor: "#ea580c",
      accentColor: "#10b981",
      lightBgColor: "#f8fafc",
      darkBgColor: "#090a0f",
      fontFamily: "inter",
      fontSizeScale: "normal",
      themeMode: "dark"
    }, null, 2), "utf-8");
  }

  const celerisCustomers = path.join(celerisDir, "customers.json");
  if (!fs.existsSync(celerisCustomers)) {
    fs.writeFileSync(celerisCustomers, JSON.stringify([
      {
        id: 1,
        code: "CLI-CEL-301",
        fullName: "Agroindustrias del Norte SA",
        documentType: "ruc",
        documentNumber: "20509988776",
        email: "sistemas@agronorte.com",
        phone: "+51 944 332 211",
        address: "Carretera Industrial Km 4.5, Trujillo",
        serviceStatus: "active",
        servicePlanId: 1,
        serviceSpeed: "600 Mbps Dedicado",
        monthlyFee: "220.00",
        billingDay: 1,
        ipAddress: "172.16.50.10",
        routerModel: "MikroTik CCR2004-16G-2S+",
        createdAt: "2026-09-20T09:00:00Z"
      }
    ], null, 2), "utf-8");
  }

  const celerisServices = path.join(celerisDir, "services.json");
  if (!fs.existsSync(celerisServices)) {
    fs.writeFileSync(celerisServices, JSON.stringify([
      {
        id: 1,
        name: "Celeris Dedicado 600M",
        speed: "600 Mbps Dedicado",
        downloadSpeedMbps: 600,
        uploadSpeedMbps: 600,
        price: "220.00",
        billingCycle: "monthly",
        description: "Enlace corporativo punto a punto con IP pública fija",
        isActive: true,
        createdAt: "2026-09-20T00:00:00Z"
      }
    ], null, 2), "utf-8");
  }

  // 4. Actualizar matriz de permisos de usuarios si users.json existe
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      const users = JSON.parse(raw);
      let updated = false;
      for (const u of users) {
        if (u.id === 1) {
          if (!u.isSuperAdmin || !u.allowedTenants) {
            u.isSuperAdmin = true;
            u.allowedTenants = ["*"];
            updated = true;
          }
        } else if (u.id === 2) {
          if (u.isSuperAdmin === undefined || !u.allowedTenants) {
            u.isSuperAdmin = false;
            u.allowedTenants = ["turbonetwork", "loanetwork"];
            updated = true;
          }
        } else if (u.id === 3) {
          if (u.isSuperAdmin === undefined || !u.allowedTenants) {
            u.isSuperAdmin = false;
            u.allowedTenants = ["turbonetwork"];
            updated = true;
          }
        }
      }
      if (updated) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
      }
    }
  } catch (err) {
    console.warn("Aviso al actualizar permisos multi-tenant en users.json:", err);
  }
}
