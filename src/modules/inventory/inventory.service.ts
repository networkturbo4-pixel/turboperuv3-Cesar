import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getTenantFilePath } from "../tenants/tenants.service";
import {
  InventoryCategory,
  InventoryProduct,
  ProductType,
  ProductVariant,
  StockMovement,
  InventoryMetrics,
  FixedAsset,
  AssetCategory,
  AssetStatus,
  AssetMaintenance,
  AssetHistoryEvent,
  ProductPurchase,
  ClientInstallation,
  PersonnelAssignment,
  ProductTraceabilitySummary,
} from "./inventory.types";

const DEFAULT_CATEGORIES: Omit<InventoryCategory, "tenantId" | "createdAt" | "updatedAt">[] = [
  { id: "cat-fibra", name: "Cables & Fibra Óptica", description: "Bobinas, drops, pigtails y patch cords", color: "#2563eb" },
  { id: "cat-activos", name: "Equipos Activos & ONUs", description: "Routers, ONUs XPON, switches y OLTs", color: "#059669" },
  { id: "cat-pasivos", name: "Ferretería & Pasivos", description: "Splitters, cajas NAP, mangas y conectores", color: "#7c3aed" },
  { id: "cat-epp", name: "EPP & Seguridad Industrial", description: "Equipos de protección personal para técnicos", color: "#d97706" },
  { id: "cat-herramientas", name: "Herramientas & Medición", description: "Fusionadoras, OTDR, power meters y peladoras", color: "#0891b2" },
];

const DEFAULT_PRODUCTS: Omit<InventoryProduct, "tenantId" | "createdAt" | "updatedAt">[] = [
  // 1. PRODUCTO SIMPLE
  {
    id: 101,
    type: "simple",
    name: "Router Wi-Fi 6 Gigabit Dual Band AX1800",
    alternativeNames: ["Router AX1800", "Módem WiFi 6 Residencial", "AP Gigabit Dual Band"],
    categoryId: "cat-activos",
    categoryName: "Equipos Activos & ONUs",
    sku: "EQ-RTR-AX1800",
    barcode: "775981029384",
    batchNumber: "LOTE-2026-08A",
    entryDate: "2026-08-15T09:30:00Z",
    barcodePrinted: true,
    barcodePrintedAt: "2026-08-15T10:00:00Z",
    baseCost: 125.0,
    salePrice: 165.0,
    stock: 42,
    stockMin: 10,
    stockCritical: 3,
    images: [
      "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=600&q=80",
    ],
    description: "Router de alto rendimiento para abonados FTTH con soporte EasyMesh y 4 puertos Gigabit Ethernet.",
    location: "Estante A-02",
    status: "optimal",
  },
  // 2. PRODUCTO A GRANEL (Bulk)
  {
    id: 102,
    type: "bulk",
    name: "Cable de Fibra Óptica Drop FTTH 1 Hilo G657A2",
    alternativeNames: ["Cable Drop 1H", "Fibra Drop Exterior Negro", "Drop Flat 1 Core"],
    categoryId: "cat-fibra",
    categoryName: "Cables & Fibra Óptica",
    sku: "FBR-DROP-1H-MTR",
    unitOfMeasure: "Metros (m)",
    unitSku: "FBR-DROP-MTR",
    batchNumber: "LOTE-2026-09B",
    entryDate: "2026-09-02T14:15:00Z",
    barcodePrinted: false,
    allowDecimals: true,
    baseCost: 0.38,
    salePrice: 0.65,
    stock: 3500,
    stockMin: 800,
    stockCritical: 250,
    images: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
    ],
    description: "Cable de acometida exterior con mensajero de acero galvanizado y protección UV.",
    location: "Pasillo Central - Bobinas 04",
    status: "optimal",
  },
  // 3. PRODUCTO EPP (Equipos de Protección Personal con variantes y costos distintos)
  {
    id: 103,
    type: "epp",
    name: "Casco Dieléctrico con Barbiquejo de Seguridad",
    alternativeNames: ["Casco Liniero Alturas", "Casco Protección Dieléctrica Clase E", "Casco de Faena"],
    categoryId: "cat-epp",
    categoryName: "EPP & Seguridad Industrial",
    sku: "EPP-CSK-GEN",
    batchNumber: "LOTE-2026-07C",
    entryDate: "2026-07-20T11:00:00Z",
    barcodePrinted: true,
    barcodePrintedAt: "2026-07-20T11:45:00Z",
    baseCost: 48.0,
    salePrice: 65.0,
    stock: 38,
    stockMin: 12,
    stockCritical: 4,
    hasDifferentCostPerVariant: true,
    variants: [
      {
        id: "var-1",
        name: "Blanco / Talla Estándar (Liniero)",
        sku: "EPP-CSK-BL",
        quantity: 14,
        costPrice: 48.0,
        salePrice: 65.0,
      },
      {
        id: "var-2",
        name: "Azul Eléctrico / Talla Estándar (Técnico)",
        sku: "EPP-CSK-AZ",
        quantity: 12,
        costPrice: 50.0,
        salePrice: 68.0,
      },
      {
        id: "var-3",
        name: "Amarillo Alta Visibilidad c/ Barbiquejo 4 Puntas",
        sku: "EPP-CSK-AM-BAR",
        quantity: 12,
        costPrice: 56.0,
        salePrice: 75.0,
      },
    ],
    images: [
      "https://images.unsplash.com/photo-1578873375972-00b84c8a8e1b?auto=format&fit=crop&w=600&q=80",
    ],
    description: "Casco certificado ANSI Z89.1 Clase E para trabajos en postes y líneas eléctricas.",
    location: "Armario de Seguridad EPP-01",
    status: "optimal",
  },
  // 4. PRODUCTO EN STOCK CRÍTICO
  {
    id: 104,
    type: "simple",
    name: "Conector Rápido SC/APC Monomodo Ensamblado Manual",
    alternativeNames: ["Fast Connector SC/APC", "Conector Verde Fibra", "Conector Mecánico FTTH"],
    categoryId: "cat-pasivos",
    categoryName: "Ferretería & Pasivos",
    sku: "PAS-CON-SCAPC",
    batchNumber: "LOTE-2026-09C",
    entryDate: "2026-09-10T16:20:00Z",
    barcodePrinted: false,
    baseCost: 0.85,
    salePrice: 1.5,
    stock: 8,
    stockMin: 50,
    stockCritical: 15,
    images: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
    ],
    description: "Conector pre-pulido para terminación rápida en rosetas de cliente sin fusionadora.",
    location: "Cajón B-12",
    status: "critical",
  },
];

// ACTIVOS FIJOS INICIALES (Vehículo, Tecnología, Mobiliario)
const DEFAULT_ASSETS: Omit<FixedAsset, "tenantId" | "createdAt" | "updatedAt">[] = [
  {
    id: 501,
    code: "ACT-VEH-001",
    name: "Camioneta Técnica Toyota Hilux 4x4 Cuadrilla 1",
    category: "vehiculo",
    brand: "Toyota",
    model: "Hilux Doble Cabina 2.4 TDI",
    plateNumber: "ABC-123",
    serialNumber: "8AJFA8920194821",
    assignedTo: "Cuadrilla 1 - Técnico Juan Pérez",
    location: "Sede Principal - Cochera A",
    acquisitionDate: "2025-03-10",
    acquisitionCost: 32500.0,
    status: "operativo",
    description: "Camioneta equipada con portaescaleras reforzado, caja de herramientas metálica y conos de seguridad.",
    photos: [
      "https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=600&q=80",
    ],
    videos: [],
    maintenanceHistory: [
      {
        id: "maint-1",
        assetId: 501,
        type: "preventivo",
        title: "Mantenimiento 20,000 KM & Cambio de Aceite",
        description: "Cambio de aceite sintético 5W-30, filtro de aceite, filtro de aire y rotación de neumáticos.",
        cost: 280.0,
        technician: "Taller Autorizado Mitsui",
        date: "2026-08-10",
        photos: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80"],
        videos: [],
        createdAt: "2026-08-10T15:00:00Z",
      },
    ],
    eventHistory: [
      {
        id: "evt-1",
        assetId: 501,
        type: "creacion",
        title: "Alta de Activo en Flota",
        description: "Incorporación a la flota de TurboNetwork.",
        operator: "Admin",
        date: "2025-03-10T10:00:00Z",
      },
      {
        id: "evt-2",
        assetId: 501,
        type: "asignacion",
        title: "Asignación a Cuadrilla 1",
        description: "Entrega de llaves y tarjeta de propiedad a Juan Pérez.",
        operator: "Jefe de Operaciones",
        date: "2025-03-12T08:30:00Z",
      },
    ],
  },
  {
    id: 502,
    code: "ACT-TEC-001",
    name: "Fusionadora de Fibra Óptica Fujikura 90S+ Core Alignment",
    category: "tecnologia",
    brand: "Fujikura",
    model: "90S+ Core Alignment",
    serialNumber: "FJ-90S-984210",
    assignedTo: "Técnico Especialista Carlos Gómez",
    location: "Laboratorio NOC / Cuadrilla Fibra",
    acquisitionDate: "2025-06-20",
    acquisitionCost: 6800.0,
    status: "operativo",
    description: "Equipo de fusión por alineación de núcleo con pérdida < 0.02 dB y cortadora CT-50 Bluetooth.",
    photos: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    ],
    videos: [],
    maintenanceHistory: [
      {
        id: "maint-2",
        assetId: 502,
        type: "calibracion",
        title: "Calibración de Electrodos y Limpieza de Lentes V-Groove",
        description: "Calibración anual con 1,200 arcos realizados, reemplazo de electrodos originales Fujikura.",
        cost: 150.0,
        technician: "Servicio Técnico Óptico",
        date: "2026-06-15",
        photos: [],
        videos: [],
        createdAt: "2026-06-15T12:00:00Z",
      },
    ],
    eventHistory: [
      {
        id: "evt-3",
        assetId: 502,
        type: "creacion",
        title: "Compra e ingreso a inventario técnico",
        description: "Adquirida para proyectos de expansión FTTH troncal.",
        operator: "Admin",
        date: "2025-06-20T11:00:00Z",
      },
    ],
  },
  {
    id: 503,
    code: "ACT-MOB-001",
    name: "Gabinete Rack Servidores 42U 800x1000mm Puerta Microperforada",
    category: "mobiliario",
    brand: "Nexxt Solutions",
    model: "Server Rack 42U Heavy Duty",
    serialNumber: "NXT-42U-003",
    assignedTo: "NOC DataCenter Central",
    location: "Data Center Piso 2 - Fila A",
    acquisitionDate: "2024-11-05",
    acquisitionCost: 1150.0,
    status: "operativo",
    description: "Rack para servidores de cabecera MikroTik CCR2216 y OLTs Huawei SmartAX.",
    photos: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
    ],
    videos: [],
    maintenanceHistory: [],
    eventHistory: [
      {
        id: "evt-4",
        assetId: 503,
        type: "creacion",
        title: "Instalación y anclaje antisísmico en sala de datos",
        description: "Anclaje con barras roscadas a losa de piso técnico.",
        operator: "Admin",
        date: "2024-11-05T09:00:00Z",
      },
    ],
  },
];

function calculateStatus(stock: number, stockMin: number, stockCritical: number): "optimal" | "low" | "critical" | "out_of_stock" {
  if (stock <= 0) return "out_of_stock";
  if (stock <= stockCritical) return "critical";
  if (stock <= stockMin) return "low";
  return "optimal";
}

// 60 Días de caducidad automática para productos en papelera
const TRASH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function purgeOldTrash(products: InventoryProduct[]): { products: InventoryProduct[]; purgedCount: number } {
  const now = Date.now();
  let purgedCount = 0;

  const validProducts = products.filter((p) => {
    if (!p.isDeleted || !p.deletedAt) return true;
    const deletedTime = new Date(p.deletedAt).getTime();
    if (now - deletedTime > TRASH_TTL_MS) {
      purgedCount++;
      return false; // Eliminar definitivamente tras 60 días
    }
    return true;
  });

  return { products: validProducts, purgedCount };
}

// ==========================================
// PERSISTENCIA Y CARGA DE PRODUCTOS
// ==========================================

export function loadCategories(tenantId: string): InventoryCategory[] {
  const filePath = getTenantFilePath(tenantId, "inventory_categories.json");
  if (!fs.existsSync(filePath)) {
    const initialCategories: InventoryCategory[] = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(filePath, JSON.stringify(initialCategories, null, 2), "utf-8");
    return initialCategories;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading inventory categories for tenant ${tenantId}:`, err);
    return [];
  }
}

export function saveCategories(tenantId: string, categories: InventoryCategory[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_categories.json");
  fs.writeFileSync(filePath, JSON.stringify(categories, null, 2), "utf-8");
}

export function loadProducts(tenantId: string): InventoryProduct[] {
  const filePath = getTenantFilePath(tenantId, "inventory_products.json");
  if (!fs.existsSync(filePath)) {
    const initialProducts: InventoryProduct[] = DEFAULT_PRODUCTS.map((p) => {
      const stock = p.type === "epp" && p.variants ? p.variants.reduce((acc, v) => acc + (v.quantity || 0), 0) : p.stock;
      return {
        ...p,
        stock,
        tenantId,
        isDeleted: false,
        status: calculateStatus(stock, p.stockMin, p.stockCritical),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    fs.writeFileSync(filePath, JSON.stringify(initialProducts, null, 2), "utf-8");
    return initialProducts;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const rawProducts: InventoryProduct[] = JSON.parse(raw);

    // Depuración automática de papelera > 60 días
    const { products, purgedCount } = purgeOldTrash(rawProducts);
    if (purgedCount > 0) {
      saveProducts(tenantId, products);
    }

    return products.map((p) => {
      const totalStock = p.type === "epp" && p.variants && p.variants.length > 0
        ? p.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
        : Number(p.stock) || 0;
      return {
        ...p,
        stock: totalStock,
        status: calculateStatus(totalStock, p.stockMin, p.stockCritical),
      };
    });
  } catch (err) {
    console.error(`Error loading inventory products for tenant ${tenantId}:`, err);
    return [];
  }
}

export function saveProducts(tenantId: string, products: InventoryProduct[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_products.json");
  fs.writeFileSync(filePath, JSON.stringify(products, null, 2), "utf-8");
}

export function loadMovements(tenantId: string): StockMovement[] {
  const filePath = getTenantFilePath(tenantId, "inventory_movements.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMovement(tenantId: string, movement: StockMovement): void {
  const filePath = getTenantFilePath(tenantId, "inventory_movements.json");
  const movements = loadMovements(tenantId);
  movements.unshift(movement);
  fs.writeFileSync(filePath, JSON.stringify(movements.slice(0, 1000), null, 2), "utf-8");
}

// ==========================================
// SERVICIOS DE PRODUCTOS (CATÁLOGO ACTIVO)
// ==========================================

export function getInventoryProducts(
  tenantId: string,
  filters?: {
    type?: string;
    categoryId?: string;
    search?: string;
    status?: string;
    includeDeleted?: boolean;
  }
): InventoryProduct[] {
  let products = loadProducts(tenantId);

  // Por defecto excluimos papelera
  if (!filters?.includeDeleted) {
    products = products.filter((p) => !p.isDeleted);
  }

  const categories = loadCategories(tenantId);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  products = products.map((p) => ({
    ...p,
    categoryName: catMap.get(p.categoryId) || p.categoryName || "Sin categoría",
  }));

  if (filters?.type && filters.type !== "all") {
    products = products.filter((p) => p.type === filters.type);
  }

  if (filters?.categoryId && filters.categoryId !== "all") {
    products = products.filter((p) => p.categoryId === filters.categoryId);
  }

  if (filters?.status && filters.status !== "all") {
    products = products.filter((p) => p.status === filters.status);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    products = products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode?.toLowerCase().includes(q);
      const matchCat = p.categoryName?.toLowerCase().includes(q);
      const matchAlt = (p.alternativeNames || []).some((alt) => alt.toLowerCase().includes(q));
      const matchVariants = (p.variants || []).some(
        (v) => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)
      );
      return matchName || matchSku || matchBarcode || matchCat || matchAlt || matchVariants;
    });
  }

  return products;
}

export function getProductById(tenantId: string, id: number): InventoryProduct | null {
  const products = loadProducts(tenantId);
  const found = products.find((p) => p.id === id);
  if (!found) return null;

  const categories = loadCategories(tenantId);
  const cat = categories.find((c) => c.id === found.categoryId);
  return {
    ...found,
    categoryName: cat ? cat.name : found.categoryName,
  };
}

export function createProduct(
  tenantId: string,
  payload: Omit<InventoryProduct, "id" | "tenantId" | "status" | "createdAt" | "updatedAt">
): InventoryProduct {
  const products = loadProducts(tenantId);
  const newId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 101;

  let totalStock = Number(payload.stock) || 0;
  if (payload.type === "epp" && payload.variants && payload.variants.length > 0) {
    totalStock = payload.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
  }

  const now = new Date().toISOString();
  const newProduct: InventoryProduct = {
    ...payload,
    id: newId,
    tenantId,
    stock: totalStock,
    stockMin: Number(payload.stockMin) || 0,
    stockCritical: Number(payload.stockCritical) || 0,
    baseCost: Number(payload.baseCost) || 0,
    salePrice: Number(payload.salePrice) || 0,
    alternativeNames: Array.isArray(payload.alternativeNames) ? payload.alternativeNames : [],
    images: Array.isArray(payload.images) ? payload.images : [],
    variants: Array.isArray(payload.variants) ? payload.variants : [],
    isDeleted: false,
    entryDate: payload.entryDate || now,
    barcodePrinted: false,
    status: calculateStatus(totalStock, payload.stockMin, payload.stockCritical),
    createdAt: now,
    updatedAt: now,
  };

  products.unshift(newProduct);
  saveProducts(tenantId, products);

  if (totalStock > 0) {
    saveMovement(tenantId, {
      id: crypto.randomUUID(),
      tenantId,
      productId: newId,
      productName: newProduct.name,
      type: "in",
      quantity: totalStock,
      reason: "Inventario Inicial",
      timestamp: now,
    });
  }

  return newProduct;
}

export function updateProduct(
  tenantId: string,
  id: number,
  payload: Partial<InventoryProduct>
): InventoryProduct | null {
  const products = loadProducts(tenantId);
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const current = products[index];

  let totalStock = payload.stock !== undefined ? Number(payload.stock) : current.stock;
  if (payload.type === "epp" || (current.type === "epp" && !payload.type)) {
    const variants = payload.variants || current.variants || [];
    if (variants.length > 0) {
      totalStock = variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
    }
  }

  const stockMin = payload.stockMin !== undefined ? Number(payload.stockMin) : current.stockMin;
  const stockCritical = payload.stockCritical !== undefined ? Number(payload.stockCritical) : current.stockCritical;

  const updated: InventoryProduct = {
    ...current,
    ...payload,
    id: current.id,
    tenantId,
    stock: totalStock,
    stockMin,
    stockCritical,
    baseCost: payload.baseCost !== undefined ? Number(payload.baseCost) : current.baseCost,
    salePrice: payload.salePrice !== undefined ? Number(payload.salePrice) : current.salePrice,
    alternativeNames: payload.alternativeNames || current.alternativeNames,
    images: payload.images || current.images,
    variants: payload.variants || current.variants,
    status: calculateStatus(totalStock, stockMin, stockCritical),
    updatedAt: new Date().toISOString(),
  };

  products[index] = updated;
  saveProducts(tenantId, products);
  return updated;
}

// Soft Delete hacia la papelera
export function softDeleteProduct(tenantId: string, id: number): boolean {
  const products = loadProducts(tenantId);
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return false;

  products[index].isDeleted = true;
  products[index].deletedAt = new Date().toISOString();
  saveProducts(tenantId, products);

  saveMovement(tenantId, {
    id: crypto.randomUUID(),
    tenantId,
    productId: id,
    productName: products[index].name,
    type: "out",
    quantity: 0,
    reason: "Enviado a papelera de reciclaje",
    timestamp: new Date().toISOString(),
  });

  return true;
}

// ==========================================
// PAPELERA DE RECICLAJE (HASTA 60 DÍAS)
// ==========================================

export interface TrashItem extends InventoryProduct {
  daysRemaining: number;
}

export function getTrashProducts(tenantId: string): TrashItem[] {
  const products = loadProducts(tenantId);
  const now = Date.now();

  return products
    .filter((p) => p.isDeleted && p.deletedAt)
    .map((p) => {
      const deletedTime = new Date(p.deletedAt!).getTime();
      const elapsedMs = now - deletedTime;
      const daysRemaining = Math.max(0, 60 - Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
      return {
        ...p,
        daysRemaining,
      };
    })
    .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
}

export function restoreProduct(tenantId: string, id: number): boolean {
  const products = loadProducts(tenantId);
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return false;

  products[index].isDeleted = false;
  delete products[index].deletedAt;
  products[index].updatedAt = new Date().toISOString();
  saveProducts(tenantId, products);

  saveMovement(tenantId, {
    id: crypto.randomUUID(),
    tenantId,
    productId: id,
    productName: products[index].name,
    type: "in",
    quantity: 0,
    reason: "Restaurado desde papelera de reciclaje",
    timestamp: new Date().toISOString(),
  });

  return true;
}

export function permanentDeleteProduct(tenantId: string, id: number): boolean {
  const products = loadProducts(tenantId);
  const filtered = products.filter((p) => p.id !== id);
  if (filtered.length === products.length) return false;
  saveProducts(tenantId, filtered);
  return true;
}

export function emptyTrash(tenantId: string): number {
  const products = loadProducts(tenantId);
  const kept = products.filter((p) => !p.isDeleted);
  const deletedCount = products.length - kept.length;
  saveProducts(tenantId, kept);
  return deletedCount;
}

// ==========================================
// MARCACIÓN DE CÓDIGOS DE BARRA IMPRESOS
// ==========================================

export function markBarcodesPrinted(tenantId: string, productIds: number[]): { updatedCount: number } {
  const products = loadProducts(tenantId);
  const now = new Date().toISOString();
  let count = 0;

  products.forEach((p) => {
    if (productIds.includes(p.id)) {
      p.barcodePrinted = true;
      p.isBarcodePrinted = true;
      p.barcodePrintedAt = now;
      count++;
    }
  });

  if (count > 0) {
    saveProducts(tenantId, products);
  }
  return { updatedCount: count };
}

// ==========================================
// AJUSTE DE STOCK & KARDEX
// ==========================================

export function adjustStock(
  tenantId: string,
  productId: number,
  params: {
    type: "in" | "out" | "adjustment";
    quantity: number;
    variantId?: string;
    reason: string;
    operatorName?: string;
  }
): InventoryProduct | null {
  const products = loadProducts(tenantId);
  const p = products.find((item) => item.id === productId);
  if (!p) return null;

  const qty = Number(params.quantity);
  if (isNaN(qty) || qty <= 0) return null;

  let variantName = "";

  if (p.type === "epp" && params.variantId && p.variants) {
    const vIndex = p.variants.findIndex((v) => v.id === params.variantId);
    if (vIndex !== -1) {
      variantName = p.variants[vIndex].name;
      if (params.type === "in") {
        p.variants[vIndex].quantity += qty;
      } else if (params.type === "out") {
        p.variants[vIndex].quantity = Math.max(0, p.variants[vIndex].quantity - qty);
      } else if (params.type === "adjustment") {
        p.variants[vIndex].quantity = qty;
      }
      p.stock = p.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
    }
  } else {
    if (params.type === "in") {
      p.stock += qty;
    } else if (params.type === "out") {
      p.stock = Math.max(0, p.stock - qty);
    } else if (params.type === "adjustment") {
      p.stock = qty;
    }
  }

  p.status = calculateStatus(p.stock, p.stockMin, p.stockCritical);
  p.updatedAt = new Date().toISOString();

  saveProducts(tenantId, products);

  saveMovement(tenantId, {
    id: crypto.randomUUID(),
    tenantId,
    productId,
    productName: p.name,
    type: params.type,
    quantity: qty,
    variantId: params.variantId,
    variantName,
    reason: params.reason || "Ajuste de stock",
    operatorName: params.operatorName || "Operador",
    timestamp: new Date().toISOString(),
  });

  return p;
}

// ==========================================
// CATEGORÍAS
// ==========================================

export function getCategories(tenantId: string): InventoryCategory[] {
  return loadCategories(tenantId);
}

export function createCategory(
  tenantId: string,
  payload: { name: string; description?: string; color?: string }
): InventoryCategory {
  const categories = loadCategories(tenantId);
  const slugId = "cat-" + crypto.randomBytes(3).toString("hex");
  const now = new Date().toISOString();

  const newCat: InventoryCategory = {
    id: slugId,
    tenantId,
    name: payload.name.trim(),
    description: payload.description?.trim() || "",
    color: payload.color || "#3b82f6",
    createdAt: now,
    updatedAt: now,
  };

  categories.push(newCat);
  saveCategories(tenantId, categories);
  return newCat;
}

export function updateCategory(
  tenantId: string,
  id: string,
  payload: { name?: string; description?: string; color?: string }
): InventoryCategory | null {
  const categories = loadCategories(tenantId);
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) return null;

  categories[index] = {
    ...categories[index],
    name: payload.name ? payload.name.trim() : categories[index].name,
    description: payload.description !== undefined ? payload.description.trim() : categories[index].description,
    color: payload.color || categories[index].color,
    updatedAt: new Date().toISOString(),
  };

  saveCategories(tenantId, categories);
  return categories[index];
}

export function deleteCategory(tenantId: string, id: string): { success: boolean; message?: string } {
  const categories = loadCategories(tenantId);
  const products = loadProducts(tenantId);

  const inUse = products.some((p) => p.categoryId === id);
  if (inUse) {
    return { success: false, message: "No se puede eliminar la categoría porque tiene productos asignados." };
  }

  const filtered = categories.filter((c) => c.id !== id);
  if (filtered.length === categories.length) {
    return { success: false, message: "Categoría no encontrada." };
  }

  saveCategories(tenantId, filtered);
  return { success: true };
}

// ==========================================
// ACTIVOS FIJOS (VEHÍCULO, TECNOLOGÍA, MOBILIARIO)
// ==========================================

export function loadAssets(tenantId: string): FixedAsset[] {
  const filePath = getTenantFilePath(tenantId, "inventory_assets.json");
  if (!fs.existsSync(filePath)) {
    const initialAssets: FixedAsset[] = DEFAULT_ASSETS.map((a) => ({
      ...a,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(filePath, JSON.stringify(initialAssets, null, 2), "utf-8");
    return initialAssets;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading fixed assets for tenant ${tenantId}:`, err);
    return [];
  }
}

export function saveAssets(tenantId: string, assets: FixedAsset[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_assets.json");
  fs.writeFileSync(filePath, JSON.stringify(assets, null, 2), "utf-8");
}

export function getAssets(tenantId: string, category?: AssetCategory): FixedAsset[] {
  let assets = loadAssets(tenantId);
  if (category && category !== ("all" as any)) {
    assets = assets.filter((a) => a.category === category);
  }
  return assets;
}

export function getAssetById(tenantId: string, id: number): FixedAsset | null {
  const assets = loadAssets(tenantId);
  return assets.find((a) => a.id === id) || null;
}

export function createAsset(
  tenantId: string,
  payload: Omit<FixedAsset, "id" | "tenantId" | "maintenanceHistory" | "eventHistory" | "createdAt" | "updatedAt">
): FixedAsset {
  const assets = loadAssets(tenantId);
  const newId = assets.length > 0 ? Math.max(...assets.map((a) => a.id)) + 1 : 501;
  const now = new Date().toISOString();

  const newAsset: FixedAsset = {
    ...payload,
    id: newId,
    tenantId,
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    maintenanceHistory: [],
    eventHistory: [
      {
        id: crypto.randomUUID(),
        assetId: newId,
        type: "creacion",
        title: "Alta de Activo Fijo",
        description: `Registro inicial de ${payload.name} (${payload.category})`,
        operator: "Sistema",
        date: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  assets.unshift(newAsset);
  saveAssets(tenantId, assets);
  return newAsset;
}

export function updateAsset(
  tenantId: string,
  id: number,
  payload: Partial<FixedAsset>
): FixedAsset | null {
  const assets = loadAssets(tenantId);
  const index = assets.findIndex((a) => a.id === id);
  if (index === -1) return null;

  assets[index] = {
    ...assets[index],
    ...payload,
    updatedAt: new Date().toISOString(),
  };

  saveAssets(tenantId, assets);
  return assets[index];
}

export function deleteAsset(tenantId: string, id: number): boolean {
  const assets = loadAssets(tenantId);
  const filtered = assets.filter((a) => a.id !== id);
  if (filtered.length === assets.length) return false;
  saveAssets(tenantId, filtered);
  return true;
}

export function addAssetMaintenance(
  tenantId: string,
  assetId: number,
  payload: Omit<AssetMaintenance, "id" | "assetId" | "createdAt">
): AssetMaintenance | null {
  const assets = loadAssets(tenantId);
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) return null;

  const now = new Date().toISOString();
  const maintenance: AssetMaintenance = {
    ...payload,
    id: "maint-" + crypto.randomBytes(3).toString("hex"),
    assetId,
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    createdAt: now,
  };

  asset.maintenanceHistory.unshift(maintenance);

  // Registrar automáticamente evento en la línea de tiempo del activo
  asset.eventHistory.unshift({
    id: crypto.randomUUID(),
    assetId,
    type: "mantenimiento",
    title: maintenance.title,
    description: `Mantenimiento ${maintenance.type}: ${maintenance.description} ($${maintenance.cost.toFixed(2)})`,
    operator: maintenance.technician,
    date: maintenance.date || now,
    photos: maintenance.photos,
    videos: maintenance.videos,
  });

  asset.updatedAt = now;
  saveAssets(tenantId, assets);
  return maintenance;
}

export function addAssetEvent(
  tenantId: string,
  assetId: number,
  payload: Omit<AssetHistoryEvent, "id" | "assetId">
): AssetHistoryEvent | null {
  const assets = loadAssets(tenantId);
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) return null;

  const event: AssetHistoryEvent = {
    ...payload,
    id: crypto.randomUUID(),
    assetId,
  };

  asset.eventHistory.unshift(event);
  asset.updatedAt = new Date().toISOString();
  saveAssets(tenantId, assets);
  return event;
}

// ==========================================
// HISTORIAL & TRAZABILIDAD 360° (COMPRAS, CLIENTES, PERSONAL)
// ==========================================

export function loadPurchases(tenantId: string): ProductPurchase[] {
  const filePath = getTenantFilePath(tenantId, "inventory_purchases.json");
  if (!fs.existsSync(filePath)) {
    const starterPurchases: ProductPurchase[] = [
      {
        id: "pch-001",
        tenantId,
        productId: 101,
        supplier: "Huawei Enterprise Tech SAC",
        invoiceNumber: "F001-002891",
        date: "2026-08-15",
        quantity: 50,
        unitCost: 125.0,
        totalCost: 6250.0,
        notes: "Importación Lote 2026-08A Routers Wi-Fi 6",
        createdAt: "2026-08-15T09:30:00Z",
      },
      {
        id: "pch-002",
        tenantId,
        productId: 102,
        supplier: "OptoFibre Telecom Perú",
        invoiceNumber: "F003-009841",
        date: "2026-09-02",
        quantity: 4000,
        unitCost: 0.38,
        totalCost: 1520.0,
        notes: "Carretes de 1000m Drop G657A2 exterior",
        createdAt: "2026-09-02T14:15:00Z",
      },
    ];
    fs.writeFileSync(filePath, JSON.stringify(starterPurchases, null, 2), "utf-8");
    return starterPurchases;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePurchases(tenantId: string, purchases: ProductPurchase[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_purchases.json");
  fs.writeFileSync(filePath, JSON.stringify(purchases, null, 2), "utf-8");
}

export function loadInstallations(tenantId: string): ClientInstallation[] {
  const filePath = getTenantFilePath(tenantId, "inventory_installations.json");
  if (!fs.existsSync(filePath)) {
    const starterInstallations: ClientInstallation[] = [
      {
        id: "inst-001",
        tenantId,
        productId: 101,
        customerId: 1,
        customerName: "Carlos Méndez Soto",
        address: "Av. Los Rosales 450 - Dpto 301, San Isidro",
        assignedIp: "192.168.10.15",
        installedAt: "2026-08-20T11:30:00Z",
        technicianName: "Juan Pérez",
        quantity: 1,
        notes: "Instalación Plan 300 Mbps Fibra",
      },
      {
        id: "inst-002",
        tenantId,
        productId: 101,
        customerId: 2,
        customerName: "María Fernández Dávila",
        address: "Calle Los Pinos 182, Miraflores",
        assignedIp: "192.168.10.16",
        installedAt: "2026-08-25T16:00:00Z",
        technicianName: "Carlos Gómez",
        quantity: 1,
        notes: "Migración de HFC a FTTH Wi-Fi 6",
      },
      {
        id: "inst-003",
        tenantId,
        productId: 102,
        customerId: 1,
        customerName: "Carlos Méndez Soto",
        address: "Av. Los Rosales 450, San Isidro",
        assignedIp: "192.168.10.15",
        installedAt: "2026-08-20T11:30:00Z",
        technicianName: "Juan Pérez",
        quantity: 120, // 120 metros de drop
        notes: "Tirada desde caja NAP-04 hasta roseta interior",
      },
    ];
    fs.writeFileSync(filePath, JSON.stringify(starterInstallations, null, 2), "utf-8");
    return starterInstallations;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveInstallations(tenantId: string, installations: ClientInstallation[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_installations.json");
  fs.writeFileSync(filePath, JSON.stringify(installations, null, 2), "utf-8");
}

export function loadAssignments(tenantId: string): PersonnelAssignment[] {
  const filePath = getTenantFilePath(tenantId, "inventory_assignments.json");
  if (!fs.existsSync(filePath)) {
    const starterAssignments: PersonnelAssignment[] = [
      {
        id: "asg-001",
        tenantId,
        productId: 103, // Casco EPP
        employeeId: 1,
        employeeName: "Juan Pérez (Técnico Alturas)",
        assignedAt: "2026-07-22T08:00:00Z",
        quantity: 1,
        status: "en_uso",
        variantName: "Blanco / Talla Estándar (Liniero)",
        notes: "Asignación semestral de EPP normado",
      },
      {
        id: "asg-002",
        tenantId,
        productId: 103,
        employeeId: 2,
        employeeName: "Carlos Gómez (Técnico Fibra)",
        assignedAt: "2026-07-22T08:15:00Z",
        quantity: 1,
        status: "en_uso",
        variantName: "Azul Eléctrico / Talla Estándar (Técnico)",
        notes: "Asignación semestral de EPP normado",
      },
      {
        id: "asg-003",
        tenantId,
        productId: 101, // Router en cuadrilla de móvil
        employeeId: 1,
        employeeName: "Juan Pérez",
        assignedAt: "2026-09-28T07:30:00Z",
        quantity: 4,
        status: "en_uso",
        notes: "Stock móvil en camioneta para instalaciones del día",
      },
    ];
    fs.writeFileSync(filePath, JSON.stringify(starterAssignments, null, 2), "utf-8");
    return starterAssignments;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAssignments(tenantId: string, assignments: PersonnelAssignment[]): void {
  const filePath = getTenantFilePath(tenantId, "inventory_assignments.json");
  fs.writeFileSync(filePath, JSON.stringify(assignments, null, 2), "utf-8");
}

// REGISTRAR COMPRA (Aumenta stock e inserta movimiento)
export function createPurchase(
  tenantId: string,
  payload: Omit<ProductPurchase, "id" | "tenantId" | "createdAt">
): ProductPurchase {
  const purchases = loadPurchases(tenantId);
  const now = new Date().toISOString();
  const newPurchase: ProductPurchase = {
    ...payload,
    id: "pch-" + crypto.randomBytes(3).toString("hex"),
    tenantId,
    totalCost: Number(payload.quantity) * Number(payload.unitCost),
    createdAt: now,
  };

  purchases.unshift(newPurchase);
  savePurchases(tenantId, purchases);

  // Aumentar stock del producto en el catálogo
  adjustStock(tenantId, payload.productId, {
    type: "in",
    quantity: payload.quantity,
    reason: `Compra Fac #${payload.invoiceNumber} - ${payload.supplier}`,
    operatorName: "Compras / Recepción",
  });

  return newPurchase;
}

// REGISTRAR INSTALACIÓN EN CLIENTE (Disminuye stock de almacén)
export function createClientInstallation(
  tenantId: string,
  payload: Omit<ClientInstallation, "id" | "tenantId">
): ClientInstallation {
  const installations = loadInstallations(tenantId);
  const newInstallation: ClientInstallation = {
    ...payload,
    id: "inst-" + crypto.randomBytes(3).toString("hex"),
    tenantId,
  };

  installations.unshift(newInstallation);
  saveInstallations(tenantId, installations);

  // Descontar del almacén
  adjustStock(tenantId, payload.productId, {
    type: "out",
    quantity: payload.quantity,
    reason: `Instalación Cliente: ${payload.customerName}`,
    operatorName: payload.technicianName,
  });

  return newInstallation;
}

// ASIGNAR MATERIAL / EPP A PERSONAL
export function createPersonnelAssignment(
  tenantId: string,
  payload: Omit<PersonnelAssignment, "id" | "tenantId">
): PersonnelAssignment {
  const assignments = loadAssignments(tenantId);
  const products = loadProducts(tenantId);
  const product = products.find((p) => p.id === payload.productId);

  const newAssignment: PersonnelAssignment = {
    ...payload,
    productName: payload.productName || product?.name || "Material",
    productSku: payload.productSku || product?.sku || "SKU-GEN",
    productImage: payload.productImage || (product?.images && product.images[0]) || "",
    id: "asg-" + crypto.randomBytes(3).toString("hex"),
    tenantId,
  };

  assignments.unshift(newAssignment);
  saveAssignments(tenantId, assignments);

  // Descontar del almacén principal
  adjustStock(tenantId, payload.productId, {
    type: "out",
    quantity: payload.quantity,
    reason: `Asignación a técnico: ${payload.employeeName}`,
    operatorName: "Despacho Almacén",
  });

  return newAssignment;
}

// DEVOLUCIÓN DE ASIGNACIÓN
export function returnPersonnelAssignment(
  tenantId: string,
  assignmentId: string,
  options?: { notes?: string; condition?: "buen_estado" | "danado" | "observacion" } | string
): PersonnelAssignment | null {
  const assignments = loadAssignments(tenantId);
  const asg = assignments.find((a) => a.id === assignmentId);
  if (!asg || asg.status === "devuelto") return null;

  const notes = typeof options === "string" ? options : options?.notes;
  const condition = typeof options === "object" ? options?.condition : "buen_estado";

  asg.status = "devuelto";
  asg.returnCondition = condition || "buen_estado";
  asg.returnedAt = new Date().toISOString();
  if (notes) asg.notes = (asg.notes ? asg.notes + " | " : "") + notes;

  saveAssignments(tenantId, assignments);

  // Reingresar stock al almacén principal solo si está en buen estado
  if (asg.returnCondition === "buen_estado") {
    adjustStock(tenantId, asg.productId, {
      type: "in",
      quantity: asg.quantity,
      reason: `Devolución de material/EPP por ${asg.employeeName} (Buen estado)`,
      operatorName: "Recepción Almacén",
    });
  } else {
    // Si está dañado o en observación, registramos observación/merma
    adjustStock(tenantId, asg.productId, {
      type: "adjustment",
      quantity: 0,
      reason: `Devolución de ${asg.employeeName} reportada como: ${asg.returnCondition} (Requiere reposición/taller)`,
      operatorName: "Recepción Almacén",
    });
  }

  return asg;
}

export function getPersonnelAssignments(
  tenantId: string,
  options?: { employeeId?: string | number; status?: string }
): PersonnelAssignment[] {
  let list = loadAssignments(tenantId);
  if (options?.employeeId) {
    const target = String(options.employeeId).trim();
    list = list.filter((a) => String(a.employeeId).trim() === target);
  }
  if (options?.status) {
    list = list.filter((a) => a.status === options.status);
  }
  return list;
}

// TRAZABILIDAD 360° POR SKU O CÓDIGO DE BARRAS O ID
export function getProductTraceability(
  tenantId: string,
  skuOrBarcodeOrId: string
): ProductTraceabilitySummary | null {
  const products = loadProducts(tenantId);
  const needle = skuOrBarcodeOrId.trim().toLowerCase();

  const product = products.find((p) => {
    return (
      String(p.id) === needle ||
      (p.sku && p.sku.toLowerCase() === needle) ||
      (p.barcode && p.barcode.toLowerCase() === needle) ||
      (p.unitSku && p.unitSku.toLowerCase() === needle) ||
      (p.variants && p.variants.some((v) => v.sku && v.sku.toLowerCase() === needle)) ||
      (p.bulkUnits && p.bulkUnits.some((u) => u.sku && u.sku.toLowerCase() === needle))
    );
  }) || products.find((p) => (p.name && p.name.toLowerCase().includes(needle)));

  if (!product) return null;

  const allMovements = loadMovements(tenantId).filter((m) => m.productId === product.id);
  const allPurchases = loadPurchases(tenantId).filter((p) => p.productId === product.id);
  const allInstallations = loadInstallations(tenantId).filter((i) => i.productId === product.id);
  const allAssignments = loadAssignments(tenantId).filter((a) => a.productId === product.id);

  // Cálculo de las 6 tarjetas de información
  const totalPurchasedQty = allPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  const installedCustomersQty = allInstallations.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const inPersonnelEppQty = allAssignments
    .filter((a) => a.status === "en_uso" || a.status === "entregado")
    .reduce((acc, a) => acc + (Number(a.quantity) || 0), 0);

  // Movimientos clasificados
  const damagedOrDischarged = allMovements
    .filter((m) => m.type === "out" && /merma|dañado|quemado|baja|garantia|roto/i.test(m.reason))
    .reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);

  const inObservation = allMovements
    .filter((m) => /observacion|taller|laboratorio|prueba/i.test(m.reason))
    .reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);

  const totalRegistered = Math.max(
    product.stock + installedCustomersQty + inPersonnelEppQty + damagedOrDischarged,
    totalPurchasedQty || product.stock
  );

  return {
    product,
    stats: {
      totalRegistered,
      stockAvailable: product.stock,
      installedCustomers: installedCustomersQty,
      damagedOrDischarged,
      inObservation,
      inPersonnelEpp: inPersonnelEppQty,
    },
    movements: allMovements,
    purchases: allPurchases,
    installations: allInstallations,
    assignments: allAssignments,
  };
}

// ==========================================
// MÉTRICAS DE INVENTARIO
// ==========================================

export function getInventoryMetrics(tenantId: string): InventoryMetrics {
  const products = loadProducts(tenantId);
  const categories = loadCategories(tenantId);
  const assets = loadAssets(tenantId);

  const activeProducts = products.filter((p) => !p.isDeleted);
  const trashProducts = products.filter((p) => p.isDeleted);

  let totalValuation = 0;
  let criticalCount = 0;
  let lowCount = 0;
  let optimalCount = 0;
  let outOfStockCount = 0;

  activeProducts.forEach((p) => {
    if (p.type === "epp" && p.hasDifferentCostPerVariant && p.variants && p.variants.length > 0) {
      p.variants.forEach((v) => {
        const cost = v.costPrice !== undefined ? v.costPrice : p.baseCost;
        totalValuation += (Number(v.quantity) || 0) * (Number(cost) || 0);
      });
    } else {
      totalValuation += (Number(p.stock) || 0) * (Number(p.baseCost) || 0);
    }

    if (p.status === "out_of_stock") outOfStockCount++;
    else if (p.status === "critical") criticalCount++;
    else if (p.status === "low") lowCount++;
    else optimalCount++;
  });

  return {
    totalProducts: activeProducts.length,
    totalValuation: Math.round(totalValuation * 100) / 100,
    criticalStockCount: criticalCount,
    lowStockCount: lowCount,
    optimalStockCount: optimalCount,
    outOfStockCount: outOfStockCount,
    categoriesCount: categories.length,
    trashCount: trashProducts.length,
    assetsCount: assets.length,
  };
}
