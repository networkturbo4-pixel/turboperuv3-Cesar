import { FastifyPluginAsync } from "fastify";
import fs from "fs";
import path from "path";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

export interface ApartadoAppPermission {
  id: string;
  name: string;
  description: string;
}

export interface ApartadoAppDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  badge: string;
  permissions: ApartadoAppPermission[];
}

export interface ApartadoConfig {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  themeColor: string;
  routePath: string;
  isActive: boolean;
  exclusiveAccess: boolean; // Si true, el usuario asignado no entra al sistema general, solo a su apartado
  assignedRoleIds: number[];
  assignedUserIds: number[];
  enabledApps: string[];
  enabledPermissions: string[];
  updatedAt: string;
}

export interface FieldInstallationOrder {
  id: string;
  code: string;
  type: "instalacion" | "averia" | "migracion" | "retiro";
  priority: "alta" | "normal" | "urgente";
  status: "pendiente" | "en_camino" | "en_progreso" | "completada";
  customerId?: number;
  customerName: string;
  customerCiz: string;
  customerDni: string;
  customerPhone: string;
  address: string;
  reference?: string;
  planName: string;
  napCode?: string;
  napPort?: string;
  lat?: number;
  lng?: number;
  assignedTechId?: number;
  assignedTechName: string;
  scheduledTime: string;
  scheduledDate: string;
  opticalPowerDbm?: string;
  onuSerial?: string;
  fiberMetersUsed?: number;
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MaterialFieldRequest {
  id: string;
  type: "solicitud" | "devolucion";
  status: "pendiente" | "aprobado" | "rechazado";
  techId: number;
  techName: string;
  itemName: string;
  productId?: string;
  assignmentId?: string;
  quantity: number;
  unit: string;
  serialOrMac?: string;
  urgency: "normal" | "alta" | "urgente";
  reason: string;
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TechAdvanceRequest {
  id: string;
  category: "adelanto_comision" | "viatico_combustible" | "ferreteria_campo" | "otros";
  status: "pendiente" | "aprobado" | "rechazado";
  techId: number;
  techName: string;
  amount: number;
  currency: string;
  reason: string;
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export const APARTADO_APPS_CATALOG: ApartadoAppDefinition[] = [
  {
    id: "attendance_gps",
    name: "Asistencia y Marcación GPS",
    shortName: "Asistencia GPS",
    description: "Marcación de entrada, inicio/fin de refrigerio y salida con geolocalización GPS en tiempo real.",
    icon: "clock-gps",
    color: "emerald",
    badge: "GPS Live",
    permissions: [
      { id: "attendance:checkin", name: "Marcar Entrada y Salida", description: "Registrar ingreso y salida con coordenadas GPS" },
      { id: "attendance:lunch", name: "Marcar Refrigerio", description: "Registrar inicio y término de horario de almuerzo" },
      { id: "attendance:history", name: "Ver Mi Historial", description: "Consultar asistencias y puntualidad de la semana/mes" },
    ],
  },
  {
    id: "commissions_advances",
    name: "Comisiones y Adelantos",
    shortName: "Comisiones",
    description: "Consulta de comisiones ganadas por instalaciones, solicitud de adelantos y registro de viáticos.",
    icon: "wallet",
    color: "amber",
    badge: "S/ Pagos",
    permissions: [
      { id: "commissions:view", name: "Ver Mis Comisiones", description: "Consultar comisiones generadas por instalaciones y metas" },
      { id: "advances:request", name: "Solicitar Adelanto / Viático", description: "Enviar solicitud de adelanto o gasto de combustible/campo" },
      { id: "advances:history", name: "Historial de Solicitudes", description: "Ver estado de aprobación de adelantos y descuentos" },
    ],
  },
  {
    id: "nearby_naps",
    name: "Mapas NAP Cercanas",
    shortName: "NAP Cercanas",
    description: "Radar GPS de cajas NAP y mufas FTTH más cercanas a tu ubicación, con puertos libres y ruta.",
    icon: "map-pin",
    color: "blue",
    badge: "FTTH Radar",
    permissions: [
      { id: "naps:view", name: "Ver Cajas NAP por GPS", description: "Localizar cajas NAP cercanas con cálculo de distancia en metros" },
      { id: "naps:ports", name: "Ver Puertos y Potencia", description: "Ver disponibilidad de puertos, hilos y detalles técnicos de la NAP" },
      { id: "naps:navigate", name: "Navegación en 1 Toque", description: "Abrir ruta directa en Google Maps o Waze hacia la caja NAP" },
    ],
  },
  {
    id: "my_stock",
    name: "Mi Stock (Mochila)",
    shortName: "Mi Stock",
    description: "Inventario en mano asignado al técnico: ONUs, routers, bobinas de fibra, herramientas y EPPs.",
    icon: "backpack",
    color: "purple",
    badge: "En Mano",
    permissions: [
      { id: "stock:view", name: "Ver Materiales y Equipos", description: "Consultar ítems activos asignados en su mochila técnica" },
      { id: "stock:serials", name: "Ver Series / MACs y EPPs", description: "Ver números de serie, códigos de barra y vencimiento de EPPs" },
    ],
  },
  {
    id: "qr_scanner",
    name: "Escáner QR / Barras",
    shortName: "Escáner QR",
    description: "Escaneo por cámara de ONUs, routers y materiales para consulta de serie/MAC o asignación inmediata.",
    icon: "qr-code",
    color: "cyan",
    badge: "Cámara",
    permissions: [
      { id: "qr:scan_verify", name: "Escanear y Verificar Equipo", description: "Leer código QR o barras con cámara para ver trazabilidad y estado" },
      { id: "qr:assign_client", name: "Instalar Equipo Escaneado", description: "Vincular equipo escaneado directamente a un cliente en campo" },
    ],
  },
  {
    id: "material_requests",
    name: "Solicitar y Devolver Material",
    shortName: "Pedidos / Devol.",
    description: "Solicitudes rápidas de reposición a almacén y devolución de materiales o equipos sobrantes.",
    icon: "arrows-exchange",
    color: "indigo",
    badge: "Almacén",
    permissions: [
      { id: "materials:request", name: "Solicitar Material a Almacén", description: "Crear pedido de ONUs, fibra, conectores o herramientas" },
      { id: "materials:return", name: "Devolver Material de Mochila", description: "Registrar devolución de equipos o sobrantes al almacén" },
    ],
  },
  {
    id: "my_installations",
    name: "Mis Instalaciones",
    shortName: "Instalaciones",
    description: "Agenda diaria de altas FTTH, averías y migraciones con reporte de potencia óptica y cierre en campo.",
    icon: "wrench-check",
    color: "rose",
    badge: "Agenda Hoy",
    permissions: [
      { id: "installations:view", name: "Ver Agenda de Visitas", description: "Ver órdenes de instalación y soporte asignadas al técnico" },
      { id: "installations:complete", name: "Iniciar y Finalizar Orden", description: "Cambiar estado en camino/en progreso y cerrar acta con potencia dBm" },
      { id: "installations:consume_stock", name: "Descontar Material en Cierre", description: "Descontar automáticamente ONU y metraje de fibra de su mochila" },
    ],
  },
  {
    id: "ciz_search",
    name: "Buscador CIZ",
    shortName: "Buscador CIZ",
    description: "Búsqueda ultrarrápida de abonados por CIZ, DNI, nombre o PPPoE con diagnóstico de red y señal.",
    icon: "search-ciz",
    color: "sky",
    badge: "Diagnóstico",
    permissions: [
      { id: "ciz:search", name: "Buscar por CIZ / DNI / Nombre", description: "Consultar ficha técnica, dirección GPS, NAP y plan del cliente" },
      { id: "ciz:diagnostics", name: "Test Ping y Potencia Óptica", description: "Ejecutar diagnóstico rápido de conectividad y estado PPPoE" },
      { id: "ciz:reactivate", name: "Reactivar / Refrescar Puerto", description: "Solicitar o ejecutar reconexión rápida de servicio en campo" },
    ],
  },
];

function getDefaultApartados(): ApartadoConfig[] {
  const allAppIds = APARTADO_APPS_CATALOG.map((a) => a.id);
  const allPermIds = APARTADO_APPS_CATALOG.flatMap((a) => a.permissions.map((p) => p.id));

  return [
    {
      id: "apt-tecnicos",
      slug: "tecnicos",
      name: "Apartado Técnico Móvil (TurboTech)",
      subtitle: "Super-App de Campo FTTH & Soporte",
      description: "Portal móvil exclusivo con accesos directos rápidos para técnicos instaladores y cuadrillas de planta externa, sin acceso al panel administrativo general.",
      icon: " smartphone",
      themeColor: "#2563eb",
      routePath: "/tech",
      isActive: true,
      exclusiveAccess: true,
      assignedRoleIds: [4], // Rol 4 = Soporte Técnico en Campo
      assignedUserIds: [],
      enabledApps: allAppIds,
      enabledPermissions: allPermIds,
      updatedAt: new Date().toISOString(),
    },
  ];
}

function loadApartadosForTenant(tenantId: string): ApartadoConfig[] {
  const filePath = getTenantFilePath(tenantId, "apartados.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[Apartados] Error cargando apartados para ${tenantId}:`, err);
  }
  const defaults = getDefaultApartados();
  saveApartadosForTenant(tenantId, defaults);
  return defaults;
}

function saveApartadosForTenant(tenantId: string, list: ApartadoConfig[]): void {
  const filePath = getTenantFilePath(tenantId, "apartados.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error(`[Apartados] Error guardando apartados para ${tenantId}:`, err);
  }
}

function loadCustomersForSeed(tenantId: string): any[] {
  const filePath = getTenantFilePath(tenantId, "customers.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
    const rootCustomers = path.resolve(process.cwd(), "data", "customers.json");
    if (fs.existsSync(rootCustomers)) {
      const parsed = JSON.parse(fs.readFileSync(rootCustomers, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function loadInstallationsForTenant(tenantId: string): FieldInstallationOrder[] {
  const filePath = getTenantFilePath(tenantId, "apartado_installations.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const customers = loadCustomersForSeed(tenantId);
  const today = new Date().toISOString().slice(0, 10);
  const seed: FieldInstallationOrder[] = [
    {
      id: "ORD-1001",
      code: "INS-2026-089",
      type: "instalacion",
      priority: "alta",
      status: "pendiente",
      customerId: customers[0]?.id || 1,
      customerName: customers[0]?.name || "Juan Carlos Quispe Mendoza",
      customerCiz: `CIZ-${String(customers[0]?.id || 101).padStart(4, "0")}`,
      customerDni: customers[0]?.documentNumber || "45892103",
      customerPhone: customers[0]?.phone || "+51 987 654 321",
      address: customers[0]?.address || "Av. Los Libertadores 450 - Urb. San Miguel",
      reference: "Casa de 2 pisos fachada blanca frente al parque",
      planName: customers[0]?.planName || "Fibra Hogar 200 Mbps Simétrico",
      napCode: "NAP-01-A",
      napPort: "Puerto 4",
      lat: -12.0765,
      lng: -77.0842,
      assignedTechName: "Cuadrilla FTTH",
      scheduledTime: "09:30 AM",
      scheduledDate: today,
      notes: "Llevar ONU Dual Band WiFi 6 y 80m de fibra drop.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ORD-1002",
      code: "AVE-2026-042",
      type: "averia",
      priority: "urgente",
      status: "en_camino",
      customerId: customers[1]?.id || 2,
      customerName: customers[1]?.name || "María Elena Vargas Soto",
      customerCiz: `CIZ-${String(customers[1]?.id || 102).padStart(4, "0")}`,
      customerDni: customers[1]?.documentNumber || "71029384",
      customerPhone: customers[1]?.phone || "+51 945 112 233",
      address: customers[1]?.address || "Jr. Las Magnolias 218 - Sector Norte",
      reference: "Al costado de la botica MiSalud",
      planName: customers[1]?.planName || "Fibra Gamer 300 Mbps",
      napCode: "NAP-02-B",
      napPort: "Puerto 7",
      lat: -12.0789,
      lng: -77.0815,
      assignedTechName: "Cuadrilla FTTH",
      scheduledTime: "11:15 AM",
      scheduledDate: today,
      opticalPowerDbm: "-27.8",
      notes: "Foco LOS rojo parpadeando. Revisar conector APC en roseta óptica.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ORD-1003",
      code: "INS-2026-090",
      type: "migracion",
      priority: "normal",
      status: "pendiente",
      customerId: customers[2]?.id || 3,
      customerName: customers[2]?.name || "Comercial Los Andes S.A.C.",
      customerCiz: `CIZ-${String(customers[2]?.id || 103).padStart(4, "0")}`,
      customerDni: customers[2]?.documentNumber || "20601928371",
      customerPhone: customers[2]?.phone || "+51 998 776 655",
      address: customers[2]?.address || "Calle Comercio 890 - Interior B",
      reference: "Segundo piso oficina contable",
      planName: "Fibra Negocios 500 Mbps",
      napCode: "NAP-03-C",
      napPort: "Puerto 2",
      lat: -12.0741,
      lng: -77.0869,
      assignedTechName: "Cuadrilla FTTH",
      scheduledTime: "03:00 PM",
      scheduledDate: today,
      notes: "Cambio de ONU por upgrade a plan 500 Mbps.",
      createdAt: new Date().toISOString(),
    },
  ];
  saveInstallationsForTenant(tenantId, seed);
  return seed;
}

function saveInstallationsForTenant(tenantId: string, list: FieldInstallationOrder[]): void {
  const filePath = getTenantFilePath(tenantId, "apartado_installations.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch {}
}

function loadMaterialRequestsForTenant(tenantId: string): MaterialFieldRequest[] {
  const filePath = getTenantFilePath(tenantId, "apartado_material_requests.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveMaterialRequestsForTenant(tenantId: string, list: MaterialFieldRequest[]): void {
  const filePath = getTenantFilePath(tenantId, "apartado_material_requests.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch {}
}

function loadAdvancesForTenant(tenantId: string): TechAdvanceRequest[] {
  const filePath = getTenantFilePath(tenantId, "apartado_advances.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveAdvancesForTenant(tenantId: string, list: TechAdvanceRequest[]): void {
  const filePath = getTenantFilePath(tenantId, "apartado_advances.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
  } catch {}
}

export const apartadosRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Catálogo maestro de mini-aplicaciones y permisos de apartados
  fastify.get("/apartados/catalog", async (_request, reply) => {
    return reply.send({
      success: true,
      data: APARTADO_APPS_CATALOG,
    });
  });

  // 2. Listar todos los apartados configurados para el tenant activo
  fastify.get("/apartados", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const apartados = loadApartadosForTenant(tenantId);
    const installations = loadInstallationsForTenant(tenantId);
    const materialRequests = loadMaterialRequestsForTenant(tenantId);
    const advances = loadAdvancesForTenant(tenantId);

    return reply.send({
      success: true,
      tenantId,
      data: apartados,
      catalog: APARTADO_APPS_CATALOG,
      stats: {
        totalApartados: apartados.length,
        activeApartados: apartados.filter((a) => a.isActive).length,
        pendingInstallations: installations.filter((i) => i.status !== "completada").length,
        pendingMaterialRequests: materialRequests.filter((m) => m.status === "pendiente").length,
        pendingAdvances: advances.filter((ad) => ad.status === "pendiente").length,
      },
    });
  });

  // 3. Consultar si un usuario/rol tiene acceso exclusivo a un apartado y obtener sus apps/permisos
  fastify.get("/apartados/my-access", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as { userId?: string; roleId?: string; slug?: string };
    const userId = Number(query.userId || 0);
    const roleId = Number(query.roleId || 0);
    const slug = (query.slug || "tecnicos").trim();

    const apartados = loadApartadosForTenant(tenantId);
    let matched = apartados.find(
      (a) =>
        a.isActive &&
        ((userId > 0 && a.assignedUserIds.includes(userId)) ||
          (roleId > 0 && a.assignedRoleIds.includes(roleId)))
    );

    if (!matched && slug) {
      matched = apartados.find((a) => a.slug === slug) || apartados[0];
    }

    const activeApps = APARTADO_APPS_CATALOG.filter((app) =>
      matched ? matched.enabledApps.includes(app.id) : true
    );

    return reply.send({
      success: true,
      apartado: matched || apartados[0],
      apps: activeApps,
      catalog: APARTADO_APPS_CATALOG,
    });
  });

  // 4. Crear un nuevo Apartado personalizado
  fastify.post("/apartados", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<ApartadoConfig>;
    if (!body.name || !body.name.trim()) {
      return reply.status(400).send({ success: false, message: "El nombre del apartado es obligatorio" });
    }

    const apartados = loadApartadosForTenant(tenantId);
    const slug = (body.slug || body.name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const defaultApps = Array.isArray(body.enabledApps) && body.enabledApps.length > 0
      ? body.enabledApps
      : APARTADO_APPS_CATALOG.map((a) => a.id);

    const defaultPerms = Array.isArray(body.enabledPermissions) && body.enabledPermissions.length > 0
      ? body.enabledPermissions
      : APARTADO_APPS_CATALOG.filter((a) => defaultApps.includes(a.id)).flatMap((a) => a.permissions.map((p) => p.id));

    const newApartado: ApartadoConfig = {
      id: `apt-${Date.now()}`,
      slug: slug || `apartado-${Date.now()}`,
      name: body.name.trim(),
      subtitle: body.subtitle?.trim() || "Portal Operativo Móvil",
      description: body.description?.trim() || "Apartado rápido con accesos directos personalizados.",
      icon: body.icon || "smartphone",
      themeColor: body.themeColor || "#2563eb",
      routePath: body.routePath || `/tech?apartado=${slug}`,
      isActive: body.isActive !== undefined ? !!body.isActive : true,
      exclusiveAccess: body.exclusiveAccess !== undefined ? !!body.exclusiveAccess : true,
      assignedRoleIds: Array.isArray(body.assignedRoleIds) ? body.assignedRoleIds.map(Number) : [],
      assignedUserIds: Array.isArray(body.assignedUserIds) ? body.assignedUserIds.map(Number) : [],
      enabledApps: defaultApps,
      enabledPermissions: defaultPerms,
      updatedAt: new Date().toISOString(),
    };

    apartados.push(newApartado);
    saveApartadosForTenant(tenantId, apartados);

    return reply.send({
      success: true,
      message: "Apartado creado correctamente",
      data: newApartado,
    });
  });

  // 5. Actualizar configuración de aplicaciones, permisos y roles de un Apartado
  fastify.put("/apartados/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Partial<ApartadoConfig>;

    const apartados = loadApartadosForTenant(tenantId);
    const idx = apartados.findIndex((a) => a.id === id || a.slug === id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Apartado no encontrado" });
    }

    const current = apartados[idx];
    const updated: ApartadoConfig = {
      ...current,
      name: body.name !== undefined ? body.name.trim() : current.name,
      subtitle: body.subtitle !== undefined ? body.subtitle.trim() : current.subtitle,
      description: body.description !== undefined ? body.description.trim() : current.description,
      themeColor: body.themeColor !== undefined ? body.themeColor : current.themeColor,
      isActive: body.isActive !== undefined ? !!body.isActive : current.isActive,
      exclusiveAccess: body.exclusiveAccess !== undefined ? !!body.exclusiveAccess : current.exclusiveAccess,
      assignedRoleIds: Array.isArray(body.assignedRoleIds) ? body.assignedRoleIds.map(Number) : current.assignedRoleIds,
      assignedUserIds: Array.isArray(body.assignedUserIds) ? body.assignedUserIds.map(Number) : current.assignedUserIds,
      enabledApps: Array.isArray(body.enabledApps) ? body.enabledApps : current.enabledApps,
      enabledPermissions: Array.isArray(body.enabledPermissions) ? body.enabledPermissions : current.enabledPermissions,
      updatedAt: new Date().toISOString(),
    };

    apartados[idx] = updated;
    saveApartadosForTenant(tenantId, apartados);

    return reply.send({
      success: true,
      message: "Configuración del apartado actualizada",
      data: updated,
    });
  });

  // 6. Eliminar un Apartado
  fastify.delete("/apartados/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const apartados = loadApartadosForTenant(tenantId);
    if (id === "apt-tecnicos") {
      return reply.status(400).send({
        success: false,
        message: "El Apartado Técnico principal no puede eliminarse, pero puedes configurar o desactivar sus aplicaciones.",
      });
    }
    const filtered = apartados.filter((a) => a.id !== id);
    saveApartadosForTenant(tenantId, filtered);
    return reply.send({ success: true, message: "Apartado eliminado" });
  });

  // =========================================================================
  // SUB-APIS OPERATIVAS PARA LAS 8 MINI-APPS DEL APARTADO TÉCNICO
  // =========================================================================

  // A. MIS INSTALACIONES Y AVERÍAS DE CAMPO
  fastify.get("/apartados/installations", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const list = loadInstallationsForTenant(tenantId);
    return reply.send({ success: true, data: list });
  });

  fastify.post("/apartados/installations", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<FieldInstallationOrder>;
    if (!body.customerName || !body.address) {
      return reply.status(400).send({ success: false, message: "Nombre del cliente y dirección son obligatorios" });
    }
    const list = loadInstallationsForTenant(tenantId);
    const newOrder: FieldInstallationOrder = {
      id: `ORD-${Date.now()}`,
      code: body.code || `INS-${new Date().getFullYear()}-${String(list.length + 101).padStart(3, "0")}`,
      type: body.type || "instalacion",
      priority: body.priority || "normal",
      status: "pendiente",
      customerId: body.customerId ? Number(body.customerId) : undefined,
      customerName: body.customerName.trim(),
      customerCiz: body.customerCiz || `CIZ-${String(body.customerId || list.length + 200).padStart(4, "0")}`,
      customerDni: body.customerDni || "",
      customerPhone: body.customerPhone || "",
      address: body.address.trim(),
      reference: body.reference || "",
      planName: body.planName || "Fibra Hogar 200 Mbps",
      napCode: body.napCode || "NAP-01",
      napPort: body.napPort || "Puerto 1",
      lat: body.lat ? Number(body.lat) : -12.0765,
      lng: body.lng ? Number(body.lng) : -77.0842,
      assignedTechId: body.assignedTechId ? Number(body.assignedTechId) : undefined,
      assignedTechName: body.assignedTechName || "Cuadrilla FTTH",
      scheduledTime: body.scheduledTime || "10:00 AM",
      scheduledDate: body.scheduledDate || new Date().toISOString().slice(0, 10),
      notes: body.notes || "",
      createdAt: new Date().toISOString(),
    };
    list.unshift(newOrder);
    saveInstallationsForTenant(tenantId, list);
    return reply.send({ success: true, message: "Orden asignada al apartado técnico", data: newOrder });
  });

  fastify.put("/apartados/installations/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Partial<FieldInstallationOrder>;
    const list = loadInstallationsForTenant(tenantId);
    const idx = list.findIndex((o) => o.id === id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Orden no encontrada" });
    }
    const updated: FieldInstallationOrder = {
      ...list[idx],
      ...body,
      completedAt: body.status === "completada" ? new Date().toISOString() : list[idx].completedAt,
    };
    list[idx] = updated;
    saveInstallationsForTenant(tenantId, list);
    return reply.send({ success: true, message: "Orden actualizada", data: updated });
  });

  // B. SOLICITUDES Y DEVOLUCIONES DE MATERIAL A ALMACÉN
  fastify.get("/apartados/material-requests", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const list = loadMaterialRequestsForTenant(tenantId);
    return reply.send({ success: true, data: list });
  });

  fastify.post("/apartados/material-requests", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<MaterialFieldRequest>;
    if (!body.itemName || !body.quantity) {
      return reply.status(400).send({ success: false, message: "Material y cantidad son obligatorios" });
    }
    const list = loadMaterialRequestsForTenant(tenantId);
    const entry: MaterialFieldRequest = {
      id: `MAT-${Date.now()}`,
      type: body.type === "devolucion" ? "devolucion" : "solicitud",
      status: "pendiente",
      techId: Number(body.techId || 0),
      techName: body.techName || "Técnico de Campo",
      itemName: body.itemName.trim(),
      productId: body.productId,
      assignmentId: body.assignmentId,
      quantity: Number(body.quantity) || 1,
      unit: body.unit || "und",
      serialOrMac: body.serialOrMac || "",
      urgency: body.urgency || "normal",
      reason: body.reason || "",
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    saveMaterialRequestsForTenant(tenantId, list);
    return reply.send({
      success: true,
      message: entry.type === "devolucion" ? "Devolución registrada y enviada a almacén" : "Solicitud enviada a almacén",
      data: entry,
    });
  });

  fastify.put("/apartados/material-requests/:id/status", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { status: "aprobado" | "rechazado"; adminNote?: string };
    const list = loadMaterialRequestsForTenant(tenantId);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return reply.status(404).send({ success: false, message: "Solicitud no encontrada" });

    list[idx].status = body.status;
    list[idx].adminNote = body.adminNote || "";
    list[idx].resolvedAt = new Date().toISOString();
    saveMaterialRequestsForTenant(tenantId, list);
    return reply.send({ success: true, data: list[idx] });
  });

  // C. SOLICITUDES DE ADELANTOS Y VIÁTICOS DEL TÉCNICO
  fastify.get("/apartados/advances", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const list = loadAdvancesForTenant(tenantId);
    return reply.send({ success: true, data: list });
  });

  fastify.post("/apartados/advances", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<TechAdvanceRequest>;
    if (!body.amount || Number(body.amount) <= 0) {
      return reply.status(400).send({ success: false, message: "Ingrese un monto válido" });
    }
    const list = loadAdvancesForTenant(tenantId);
    const entry: TechAdvanceRequest = {
      id: `ADV-${Date.now()}`,
      category: body.category || "adelanto_comision",
      status: "pendiente",
      techId: Number(body.techId || 0),
      techName: body.techName || "Técnico de Campo",
      amount: Number(body.amount),
      currency: body.currency || "S/",
      reason: body.reason || "Solicitud desde App Móvil Técnica",
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    saveAdvancesForTenant(tenantId, list);
    return reply.send({
      success: true,
      message: "Solicitud de adelanto/viático enviada a RRHH",
      data: entry,
    });
  });

  fastify.put("/apartados/advances/:id/status", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { status: "aprobado" | "rechazado"; adminNote?: string };
    const list = loadAdvancesForTenant(tenantId);
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return reply.status(404).send({ success: false, message: "Registro no encontrado" });
    list[idx].status = body.status;
    list[idx].adminNote = body.adminNote || "";
    list[idx].resolvedAt = new Date().toISOString();
    saveAdvancesForTenant(tenantId, list);
    return reply.send({ success: true, data: list[idx] });
  });

  // D. BUSCADOR CIZ Y DIAGNÓSTICO RÁPIDO DE CLIENTE EN CAMPO
  fastify.get("/apartados/ciz-search", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as { q?: string };
    const q = (query.q || "").trim().toLowerCase();
    const customers = loadCustomersForSeed(tenantId);

    const enriched = customers.map((c: any, index: number) => {
      const cizCode = c.cizCode || c.code || `CIZ-${String(c.id || index + 1).padStart(4, "0")}`;
      const isActive = c.status === "active" || c.status === "activo";
      // Señal óptica determinística realista por ID para diagnóstico de campo
      const dbmBase = -18.2 - ((Number(c.id || index) * 7) % 65) / 10;
      return {
        id: c.id,
        cizCode,
        name: c.name || "Cliente sin nombre",
        documentNumber: c.documentNumber || c.dni || "--",
        phone: c.phone || "--",
        address: c.address || "Dirección registrada en contrato",
        status: c.status || "active",
        planName: c.planName || c.plan || "Plan Fibra FTTH",
        monthlyPrice: c.monthlyPrice || c.price || 0,
        ipAddress: c.ipAddress || `10.20.${(Number(c.id || 1) % 20) + 1}.${(Number(c.id || 1) % 240) + 10}`,
        pppoeUser: c.pppoeUser || `pppoe_${(c.documentNumber || c.id || "user").toString().toLowerCase()}`,
        napBox: c.napBox || `NAP-0${((Number(c.id || 1) % 8) + 1)}`,
        napPort: c.napPort || `Puerto ${((Number(c.id || 1) % 16) + 1)}`,
        onuModel: c.onuModel || "Huawei EchoLife HG8145V5",
        opticalRxDbm: isActive ? dbmBase.toFixed(1) : "-32.5 (LOS)",
        pingMs: isActive ? `${2 + (Number(c.id || 1) % 6)} ms` : "Timeout",
        uptime: isActive ? `${(Number(c.id || 1) * 3) % 28 + 1}d 14h 22m` : "Sin sesión",
        lat: c.lat || -12.0765 + ((Number(c.id || 1) % 10) - 5) * 0.0015,
        lng: c.lng || -77.0842 + ((Number(c.id || 1) % 10) - 5) * 0.0015,
      };
    });

    const filtered = !q
      ? enriched.slice(0, 25)
      : enriched.filter(
          (item) =>
            item.cizCode.toLowerCase().includes(q) ||
            String(item.id).toLowerCase() === q ||
            item.name.toLowerCase().includes(q) ||
            item.documentNumber.toLowerCase().includes(q) ||
            item.ipAddress.toLowerCase().includes(q) ||
            item.pppoeUser.toLowerCase().includes(q) ||
            item.address.toLowerCase().includes(q)
        );

    return reply.send({
      success: true,
      total: filtered.length,
      data: filtered,
    });
  });

  // E. MARCACIÓN GPS DIRECTA DESDE EL APARTADO MÓVIL DE TÉCNICOS (SIN ERRORES 400/403)
  fastify.post("/apartados/attendance/:action", async (request, reply) => {
    const { action } = request.params as { action: string };
    const body = (request.body || {}) as {
      employeeId?: number;
      employeeName?: string;
      latitude?: number;
      longitude?: number;
      locationLabel?: string;
    };

    const empId = Number(body.employeeId || 1);
    const empName = (body.employeeName || "Técnico de Campo").trim();
    const tenantId = resolveTenantId(request);

    const now = new Date();
    const peruDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const peruTime = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);

    const attFile = path.resolve(process.cwd(), "data", "attendance.json");
    let records: any[] = [];
    try {
      if (fs.existsSync(attFile)) {
        const parsed = JSON.parse(fs.readFileSync(attFile, "utf-8"));
        if (Array.isArray(parsed)) records = parsed;
      }
    } catch {}

    let record = records.find(
      (r) =>
        (Number(r.employeeId) === empId ||
          (r.employeeName && r.employeeName.toLowerCase() === empName.toLowerCase())) &&
        r.date === peruDate
    );

    const locObj = {
      latitude: Number(body.latitude ?? -12.046374),
      longitude: Number(body.longitude ?? -77.042793),
      address: body.locationLabel || "App Móvil TurboTech GPS",
    };

    if (!record) {
      const nextId = records.length > 0 ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1;
      record = {
        id: nextId,
        employeeId: empId,
        employeeName: empName,
        tenantId,
        tenantName: "TurboNetwork",
        isShared: true,
        date: peruDate,
        checkIn: now.toISOString(),
        checkInTime: peruTime,
        lunchStart: null,
        lunchEndTime: null,
        checkOut: null,
        overtimeUnlocked: true,
        location: locObj,
        modality: "geolocation",
        biometricVerified: false,
        gpsVerified: true,
        manualApprovalStatus: "not_required",
        status: "on_time",
        minutesLate: 0,
      };
      records.unshift(record);
    } else {
      record.location = locObj;
      record.gpsVerified = true;
    }

    let message = `Marcación GPS registrada a las ${peruTime}`;
    if (action === "check-in") {
      record.checkIn = now.toISOString();
      record.checkInTime = peruTime;
      record.checkOut = null;
      message = `✓ Entrada GPS registrada a las ${peruTime}`;
    } else if (action === "lunch-start") {
      record.lunchStart = peruTime;
      message = `🍴 Inicio de almuerzo registrado a las ${peruTime}`;
    } else if (action === "lunch-end") {
      if (!record.lunchStart) record.lunchStart = peruTime;
      record.lunchEndTime = peruTime;
      message = `✓ Fin de almuerzo registrado a las ${peruTime}`;
    } else if (action === "check-out") {
      record.checkOut = peruTime;
      message = `🏁 Salida de turno GPS registrada a las ${peruTime}`;
    }

    try {
      fs.writeFileSync(attFile, JSON.stringify(records, null, 2), "utf-8");
    } catch {}

    return reply.send({
      success: true,
      message,
      data: record,
    });
  });
};
